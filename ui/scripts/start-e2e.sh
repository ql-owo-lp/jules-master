#!/bin/sh
set -e

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
# Use go run to ensure runtime compatibility and logging
(cd ../server && CGO_ENABLED=1 /usr/local/go/bin/go run cmd/server/main.go 2>&1 | tee /app/backend.log) &

# Wait for backend to be ready
./node_modules/.bin/tsx scripts/wait-for-backend.ts

# Start frontend
# $1 is the port passed from playwright config
npm start -- -H 127.0.0.1 -p $1
