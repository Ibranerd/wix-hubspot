import { InMemoryStore } from '../../api/src/storage/in-memory-store.js';
import { SyncService } from '../../api/src/services/sync-service.js';
import { FormCaptureService } from '../../api/src/services/form-capture-service.js';
import { FileJobQueue, type QueueJob } from '../../api/src/services/job-queue.js';
import type { ContactEvent } from '../../api/src/types/sync.js';
import type { WixFormEvent } from '../../api/src/types/forms.js';
import { logError, logInfo } from '../../api/src/utils/logger.js';
import { buildHubSpotOAuthClient } from '../../api/src/integrations/hubspot-oauth-client.js';
import { HubSpotConnectionService } from '../../api/src/services/hubspot-connection-service.js';

const pollMs = Number(process.env.WORKER_POLL_MS || 2000);
const batchSize = Number(process.env.WORKER_BATCH_SIZE || 20);
const dataDir = process.env.DATA_DIR || '.data';
const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:8080';
const redirectUri = process.env.HUBSPOT_REDIRECT_URI || `${appBaseUrl}/api/hubspot/oauth/callback`;
const hubspotClientId = process.env.HUBSPOT_CLIENT_ID || 'local-dev-client-id';
const hubspotClientSecret = process.env.HUBSPOT_CLIENT_SECRET || 'local-dev-client-secret';
const encryptionMasterKey = process.env.ENCRYPTION_MASTER_KEY || 'local-dev-master-key';
const useMockHubspotOAuth = process.env.HUBSPOT_USE_MOCK_OAUTH !== 'false';
const retryBackoffMs = [2000, 10000, 30000, 120000, 600000];
const retentionAuditDays = Number(process.env.RETENTION_AUDIT_DAYS || 90);
const retentionFormDays = Number(process.env.RETENTION_FORM_DAYS || 90);
const maintenanceIntervalMs = Number(process.env.WORKER_MAINTENANCE_MS || 60_000);

const store = new InMemoryStore(dataDir);
const queue = new FileJobQueue(dataDir);
const syncService = new SyncService(store);
const formCaptureService = new FormCaptureService(store);
const oauthClient = buildHubSpotOAuthClient(
  {
    clientId: hubspotClientId,
    clientSecret: hubspotClientSecret,
    redirectUri
  },
  useMockHubspotOAuth
);
const connectionService = new HubSpotConnectionService(store, oauthClient, {
  appBaseUrl,
  redirectUri,
  hubspotClientId,
  encryptionMasterKey
});

let working = false;

async function processQueueTick(): Promise<void> {
  if (working) {
    return;
  }

  working = true;
  try {
    const jobs = queue.claimReady(batchSize);
    if (jobs.length === 0) {
      return;
    }

    logInfo('worker_claimed_jobs', { count: jobs.length });

    for (const job of jobs) {
      try {
        await processJob(job);
        queue.complete(job.id);
        logInfo('worker_job_completed', { jobId: job.id, type: job.type });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown_error';
        const failed = queue.fail(job.id, message, retryBackoffMs);

        if (failed?.status === 'dead') {
          logError('worker_job_dead_lettered', {
            jobId: job.id,
            type: job.type,
            attempts: failed.attempts,
            error: message
          });
        } else {
          logInfo('worker_job_retry_scheduled', {
            jobId: job.id,
            type: job.type,
            attempts: failed?.attempts,
            nextRunAt: failed?.nextRunAt,
            error: message
          });
        }
      }
    }
  } finally {
    working = false;
  }
}

async function processJob(job: QueueJob<unknown>): Promise<void> {
  if (job.type === 'wix_contact_upsert_to_hubspot') {
    const payload = job.payload as Omit<ContactEvent, 'source'>;
    syncService.processContactEvent({ ...payload, source: 'wix' });
    return;
  }

  if (job.type === 'hubspot_contact_upsert_to_wix') {
    const payload = job.payload as Omit<ContactEvent, 'source'>;
    syncService.processContactEvent({ ...payload, source: 'hubspot' });
    return;
  }

  if (job.type === 'wix_form_submission_to_hubspot') {
    formCaptureService.process(job.payload as WixFormEvent);
    return;
  }

  if (job.type === 'token_refresh') {
    const payload = job.payload as { tenantId?: string };
    if (!payload.tenantId) {
      throw new Error('token_refresh_missing_tenant');
    }

    await connectionService.refreshIfNeeded(payload.tenantId);
    return;
  }

  throw new Error(`unsupported_job_type:${job.type}`);
}

setInterval(() => {
  void processQueueTick();
}, pollMs);

void processQueueTick();

setInterval(() => {
  const result = store.cleanupRetention({
    auditLogs: retentionAuditDays,
    formEvents: retentionFormDays
  });

  if (result.removedExpiredDedupe > 0 || result.removedAuditLogs > 0 || result.removedFormEvents > 0) {
    logInfo('worker_retention_cleanup', result);
  }
}, maintenanceIntervalMs);

logInfo('worker_started', {
  pollMs,
  batchSize,
  dataDir,
  useMockHubspotOAuth,
  retentionAuditDays,
  retentionFormDays,
  maintenanceIntervalMs
});
