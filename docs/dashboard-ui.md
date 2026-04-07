# Dashboard UI Surface

Implemented dashboard modules:
- `apps/wix-dashboard/src/api/client.ts`
  - typed API client with tenant headers (`x-tenant-id`, optional `x-wix-auth`)
- `apps/wix-dashboard/src/views/connect-view.ts`
  - connect/disconnect status surface
- `apps/wix-dashboard/src/views/mappings-view.ts`
  - mapping catalog + active set status
- `apps/wix-dashboard/src/views/status-view.ts`
  - sync status + logs summary
- `apps/wix-dashboard/src/app.ts`
  - composed dashboard rendering entry point

Notes:
- This is a concrete integration surface for the embedded app contract.
- Final Wix-native visual implementation can layer directly on this client/view model.
