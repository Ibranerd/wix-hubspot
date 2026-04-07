# Wix ↔ HubSpot Integration

Production-oriented standalone integration app scaffolded in phases.

## Monorepo Layout
- `apps/wix-dashboard`: Wix dashboard surface (connect/disconnect, mappings, status)
- `services/api`: Tenant API + webhooks + OAuth endpoints
- `services/worker`: Async processors for sync and retry flows
- `packages/shared`: Shared models, validation, mapping, sync helpers
- `infra`: Deployment and infrastructure notes
- `docs`: API and operations documentation

## Running locally
1. Copy `.env.example` into service-specific `.env` files.
2. Start API and worker services (`services/api` and `services/worker`).
3. Ensure both processes share the same `DATA_DIR` so API-enqueued jobs are visible to worker consumers.
4. Use `npm run test` for baseline smoke checks.

## Build and typecheck
- `npm run build`
- `npm run typecheck`

## Runtime backend switches
- `STORE_BACKEND=file|postgres`
- `QUEUE_BACKEND=file|bullmq`
- `POSTGRES_URL=...` (required when `STORE_BACKEND=postgres`)
- `REDIS_URL=...` (required when `QUEUE_BACKEND=bullmq`)
