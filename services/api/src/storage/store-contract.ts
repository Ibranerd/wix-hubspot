import type { EncryptedTokenRecord, HubSpotConnection } from '../types/models.js';
import type { StoredFormEvent } from '../types/forms.js';
import type { FieldMappingSet } from '../types/mappings.js';
import type { ContactLink, ContactRecord, SyncAuditLog, SyncSource } from '../types/sync.js';
import type { QueueJob } from '../services/job-queue.js';

export interface RuntimeStore {
  getConnection(tenantId: string): HubSpotConnection | undefined;
  upsertConnection(record: HubSpotConnection): void;

  saveTokens(record: EncryptedTokenRecord): void;
  getTokens(tenantId: string): EncryptedTokenRecord | undefined;
  deleteTokens(tenantId: string): void;

  getActiveMappingSet(tenantId: string): FieldMappingSet | undefined;
  saveMappingSet(nextSet: FieldMappingSet): void;

  saveContact(source: SyncSource, contact: ContactRecord): void;
  getContact(source: SyncSource, tenantId: string, contactId: string): ContactRecord | undefined;
  listContacts(source: SyncSource, tenantId: string): ContactRecord[];
  findContactByEmail(source: SyncSource, tenantId: string, email: string): ContactRecord[];

  putContactLink(link: ContactLink): void;
  getContactLinkBySource(source: SyncSource, tenantId: string, contactId: string): ContactLink | undefined;

  addDedupeEvent(dedupeKey: string, expiresAt: string): void;
  hasDedupeEvent(dedupeKey: string): boolean;

  addAuditLog(log: SyncAuditLog): void;
  getAuditLogs(tenantId: string, cursor?: number): { logs: SyncAuditLog[]; nextCursor: number | null };
  getSyncStatus(tenantId: string): { connectionStatus: string; mappingVersion: number | null; auditCount: number };

  addFormEvent(event: StoredFormEvent): void;
  getFormEvents(tenantId: string, cursor?: number): { events: StoredFormEvent[]; nextCursor: number | null };

  addDeadLetterJob(job: QueueJob<unknown>): void;
  addRetry(job: QueueJob<unknown>): void;
  getDeadLetterJobs(): QueueJob<unknown>[];
  removeDeadLetterJob(jobId: string): QueueJob<unknown> | undefined;

  getMetrics(): { deadLetterCount: number; retryCount: number; auditCount: number; formEventCount: number };

  cleanupRetention(retentionDays: { auditLogs: number; formEvents: number }): {
    removedExpiredDedupe: number;
    removedAuditLogs: number;
    removedFormEvents: number;
  };
}
