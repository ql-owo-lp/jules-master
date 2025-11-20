# 1. Builder Stage: Build the Next.js application
FROM node:22-slim AS builder

# Set working directory
WORKDIR /app

# Copy package.json and lock files
COPY package.json ./
COPY package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the Next.js application for production
RUN npm run build --debug

# 2. Runner Stage: Create the final, minimal production image
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner

# Set working directory
WORKDIR /app

# Set the user to the non-root user provided by the distroless image
USER nonroot

# Copy built assets from the builder stage
COPY --from=builder --chown=nonroot:nonroot /app/.next ./.next
COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./package.json

# Expose the port the app runs on
EXPOSE 9002

# Start the Next.js application
CMD ["./node_modules/next/dist/bin/next", "start", "-p", "9002"]
