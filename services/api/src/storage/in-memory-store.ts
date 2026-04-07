import type { EncryptedTokenRecord, HubSpotConnection } from '../types/models.js';
import type { FieldMappingSet } from '../types/mappings.js';

export class InMemoryStore {
  private readonly connections = new Map<string, HubSpotConnection>();
  private readonly tokens = new Map<string, EncryptedTokenRecord>();
  private readonly mappingSets = new Map<string, FieldMappingSet[]>();

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
}
