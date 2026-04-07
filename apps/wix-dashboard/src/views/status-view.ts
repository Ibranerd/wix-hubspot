import { createDashboardApi, type TenantContext } from '../api/client.js';

export async function renderStatusView(ctx: TenantContext): Promise<string> {
  const api = createDashboardApi(ctx);
  const [status, logs] = await Promise.all([api.getSyncStatus(), api.getSyncLogs()]);

  return [
    '## Sync Status',
    `Connection status: ${String(status.connectionStatus || 'unknown')}`,
    `Active mapping version: ${String(status.mappingVersion ?? 'none')}`,
    `Audit count: ${String(status.auditCount ?? 0)}`,
    `Latest logs loaded: ${logs.logs.length}`,
    `Next cursor: ${String(logs.nextCursor)}`
  ].join('\n');
}
