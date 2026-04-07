import type { EncryptedTokenRecord, HubSpotConnection } from '../types/models.js';

export class InMemoryStore {
  private readonly connections = new Map<string, HubSpotConnection>();
  private readonly tokens = new Map<string, EncryptedTokenRecord>();

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
}
