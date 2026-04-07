# API Matrix

## Dashboard APIs
- `POST /api/hubspot/connect/start` -> starts OAuth and returns HubSpot authorize URL.
- `GET /api/hubspot/oauth/callback` -> receives OAuth code and stores encrypted tokens.
- `POST /api/hubspot/disconnect` -> revokes and deletes stored tokens.
- `GET /api/hubspot/status?tenantId=...` -> returns connection status and proactively refreshes when near expiry.
- `GET /api/mappings/catalog` -> returns Wix/HubSpot field catalogs.
- `GET /api/mappings?tenantId=...` -> returns active mapping set for tenant.
- `PUT /api/mappings` -> validates and activates new mapping set version.

## Planned Webhooks (next phases)
- `POST /webhooks/wix/contacts`
- `POST /webhooks/wix/forms`
- `POST /webhooks/hubspot/contacts`
