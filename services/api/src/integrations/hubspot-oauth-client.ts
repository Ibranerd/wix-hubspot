import { randomUUID } from 'node:crypto';
import type { OAuthTokenSet } from '../types/models.js';

export interface HubSpotOAuthClient {
  exchangeCode(code: string): Promise<OAuthTokenSet & { portalId: string; scopes: string[] }>;
  refreshToken(refreshToken: string): Promise<OAuthTokenSet>;
  revokeToken(token: string): Promise<void>;
}

export class MockHubSpotOAuthClient implements HubSpotOAuthClient {
  async exchangeCode(code: string): Promise<OAuthTokenSet & { portalId: string; scopes: string[] }> {
    if (!code) {
      throw new Error('OAuth code is required');
    }

    const now = Date.now();
    return {
      accessToken: `access_${randomUUID()}`,
      refreshToken: `refresh_${randomUUID()}`,
      expiresAt: new Date(now + 60 * 60 * 1000).toISOString(),
      portalId: `portal_${code.slice(0, 8)}`,
      scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write']
    };
  }

  async refreshToken(_refreshToken: string): Promise<OAuthTokenSet> {
    const now = Date.now();
    return {
      accessToken: `access_${randomUUID()}`,
      refreshToken: `refresh_${randomUUID()}`,
      expiresAt: new Date(now + 60 * 60 * 1000).toISOString()
    };
  }

  async revokeToken(_token: string): Promise<void> {
    return;
  }
}
