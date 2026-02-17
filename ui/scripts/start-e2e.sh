#!/bin/sh
set -e

cleanup() {
  echo "--- Backend Logs (/app/backend.log) ---"
  cat /app/backend.log || echo "No backend log found."
  echo "--- End Backend Logs ---"
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

# Start backend in background with logging
# Use go run to ensure runtime compatibility and logging. GOWORK=off ensures we use go.mod.
(cd ../server && GOWORK=off CGO_ENABLED=1 /usr/local/go/bin/go run cmd/server/main.go 2>&1 | tee /app/backend.log) &

# Wait for backend to be ready
./node_modules/.bin/tsx scripts/wait-for-backend.ts

# Start frontend
PORT_TO_USE=${1:-3000}
echo "Frontend starting on port $PORT_TO_USE..."
./node_modules/.bin/next start -H 0.0.0.0 -p $PORT_TO_USE
