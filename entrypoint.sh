#!/bin/sh

# Run the database migrations
npm run db:migrate

# Start the application
exec "$@"
