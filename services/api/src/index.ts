import { createServer } from 'node:http';
import { HubSpotConnectionService } from './services/hubspot-connection-service.js';
import { readJson } from './http/json.js';
import { MappingService } from './services/mapping-service.js';
import type { MappingRowInput } from './types/mappings.js';
import { readRawBody } from './http/raw.js';
import { parseContactWebhookBody, parseFormWebhookBody } from './http/validators.js';
import { verifySimpleSignature } from './security/signature.js';
import type { ContactEvent, ContactRecord, SyncSource } from './types/sync.js';
import { logError, logInfo } from './utils/logger.js';
import { buildHubSpotOAuthClient } from './integrations/hubspot-oauth-client.js';
import { createRuntimeQueue, createRuntimeStore } from './services/runtime-factory.js';
import type { RuntimeQueue } from './services/queue-contract.js';
import { captureException, initObservability, observabilityState } from './observability/runtime.js';

const port = Number(process.env.API_PORT || 8080);
const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;
const redirectUri = process.env.HUBSPOT_REDIRECT_URI || `${appBaseUrl}/api/hubspot/oauth/callback`;
const hubspotClientId = process.env.HUBSPOT_CLIENT_ID || 'local-dev-client-id';
const hubspotClientSecret = process.env.HUBSPOT_CLIENT_SECRET || 'local-dev-client-secret';
const encryptionMasterKey = process.env.ENCRYPTION_MASTER_KEY || 'local-dev-master-key';
const wixWebhookSecret = process.env.WIX_WEBHOOK_SECRET || 'local-wix-secret';
const hubspotWebhookSecret = process.env.HUBSPOT_WEBHOOK_SECRET || 'local-hubspot-secret';
const adminToken = process.env.ADMIN_API_TOKEN || 'local-admin-token';
const dataDir = process.env.DATA_DIR || '.data';
const useMockHubspotOAuth = process.env.HUBSPOT_USE_MOCK_OAUTH !== 'false';
const wixDashboardAuthSecret = process.env.WIX_DASHBOARD_AUTH_SECRET || '';
const storeBackend = (process.env.STORE_BACKEND || 'file') as 'file' | 'postgres';
const queueBackend = (process.env.QUEUE_BACKEND || 'file') as 'file' | 'bullmq';
const postgresUrl = process.env.POSTGRES_URL || '';
const redisUrl = process.env.REDIS_URL || '';
const sentryDsn = process.env.SENTRY_DSN || '';
const otelExporterOtlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '';

const store = createRuntimeStore({
  dataDir,
  backend: storeBackend,
  postgresUrl
});

const oauthClient = buildHubSpotOAuthClient(
  {
    clientId: hubspotClientId,
    clientSecret: hubspotClientSecret,
    redirectUri
  },
  useMockHubspotOAuth
);

const mappingService = new MappingService(store);
const queue = createRuntimeQueue({
  dataDir,
  backend: queueBackend,
  redisUrl
});

const connectionService = new HubSpotConnectionService(store, oauthClient, {
  appBaseUrl,
  redirectUri,
  hubspotClientId,
  encryptionMasterKey
});

