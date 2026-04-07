# Acceptance Test Script (Phase 6)

## Prerequisites
- API service running on `http://localhost:8080`
- Shared secrets configured (`WIX_WEBHOOK_SECRET`, `HUBSPOT_WEBHOOK_SECRET`, `ADMIN_API_TOKEN`)
- A tenant id for testing, e.g. `tenant-demo-1`

## 1) OAuth connect/disconnect
1. `POST /api/hubspot/connect/start` with tenant id; verify authorize URL returned.
2. Simulate callback via `GET /api/hubspot/oauth/callback?code=...&state=...`.
3. `GET /api/hubspot/status` returns `connected`.
4. `POST /api/hubspot/disconnect` then status returns `disconnected`.

## 2) Mapping validation
1. `PUT /api/mappings` with valid rows including `email -> email`.
2. `GET /api/mappings` returns active set with `version=1`.
3. Save updated mapping and verify version increments.
4. Attempt invalid duplicate HubSpot mapping and verify save fails.

## 3) Contact sync (bi-directional)
1. Send signed webhook to `POST /webhooks/wix/contacts`.
2. Send signed webhook to `POST /webhooks/hubspot/contacts`.
3. Verify `GET /api/sync/logs` includes `create/update` entries.
4. Replay same webhook payload; verify duplicate/idempotent skip logs appear.

## 4) Conflict behavior
1. Send older timestamp update from source A and newer from source B.
2. Verify newer timestamp wins.
3. Send equal timestamps; verify HubSpot wins tie.

## 5) Forms + attribution
1. Send signed webhook to `POST /webhooks/wix/forms` with UTM metadata.
2. Repeat same `submissionId`; verify dedupe (`ignored` form event).

## 6) Reliability
1. Trigger a failure path (invalid payload/missing mapping) to force retries.
2. Verify retries increase via `GET /api/metrics`.
3. After max attempts, check `GET /api/admin/dlq` contains job.
4. Replay with `POST /api/admin/dlq/replay`.
