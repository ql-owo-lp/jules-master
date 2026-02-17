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

  echo "--- System Info ---"
  ps aux || echo "ps failed"
  node --version
  /usr/local/go/bin/go version || echo "go not found"
  ./node_modules/.bin/next --version

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

# Start backend in background with logging (using exec to keep PID valid)
echo "Starting backend..."
# Use relative path to server directory, but handle case where module download is redundant
# because Dockerfile already did it.
(cd ../server && CGO_ENABLED=1 exec /usr/local/go/bin/go run cmd/server/main.go > /app/backend.log 2>&1) &
BACKEND_PID=$!
echo "Backend started with PID $BACKEND_PID"

# Wait for backend to be ready
echo "Waiting for backend..."
if ! ./node_modules/.bin/tsx scripts/wait-for-backend.ts; then
  echo "Wait for backend failed."
  exit 1
fi

# Start frontend
PORT_TO_USE=${1:-3000}
echo "Frontend starting on port $PORT_TO_USE..."
# Unset PORT to avoid conflict with Next.js (which might use PORT env var)
unset PORT

# Start frontend in background
# Use production build for faster startup and reliability
./node_modules/.bin/next start -H 0.0.0.0 -p $PORT_TO_USE > /app/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID $FRONTEND_PID"

# Wait for frontend to be ready using the script
echo "Waiting for frontend..."
if ! ./node_modules/.bin/tsx scripts/wait-for-frontend.ts $PORT_TO_USE; then
  echo "Wait for frontend failed."
  exit 1
fi

echo "Frontend is ready on port $PORT_TO_USE."

# Wait for frontend process to exit
wait $FRONTEND_PID
EXIT_CODE=$?
echo "Frontend exited with code $EXIT_CODE"
exit $EXIT_CODE
