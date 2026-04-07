# Form Capture + Attribution (Phase 4)

Flow implemented:
- Receive `POST /webhooks/wix/forms`.
- Verify signature and enqueue processing.
- Upsert HubSpot-side contact record by email.
- Write latest-touch attribution fields every submission.
- Write first-touch attribution fields only if empty.
- Store minimal `form_events` metadata with hashed email.
- Dedupe repeated submissions by `submissionId`.
