import type { EncryptedTokenRecord, HubSpotConnection } from '../types/models.js';
import type { FieldMappingSet } from '../types/mappings.js';
import type { ContactLink, ContactRecord, SyncAuditLog, SyncSource } from '../types/sync.js';
import type { StoredFormEvent } from '../types/forms.js';
import type { QueueJob } from '../services/job-queue.js';

export class InMemoryStore {
  private readonly connections = new Map<string, HubSpotConnection>();
  private readonly tokens = new Map<string, EncryptedTokenRecord>();
  private readonly mappingSets = new Map<string, FieldMappingSet[]>();
  private readonly wixContacts = new Map<string, ContactRecord>();
  private readonly hubspotContacts = new Map<string, ContactRecord>();
  private readonly contactLinksByWix = new Map<string, ContactLink>();
  private readonly contactLinksByHubspot = new Map<string, ContactLink>();
  private readonly eventDedupe = new Map<string, string>();
  private readonly auditLogs: SyncAuditLog[] = [];
  private readonly formEvents: StoredFormEvent[] = [];
  private readonly deadLetterJobs: QueueJob<unknown>[] = [];
  private readonly queueRetries: QueueJob<unknown>[] = [];

  getConnection(tenantId: string): HubSpotConnection | undefined {
    return this.connections.get(tenantId);
  }

  upsertConnection(record: HubSpotConnection): void {
    this.connections.set(record.tenantId, record);
  }

  saveTokens(record: EncryptedTokenRecord): void {
    this.tokens.set(record.tenantId, record);
  }

  getTokens(tenantId: string): EncryptedTokenRecord | undefined {
    return this.tokens.get(tenantId);
  }

  deleteTokens(tenantId: string): void {
    this.tokens.delete(tenantId);
  }

  getActiveMappingSet(tenantId: string): FieldMappingSet | undefined {
    const sets = this.mappingSets.get(tenantId) || [];
    return sets.find((set) => set.isActive);
  }

  saveMappingSet(nextSet: FieldMappingSet): void {
    const sets = this.mappingSets.get(nextSet.tenantId) || [];
    const previousInactive = sets.map((set) => ({ ...set, isActive: false }));
    this.mappingSets.set(nextSet.tenantId, [...previousInactive, nextSet]);
  }

  saveContact(source: SyncSource, contact: ContactRecord): void {
    const key = this.contactKey(contact.tenantId, contact.id);
    if (source === 'wix') {
      this.wixContacts.set(key, contact);
      return;
    }

    this.hubspotContacts.set(key, contact);
  }

  getContact(source: SyncSource, tenantId: string, contactId: string): ContactRecord | undefined {
    const key = this.contactKey(tenantId, contactId);
    return source === 'wix' ? this.wixContacts.get(key) : this.hubspotContacts.get(key);
  }

  findContactByEmail(source: SyncSource, tenantId: string, email: string): ContactRecord[] {
    const map = source === 'wix' ? this.wixContacts : this.hubspotContacts;
    const normalizedEmail = email.toLowerCase();
    const records: ContactRecord[] = [];

    for (const contact of map.values()) {
      if (contact.tenantId !== tenantId) {
        continue;
      }

      const candidate = contact.fields.email?.toLowerCase();
      if (candidate === normalizedEmail) {
        records.push(contact);
      }
    }

    return records;
  }

  putContactLink(link: ContactLink): void {
    const wixKey = this.contactKey(link.tenantId, link.wixContactId);
    const hubspotKey = this.contactKey(link.tenantId, link.hubspotContactId);
    this.contactLinksByWix.set(wixKey, link);
    this.contactLinksByHubspot.set(hubspotKey, link);
  }

  getContactLinkBySource(source: SyncSource, tenantId: string, contactId: string): ContactLink | undefined {
    const key = this.contactKey(tenantId, contactId);
    return source === 'wix' ? this.contactLinksByWix.get(key) : this.contactLinksByHubspot.get(key);
  }

  addDedupeEvent(dedupeKey: string, expiresAt: string): void {
    this.eventDedupe.set(dedupeKey, expiresAt);
  }

  hasDedupeEvent(dedupeKey: string): boolean {
    const expiresAt = this.eventDedupe.get(dedupeKey);
    if (!expiresAt) {
      return false;
    }

    if (new Date(expiresAt).getTime() < Date.now()) {
      this.eventDedupe.delete(dedupeKey);
      return false;
    }

    return true;
  }

  addAuditLog(log: SyncAuditLog): void {
    this.auditLogs.push(log);
  }

  getAuditLogs(tenantId: string, cursor?: number): { logs: SyncAuditLog[]; nextCursor: number | null } {
    const filtered = this.auditLogs.filter((entry) => entry.tenantId === tenantId);
    const start = cursor && cursor > 0 ? cursor : 0;
    const page = filtered.slice(start, start + 50);
    const nextCursor = start + page.length < filtered.length ? start + page.length : null;
    return { logs: page, nextCursor };
  }

  getSyncStatus(tenantId: string): { connectionStatus: string; mappingVersion: number | null; auditCount: number } {
    const connection = this.getConnection(tenantId);
    const mapping = this.getActiveMappingSet(tenantId);
    const auditCount = this.auditLogs.filter((entry) => entry.tenantId === tenantId).length;
    return {
      connectionStatus: connection?.status ?? 'disconnected',
      mappingVersion: mapping?.version ?? null,
      auditCount
    };
  }

  addFormEvent(event: StoredFormEvent): void {
    this.formEvents.push(event);
  }

  addDeadLetterJob(job: QueueJob<unknown>): void {
    this.deadLetterJobs.push(job);
  }

  addRetry(job: QueueJob<unknown>): void {
    this.queueRetries.push(job);
  }

  getDeadLetterJobs(): QueueJob<unknown>[] {
    return [...this.deadLetterJobs];
  }

  removeDeadLetterJob(jobId: string): QueueJob<unknown> | undefined {
    const index = this.deadLetterJobs.findIndex((job) => job.id === jobId);
    if (index < 0) {
      return undefined;
    }

    const [job] = this.deadLetterJobs.splice(index, 1);
    return job;
  }

  getMetrics(): { deadLetterCount: number; retryCount: number; auditCount: number; formEventCount: number } {
    return {
      deadLetterCount: this.deadLetterJobs.length,
      retryCount: this.queueRetries.length,
      auditCount: this.auditLogs.length,
      formEventCount: this.formEvents.length
    };
  }

  private contactKey(tenantId: string, contactId: string): string {
    return `${tenantId}:${contactId}`;
  }
}
