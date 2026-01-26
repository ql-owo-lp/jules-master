# 1. Go Builder Stage
FROM golang:1.24-bookworm AS go-builder
WORKDIR /app
# Install build dependencies if needed (gcc is included in bookworm)
# RUN apt-get update && apt-get install -y gcc
COPY server/go.mod server/go.sum ./
COPY proto/ /proto/
RUN go mod download
COPY server/ .
RUN go build -o server cmd/server/main.go

# 2. Node Builder Stage
FROM node:22 AS node-builder
RUN apt-get update && apt-get install -y protobuf-compiler
WORKDIR /app

# Copy UI package files and proto files
COPY ui/package.json ui/package-lock.json ./
RUN npm ci

# Copy source code and protos
COPY ui/ .
COPY proto/ /proto/
# Workdir for proto generation
WORKDIR /
RUN protoc --plugin=/app/node_modules/.bin/protoc-gen-ts_proto \
    --ts_proto_out=proto \
    --ts_proto_opt=esModuleInterop=true \
    --ts_proto_opt=outputServices=grpc-js \
    --proto_path=proto proto/*.proto

# Back to app workdir for build
WORKDIR /app
RUN ln -s /app/node_modules /node_modules
RUN npm run build --debug
RUN mkdir -p /app/data

# 3. Final Stage
FROM gcr.io/distroless/nodejs24-debian12 AS runner
WORKDIR /app
# Set DB URL
ENV DATABASE_URL=/app/data/sqlite.db

# Copy Next.js assets
COPY --from=node-builder /app/.next ./.next
COPY --from=node-builder /app/package-lock.json ./package-lock.json
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
