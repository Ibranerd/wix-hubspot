# To-10/10 Execution Plan

## Wave 1 (now): harden backend flow
1. Add strict tenant-context middleware on dashboard/admin APIs.
2. Add durable queue/store cleanup jobs for retention windows.
3. Add PostgreSQL schema artifacts and production adapter contract.
4. Add deployment manifests for local/prod parity (Postgres/Redis/api/worker).

## Wave 2: platform integrations
1. Activate real HubSpot OAuth + contact/property clients in non-mock mode.
2. Implement queue backend adapter (BullMQ/SQS) and switch via env flag.
3. Implement DB adapter (Postgres) and switch via env flag.

## Wave 3: product completion
1. Build Wix embedded dashboard pages for:
- Connect/disconnect
- Mapping CRUD with inline validation
- Sync status/log views
- Read-only error + DLQ visibility
2. Add tenant auth verification integrated with Wix context.

## Wave 4: reliability and compliance
1. Add OTel traces + metrics exporters and Sentry error capture.
2. Add retention/purge jobs for dedupe, audit, and form event records.
3. Add region-routing strategy and residency policy enforcement hooks.

## Wave 5: verification
1. Add integration tests (sandbox Wix + HubSpot) for all acceptance criteria.
2. Add CI gates for e2e smoke, replay behavior, and conflict scenarios.
3. Execute handoff checklist with test tenant credentials and demo script.
