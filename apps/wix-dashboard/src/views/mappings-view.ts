import { createDashboardApi, type TenantContext } from '../api/client.js';

export async function renderMappingsView(ctx: TenantContext): Promise<string> {
  const api = createDashboardApi(ctx);
  const [catalog, mappings] = await Promise.all([api.getCatalog(), api.getMappings()]);

  return [
    '## Field Mappings',
    `Wix fields: ${catalog.wixFields.length}`,
    `HubSpot properties: ${catalog.hubspotProperties.length}`,
    `Active mapping set present: ${Boolean(mappings.mappingSet)}`,
    'Actions:',
    '- Load current mappings with `getMappings()`',
    '- Save edited rows with `saveMappings(rows)`'
  ].join('\n');
}
