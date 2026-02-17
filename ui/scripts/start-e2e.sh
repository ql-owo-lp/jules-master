#!/bin/sh
set -e

# Variable to hold PIDs
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo "--- Backend Logs (/app/backend.log) ---"
  cat /app/backend.log || echo "No backend log found."
  echo "--- End Backend Logs ---"

  echo "--- Frontend Logs (/app/frontend.log) ---"
  cat /app/frontend.log || echo "No frontend log found."
  echo "--- End Frontend Logs ---"

  echo "Cleaning up processes..."
  if [ -n "$FRONTEND_PID" ]; then
    echo "Killing frontend PID $FRONTEND_PID"
    kill $FRONTEND_PID 2>/dev/null || true
  fi
  if [ -n "$BACKEND_PID" ]; then
    echo "Killing backend PID $BACKEND_PID"
    kill $BACKEND_PID 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Cleanup DB
echo "Cleaning up DB..."
rm -f e2e_jules.db*
# Use absolute path to ensure backend (running in different dir) connects to same DB
export DATABASE_URL=$(pwd)/e2e_jules.db

# Run migrations and seed with retry
echo "Running migrations..."
MAX_RETRIES=3
RETRY_COUNT=0
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

# Start backend in background with logging (using exec to keep PID valid)
echo "Starting backend..."
# Use GOWORK=off and direct go run.
# Ensure logs are redirected properly.
(cd ../server && GOWORK=off go mod download && CGO_ENABLED=1 exec /usr/local/go/bin/go run cmd/server/main.go > /app/backend.log 2>&1) &
BACKEND_PID=$!
echo "Backend started with PID $BACKEND_PID"

# Wait for backend to be ready
echo "Waiting for backend..."
if ! ./node_modules/.bin/tsx scripts/wait-for-backend.ts; then
  echo "Wait for backend failed."
  exit 1
fi

# Start frontend
PORT_TO_USE=3000
echo "Frontend starting on port $PORT_TO_USE..."
# Unset PORT to avoid conflict with Next.js (which might use PORT env var)
unset PORT

# Start frontend in background
# Disable turbopack (via direct next usage) to improve stability in CI/Docker
# Ensure we bind to 0.0.0.0
export HOSTNAME=0.0.0.0
./node_modules/.bin/next dev -H 0.0.0.0 -p $PORT_TO_USE > /app/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID $FRONTEND_PID"

# Use npx wait-on if available, otherwise fallback to curl loop
echo "Waiting for frontend..."
# Timeout 300s (5m)
if npx wait-on -t 300000 http://127.0.0.1:$PORT_TO_USE; then
  echo "Frontend is ready."
else
  echo "wait-on failed, falling back to curl loop check..."
  # Simple shell-based wait for frontend with better logging
  MAX_WAIT_RETRIES=120 # 2 minutes
  WAIT_COUNT=0
  while ! curl -s "http://127.0.0.1:$PORT_TO_USE" > /dev/null && ! curl -s "http://localhost:$PORT_TO_USE" > /dev/null; do
    WAIT_COUNT=$((WAIT_COUNT+1))
    if [ $WAIT_COUNT -ge $MAX_WAIT_RETRIES ]; then
      echo "Frontend failed to start after curl retries."
      # Diagnostic info
      ps aux | grep next || echo "Next process not found"
      netstat -tulpn 2>/dev/null || ss -tulpn 2>/dev/null || echo "Network tools not found"
      cat /app/frontend.log
      exit 1
    fi
    sleep 1
  done
fi

echo "Frontend is ready on port $PORT_TO_USE."

if [ "$#" -gt 0 ]; then
  # Run the provided command (tests)
  echo "Running provided command: $@"
  "$@"
  EXIT_CODE=$?
  echo "Command exited with code $EXIT_CODE"
  exit $EXIT_CODE
else
  # Wait for frontend process to exit (default behavior if no args)
  wait $FRONTEND_PID
  EXIT_CODE=$?
  echo "Frontend exited with code $EXIT_CODE"
  exit $EXIT_CODE
fi
