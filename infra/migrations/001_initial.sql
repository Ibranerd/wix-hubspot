-- Initial PostgreSQL schema for Wix <-> HubSpot integration

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  wix_site_id TEXT,
  wix_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hubspot_connections (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  hubspot_portal_id TEXT NOT NULL,
  status TEXT NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  rotated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS field_mapping_sets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS field_mapping_sets_unique_version
  ON field_mapping_sets (tenant_id, version);

CREATE UNIQUE INDEX IF NOT EXISTS field_mapping_sets_unique_active
  ON field_mapping_sets (tenant_id)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS field_mappings (
  id TEXT PRIMARY KEY,
  mapping_set_id TEXT NOT NULL REFERENCES field_mapping_sets(id) ON DELETE CASCADE,
  wix_field_key TEXT NOT NULL,
  hubspot_property TEXT NOT NULL,
  direction TEXT NOT NULL,
  transform TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS contact_links (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wix_contact_id TEXT NOT NULL,
  hubspot_contact_id TEXT NOT NULL,
  last_sync_source TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ NOT NULL,
  last_payload_hash TEXT,
  last_correlation_id TEXT,
  wix_updated_at TIMESTAMPTZ,
  hubspot_updated_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, wix_contact_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_links_hubspot_unique
  ON contact_links (tenant_id, hubspot_contact_id);

CREATE TABLE IF NOT EXISTS event_dedupe (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  correlation_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, source, dedupe_key)
);

CREATE TABLE IF NOT EXISTS sync_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  job_type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 8,
  next_run_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sync_jobs_status_next_run
  ON sync_jobs (status, next_run_at);

CREATE TABLE IF NOT EXISTS sync_audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  result TEXT NOT NULL,
  error_code TEXT,
  correlation_id TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sync_audit_logs_tenant_created
  ON sync_audit_logs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS form_events (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wix_form_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  attribution_json JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL,
  result TEXT NOT NULL,
  PRIMARY KEY (tenant_id, submission_id)
);

CREATE INDEX IF NOT EXISTS form_events_tenant_processed
  ON form_events (tenant_id, processed_at DESC);
