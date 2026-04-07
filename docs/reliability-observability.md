# Reliability + Observability (Phase 5)

Implemented:
- Durable file-backed queue used by API and worker.
- Runtime queue/store backend switches (`QUEUE_BACKEND`, `STORE_BACKEND`) with production adapter scaffolds.
- Worker-owned retries with backoff and max attempts.
- Dead-letter capture when retries are exhausted.
- Internal replay endpoint for DLQ jobs.
- Metrics endpoint for queue/audit/form counters.
- Periodic retention cleanup for dedupe, audit logs, and form events.
- Structured logging with automatic PII/token redaction.
- Sentry/OTEL runtime hook points via environment configuration.

Endpoints:
- `GET /api/metrics`
- `GET /api/admin/dlq` (requires `x-admin-token`)
- `POST /api/admin/dlq/replay` (requires `x-admin-token`)
