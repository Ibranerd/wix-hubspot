import type { TenantContext } from './api/client.js';
import { renderConnectView } from './views/connect-view.js';
import { renderMappingsView } from './views/mappings-view.js';
import { renderStatusView } from './views/status-view.js';

export async function renderDashboard(ctx: TenantContext): Promise<string> {
  const [connect, mappings, status] = await Promise.all([
    renderConnectView(ctx),
    renderMappingsView(ctx),
    renderStatusView(ctx)
  ]);

  return [connect, '', mappings, '', status].join('\n');
}
