# Operations Runbook

## Common checks
- Health: `GET /health`
- Sync status: `GET /api/sync/status?tenantId=...`
- Recent logs: `GET /api/sync/logs?tenantId=...`
- Form ingestion logs: `GET /api/forms/events?tenantId=...`
- Metrics: `GET /api/metrics`

Tenant-authenticated API calls require:
- `x-tenant-id` header matching query/body tenant id.
- `x-wix-auth` header when `WIX_DASHBOARD_AUTH_SECRET` is enabled.

## Incident triage
1. Confirm webhook signature settings are correct.
2. Confirm worker process is running and polling queue.
3. Confirm active mapping set exists for tenant.
4. Inspect DLQ via admin endpoint.
5. Replay DLQ jobs after root cause fix.
6. Run targeted backfill if required via `POST /api/sync/backfill/start`.

## Security checks
- Ensure logs have no raw tokens.
- Ensure PII fields are redacted in error contexts.
- Rotate webhook secrets and admin token periodically.
