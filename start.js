const { spawnSync } = require('child_process');
const fs = require('fs');
const nodePath = process.execPath;

// Run migration
console.log('Running database migrations...');
let migrationArgs;

if (fs.existsSync('src/lib/db/migrate.js')) {
  console.log('Using compiled migration script.');
  migrationArgs = ['src/lib/db/migrate.js'];
} else {
  console.log('Using source migration script with tsx.');
  migrationArgs = ['./node_modules/tsx/dist/cli.mjs', 'src/lib/db/migrate.ts'];
}

const migrationResult = spawnSync(
  nodePath,
  migrationArgs,
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
