# Sync Engine (Phase 3)

Implemented behaviors:
- Bi-directional webhook ingestion (`wix` and `hubspot`).
- Signature verification on inbound webhook payloads.
- Durable queue boundary before processing (API enqueue, worker consume).
- Contact link table abstraction (`contact_links`) in the file-backed state store.
- Event dedupe window with source+event key fallback.
- Payload hash skip for idempotent no-op updates.
- Conflict policy:
  - last updated wins
  - HubSpot wins timestamp ties
  - timestamp-present side wins when only one timestamp exists
  - HubSpot wins when both missing
- Audit log emission for create/update/skip/conflict outcomes.

Notes:
- Worker process owns retry scheduling and dead-letter transitions.
- Persistent DB-backed repositories replace file-backed store in production deployment.
