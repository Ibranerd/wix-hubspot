const fs = require('fs');
const required = [
  'apps/wix-dashboard',
  'services/api/src/index.ts',
  'services/worker/src/index.ts',
  'packages/shared/src/index.ts',
  'wix-hubspot-integration-implementation-plan.md'
];

const missing = required.filter((entry) => !fs.existsSync(entry));
if (missing.length > 0) {
  console.error('Missing required files/directories:', missing);
  process.exit(1);
}

console.log('Smoke check passed. Baseline scaffold is present.');
