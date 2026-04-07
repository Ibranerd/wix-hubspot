export interface TenantContext {
  tenantId: string;
  authSecret?: string;
  baseUrl: string;
}

async function request<T>(
  ctx: TenantContext,
  path: string,
  init?: RequestInit & { bodyJson?: unknown }
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('x-tenant-id', ctx.tenantId);
  if (ctx.authSecret) {
    headers.set('x-wix-auth', ctx.authSecret);
  }

  if (init?.bodyJson !== undefined) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(`${ctx.baseUrl}${path}`, {
    ...init,
    headers,
    body: init?.bodyJson !== undefined ? JSON.stringify(init.bodyJson) : init?.body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function createDashboardApi(ctx: TenantContext) {
  return {
    startHubspotConnect: () => request<{ authorizeUrl: string; state: string }>(ctx, '/api/hubspot/connect/start', {
      method: 'POST',
      bodyJson: { tenantId: ctx.tenantId }
    }),
    disconnectHubspot: () => request<void>(ctx, '/api/hubspot/disconnect', {
      method: 'POST',
      bodyJson: { tenantId: ctx.tenantId }
    }),
    getHubspotStatus: () =>
      request<{ status: string }>(ctx, `/api/hubspot/status?tenantId=${encodeURIComponent(ctx.tenantId)}`),

    getCatalog: () => request<{
      wixFields: Array<{ key: string; label: string; type: string }>;
      hubspotProperties: Array<{ key: string; label: string; type: string }>;
    }>(ctx, '/api/mappings/catalog'),

    getMappings: () =>
      request<{ mappingSet: unknown }>(ctx, `/api/mappings?tenantId=${encodeURIComponent(ctx.tenantId)}`),

    saveMappings: (rows: Array<Record<string, unknown>>) =>
      request<{ mappingSet: unknown }>(ctx, '/api/mappings', {
        method: 'PUT',
        bodyJson: {
          tenantId: ctx.tenantId,
          rows
        }
      }),

    getSyncStatus: () =>
      request<Record<string, unknown>>(ctx, `/api/sync/status?tenantId=${encodeURIComponent(ctx.tenantId)}`),

    getSyncLogs: (cursor?: number) => {
      const suffix = cursor !== undefined ? `&cursor=${cursor}` : '';
      return request<{ logs: Array<Record<string, unknown>>; nextCursor: number | null }>(
        ctx,
        `/api/sync/logs?tenantId=${encodeURIComponent(ctx.tenantId)}${suffix}`
      );
    }
  };
}
