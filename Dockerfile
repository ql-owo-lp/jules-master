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
FROM node:24 AS node-builder
RUN apt-get update && apt-get install -y curl unzip
# Install pnpm (optional, but we use npm now)
# RUN npm install -g pnpm

RUN PROTOC_VERSION="29.3" && \
    ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
      PROTOC_ARCH="linux-x86_64"; \
    elif [ "$ARCH" = "aarch64" ]; then \
      PROTOC_ARCH="linux-aarch_64"; \
    else \
      echo "Unsupported architecture: $ARCH" && exit 1; \
    fi && \
    curl -LO "https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VERSION}/protoc-${PROTOC_VERSION}-${PROTOC_ARCH}.zip" && \
    unzip -o "protoc-${PROTOC_VERSION}-${PROTOC_ARCH}.zip" -d /usr/local && \
    rm "protoc-${PROTOC_VERSION}-${PROTOC_ARCH}.zip"
WORKDIR /app

# Copy UI package files and proto files
COPY ui/package.json ui/package-lock.json ./
# Use npm ci instead of pnpm to avoid symlink issues in multi-stage builds
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
    --proto_path=proto \
    --proto_path=/usr/local/include \
    proto/*.proto

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
# Copy node_modules (npm structure is flat and safe to copy)
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/package.json ./package.json
COPY --from=node-builder /app/start.js ./
# Copy entire src folder to ensure all dependencies for migrations/scripts are present
COPY --from=node-builder /app/src ./src
COPY --from=node-builder /app/tsconfig.json ./tsconfig.json
COPY --from=node-builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=node-builder /app/data /app/data

# Copy Go backend binary
COPY --from=go-builder /app/server /app/server

# Expose ports (9002 for frontend, 50051 for backend (internal))
EXPOSE 9002

# Volume
VOLUME /app/data


CMD ["start.js"]
