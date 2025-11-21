# 1. Builder Stage: Build the Next.js application
FROM node:22 AS builder

# Set working directory
WORKDIR /app

# Copy package.json and lock files
COPY package.json ./
COPY package-lock.json ./

# Update npm to the latest version
RUN npm install -g npm@latest

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

# Create a directory for the database
RUN mkdir /app/data

# Set the database URL environment variable
ENV DATABASE_URL=/app/data/sqlite.db

# Copy built assets and entrypoint script from the builder stage
COPY --from=builder --chown=nonroot:nonroot /app/.next ./.next
COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./package.json
COPY --from=builder --chown=nonroot:nonroot /app/entrypoint.sh ./

# Expose the port the app runs on
EXPOSE 9002

# Set the entrypoint to our script
ENTRYPOINT ["./entrypoint.sh"]

# Start the Next.js application
CMD ["./node_modules/next/dist/bin/next", "start", "-p", "9002"]