void initObservability({
  serviceName: 'wix-hubspot-api',
  sentryDsn,
  otelExporterOtlpEndpoint,
  environment: process.env.NODE_ENV || 'development'
});

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', appBaseUrl);

    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, { ok: true, service: 'api' });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/hubspot/connect/start') {
      const tenantHeader = requireTenantHeader(req, res, wixDashboardAuthSecret);
      if (!tenantHeader) {
        return;
      }

      const body = await readJson<{ tenantId: string }>(req);
      if (!body.tenantId) {
        json(res, 400, { error: 'tenantId is required' });
        return;
      }
      if (!enforceTenantMatch(res, tenantHeader, body.tenantId)) {
        return;
      }

      const payload = connectionService.startConnection(body.tenantId);
      json(res, 200, payload);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/hubspot/oauth/callback') {
      const code = url.searchParams.get('code') || '';
      const state = url.searchParams.get('state') || '';
      const result = await connectionService.handleCallback(code, state);
      json(res, 200, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/hubspot/disconnect') {
      const tenantHeader = requireTenantHeader(req, res, wixDashboardAuthSecret);
      if (!tenantHeader) {
        return;
      }

      const body = await readJson<{ tenantId: string }>(req);
      if (!body.tenantId) {
        json(res, 400, { error: 'tenantId is required' });
        return;
      }
      if (!enforceTenantMatch(res, tenantHeader, body.tenantId)) {
        return;
      }

      await connectionService.disconnect(body.tenantId);
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/hubspot/status') {
      const tenantHeader = requireTenantHeader(req, res, wixDashboardAuthSecret);
      if (!tenantHeader) {
        return;
      }

      const tenantId = url.searchParams.get('tenantId') || '';
      if (!tenantId) {
        json(res, 400, { error: 'tenantId is required' });
        return;
      }
      if (!enforceTenantMatch(res, tenantHeader, tenantId)) {
        return;
      }

      await connectionService.refreshIfNeeded(tenantId);
      const status = connectionService.getConnectionStatus(tenantId);
      json(res, 200, status);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/mappings/catalog') {
      const catalog = mappingService.getCatalog();
      json(res, 200, catalog);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/mappings') {
      const tenantHeader = requireTenantHeader(req, res, wixDashboardAuthSecret);
      if (!tenantHeader) {
        return;
      }

      const tenantId = url.searchParams.get('tenantId') || '';
      if (!tenantId) {
        json(res, 400, { error: 'tenantId is required' });
        return;
      }
      if (!enforceTenantMatch(res, tenantHeader, tenantId)) {
        return;
      }

      const mappingSet = mappingService.getActiveMappingSet(tenantId);
      json(res, 200, { mappingSet });
      return;
    }

    if (req.method === 'PUT' && url.pathname === '/api/mappings') {
      const tenantHeader = requireTenantHeader(req, res, wixDashboardAuthSecret);
      if (!tenantHeader) {
        return;
      }

      const body = await readJson<{ tenantId: string; rows: MappingRowInput[] }>(req);
      if (!body.tenantId) {
        json(res, 400, { error: 'tenantId is required' });
        return;
      }
      if (!enforceTenantMatch(res, tenantHeader, body.tenantId)) {
        return;
      }

      const mappingSet = mappingService.saveMappingSet(body.tenantId, body.rows || []);
      json(res, 200, { mappingSet });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/sync/status') {
      const tenantHeader = requireTenantHeader(req, res, wixDashboardAuthSecret);
      if (!tenantHeader) {
        return;
      }

      const tenantId = url.searchParams.get('tenantId') || '';
      if (!tenantId) {
        json(res, 400, { error: 'tenantId is required' });
        return;
      }
      if (!enforceTenantMatch(res, tenantHeader, tenantId)) {
        return;
      }

      const status = store.getSyncStatus(tenantId);
      json(res, 200, status);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/sync/logs') {
      const tenantHeader = requireTenantHeader(req, res, wixDashboardAuthSecret);
      if (!tenantHeader) {
        return;
      }

      const tenantId = url.searchParams.get('tenantId') || '';
      if (!tenantId) {
        json(res, 400, { error: 'tenantId is required' });
        return;
      }
      if (!enforceTenantMatch(res, tenantHeader, tenantId)) {
        return;
      }

      const cursorValue = url.searchParams.get('cursor');
      const cursor = cursorValue ? Number(cursorValue) : undefined;
      const payload = store.getAuditLogs(tenantId, cursor);
      json(res, 200, payload);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/sync/backfill/start') {
      const tenantHeader = requireTenantHeader(req, res, wixDashboardAuthSecret);
      if (!tenantHeader) {
        return;
      }

      const body = await readJson<{ tenantId: string; source?: SyncSource; limit?: number }>(req);
      if (!body.tenantId) {
        json(res, 400, { error: 'tenantId is required' });
        return;
      }
      if (!enforceTenantMatch(res, tenantHeader, body.tenantId)) {
        return;
      }

      const source: SyncSource = body.source || 'wix';
      const contacts = store.listContacts(source, body.tenantId);
      const limit = body.limit && body.limit > 0 ? body.limit : contacts.length;
      const selected = contacts.slice(0, limit);

      for (const contact of selected) {
        enqueueBackfillJob(queue, source, contact);
      }

      json(res, 202, {
        queued: true,
        source,
        queuedJobs: selected.length
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/forms/events') {
      const tenantHeader = requireTenantHeader(req, res, wixDashboardAuthSecret);
      if (!tenantHeader) {
        return;
      }

      const tenantId = url.searchParams.get('tenantId') || '';
      if (!tenantId) {
        json(res, 400, { error: 'tenantId is required' });
        return;
      }
      if (!enforceTenantMatch(res, tenantHeader, tenantId)) {
        return;
      }

      const cursorValue = url.searchParams.get('cursor');
      const cursor = cursorValue ? Number(cursorValue) : undefined;
      const payload = store.getFormEvents(tenantId, cursor);
      json(res, 200, payload);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/wix/contacts') {
      const raw = await readRawBody(req);
      const signature = req.headers['x-signature']?.toString();
      if (!verifySimpleSignature(raw, signature, wixWebhookSecret)) {
        json(res, 401, { error: 'invalid_signature' });
        return;
      }

      const body = parseContactWebhookBody(raw);
      const job = queue.enqueue('wix_contact_upsert_to_hubspot', body);
      json(res, 202, { queued: true, jobId: job.id });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/hubspot/contacts') {
      const raw = await readRawBody(req);
      const signature = req.headers['x-signature']?.toString();
      if (!verifySimpleSignature(raw, signature, hubspotWebhookSecret)) {
        json(res, 401, { error: 'invalid_signature' });
        return;
      }

      const body = parseContactWebhookBody(raw);
      const job = queue.enqueue('hubspot_contact_upsert_to_wix', body);
      json(res, 202, { queued: true, jobId: job.id });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/wix/forms') {
      const raw = await readRawBody(req);
      const signature = req.headers['x-signature']?.toString();
      if (!verifySimpleSignature(raw, signature, wixWebhookSecret)) {
        json(res, 401, { error: 'invalid_signature' });
        return;
      }

      const body = parseFormWebhookBody(raw);
      const job = queue.enqueue('wix_form_submission_to_hubspot', body);
      json(res, 202, { queued: true, jobId: job.id });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/metrics') {
      const storeMetrics = store.getMetrics();
      const queueMetrics = queue.getMetrics();
      json(res, 200, {
        ...storeMetrics,
        ...queueMetrics,
        observability: observabilityState()
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/dlq') {
      if (req.headers['x-admin-token']?.toString() !== adminToken) {
        json(res, 403, { error: 'forbidden' });
        return;
      }

      const jobs = queue.listDeadLetter();
      json(res, 200, { jobs });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/dlq/replay') {
      if (req.headers['x-admin-token']?.toString() !== adminToken) {
        json(res, 403, { error: 'forbidden' });
        return;
      }

      const body = await readJson<{ jobId: string }>(req);
      const replayed = queue.replayDeadLetter(body.jobId);
      if (!replayed) {
        json(res, 404, { error: 'job_not_found' });
        return;
      }

      json(res, 200, { replayed: true, jobId: replayed.id });
      return;
    }

    res.statusCode = 404;
    res.end('Not found');
  } catch (error) {
    captureException(error);
    logError('api_request_failed', {
      path: req.url,
      method: req.method,
      error: error instanceof Error ? error.message : 'unknown_error'
    });

    json(res, 500, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

server.listen(port, () => {
  logInfo('api_started', {
    port,
    dataDir,
    useMockHubspotOAuth,
    storeBackend,
    queueBackend,
    observability: observabilityState()
  });
});

function json(res: import('node:http').ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function enqueueBackfillJob(queue: RuntimeQueue, source: SyncSource, contact: ContactRecord): void {
  const canonicalPayload = {
    email: stringOrUndefined(contact.fields.email),
    firstName: stringOrUndefined(contact.fields.firstName),
    lastName: stringOrUndefined(contact.fields.lastName),
    phone: stringOrUndefined(contact.fields.phone),
    createdAt: stringOrUndefined(contact.fields.createdAt),
    marketingOptIn: booleanOrUndefined(contact.fields.marketingOptIn),
    sourceUpdatedAt: contact.updatedAt
  };

  const payload: Omit<ContactEvent, 'source'> = {
    tenantId: contact.tenantId,
    contactId: contact.id,
    eventId: `backfill_${source}_${contact.id}_${Date.now()}`,
    occurredAt: new Date().toISOString(),
    payload: canonicalPayload
  };

  if (source === 'wix') {
    queue.enqueue('wix_contact_upsert_to_hubspot', payload);
    return;
  }

  queue.enqueue('hubspot_contact_upsert_to_wix', payload);
}

function requireTenantHeader(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  dashboardSecret: string
): string | null {
  const tenantId = req.headers['x-tenant-id']?.toString();
  if (!tenantId) {
    json(res, 401, { error: 'missing_tenant_context' });
    return null;
  }

  if (dashboardSecret) {
    const authHeader = req.headers['x-wix-auth']?.toString();
    if (authHeader !== dashboardSecret) {
      json(res, 403, { error: 'invalid_dashboard_auth' });
      return null;
    }
  }

  return tenantId;
}

function enforceTenantMatch(
  res: import('node:http').ServerResponse,
  tenantHeader: string,
  tenantInRequest: string
): boolean {
  if (tenantHeader !== tenantInRequest) {
    json(res, 403, { error: 'tenant_scope_mismatch' });
    return false;
  }

  return true;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function booleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
