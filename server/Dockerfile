FROM golang:1.24.3-alpine AS builder

WORKDIR /app

# Install dependencies required for go-sqlite3
RUN apk add --no-cache gcc musl-dev git

# Copy go mod and sum files
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN go build -o server cmd/server/main.go

# Final stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies for sqlite3 if needed (often static, but good to have libc compat)
# using CGO_ENABLED=1 means we link against libc. Alpine uses musl.
# verify if we need additional libs. glibc compatibility might be needed if not careful, 
# but building on alpine (musl) for alpine (musl) is standard.
RUN apk add --no-cache ca-certificates

COPY --from=builder /app/server .

# Expose port
EXPOSE 50051

# Run the server
CMD ["./server"]
