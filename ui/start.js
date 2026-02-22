const { spawnSync } = require('child_process');
const crypto = require('crypto');
const nodePath = process.execPath;
const fs = require('fs');
const path = require('path');

// Security: Enforce internal authentication for gRPC services
// If no token is provided, generate a secure random token and inject it into the environment
// for both the backend and frontend processes to use.
if (!process.env.JULES_INTERNAL_TOKEN) {
  console.log('NOTICE: JULES_INTERNAL_TOKEN not set. Generating a secure internal token for gRPC authentication.');
  try {
    process.env.JULES_INTERNAL_TOKEN = crypto.randomUUID();
  } catch (e) {
    // Fallback for older Node versions (though Docker uses v24/v20) or unexpected issues
    console.warn('WARNING: crypto.randomUUID() failed, falling back to randomBytes hex string.');
    process.env.JULES_INTERNAL_TOKEN = crypto.randomBytes(32).toString('hex');
  }
} else {
  console.log('NOTICE: Using provided JULES_INTERNAL_TOKEN for gRPC authentication.');
}

// Check database setup
const dbUrl = process.env.DATABASE_URL || 'data/sqlite.db';
console.log(`Using DATABASE_URL: ${dbUrl}`);

// Verify better-sqlite3 loads
try {
  require('better-sqlite3');
  console.log('better-sqlite3 module verified.');
} catch (e) {
  console.error('CRITICAL ERROR: better-sqlite3 failed to load:', e);
  process.exit(1);
}

// Verify tsx path
const tsxPath = path.resolve('./node_modules/tsx/dist/cli.mjs');
if (!fs.existsSync(tsxPath)) {
  console.error(`CRITICAL ERROR: tsx not found at ${tsxPath}`);
  try {
    console.log('Listing node_modules/tsx:');
    console.log(fs.readdirSync('./node_modules/tsx'));
  } catch(e) { console.log('Could not list node_modules/tsx'); }
  process.exit(1);
} else {
  console.log(`tsx found at ${tsxPath}`);
}


// Run migration
console.log('Running database migrations...');
const migrationResult = spawnSync(
  nodePath,
  [
    tsxPath,
    'src/lib/db/migrate.ts'
  ],
  {
    stdio: 'inherit',
    timeout: 120000 // 2 minutes timeout
  }
);

if (migrationResult.status !== 0) {
  console.error('Failed to run database migrations. Exiting.');
  if (migrationResult.error) {
    console.error('Error:', migrationResult.error);
    if (migrationResult.error.code === 'ETIMEDOUT') {
      console.error('Migration timed out after 120s.');
    }
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
// Pass the modified environment (including JULES_INTERNAL_TOKEN) to the backend
const backend = spawn('/app/server', [], {
  stdio: 'inherit',
  env: { ...process.env, PORT: '50051' } // Force backend to internal port, avoiding conflict with frontend
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
// spawnSync inherits process.env by default, so it picks up JULES_INTERNAL_TOKEN
const appResult = spawnSync(
  nodePath,
  [
    './node_modules/next/dist/bin/next',
    'start',
    '-H', '0.0.0.0',
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
