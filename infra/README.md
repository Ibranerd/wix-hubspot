# Infrastructure

## Included artifacts
- `migrations/001_initial.sql`: baseline PostgreSQL schema.
- `docker-compose.yml`: local infra baseline (Postgres + Redis + service stubs).
- `k8s/`: starter deployment manifests for api/worker.

## Notes
- Current runtime defaults use file-backed queue/state for local dev.
- Postgres/Redis artifacts are included for production adapter migration.
