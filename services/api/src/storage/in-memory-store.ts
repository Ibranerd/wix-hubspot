import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EncryptedTokenRecord, HubSpotConnection } from '../types/models.js';
import type { FieldMappingSet } from '../types/mappings.js';
import type { ContactLink, ContactRecord, SyncAuditLog, SyncSource } from '../types/sync.js';
import type { StoredFormEvent } from '../types/forms.js';
import type { QueueJob } from '../services/job-queue.js';

interface PersistedState {
  connections: Record<string, HubSpotConnection>;
  tokens: Record<string, EncryptedTokenRecord>;
  mappingSets: Record<string, FieldMappingSet[]>;
  wixContacts: Record<string, ContactRecord>;
  hubspotContacts: Record<string, ContactRecord>;
  contactLinksByWix: Record<string, ContactLink>;
  contactLinksByHubspot: Record<string, ContactLink>;
  eventDedupe: Record<string, string>;
  auditLogs: SyncAuditLog[];
  formEvents: StoredFormEvent[];
  deadLetterJobs: QueueJob<unknown>[];
  queueRetries: QueueJob<unknown>[];
}

const INITIAL_STATE: PersistedState = {
  connections: {},
  tokens: {},
  mappingSets: {},
  wixContacts: {},
  hubspotContacts: {},
  contactLinksByWix: {},
  contactLinksByHubspot: {},
  eventDedupe: {},
  auditLogs: [],
  formEvents: [],
  deadLetterJobs: [],
  queueRetries: []
};

export class InMemoryStore {
  private readonly statePath: string;

  constructor(dataDir = process.env.DATA_DIR || '.data') {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.statePath = join(dataDir, 'state.json');
    if (!existsSync(this.statePath)) {
      this.writeState(INITIAL_STATE);
    }
  }

  getConnection(tenantId: string): HubSpotConnection | undefined {
    const state = this.readState();
    return state.connections[tenantId];
  }

  upsertConnection(record: HubSpotConnection): void {
    this.mutate((state) => {
      state.connections[record.tenantId] = record;
    });
  }

  saveTokens(record: EncryptedTokenRecord): void {
    this.mutate((state) => {
      state.tokens[record.tenantId] = record;
    });
  }

  getTokens(tenantId: string): EncryptedTokenRecord | undefined {
    const state = this.readState();
    return state.tokens[tenantId];
  }

  deleteTokens(tenantId: string): void {
    this.mutate((state) => {
      delete state.tokens[tenantId];
    });
  }

  getActiveMappingSet(tenantId: string): FieldMappingSet | undefined {
    const state = this.readState();
    const sets = state.mappingSets[tenantId] || [];
    return sets.find((set) => set.isActive);
  }

  saveMappingSet(nextSet: FieldMappingSet): void {
    this.mutate((state) => {
      const sets = state.mappingSets[nextSet.tenantId] || [];
      const previousInactive = sets.map((set) => ({ ...set, isActive: false }));
      state.mappingSets[nextSet.tenantId] = [...previousInactive, nextSet];
    });
  }

  saveContact(source: SyncSource, contact: ContactRecord): void {
    const key = this.contactKey(contact.tenantId, contact.id);
    this.mutate((state) => {
      if (source === 'wix') {
        state.wixContacts[key] = contact;
        return;
      }

      state.hubspotContacts[key] = contact;
    });
  }

  getContact(source: SyncSource, tenantId: string, contactId: string): ContactRecord | undefined {
    const state = this.readState();
    const key = this.contactKey(tenantId, contactId);
    return source === 'wix' ? state.wixContacts[key] : state.hubspotContacts[key];
  }

  listContacts(source: SyncSource, tenantId: string): ContactRecord[] {
    const state = this.readState();
    const sourceMap = source === 'wix' ? state.wixContacts : state.hubspotContacts;
    return Object.values(sourceMap).filter((contact) => contact.tenantId === tenantId);
  }

  findContactByEmail(source: SyncSource, tenantId: string, email: string): ContactRecord[] {
    const normalizedEmail = email.toLowerCase();
    const sourceContacts = this.listContacts(source, tenantId);

    return sourceContacts.filter((contact) => {
      const candidate = contact.fields.email;
      return typeof candidate === 'string' && candidate.toLowerCase() === normalizedEmail;
    });
  }

  putContactLink(link: ContactLink): void {
    const wixKey = this.contactKey(link.tenantId, link.wixContactId);
    const hubspotKey = this.contactKey(link.tenantId, link.hubspotContactId);
    this.mutate((state) => {
      state.contactLinksByWix[wixKey] = link;
      state.contactLinksByHubspot[hubspotKey] = link;
    });
  }

