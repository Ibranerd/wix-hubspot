import { randomUUID } from 'node:crypto';
import { decryptSecret, encryptSecret } from '../security/token-crypto.js';
import type { HubSpotOAuthClient } from '../integrations/hubspot-oauth-client.js';
import type { OAuthTokenSet } from '../types/models.js';
import { InMemoryStore } from '../storage/in-memory-store.js';

interface ServiceConfig {
  appBaseUrl: string;
  redirectUri: string;
  hubspotClientId: string;
  encryptionMasterKey: string;
}

export class HubSpotConnectionService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly oauthClient: HubSpotOAuthClient,
    private readonly config: ServiceConfig
  ) {}

  startConnection(tenantId: string): { authorizeUrl: string; state: string } {
    const nonce = randomUUID();
    const state = `${tenantId}:${nonce}`;
    const query = new URLSearchParams({
      client_id: this.config.hubspotClientId,
      redirect_uri: this.config.redirectUri,
      scope: 'crm.objects.contacts.read crm.objects.contacts.write',
      state
    });

    return {
      state,
      authorizeUrl: `https://app.hubspot.com/oauth/authorize?${query.toString()}`
    };
  }

  async handleCallback(code: string, state: string): Promise<{ connected: true; tenantId: string }> {
    const [tenantId] = state.split(':');
    if (!tenantId) {
      throw new Error('Invalid OAuth state');
    }

    const tokens = await this.oauthClient.exchangeCode(code);
    this.saveEncryptedTokens(tenantId, tokens);

    this.store.upsertConnection({
      tenantId,
      hubspotPortalId: tokens.portalId,
      status: 'connected',
      scopes: tokens.scopes,
      connectedAt: new Date().toISOString(),
      disconnectedAt: undefined
    });

    return { connected: true, tenantId };
  }

  async disconnect(tenantId: string): Promise<void> {
    const tokenRecord = this.store.getTokens(tenantId);
    if (tokenRecord) {
      const rawAccessToken = decryptSecret(tokenRecord.encryptedAccessToken, this.config.encryptionMasterKey);
      await this.oauthClient.revokeToken(rawAccessToken);
    }

    this.store.deleteTokens(tenantId);
    const existing = this.store.getConnection(tenantId);

    if (existing) {
      this.store.upsertConnection({
        ...existing,
        status: 'disconnected',
        disconnectedAt: new Date().toISOString()
      });
    }
  }

  async refreshIfNeeded(tenantId: string): Promise<void> {
    const tokenRecord = this.store.getTokens(tenantId);
    if (!tokenRecord) {
      throw new Error('No token record found for tenant');
    }

    const expiresAt = new Date(tokenRecord.expiresAt).getTime();
    const now = Date.now();
    const refreshWindowMs = 5 * 60 * 1000;
    if (expiresAt - now > refreshWindowMs) {
      return;
    }

    const refreshToken = decryptSecret(tokenRecord.encryptedRefreshToken, this.config.encryptionMasterKey);
    const nextTokens = await this.oauthClient.refreshToken(refreshToken);
    this.saveEncryptedTokens(tenantId, nextTokens);
  }

  getConnectionStatus(tenantId: string): { status: string } {
    const connection = this.store.getConnection(tenantId);
    return { status: connection?.status ?? 'disconnected' };
  }

  private saveEncryptedTokens(tenantId: string, tokens: OAuthTokenSet): void {
    this.store.saveTokens({
      tenantId,
      encryptedAccessToken: encryptSecret(tokens.accessToken, this.config.encryptionMasterKey),
      encryptedRefreshToken: encryptSecret(tokens.refreshToken, this.config.encryptionMasterKey),
      expiresAt: tokens.expiresAt,
      rotatedAt: new Date().toISOString()
    });
  }
}
