const { spawnSync } = require('child_process');
const nodePath = process.execPath;

// Run migration
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

// Start Go Backend
console.log('Starting Go backend...');
const { spawn } = require('child_process');
const backend = spawn('/app/server', [], {
  stdio: 'inherit',
  env: { ...process.env } // Pass through env vars
});

backend.on('error', (err) => {
  console.error('Failed to start backend:', err);
});

backend.on('close', (code) => {
  if (code !== 0 && code !== null) {
      console.error(`Backend process exited with code ${code}`);
  }
});

// Ensure backend is killed when this process exits
const cleanup = () => {
    if (backend && !backend.killed) {
        console.log('Stopping Go backend...');
        backend.kill('SIGTERM');
    }
};
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(); });
process.on('SIGTERM', () => { cleanup(); process.exit(); });

// Start Next.js server
console.log('Starting Next.js application...');
const appResult = spawnSync(
  nodePath,
  [
    './node_modules/next/dist/bin/next',
    'start',
    '-p',
    process.env.PORT || '9002'
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
