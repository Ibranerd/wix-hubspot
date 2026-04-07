#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
TENANT_ID="${TENANT_ID:-tenant-demo-1}"

printf "Running acceptance smoke against %s for tenant %s\n" "$BASE_URL" "$TENANT_ID"

printf "1) Start OAuth...\n"
curl -sS -X POST "$BASE_URL/api/hubspot/connect/start" \
  -H 'content-type: application/json' \
  -d "{\"tenantId\":\"$TENANT_ID\"}" | jq '.'

printf "2) Save base mapping...\n"
curl -sS -X PUT "$BASE_URL/api/mappings" \
  -H 'content-type: application/json' \
  -d "{\"tenantId\":\"$TENANT_ID\",\"rows\":[{\"wixFieldKey\":\"email\",\"hubspotProperty\":\"email\",\"direction\":\"bidirectional\",\"transform\":\"trim\",\"enabled\":true}]}" | jq '.'

printf "3) Read sync status...\n"
curl -sS "$BASE_URL/api/sync/status?tenantId=$TENANT_ID" | jq '.'

printf "Acceptance smoke complete.\n"