  getContactLinkBySource(source: SyncSource, tenantId: string, contactId: string): ContactLink | undefined {
    const state = this.readState();
    const key = this.contactKey(tenantId, contactId);
    return source === 'wix' ? state.contactLinksByWix[key] : state.contactLinksByHubspot[key];
  }

  addDedupeEvent(dedupeKey: string, expiresAt: string): void {
    this.mutate((state) => {
      state.eventDedupe[dedupeKey] = expiresAt;
    });
  }

  hasDedupeEvent(dedupeKey: string): boolean {
    const state = this.readState();
    const expiresAt = state.eventDedupe[dedupeKey];
    if (!expiresAt) {
      return false;
    }

    if (new Date(expiresAt).getTime() < Date.now()) {
      this.mutate((next) => {
        delete next.eventDedupe[dedupeKey];
      });
      return false;
    }

    return true;
  }

  addAuditLog(log: SyncAuditLog): void {
    this.mutate((state) => {
      state.auditLogs.push(log);
    });
  }

  getAuditLogs(tenantId: string, cursor?: number): { logs: SyncAuditLog[]; nextCursor: number | null } {
    const state = this.readState();
    const filtered = state.auditLogs.filter((entry) => entry.tenantId === tenantId);
    const start = cursor && cursor > 0 ? cursor : 0;
    const page = filtered.slice(start, start + 50);
    const nextCursor = start + page.length < filtered.length ? start + page.length : null;
    return { logs: page, nextCursor };
  }

  getSyncStatus(tenantId: string): { connectionStatus: string; mappingVersion: number | null; auditCount: number } {
    const state = this.readState();
    const connection = state.connections[tenantId];
    const mappingSet = state.mappingSets[tenantId]?.find((set) => set.isActive);
    const auditCount = state.auditLogs.filter((entry) => entry.tenantId === tenantId).length;

    return {
      connectionStatus: connection?.status ?? 'disconnected',
      mappingVersion: mappingSet?.version ?? null,
      auditCount
    };
  }

  addFormEvent(event: StoredFormEvent): void {
    this.mutate((state) => {
      state.formEvents.push(event);
    });
  }

  getFormEvents(tenantId: string, cursor?: number): { events: StoredFormEvent[]; nextCursor: number | null } {
    const state = this.readState();
    const filtered = state.formEvents.filter((entry) => entry.tenantId === tenantId);
    const start = cursor && cursor > 0 ? cursor : 0;
    const page = filtered.slice(start, start + 50);
    const nextCursor = start + page.length < filtered.length ? start + page.length : null;
    return { events: page, nextCursor };
  }

  addDeadLetterJob(job: QueueJob<unknown>): void {
    this.mutate((state) => {
      state.deadLetterJobs.push(job);
    });
  }

  addRetry(job: QueueJob<unknown>): void {
    this.mutate((state) => {
      state.queueRetries.push(job);
    });
  }

  getDeadLetterJobs(): QueueJob<unknown>[] {
    const state = this.readState();
    return [...state.deadLetterJobs];
  }

  removeDeadLetterJob(jobId: string): QueueJob<unknown> | undefined {
    let removed: QueueJob<unknown> | undefined;
    this.mutate((state) => {
      const index = state.deadLetterJobs.findIndex((job) => job.id === jobId);
      if (index < 0) {
        return;
      }

      const [job] = state.deadLetterJobs.splice(index, 1);
      removed = job;
    });
    return removed;
  }

  getMetrics(): { deadLetterCount: number; retryCount: number; auditCount: number; formEventCount: number } {
    const state = this.readState();
    return {
      deadLetterCount: state.deadLetterJobs.length,
      retryCount: state.queueRetries.length,
      auditCount: state.auditLogs.length,
      formEventCount: state.formEvents.length
    };
  }

  private contactKey(tenantId: string, contactId: string): string {
    return `${tenantId}:${contactId}`;
  }

  private mutate(mutator: (state: PersistedState) => void): void {
    const state = this.readState();
    mutator(state);
    this.writeState(state);
  }

  private readState(): PersistedState {
    try {
      const raw = readFileSync(this.statePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedState;
      return {
        ...INITIAL_STATE,
        ...parsed
      };
    } catch {
      return { ...INITIAL_STATE };
    }
  }

  private writeState(state: PersistedState): void {
    const tempPath = `${this.statePath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf8');
    renameSync(tempPath, this.statePath);
  }
}
