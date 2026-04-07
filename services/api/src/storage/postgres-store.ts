import type { EncryptedTokenRecord, HubSpotConnection } from '../types/models.js';
import type { StoredFormEvent } from '../types/forms.js';
import type { FieldMappingSet } from '../types/mappings.js';
import type { ContactLink, ContactRecord, SyncAuditLog, SyncSource } from '../types/sync.js';
import type { QueueJob } from '../services/queue-contract.js';
import type { RuntimeStore } from './store-contract.js';

export class PostgresStore implements RuntimeStore {
  constructor(private readonly connectionString: string) {
    if (!connectionString) {
      throw new Error('POSTGRES_URL is required for PostgresStore');
    }
  }

  private unsupported(): never {
    throw new Error('PostgresStore is scaffolded but not yet wired in this branch');
  }

  getConnection(_tenantId: string): HubSpotConnection | undefined {
    return this.unsupported();
  }

  upsertConnection(_record: HubSpotConnection): void {
    return this.unsupported();
  }

  saveTokens(_record: EncryptedTokenRecord): void {
    return this.unsupported();
  }

  getTokens(_tenantId: string): EncryptedTokenRecord | undefined {
    return this.unsupported();
  }

  deleteTokens(_tenantId: string): void {
    return this.unsupported();
  }

  getActiveMappingSet(_tenantId: string): FieldMappingSet | undefined {
    return this.unsupported();
  }

  saveMappingSet(_nextSet: FieldMappingSet): void {
    return this.unsupported();
  }

  saveContact(_source: SyncSource, _contact: ContactRecord): void {
    return this.unsupported();
  }

  getContact(_source: SyncSource, _tenantId: string, _contactId: string): ContactRecord | undefined {
    return this.unsupported();
  }

  listContacts(_source: SyncSource, _tenantId: string): ContactRecord[] {
    return this.unsupported();
  }

  findContactByEmail(_source: SyncSource, _tenantId: string, _email: string): ContactRecord[] {
    return this.unsupported();
  }

  putContactLink(_link: ContactLink): void {
    return this.unsupported();
  }

  getContactLinkBySource(_source: SyncSource, _tenantId: string, _contactId: string): ContactLink | undefined {
    return this.unsupported();
  }

  addDedupeEvent(_dedupeKey: string, _expiresAt: string): void {
    return this.unsupported();
  }

  hasDedupeEvent(_dedupeKey: string): boolean {
    return this.unsupported();
  }

  addAuditLog(_log: SyncAuditLog): void {
    return this.unsupported();
  }

  getAuditLogs(_tenantId: string, _cursor?: number): { logs: SyncAuditLog[]; nextCursor: number | null } {
    return this.unsupported();
  }

  getSyncStatus(_tenantId: string): { connectionStatus: string; mappingVersion: number | null; auditCount: number } {
    return this.unsupported();
  }

  addFormEvent(_event: StoredFormEvent): void {
    return this.unsupported();
  }

  getFormEvents(_tenantId: string, _cursor?: number): { events: StoredFormEvent[]; nextCursor: number | null } {
    return this.unsupported();
  }

  addDeadLetterJob(_job: QueueJob<unknown>): void {
    return this.unsupported();
  }

  addRetry(_job: QueueJob<unknown>): void {
    return this.unsupported();
  }

  getDeadLetterJobs(): QueueJob<unknown>[] {
    return this.unsupported();
  }

  removeDeadLetterJob(_jobId: string): QueueJob<unknown> | undefined {
    return this.unsupported();
  }

  getMetrics(): { deadLetterCount: number; retryCount: number; auditCount: number; formEventCount: number } {
    return this.unsupported();
  }

  cleanupRetention(_retentionDays: { auditLogs: number; formEvents: number }): {
    removedExpiredDedupe: number;
    removedAuditLogs: number;
    removedFormEvents: number;
  } {
    return this.unsupported();
  }
}
