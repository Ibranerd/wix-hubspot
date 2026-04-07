export type ConnectionStatus = 'connected' | 'disconnected';

export interface HubSpotConnection {
  tenantId: string;
  hubspotPortalId: string;
  status: ConnectionStatus;
  scopes: string[];
  connectedAt?: string;
  disconnectedAt?: string;
}

export interface EncryptedTokenRecord {
  tenantId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  expiresAt: string;
  rotatedAt: string;
}

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}
