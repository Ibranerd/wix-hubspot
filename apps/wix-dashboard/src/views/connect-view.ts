import { createDashboardApi, type TenantContext } from '../api/client.js';

export async function renderConnectView(ctx: TenantContext): Promise<string> {
  const api = createDashboardApi(ctx);
  const status = await api.getHubspotStatus();

  return [
    '## HubSpot Connection',
    `Tenant: ${ctx.tenantId}`,
    `Status: ${status.status}`,
    'Actions:',
    '- Connect: call `startHubspotConnect()` and redirect to authorize URL',
    '- Disconnect: call `disconnectHubspot()`'
  ].join('\n');
}
