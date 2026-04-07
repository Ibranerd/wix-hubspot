## New Standalone Project Plan: Wix ↔ HubSpot Integration App (Full Stack, Production-Ready)

### Summary
Build this as a **separate repository/project** (not part of current codebase) using **Wix CLI app + self-hosted backend** with a worker queue.  
This plan fully covers all requirements in your assignment doc:
- Bi-directional contact sync (create/update both ways)
- Loop prevention + idempotency + conflict handling
- Wix form submission capture to HubSpot with UTM/source attribution
- OAuth 2.0 secure connection + token refresh/rotation
- Mapping UI (Wix field ↔ HubSpot property) with validation
- Reliable operations, observability, and acceptance-criteria validation

---

## 1) Project Setup & Architecture

### 1.1 Repo Layout (new repo)
- `apps/wix-dashboard/`
  - Wix app dashboard UI (connect/disconnect, mapping, logs/status)
- `services/api/`
  - Multi-tenant backend (OAuth callbacks, webhook handlers, mapping APIs, admin APIs)
- `services/worker/`
  - Async processors (sync jobs, retries, dead-letter handling)
- `packages/shared/`
  - Shared DTOs, validation schemas, mapping engine, utility libs
- `infra/`
  - IaC (Terraform or equivalent), queue config, DB migrations, deployment manifests
- `docs/`
  - API matrix, architecture decision records, runbooks, acceptance test script

### 1.2 Runtime Components
- **Wix App Frontend** (embedded in Wix dashboard)
- **API Service** (public HTTPS)
- **Worker Service** (internal/background)
- **PostgreSQL**
- **Redis (or queue backend)** for job queue and dedupe TTL cache
- **Secret Manager** (AWS/GCP/Azure) for encryption key + app secrets

### 1.3 Technology Defaults
- Backend: Node.js + TypeScript (NestJS/Fastify/Express)
- Queue: BullMQ (Redis) or SQS + worker
- DB: PostgreSQL + Prisma/Drizzle/TypeORM
- Dashboard: React + Wix app framework components
- Validation: Zod/Joi
- Observability: OpenTelemetry + Sentry + structured logs

---

## 2) Detailed Feature Design

## 2.1 Feature #1 — Reliable Bi-Directional Contact Sync

### 2.1.1 Source Events
- **Wix → App**
  - Contact created/updated events (webhook/event subscription)
- **HubSpot → App**
  - Contact property change webhooks

### 2.1.2 Sync Pipeline (both directions)
1. Receive event webhook
2. Verify signature/authenticity
3. Normalize payload to canonical contact model
4. Lookup `contact_links` (Wix ID ↔ HubSpot ID)
5. Apply active field mappings + transforms
6. Conflict decision (timestamp strategy)
7. Upsert target system
8. Record sync metadata, hash, source, correlation ID
9. Emit audit log + metrics

### 2.1.3 Conflict Handling (fixed policy)
- Primary rule: **last updated wins**
  - Compare canonical `sourceUpdatedAt` values
- Tie-breaker: **HubSpot wins** (deterministic)
- Missing timestamps:
  - if one side missing timestamp, side with timestamp wins
  - if both missing, HubSpot wins

### 2.1.4 Infinite Loop Prevention (critical)
- `contact_links` table stores pair and last sync metadata
- Each outbound write includes:
  - `syncSource` (`wix` or `hubspot`)
  - `correlationId` (UUID)
  - `payloadHash`
- Incoming event ignored if:
  - correlation/source matches recent self-write (dedupe window, e.g. 5 min)
  - payload hash matches last synced state (no-op idempotency)
- Event dedupe key:
  - `source + externalEventId` when available
  - fallback deterministic hash of key event fields + timestamp bucket

### 2.1.5 Create + Update Coverage
- New contact in Wix creates HubSpot contact (and link row)
- New contact in HubSpot creates Wix contact (and link row)
- Update in either side updates mapped target fields only
- No duplicate contact creation if link exists or unique match found by email

---

## 2.2 Feature #2 — Form & Lead Capture Integration (chosen approach)

