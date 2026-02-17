#!/bin/sh
set -e

cleanup() {
  echo "--- Backend Logs (/app/backend.log) ---"
  cat /app/backend.log || echo "No backend log found."
  echo "--- End Backend Logs ---"
  echo "--- System Info ---"
  ps aux || echo "ps failed"
  node --version
  ./node_modules/.bin/next --version
}
trap cleanup EXIT

# Cleanup DB
rm -f /tmp/e2e_jules.db*
export DATABASE_URL=/tmp/e2e_jules.db

# Run migrations and seed
./node_modules/.bin/tsx src/lib/db/migrate.ts
./node_modules/.bin/tsx scripts/seed-e2e.ts

# Backend Setup
export PORT=50051
export JULES_API_KEY='mock-api-key'

echo "Checking for gcc..."
which gcc || echo "gcc not found"

# Build backend first
echo "Building backend..."
cd ../server
if ! GOWORK=off CGO_ENABLED=1 /usr/local/go/bin/go build -o /app/server_bin cmd/server/main.go; then
  echo "Backend build failed."
  exit 1
fi
cd ../ui

# Start backend in background with logging
echo "Starting backend..."
(/app/server_bin 2>&1 | tee /app/backend.log) &

# Wait for backend to be ready
if ! ./node_modules/.bin/tsx scripts/wait-for-backend.ts; then
  echo "Wait failed. Backend logs:"
  cat /app/backend.log
  exit 1
fi

# Start frontend
PORT_TO_USE=${1:-3000}
echo "Frontend starting on port $PORT_TO_USE..."
# Unset PORT to avoid conflict with Next.js (which might use PORT env var)
unset PORT
exec ./node_modules/.bin/next start -H 0.0.0.0 -p $PORT_TO_USE
