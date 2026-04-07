# Reliability + Observability (Phase 5)

Implemented:
- Queue retries with backoff and max attempts.
- Dead-letter capture when retries are exhausted.
- Internal replay endpoint for DLQ jobs.
- Metrics endpoint for queue/audit/form counters.
- Structured logging with automatic PII/token redaction.

Endpoints:
- `GET /api/metrics`
- `GET /api/admin/dlq` (requires `x-admin-token`)
- `POST /api/admin/dlq/replay` (requires `x-admin-token`)
