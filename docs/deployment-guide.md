# Deployment Guide

## Services
- `services/api` (public HTTPS)
- `services/worker` (background)

## Environment variables
- `API_PORT`
- `APP_BASE_URL`
- `HUBSPOT_CLIENT_ID`
- `HUBSPOT_CLIENT_SECRET`
- `HUBSPOT_REDIRECT_URI`
- `HUBSPOT_USE_MOCK_OAUTH`
- `ENCRYPTION_MASTER_KEY`
- `WIX_WEBHOOK_SECRET`
- `HUBSPOT_WEBHOOK_SECRET`
- `ADMIN_API_TOKEN`
- `DATA_DIR`
- `WORKER_POLL_MS`
- `WORKER_BATCH_SIZE`

## Recommended production substitutions
- Replace file-backed store with PostgreSQL repositories.
- Replace file-backed queue with Redis/BullMQ or SQS.
- Add OpenTelemetry + Sentry exporters.
- Enforce tenant auth middleware from Wix context.
