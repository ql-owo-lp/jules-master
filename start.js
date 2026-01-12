const { spawnSync } = require('child_process');
const nodePath = process.execPath;

// Run migration
if (process.env.SKIP_MIGRATION !== 'true') {
  console.log('Running database migrations...');
const migrationResult = spawnSync(
  nodePath,
  [
    './node_modules/tsx/dist/cli.mjs',
    'src/lib/db/migrate.ts'
  ],
  { stdio: 'inherit' }
);

if (migrationResult.status !== 0) {
  console.error('Failed to run database migrations. Exiting.');
  if (migrationResult.error) {
    console.error('Error:', migrationResult.error);
  }
  if (migrationResult.signal) {
    console.error('Signal:', migrationResult.signal);
  }
  console.error('Status:', migrationResult.status);
  process.exit(migrationResult.status || 1);
}
}

// Start Next.js server
console.log('Starting Next.js application...');
const appResult = spawnSync(
  nodePath,
  [
    './node_modules/next/dist/bin/next',
    'start',
    '-p',
    '9002'
  ],
  { stdio: 'inherit' }
);

if (appResult.status !== 0) {
  console.error('Failed to start Next.js application. Exiting.');
  if (appResult.error) {
    console.error('Error:', appResult.error);
  }
  if (appResult.signal) {
    console.error('Signal:', appResult.signal);
  }
  console.error('Status:', appResult.status);
  process.exit(appResult.status || 1);
}
