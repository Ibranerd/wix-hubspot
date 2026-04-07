# API Matrix

## Dashboard APIs
- `POST /api/hubspot/connect/start` -> starts OAuth and returns HubSpot authorize URL.
- `GET /api/hubspot/oauth/callback` -> receives OAuth code and stores encrypted tokens.
- `POST /api/hubspot/disconnect` -> revokes and deletes stored tokens.
- `GET /api/hubspot/status?tenantId=...` -> returns connection status and proactively refreshes when near expiry.
- `GET /api/mappings/catalog` -> returns Wix/HubSpot field catalogs.
- `GET /api/mappings?tenantId=...` -> returns active mapping set for tenant.
- `PUT /api/mappings` -> validates and activates new mapping set version.

## Webhooks
- `POST /webhooks/wix/contacts`
- `POST /webhooks/hubspot/contacts`
- `POST /webhooks/wix/forms`

## Sync APIs
- `GET /api/sync/status?tenantId=...` -> returns connection + mapping + audit counters.
- `GET /api/sync/logs?tenantId=...&cursor=...` -> paginated sync audit logs.
- `POST /api/sync/backfill/start` -> enqueues resumable contact backfill jobs from Wix or HubSpot side.
- `GET /api/forms/events?tenantId=...&cursor=...` -> paginated stored form ingestion metadata.
- `GET /api/metrics` -> operational counters.
- `GET /api/admin/dlq` -> view dead-letter jobs (admin token required).
- `POST /api/admin/dlq/replay` -> replay dead-letter jobs (admin token required).
