# Dockerfile for production
# This is a multi-stage build to create a small, optimized production image.

# 1. Base Stage: Get Node.js
FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g patch-package

# 2. Dependencies Stage: Install npm packages
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# 3. Build Stage: Build the Next.js app
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 4. Runner Stage: Create the final, small image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built assets from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/data ./data

# Expose the port the app runs on
EXPOSE 9002

# Set the user to a non-root user for security
USER node

# The command to run the application
CMD ["node", "server.js"]
