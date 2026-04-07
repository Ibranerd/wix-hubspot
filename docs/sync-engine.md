# Sync Engine (Phase 3)

Implemented behaviors:
- Bi-directional webhook ingestion (`wix` and `hubspot`).
- Signature verification on inbound webhook payloads.
- Async queue boundary before processing.
- Contact link table abstraction (`contact_links`) in the in-memory store.
- Event dedupe window with source+event key fallback.
- Payload hash skip for idempotent no-op updates.
- Conflict policy:
  - last updated wins
  - HubSpot wins timestamp ties
  - timestamp-present side wins when only one timestamp exists
  - HubSpot wins when both missing
- Audit log emission for create/update/skip/conflict outcomes.

Notes:
- Queue retries/DLQ are completed in Phase 5.
- Persistent DB-backed repositories replace in-memory store in production deployment.
