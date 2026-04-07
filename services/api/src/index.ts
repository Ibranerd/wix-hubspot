import { createServer } from 'node:http';
import { MockHubSpotOAuthClient } from './integrations/hubspot-oauth-client.js';
import { InMemoryStore } from './storage/in-memory-store.js';
import { HubSpotConnectionService } from './services/hubspot-connection-service.js';
import { readJson } from './http/json.js';

const port = Number(process.env.API_PORT || 8080);
const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;
const redirectUri = process.env.HUBSPOT_REDIRECT_URI || `${appBaseUrl}/api/hubspot/oauth/callback`;
const hubspotClientId = process.env.HUBSPOT_CLIENT_ID || 'local-dev-client-id';
const encryptionMasterKey = process.env.ENCRYPTION_MASTER_KEY || 'local-dev-master-key';

const store = new InMemoryStore();
const oauthClient = new MockHubSpotOAuthClient();
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
