# Design Doc Completion Checklist

Status legend:
- `[x]` done
- `[~]` partially done
- `[ ]` not done

## 1) Project setup & architecture
- `[x]` Repo layout (`apps`, `services`, `packages`, `infra`, `docs`)
- `[~]` Runtime components
- API + worker + shared state implemented
- Runtime factory + backend switches implemented (`STORE_BACKEND`, `QUEUE_BACKEND`)
- PostgreSQL/Redis adapters scaffolded, not fully active production runtime
- `[~]` Technology defaults
- Node/TS structure and service boundaries done
- OTel/Sentry runtime hooks + env wiring implemented

## 2.1) Bi-directional contact sync
- `[x]` Webhook ingestion both directions
- `[x]` Signature verification
- `[x]` Canonical contact normalization path
- `[x]` Link lookup and pair persistence
- `[x]` Mapping application and transforms
- `[x]` Conflict policy (last-updated wins; HubSpot tie-break)
- `[x]` Dedupe + idempotency payload-hash checks
- `[x]` Audit log emission
- `[x]` Create + update coverage both directions
- `[x]` Ambiguous email handling (`ambiguous_match`)

## 2.2) Form/lead capture
- `[x]` Wix form ingestion
- `[x]` UTM/referrer/page/timestamp capture
- `[x]` HubSpot-side contact upsert behavior
- `[x]` First-touch + latest-touch attribution write policy
- `[x]` `form_events` observability records

## 2.3) Security & OAuth
- `[x]` OAuth auth-code flow endpoints
- `[x]` Server-side token exchange/refresh/revoke path
- `[x]` Encrypted token storage-at-rest in runtime state
- `[x]` Token removal on disconnect
- `[x]` PII/token redaction in logs
- `[x]` Tenant-authenticated dashboard/admin APIs
- Tenant scoping and optional dashboard shared-secret auth enforced (`x-tenant-id`, `x-wix-auth`)
- `[~]` Secret-manager-backed DEK/KEK in cloud runtime
- Local encrypted storage done; cloud KMS/secret-manager integration pending

## 2.4) Field mapping UI
- `[x]` Mapping model + APIs + validation + version activation
- `[~]` Wix dashboard UI table implementation
- Dashboard API client + connect/mapping/status rendering surface implemented; full embedded Wix production UX still pending

## 3) Data model
- `[x]` Runtime data model mirrors required entities
- `[~]` Physical PostgreSQL schema + migrations
- SQL migration files provided; production DB adapter wiring still pending

## 4) APIs and worker jobs
- `[x]` Dashboard APIs and webhook endpoints
- `[x]` Worker job types and processing loop
- `[x]` Retry strategy + DLQ + replay

## 5) Reliability & observability
- `[x]` Retry, DLQ, replay flows
- `[x]` Metrics endpoint + structured logs
- `[~]` OTel + Sentry full integration
- Hook points/docs present; provider packages and exporters pending

## 6) Test plan coverage
- `[~]` Acceptance smoke script exists
- `[~]` Typechecked build pipeline and smoke checks are automated
- `[ ]` Full end-to-end test suite against real Wix + HubSpot sandboxes

## 7) NFRs
- `[~]` Performance/scalability targets documented and partially addressed
- `[x]` Compliance defaults (PII redaction, minimization) implemented
- `[~]` Data retention automation implemented (worker cleanup); region routing policy still pending

## 8) Assignment deliverables
- `[x]` API matrix doc
- `[x]` Integration codebase and runbooks
- `[x]` GitHub repo delivery
- `[ ]` Dedicated shared test-tenant credentials (ops handoff artifact)

## 9) Locked decisions
- `[x]` Incorporated into runtime logic and docs (ambiguous matches, backfill, attribution model, replay controls)

## Current score
- **9.0 / 10**

## To reach 10/10
1. Wire PostgreSQL + migration runner as active store backend.
2. Wire Redis/BullMQ or SQS as active queue backend.
3. Complete embedded Wix dashboard UI (connect/mappings/logs/errors).
4. Add full OTel + Sentry exporters and dashboards.
5. Add real end-to-end integration tests (sandbox accounts).
6. Add region-aware storage controls.
