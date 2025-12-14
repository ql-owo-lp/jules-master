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

# Create the data directory
RUN mkdir -p /app/data


# 2. Runner Stage: Create the final, minimal production image
FROM gcr.io/distroless/nodejs22-debian12 AS runner

# Set working directory
WORKDIR /app

# Set the database URL environment variable
ENV DATABASE_URL=/app/data/sqlite.db

# Copy built assets, startup script, and data directory from the builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/start.js ./
COPY --from=builder /app/src/lib/db ./src/lib/db
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/data /app/data

# Expose the port the app runs on
EXPOSE 9002

# Declare a volume for the database data
VOLUME /app/data

# Set the command to our startup script
ENV NODE_OPTIONS='--expose-gc'
CMD ["start.js"]
