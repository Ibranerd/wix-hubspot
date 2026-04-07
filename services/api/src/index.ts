import { createServer } from 'node:http';
import { MockHubSpotOAuthClient } from './integrations/hubspot-oauth-client.js';
import { InMemoryStore } from './storage/in-memory-store.js';
import { HubSpotConnectionService } from './services/hubspot-connection-service.js';
import { readJson } from './http/json.js';
import { MappingService } from './services/mapping-service.js';
import type { MappingRowInput } from './types/mappings.js';
import { readRawBody } from './http/raw.js';
import { verifySimpleSignature } from './security/signature.js';
import { SyncService } from './services/sync-service.js';
import { InMemoryJobQueue } from './services/job-queue.js';
import type { ContactEvent } from './types/sync.js';
import { FormCaptureService } from './services/form-capture-service.js';
import type { WixFormEvent } from './types/forms.js';

const port = Number(process.env.API_PORT || 8080);
const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;
const redirectUri = process.env.HUBSPOT_REDIRECT_URI || `${appBaseUrl}/api/hubspot/oauth/callback`;
const hubspotClientId = process.env.HUBSPOT_CLIENT_ID || 'local-dev-client-id';
const encryptionMasterKey = process.env.ENCRYPTION_MASTER_KEY || 'local-dev-master-key';
const wixWebhookSecret = process.env.WIX_WEBHOOK_SECRET || 'local-wix-secret';
const hubspotWebhookSecret = process.env.HUBSPOT_WEBHOOK_SECRET || 'local-hubspot-secret';

const store = new InMemoryStore();
const oauthClient = new MockHubSpotOAuthClient();
const mappingService = new MappingService(store);
const syncService = new SyncService(store);
const formCaptureService = new FormCaptureService(store);
const queue = new InMemoryJobQueue();
const connectionService = new HubSpotConnectionService(store, oauthClient, {
  appBaseUrl,
  redirectUri,
  hubspotClientId,
  encryptionMasterKey
});

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', appBaseUrl);

    if (req.method === 'GET' && url.pathname === '/health') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, service: 'api' }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/hubspot/connect/start') {
      const body = await readJson<{ tenantId: string }>(req);
      if (!body.tenantId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'tenantId is required' }));
        return;
      }

      const payload = connectionService.startConnection(body.tenantId);
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(payload));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/hubspot/oauth/callback') {
      const code = url.searchParams.get('code') || '';
      const state = url.searchParams.get('state') || '';
      const result = await connectionService.handleCallback(code, state);
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(result));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/hubspot/disconnect') {
      const body = await readJson<{ tenantId: string }>(req);
      if (!body.tenantId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'tenantId is required' }));
        return;
      }

      await connectionService.disconnect(body.tenantId);
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/hubspot/status') {
      const tenantId = url.searchParams.get('tenantId') || '';
      if (!tenantId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'tenantId is required' }));
        return;
      }

      await connectionService.refreshIfNeeded(tenantId);
      const status = connectionService.getConnectionStatus(tenantId);
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(status));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/mappings/catalog') {
      const catalog = mappingService.getCatalog();
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(catalog));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/mappings') {
      const tenantId = url.searchParams.get('tenantId') || '';
      if (!tenantId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'tenantId is required' }));
        return;
      }

      const mappingSet = mappingService.getActiveMappingSet(tenantId);
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ mappingSet }));
      return;
    }

    if (req.method === 'PUT' && url.pathname === '/api/mappings') {
      const body = await readJson<{ tenantId: string; rows: MappingRowInput[] }>(req);
      if (!body.tenantId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'tenantId is required' }));
        return;
      }

      const mappingSet = mappingService.saveMappingSet(body.tenantId, body.rows || []);
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ mappingSet }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/sync/status') {
      const tenantId = url.searchParams.get('tenantId') || '';
      if (!tenantId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'tenantId is required' }));
        return;
      }

      const status = store.getSyncStatus(tenantId);
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(status));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/sync/logs') {
      const tenantId = url.searchParams.get('tenantId') || '';
      if (!tenantId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'tenantId is required' }));
        return;
      }

      const cursorValue = url.searchParams.get('cursor');
      const cursor = cursorValue ? Number(cursorValue) : undefined;
      const payload = store.getAuditLogs(tenantId, cursor);
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(payload));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/wix/contacts') {
      const raw = await readRawBody(req);
      const signature = req.headers['x-signature']?.toString();
      if (!verifySimpleSignature(raw, signature, wixWebhookSecret)) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'invalid_signature' }));
        return;
      }

      const body = JSON.parse(raw) as Omit<ContactEvent, 'source'>;
      const job = queue.enqueue('wix_contact_upsert_to_hubspot', body, async () => {
        syncService.processContactEvent({ ...body, source: 'wix' });
      });

      res.statusCode = 202;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ queued: true, jobId: job.id }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/hubspot/contacts') {
      const raw = await readRawBody(req);
      const signature = req.headers['x-signature']?.toString();
      if (!verifySimpleSignature(raw, signature, hubspotWebhookSecret)) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'invalid_signature' }));
        return;
      }

      const body = JSON.parse(raw) as Omit<ContactEvent, 'source'>;
      const job = queue.enqueue('hubspot_contact_upsert_to_wix', body, async () => {
        syncService.processContactEvent({ ...body, source: 'hubspot' });
      });

      res.statusCode = 202;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ queued: true, jobId: job.id }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/wix/forms') {
      const raw = await readRawBody(req);
      const signature = req.headers['x-signature']?.toString();
      if (!verifySimpleSignature(raw, signature, wixWebhookSecret)) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'invalid_signature' }));
        return;
      }

      const body = JSON.parse(raw) as WixFormEvent;
      const job = queue.enqueue('wix_form_submission_to_hubspot', body, async () => {
        formCaptureService.process(body);
      });

      res.statusCode = 202;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ queued: true, jobId: job.id }));
      return;
    }

    res.statusCode = 404;
    res.end('Not found');
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on :${port}`);
});
