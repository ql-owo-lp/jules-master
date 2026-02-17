#!/bin/sh
set -e

cleanup() {
  echo "--- Backend Logs (/app/backend.log) ---"
  cat /app/backend.log || echo "No backend log found."
  echo "--- End Backend Logs ---"
  echo "--- System Info ---"
  ps aux || echo "ps failed"
  node --version
  /usr/local/go/bin/go version || echo "go not found"
  ./node_modules/.bin/next --version
}
trap cleanup EXIT

# Cleanup DB
rm -f e2e_jules.db*
export DATABASE_URL=e2e_jules.db

# Run migrations and seed
./node_modules/.bin/tsx src/lib/db/migrate.ts
./node_modules/.bin/tsx scripts/seed-e2e.ts

# Ensure permissions
chmod -R 777 .

# Backend Setup
export PORT=50051
export JULES_API_KEY='mock-api-key'

# Start backend in background with logging
echo "Starting backend..."
(cd ../server && GOWORK=off go mod download && CGO_ENABLED=1 /usr/local/go/bin/go run cmd/server/main.go > /app/backend.log 2>&1) &

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
# Use next start directly (without exec to ensure trap runs)
./node_modules/.bin/next start -H 0.0.0.0 -p $PORT_TO_USE
EXIT_CODE=$?
echo "Frontend exited with code $EXIT_CODE"
exit $EXIT_CODE
