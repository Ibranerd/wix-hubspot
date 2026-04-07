export type SyncSource = 'wix' | 'hubspot';

export interface CorrelationContext {
  tenantId: string;
  correlationId: string;
  source: SyncSource;
}
