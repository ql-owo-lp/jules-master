#!/bin/bash
set -e

# Start Go Backend in background
echo "Starting Go Backend..."
cd backend
export SQLITE_DB_PATH=../data/sqlite.db
go run ./cmd/server/main.go &
BACKEND_PID=$!
cd ..


echo "Go Backend started with PID $BACKEND_PID"

# Wait for backend to be ready (simple sleep)
sleep 2

# Run Test
echo "Running UI Tests..."
# We run a subset or all. 'make test' runs unit and e2e.
# npm run test:e2e might be enough if we trust unit tests?
# But user said "ensure features are as expected".
# We'll run 'npm run test:e2e' specifically as that exercises the full stack.
# We also need to make sure Next.js is running? 'playwright test' usually starts the web server if configured in playwright.config.ts?
# Let's check playwright.config.ts. If it uses 'npm run dev', it works.
# But we need to ensure the Go backend is running FOR the next.js app.
# The 'npm run test:e2e' will start next.js -> next.js call localhost:8080 (Go).
npm run test:e2e

TEST_EXIT_CODE=$?

# Kill backend
echo "stopping backend..."
kill $BACKEND_PID

exit $TEST_EXIT_CODE
