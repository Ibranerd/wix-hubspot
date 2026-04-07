import type { MappingRow } from './mappings.js';

export type SyncSource = 'wix' | 'hubspot';

export interface CanonicalContact {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  createdAt?: string;
  marketingOptIn?: boolean;
  sourceUpdatedAt?: string;
}

export interface ContactLink {
  tenantId: string;
  wixContactId: string;
  hubspotContactId: string;
  lastSyncSource: SyncSource;
  lastSyncAt: string;
  lastPayloadHash: string;
  lastCorrelationId: string;
  wixUpdatedAt?: string;
  hubspotUpdatedAt?: string;
}

export interface ContactEvent {
  tenantId: string;
  source: SyncSource;
  eventId?: string;
  contactId: string;
  correlationId?: string;
  occurredAt: string;
  payload: CanonicalContact;
}

export interface SyncAuditLog {
  id: string;
  tenantId: string;
  source: SyncSource;
  action: 'create' | 'update' | 'skip' | 'conflict_resolved';
  entityType: 'contact';
  entityId: string;
  result: 'success' | 'ignored' | 'failed';
  errorCode?: string;
  correlationId: string;
  createdAt: string;
  detail?: string;
}

export interface SyncResult {
  status: 'processed' | 'ignored';
  correlationId: string;
}

export interface ContactRecord {
  id: string;
  tenantId: string;
  updatedAt: string;
  fields: Record<string, unknown>;
}

export interface MappingSnapshot {
  rows: MappingRow[];
  version: number;
}
