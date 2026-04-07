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
- `ENCRYPTION_MASTER_KEY`
- `WIX_WEBHOOK_SECRET`
- `HUBSPOT_WEBHOOK_SECRET`
- `ADMIN_API_TOKEN`

## Recommended production substitutions
- Replace in-memory store with PostgreSQL repositories.
- Replace in-memory queue with Redis/BullMQ or SQS.
- Add OpenTelemetry + Sentry exporters.
- Enforce tenant auth middleware from Wix context.
