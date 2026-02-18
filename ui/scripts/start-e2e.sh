#!/bin/sh
set -e

# Variable to hold PIDs
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo "--- Cleanup initiated ---"

  if [ -n "$FRONTEND_PID" ]; then
    echo "Killing frontend PID $FRONTEND_PID"
    kill $FRONTEND_PID 2>/dev/null || true
  fi
  if [ -n "$BACKEND_PID" ]; then
    echo "Killing backend PID $BACKEND_PID"
    kill $BACKEND_PID 2>/dev/null || true
  fi

  # Force kill any lingering processes on ports
  fuser -k 3000/tcp 2>/dev/null || true
  fuser -k 50051/tcp 2>/dev/null || true
}
trap cleanup EXIT

# Pre-emptive cleanup
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 50051/tcp 2>/dev/null || true

# Cleanup DB
echo "Cleaning up DB..."
rm -f e2e_jules.db*
export DATABASE_URL=$(pwd)/e2e_jules.db

# Run migrations and seed with retry
echo "Running migrations..."
MAX_RETRIES=3
RETRY_COUNT=0
# Ensure we are in ui directory or path is correct.
# Script is run from /app, and ui is in /app/ui (if built that way) or /app (if Dockerfile copies ui content to /app)
# Dockerfile copies ui/. to /app/.
# So migrate.ts is at src/lib/db/migrate.ts
until ./node_modules/.bin/tsx src/lib/db/migrate.ts; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "Migration failed after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "Migration failed, retrying ($RETRY_COUNT/$MAX_RETRIES)..."
  sleep 2
done

echo "Running seed..."
./node_modules/.bin/tsx scripts/seed-e2e.ts || { echo "Seed failed"; exit 1; }

# Ensure permissions
chmod -R 777 .

# Backend Setup
export PORT=50051
export JULES_API_KEY='mock-api-key'

# Start backend
echo "Starting backend..."
(cd ../server && GOWORK=off go mod download && CGO_ENABLED=1 exec /usr/local/go/bin/go run cmd/server/main.go > /app/backend.log 2>&1) &
BACKEND_PID=$!
echo "Backend started with PID $BACKEND_PID"

# Wait for backend
echo "Waiting for backend..."
if ! ./node_modules/.bin/tsx scripts/wait-for-backend.ts; then
  echo "Wait for backend failed."
  cat /app/backend.log
  exit 1
fi

# Start frontend
PORT_TO_USE=3000
echo "Frontend starting on port $PORT_TO_USE..."
unset PORT

# Check environment
echo "Node version:"
node --version

echo "Starting frontend (next start)..."
export NODE_ENV=production
export HOSTNAME=0.0.0.0
# Increase memory
export NODE_OPTIONS="--max-old-space-size=4096"

# Ensure build exists (if running locally/fresh)
if [ ! -d ".next" ]; then
  echo "Build not found. Building..."
  npm run build || { echo "Build failed"; exit 1; }
fi

# Pipe to stdout for immediate visibility in CI
# Use next start for production-like environment
./node_modules/.bin/next start -H 0.0.0.0 -p $PORT_TO_USE &
FRONTEND_PID=$!
echo "Frontend started with PID $FRONTEND_PID"

# Wait for frontend
echo "Waiting for frontend (curl loop)..."
MAX_WAIT_RETRIES=300 # 5 minutes
WAIT_COUNT=0

# Loop checking all interfaces
while ! curl -s "http://127.0.0.1:$PORT_TO_USE" > /dev/null && ! curl -s "http://localhost:$PORT_TO_USE" > /dev/null && ! curl -s "http://0.0.0.0:$PORT_TO_USE" > /dev/null; do
  WAIT_COUNT=$((WAIT_COUNT+1))
  if [ $WAIT_COUNT -ge $MAX_WAIT_RETRIES ]; then
    echo "Frontend failed to start after $MAX_WAIT_RETRIES attempts."

    echo "--- Process Status ---"
    ps aux | grep next || echo "Next process not found"

    echo "--- Network Status ---"
    netstat -tulpn 2>/dev/null || ss -tulpn 2>/dev/null || echo "Network tools not found"

    # Logs are already in stdout, but we can dump backend log again
    echo "--- Backend Log ---"
    cat /app/backend.log

    exit 1
  fi

  if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "Frontend process $FRONTEND_PID died unexpectedly."
    exit 1
  fi

  if [ $((WAIT_COUNT % 10)) -eq 0 ]; then
      echo "Waiting... ($WAIT_COUNT/$MAX_WAIT_RETRIES)"
  fi
  sleep 1
done

echo "Frontend is ready on port $PORT_TO_USE."

if [ "$#" -gt 0 ]; then
  echo "Running provided command: $@"
  "$@"
  EXIT_CODE=$?
  echo "Command exited with code $EXIT_CODE"
  exit $EXIT_CODE
else
  wait $FRONTEND_PID
  EXIT_CODE=$?
  echo "Frontend exited with code $EXIT_CODE"
  exit $EXIT_CODE
fi
