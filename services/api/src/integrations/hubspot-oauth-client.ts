import { randomUUID } from 'node:crypto';
import type { OAuthTokenSet } from '../types/models.js';

export interface HubSpotOAuthClient {
  exchangeCode(code: string): Promise<OAuthTokenSet & { portalId: string; scopes: string[] }>;
  refreshToken(refreshToken: string): Promise<OAuthTokenSet>;
  revokeToken(token: string): Promise<void>;
}

interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class HttpHubSpotOAuthClient implements HubSpotOAuthClient {
  constructor(private readonly config: OAuthClientConfig) {}

  async exchangeCode(code: string): Promise<OAuthTokenSet & { portalId: string; scopes: string[] }> {
    if (!code) {
      throw new Error('OAuth code is required');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      code
    });

    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body
    });

    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      hub_id?: number;
      scope?: string;
      message?: string;
    };

    if (!response.ok || !payload.access_token || !payload.refresh_token || !payload.expires_in) {
      throw new Error(`HubSpot OAuth exchange failed: ${payload.message || response.statusText}`);
    }

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: new Date(Date.now() + payload.expires_in * 1000).toISOString(),
      portalId: String(payload.hub_id || ''),
      scopes: payload.scope ? payload.scope.split(/\s+/).filter(Boolean) : []
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokenSet> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      refresh_token: refreshToken
    });

    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body
    });

    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      message?: string;
    };

    if (!response.ok || !payload.access_token || !payload.refresh_token || !payload.expires_in) {
      throw new Error(`HubSpot OAuth refresh failed: ${payload.message || response.statusText}`);
    }

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: new Date(Date.now() + payload.expires_in * 1000).toISOString()
    };
  }

  async revokeToken(token: string): Promise<void> {
    const body = new URLSearchParams({
      token,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    const response = await fetch('https://api.hubapi.com/oauth/v1/token/revoke', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body
    });

    if (!response.ok) {
      throw new Error(`HubSpot token revoke failed: ${response.statusText}`);
    }
  }
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

export function buildHubSpotOAuthClient(config: OAuthClientConfig, useMock: boolean): HubSpotOAuthClient {
  if (useMock) {
    return new MockHubSpotOAuthClient();
  }

  return new HttpHubSpotOAuthClient(config);
}
