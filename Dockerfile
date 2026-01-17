# 1. Go Builder Stage
FROM golang:1.24-bookworm AS go-builder
WORKDIR /app
# Install build dependencies if needed (gcc is included in bookworm)
# RUN apt-get update && apt-get install -y gcc
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ .
RUN go build -o server cmd/server/main.go

# 2. Node Builder Stage
FROM node:24 AS node-builder
WORKDIR /app
# Copy UI package files
COPY ui/package.json ui/package-lock.json ./
RUN npm install -g npm@latest
RUN npm ci
# Copy UI source
COPY ui/ .
RUN npm run build --debug
RUN mkdir -p /app/data

# 3. Final Stage
FROM gcr.io/distroless/nodejs24-debian12 AS runner
WORKDIR /app
# Set DB URL
ENV DATABASE_URL=/app/data/sqlite.db

# Copy Next.js assets
COPY --from=node-builder /app/.next ./.next
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/package.json ./package.json
COPY --from=node-builder /app/start.js ./
COPY --from=node-builder /app/src/lib/db ./src/lib/db
COPY --from=node-builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=node-builder /app/data /app/data

# Copy Go backend binary
COPY --from=go-builder /app/server /app/server

# Expose ports (9002 for frontend, 50051 for backend (internal))
EXPOSE 9002

# Volume
VOLUME /app/data


CMD ["start.js"]
