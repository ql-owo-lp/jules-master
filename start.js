
const { spawnSync } = require('child_process');

// Run migration
console.log('Running database migrations...');
const migrationResult = spawnSync(
  './node_modules/.bin/tsx',
  ['src/lib/db/migrate.ts'],
  { stdio: 'inherit' }
);

if (migrationResult.status !== 0) {
  console.error('Failed to run database migrations. Exiting.');
  process.exit(migrationResult.status || 1);
}

// Start Next.js server
console.log('Starting Next.js application...');
const appResult = spawnSync(
  './node_modules/next/dist/bin/next',
  ['start', '-p', '9002'],
  { stdio: 'inherit' }
);

if (appResult.status !== 0) {
  console.error('Failed to start Next.js application. Exiting.');
  process.exit(appResult.status || 1);
}
