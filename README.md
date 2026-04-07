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
2. Start API and worker once dependencies are installed.
3. Use `npm run test` for baseline smoke checks.
