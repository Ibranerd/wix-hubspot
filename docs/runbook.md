# Operations Runbook

## Common checks
- Health: `GET /health`
- Sync status: `GET /api/sync/status?tenantId=...`
- Recent logs: `GET /api/sync/logs?tenantId=...`
- Metrics: `GET /api/metrics`

## Incident triage
1. Confirm webhook signature settings are correct.
2. Confirm active mapping set exists for tenant.
3. Inspect DLQ via admin endpoint.
4. Replay DLQ jobs after root cause fix.

## Security checks
- Ensure logs have no raw tokens.
- Ensure PII fields are redacted in error contexts.
- Rotate webhook secrets and admin token periodically.
