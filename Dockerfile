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
# Install pnpm
RUN npm install -g pnpm@10.28.0

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
COPY ui/package.json ui/pnpm-lock.yaml ./
# Use pnpm install instead of npm ci
RUN pnpm install --frozen-lockfile

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
# Copy pnpm-lock.yaml instead of package-lock.json if needed by runtime (Next.js sometimes checks lockfile for dependency resolution optimization)
# But more importantly copy node_modules
# Note: pnpm node_modules structure might contain symlinks. Distroless image might not handle copying symlinks well if the source is not present?
# But `COPY` should dereference if we copy directories? No.
# If `pnpm` uses hardlinks to store, copying across stages might break if store is not copied?
# However, `pnpm install` in Docker without mount usually copies files into node_modules (hardlinked), so copying the folder should work as files.
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
