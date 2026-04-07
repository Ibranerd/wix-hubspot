import { createHash, randomUUID } from 'node:crypto';
import type { RuntimeStore } from '../storage/store-contract.js';
import type { MappingRow } from '../types/mappings.js';
import type {
  CanonicalContact,
  ContactEvent,
  ContactLink,
  ContactRecord,
  SyncAuditLog,
  SyncResult,
  SyncSource
} from '../types/sync.js';

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

export class SyncService {
  constructor(private readonly store: RuntimeStore) {}

  processContactEvent(event: ContactEvent): SyncResult {
    const correlationId = event.correlationId || randomUUID();
    const dedupeKey = this.buildDedupeKey(event);
    if (this.store.hasDedupeEvent(dedupeKey)) {
      this.audit({
        tenantId: event.tenantId,
        source: event.source,
        action: 'skip',
        entityType: 'contact',
        entityId: event.contactId,
        result: 'ignored',
        correlationId,
        detail: 'duplicate_event'
      });
      return { status: 'ignored', correlationId };
    }

    const mappingSet = this.store.getActiveMappingSet(event.tenantId);
    if (!mappingSet) {
      throw new Error('No active mapping set found for tenant');
    }

    const sourceRecord = this.upsertSourceContact(event);
    const link = this.resolveLink(event, sourceRecord);
    const targetSource: SyncSource = event.source === 'wix' ? 'hubspot' : 'wix';

    const targetFields = this.applyMappings(event.source, event.payload, mappingSet.rows);
    const payloadHash = hashPayload(targetFields);

    if (payloadHash === link.lastPayloadHash && event.source === link.lastSyncSource) {
      this.store.addDedupeEvent(dedupeKey, new Date(Date.now() + DEDUPE_WINDOW_MS).toISOString());
      this.audit({
        tenantId: event.tenantId,
        source: event.source,
        action: 'skip',
        entityType: 'contact',
        entityId: event.contactId,
        result: 'ignored',
        correlationId,
        detail: 'payload_hash_match'
      });
      return { status: 'ignored', correlationId };
    }

    const targetUpdatedAt = targetSource === 'hubspot' ? link.hubspotUpdatedAt : link.wixUpdatedAt;
    const winner = this.resolveConflict(event.payload.sourceUpdatedAt, targetUpdatedAt, event.source);
    if (winner !== event.source) {
      this.audit({
        tenantId: event.tenantId,
        source: event.source,
        action: 'conflict_resolved',
        entityType: 'contact',
        entityId: event.contactId,
        result: 'ignored',
        correlationId,
        detail: 'target_won_last_updated'
      });
      return { status: 'ignored', correlationId };
    }

    const targetId = targetSource === 'hubspot' ? link.hubspotContactId : link.wixContactId;
    this.store.saveContact(targetSource, {
      id: targetId,
      tenantId: event.tenantId,
      updatedAt: new Date().toISOString(),
      fields: {
        ...targetFields,
        sourceUpdatedAt: event.payload.sourceUpdatedAt || event.occurredAt
      }
    });

    const nextLink: ContactLink = {
      ...link,
      lastSyncAt: new Date().toISOString(),
      lastSyncSource: event.source,
      lastCorrelationId: correlationId,
      lastPayloadHash: payloadHash,
      wixUpdatedAt:
        event.source === 'wix'
          ? event.payload.sourceUpdatedAt || event.occurredAt
          : link.wixUpdatedAt || event.occurredAt,
      hubspotUpdatedAt:
        event.source === 'hubspot'
          ? event.payload.sourceUpdatedAt || event.occurredAt
          : link.hubspotUpdatedAt || event.occurredAt
    };

    this.store.putContactLink(nextLink);
    this.store.addDedupeEvent(dedupeKey, new Date(Date.now() + DEDUPE_WINDOW_MS).toISOString());
    this.audit({
      tenantId: event.tenantId,
      source: event.source,
      action: 'update',
      entityType: 'contact',
      entityId: event.contactId,
      result: 'success',
      correlationId,
      detail: `synced_to_${targetSource}`
    });

    return { status: 'processed', correlationId };
  }

  private upsertSourceContact(event: ContactEvent): ContactRecord {
    const sourceContact: ContactRecord = {
      id: event.contactId,
      tenantId: event.tenantId,
      updatedAt: event.payload.sourceUpdatedAt || event.occurredAt,
      fields: { ...event.payload }
    };

    this.store.saveContact(event.source, sourceContact);
    return sourceContact;
  }