### Chosen option: **Wix forms as UI, push submissions to HubSpot**
(Assignment allows either option; this plan chooses #2 for control + attribution capture)

### 2.2.1 Submission flow
1. Wix form submission event arrives
2. Extract:
  - email, name, custom fields
  - `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
  - page URL, referrer, timestamp
3. Upsert HubSpot contact
4. Write attribution fields to HubSpot contact properties
5. Store minimal event metadata in local DB (`form_events`) for observability

### 2.2.2 Attribution model in HubSpot
- Create/ensure custom properties:
  - `wix_utm_source`, `wix_utm_medium`, `wix_utm_campaign`, `wix_utm_term`, `wix_utm_content`
  - `wix_page_url`, `wix_referrer`, `wix_form_submitted_at`
- Alternative note/timeline event optional; contact properties are primary for easy filtering/reporting

### 2.2.3 Latency target
- P95 end-to-end from Wix submission to HubSpot update: **< 5 seconds**
- If HubSpot unavailable, queue + retry with backoff

---

## 2.3 Security & Connection (Must-Have)

### 2.3.1 OAuth
- HubSpot OAuth 2.0 Authorization Code flow
- Browser only handles redirect; token exchange happens server-side only

### 2.3.2 Token storage
- Store encrypted tokens in DB:
  - `encrypted_access_token`, `encrypted_refresh_token`, `expires_at`
- Encryption:
  - DEK/KEK pattern using Secret Manager
- Refresh logic:
  - proactive refresh before expiry + retry on 401
- Disconnect:
  - revoke token if supported + delete local token records

### 2.3.3 Least privilege scopes
- Request only scopes required for:
  - contacts read/write
  - properties read/write (if creating custom attribution props)
  - webhooks subscription management (if needed)
- Scope list documented and justified in README

### 2.3.4 Secure endpoints
- All sync/mapping/admin endpoints require Wix-authenticated tenant context
- Webhook endpoints enforce provider signature validation
- Strict tenant scoping for all reads/writes

### 2.3.5 Safe logging
- Never log raw tokens
- Redact PII (email/phone/name) in logs by default
- Use hashed identifiers in diagnostics

---

## 2.4 Field Mapping UI (Must-Have)

### 2.4.1 Dashboard table UI
Each row:
- Wix field dropdown
- HubSpot property dropdown
- Sync direction:
  - Wix → HubSpot
  - HubSpot → Wix
  - Bi-directional
- Optional transform:
  - none, trim, lowercase (initial set)

### 2.4.2 Mapping validation rules
- No duplicate HubSpot property mapping by default
- Email mapping required (identity anchor)
- Prevent incompatible type pairings (e.g., date → number)
- Show inline validation errors before save

### 2.4.3 Mapping persistence
- `mapping_sets` (versioned)
- `mapping_rows` linked to active set
- “Save mapping” activates new version atomically
- Sync engine always reads active set per tenant

---

## 3) Data Model (Decision Complete)

### 3.1 Core tables
- `tenants`
  - id, wixSiteId, wixAccountId, createdAt
- `hubspot_connections`
  - tenantId, hubspotPortalId, status, scopes, connectedAt, disconnectedAt
- `oauth_tokens`
  - tenantId, encryptedAccessToken, encryptedRefreshToken, expiresAt, rotatedAt
- `field_mapping_sets`
  - id, tenantId, version, isActive, createdAt
- `field_mappings`
  - mappingSetId, wixFieldKey, hubspotProperty, direction, transform, enabled
- `contact_links`
  - tenantId, wixContactId, hubspotContactId, lastSyncSource, lastSyncAt, lastPayloadHash, lastCorrelationId
- `event_dedupe`
  - tenantId, source, dedupeKey, correlationId, expiresAt
- `sync_jobs`
  - id, tenantId, jobType, payloadJson, status, attempts, maxAttempts, nextRunAt, lastError
- `sync_audit_logs`
  - id, tenantId, source, action, entityType, entityId, result, errorCode, correlationId, createdAt
- `form_events`
  - tenantId, wixFormId, submissionId, emailHash, attributionJson, processedAt, result

### 3.2 Indexes/constraints
- Unique `(tenantId, wixContactId)` and `(tenantId, hubspotContactId)` on `contact_links`
- Unique `(tenantId, source, dedupeKey)` on `event_dedupe`
- Unique active mapping set per tenant
- TTL cleanup strategy for dedupe + old audit rows

---

## 4) API Contracts & Flows

### 4.1 Dashboard APIs (tenant-authenticated)
- `POST /api/hubspot/connect/start`
- `GET /api/hubspot/oauth/callback`
- `POST /api/hubspot/disconnect`
- `GET /api/mappings`
- `PUT /api/mappings`
- `GET /api/sync/status`
- `GET /api/sync/logs?cursor=...`

### 4.2 Webhook endpoints
- `POST /webhooks/wix/contacts`
- `POST /webhooks/wix/forms`
- `POST /webhooks/hubspot/contacts`
Each endpoint:
- verify signature
- validate schema
- enqueue job
- 2xx quickly

### 4.3 Worker job types
- `wix_contact_upsert_to_hubspot`
- `hubspot_contact_upsert_to_wix`
- `wix_form_submission_to_hubspot`
- `token_refresh`
- `dead_letter_replay`

### 4.4 Retry strategy
- Exponential backoff (e.g., 2s, 10s, 30s, 2m, 10m)
- Max attempts (e.g., 8)
- Move to DLQ after max attempts
- Manual replay endpoint (admin)

---

## 5) Delivery Phases & Milestones

### Phase 0: Bootstrapping (2-3 days)
- Repo scaffold, CI, lint/test, env management
- DB + queue + secret manager wiring
- Wix CLI app skeleton + backend deploy baseline

### Phase 1: OAuth & Connection (2-3 days)
- HubSpot OAuth flow end-to-end
- Token encryption + refresh + disconnect
- Dashboard connect/disconnect UI

### Phase 2: Mapping UI & Persistence (2-3 days)
- Fetch Wix fields + HubSpot properties
- Mapping table with validation + save activation
- Mapping APIs + versioning

### Phase 3: Core Bi-Directional Sync (4-6 days)
- Webhook ingestion both sides
- Sync engine with conflict policy
- Link table + loop prevention + idempotency
- Create/update full flows

### Phase 4: Form Capture + Attribution (2-3 days)
- Wix form event processing
- HubSpot contact upsert + attribution property writes
- Minimal metadata storage for observability

### Phase 5: Reliability + Observability (2-3 days)
- Retries, DLQ, replay
- Metrics, dashboards, Sentry alerts
- Security logging hardening

### Phase 6: QA & Handoff (2-3 days)
- Acceptance test script execution
- Docs, API matrix, demo account/user setup
- GitHub repo finalization

---

## 6) Test Plan (100% Requirement Coverage)

### 6.1 Contact sync acceptance
- Wix create → HubSpot create
- HubSpot create → Wix create
- Wix update → HubSpot update
- HubSpot update → Wix update
- No ping-pong on single change
- Idempotent duplicate event replay causes no extra writes

### 6.2 Conflict cases
- Simultaneous updates with newer Wix timestamp
- Simultaneous updates with newer HubSpot timestamp
- Equal timestamp tie (HubSpot wins)
- Missing timestamp fallback behavior

### 6.3 Mapping behavior
- Mapping change without deploy impacts next sync
- Duplicate mapping validation blocks invalid save
- Direction-specific mappings obeyed correctly

### 6.4 Form + attribution acceptance
- Wix submission updates HubSpot in seconds
- All UTM fields visible in HubSpot
- Page URL/referrer/timestamp persisted correctly
- Repeated same submission id is deduped

### 6.5 Security acceptance
- Connect/disconnect works from dashboard
- Tokens never present in frontend payloads
- Token refresh works after expiry
- Webhooks reject invalid signatures
- Logs contain no tokens/PII

### 6.6 Reliability acceptance
- Temporary HubSpot outage: queued retries eventually succeed
- Worker restart mid-flow does not lose jobs
- DLQ captures persistent failures and supports replay

---

## 7) Non-Functional Requirements

### Performance
- Webhook handlers respond fast (<300ms typical) by enqueueing
- P95 sync latency under 5s for healthy external APIs

### Scalability
- Queue consumers horizontally scalable
- Tenant-scoped processing keys to avoid lock contention

### Compliance/Safety
- Data minimization
- Configurable retention policy for logs/events
- Audit trail for connect/disconnect/sync actions

---

## 8) Deliverables Mapping to Assignment

1. **“Share what APIs”**  
- `docs/api-matrix.md` listing Wix + HubSpot APIs/events per feature with rationale.

2. **“Build integration for #1 and #2”**  
- Working app implementing all flows above.

3. **“Send GitHub repo”**  
- Full source + deployment guide + test instructions.

4. **“Send username to test app connection”**  
- Dedicated test tenant credentials + scripted test checklist.

---

## Assumptions
- Standalone project (new repo) is required and approved.
- Feature #2 implementation uses Wix forms push-to-HubSpot, not embedded HubSpot forms.
- HubSpot webhook app setup is available; if blocked in environment, temporary polling fallback can be added but webhook remains target architecture.
- Deployment environment supports HTTPS endpoints required by OAuth/webhooks.

---

## 9) Final Design Decisions (Locked for Implementation)

### 9.1 Identity matching and duplicate email handling
- Primary identity anchor is `email` per tenant.
- HubSpot duplicate emails are treated as possible/allowed.
- If multiple HubSpot contacts match one email, do not auto-link.
- Mark event/result as `ambiguous_match` and require manual resolution in dashboard.

### 9.2 Timestamp normalization and conflict comparison
- Normalize all inbound timestamps to UTC ISO-8601 at ingestion.
- Compare timestamps at second-level precision.
- If one side lacks timestamp, side with timestamp wins.
- If both are missing, HubSpot wins (existing policy).

### 9.3 Deletion behavior (v1 scope)
- v1 supports contact create/update sync only.
- Contact deletions are out of scope for v1.
- Deletion sync can be introduced later as a gated feature with soft-delete safety rules.

### 9.4 Concurrent updates inside dedupe window
- If the same mapped field changes in both systems within the dedupe window, apply standard conflict policy:
  - Last updated wins
  - HubSpot wins on exact tie
- Persist audit record `conflict_resolved` including both source timestamps and selected winner.

### 9.5 Attribution write policy
- Implement dual attribution properties:
  - First-touch fields: write only when empty.
  - Latest-touch fields: overwrite on each new valid submission.
- This preserves acquisition origin while keeping most recent campaign context.

### 9.6 Initial historical sync/backfill
- Provide optional tenant-triggered backfill at connection time.
- Backfill must be rate-limited and resumable.
- Default behavior remains real-time sync from connect-forward unless admin starts backfill.

### 9.7 OAuth disconnect and token lifecycle
- On disconnect, attempt provider token revocation first.
- Hard-delete encrypted access/refresh tokens immediately after disconnect flow.
- Retain non-sensitive audit metadata only (tenant, portal, timestamps, action result).

### 9.8 Throughput and latency targets
- Per-tenant burst target: up to 50 webhook events/sec for 60 seconds.
- Per-tenant steady target: around 5 webhook events/sec.
- P95 end-to-end sync latency target: under 5 seconds when external APIs are healthy.
- Retry convergence target for transient outages: under 30 minutes.

### 9.9 Replay controls and tenant exposure
- Manual replay endpoints are internal ops-only in v1.
- Tenant dashboard exposes read-only sync status and error visibility.
- Replay actions are restricted to operations/admin tooling to avoid accidental replay floods.

### 9.10 Compliance defaults
- Design for GDPR/CCPA-compatible operation.
- Enforce data minimization and PII-redacted logs by default.
- Keep retention configurable (recommended baseline: 30-90 days for logs/events).
- Support region-aware deployment (US/EU) and tenant-level residency options when required.
