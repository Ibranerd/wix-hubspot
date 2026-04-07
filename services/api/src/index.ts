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
import { logError, logInfo } from './utils/logger.js';
import type { QueueJob } from './services/job-queue.js';

const port = Number(process.env.API_PORT || 8080);
const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;
const redirectUri = process.env.HUBSPOT_REDIRECT_URI || `${appBaseUrl}/api/hubspot/oauth/callback`;
const hubspotClientId = process.env.HUBSPOT_CLIENT_ID || 'local-dev-client-id';
const encryptionMasterKey = process.env.ENCRYPTION_MASTER_KEY || 'local-dev-master-key';
const wixWebhookSecret = process.env.WIX_WEBHOOK_SECRET || 'local-wix-secret';
const hubspotWebhookSecret = process.env.HUBSPOT_WEBHOOK_SECRET || 'local-hubspot-secret';
const adminToken = process.env.ADMIN_API_TOKEN || 'local-admin-token';

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
      }, {
        onRetry: (retryJob) => store.addRetry(retryJob as QueueJob<unknown>),
        onDeadLetter: (dlqJob) => store.addDeadLetterJob(dlqJob as QueueJob<unknown>)
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
      }, {
        onRetry: (retryJob) => store.addRetry(retryJob as QueueJob<unknown>),
        onDeadLetter: (dlqJob) => store.addDeadLetterJob(dlqJob as QueueJob<unknown>)
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
      }, {
        onRetry: (retryJob) => store.addRetry(retryJob as QueueJob<unknown>),
        onDeadLetter: (dlqJob) => store.addDeadLetterJob(dlqJob as QueueJob<unknown>)
      });

      res.statusCode = 202;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ queued: true, jobId: job.id }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/metrics') {
      const metrics = store.getMetrics();
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(metrics));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/dlq') {
      if (req.headers['x-admin-token']?.toString() !== adminToken) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
      }

      const jobs = store.getDeadLetterJobs();
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ jobs }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/dlq/replay') {
      if (req.headers['x-admin-token']?.toString() !== adminToken) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
      }

      const body = await readJson<{ jobId: string }>(req);
      const job = store.removeDeadLetterJob(body.jobId);
      if (!job) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'job_not_found' }));
        return;
      }

      if (job.type === 'wix_contact_upsert_to_hubspot') {
        const payload = job.payload as Omit<ContactEvent, 'source'>;
        syncService.processContactEvent({ ...payload, source: 'wix' });
      } else if (job.type === 'hubspot_contact_upsert_to_wix') {
        const payload = job.payload as Omit<ContactEvent, 'source'>;
        syncService.processContactEvent({ ...payload, source: 'hubspot' });
      } else if (job.type === 'wix_form_submission_to_hubspot') {
        formCaptureService.process(job.payload as WixFormEvent);
      }

      res.statusCode = 200;
      res.end(JSON.stringify({ replayed: true, jobId: job.id }));
      return;
    }

    res.statusCode = 404;
    res.end('Not found');
  } catch (error) {
    logError('api_request_failed', {
      path: req.url,
      method: req.method,
      error: error instanceof Error ? error.message : 'unknown_error'
    });
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(port, () => {
  logInfo('api_started', { port });
});