  private resolveLink(event: ContactEvent, sourceRecord: ContactRecord): ContactLink {
    const existing = this.store.getContactLinkBySource(event.source, event.tenantId, event.contactId);
    if (existing) {
      return existing;
    }

    const targetSource: SyncSource = event.source === 'wix' ? 'hubspot' : 'wix';
    const email = asString(sourceRecord.fields.email);
    let matchedTargetId: string | undefined;

    if (email) {
      const matches = this.store.findContactByEmail(targetSource, event.tenantId, email);
      if (matches.length === 1) {
        matchedTargetId = matches[0].id;
      }

      if (matches.length > 1) {
        throw new Error('ambiguous_match');
      }
    }

    if (!matchedTargetId) {
      matchedTargetId = `${targetSource}_${randomUUID()}`;
      this.store.saveContact(targetSource, {
        id: matchedTargetId,
        tenantId: event.tenantId,
        updatedAt: event.occurredAt,
        fields: {}
      });
    }

    const link: ContactLink = {
      tenantId: event.tenantId,
      wixContactId: event.source === 'wix' ? event.contactId : matchedTargetId,
      hubspotContactId: event.source === 'hubspot' ? event.contactId : matchedTargetId,
      lastSyncSource: event.source,
      lastSyncAt: event.occurredAt,
      lastPayloadHash: '',
      lastCorrelationId: event.correlationId || randomUUID(),
      wixUpdatedAt: event.source === 'wix' ? sourceRecord.updatedAt : undefined,
      hubspotUpdatedAt: event.source === 'hubspot' ? sourceRecord.updatedAt : undefined
    };

    this.store.putContactLink(link);
    this.audit({
      tenantId: event.tenantId,
      source: event.source,
      action: 'create',
      entityType: 'contact',
      entityId: event.contactId,
      result: 'success',
      correlationId: link.lastCorrelationId,
      detail: 'contact_link_created'
    });

    return link;
  }

  private resolveConflict(
    sourceUpdatedAt: string | undefined,
    targetUpdatedAt: string | undefined,
    source: SyncSource
  ): SyncSource {
    if (sourceUpdatedAt && targetUpdatedAt) {
      const sourceTime = new Date(sourceUpdatedAt).getTime();
      const targetTime = new Date(targetUpdatedAt).getTime();

      if (sourceTime > targetTime) {
        return source;
      }

      if (sourceTime < targetTime) {
        return source === 'wix' ? 'hubspot' : 'wix';
      }

      return 'hubspot';
    }

    if (sourceUpdatedAt && !targetUpdatedAt) {
      return source;
    }

    if (!sourceUpdatedAt && targetUpdatedAt) {
      return source === 'wix' ? 'hubspot' : 'wix';
    }

    return 'hubspot';
  }

  private applyMappings(source: SyncSource, payload: CanonicalContact, mappings: MappingRow[]): CanonicalContact {
    const transformed: Record<string, unknown> = {};

    for (const mapping of mappings) {
      if (!mapping.enabled) {
        continue;
      }

      const allowed =
        (source === 'wix' && (mapping.direction === 'wix_to_hubspot' || mapping.direction === 'bidirectional')) ||
        (source === 'hubspot' && (mapping.direction === 'hubspot_to_wix' || mapping.direction === 'bidirectional'));

      if (!allowed) {
        continue;
      }

      const rawValue = payload[mapping.wixFieldKey as keyof CanonicalContact];
      if (rawValue === undefined || rawValue === null) {
        continue;
      }

      transformed[mapping.wixFieldKey] =
        typeof rawValue === 'string' ? applyTransform(rawValue, mapping.transform) : rawValue;
    }

    return transformed as CanonicalContact;
  }

  private buildDedupeKey(event: ContactEvent): string {
    if (event.eventId) {
      return `${event.tenantId}:${event.source}:${event.eventId}`;
    }

    const bucket = Math.floor(new Date(event.occurredAt).getTime() / 1000);
    return `${event.tenantId}:${event.source}:${event.contactId}:${bucket}`;
  }

  private audit(log: Omit<SyncAuditLog, 'id' | 'createdAt'>): void {
    this.store.addAuditLog({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...log
    });
  }
}

function hashPayload(value: CanonicalContact): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function applyTransform(value: string, transform: 'none' | 'trim' | 'lowercase'): string {
  if (transform === 'trim') {
    return value.trim();
  }

  if (transform === 'lowercase') {
    return value.toLowerCase();
  }

  return value;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
