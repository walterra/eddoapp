# Multi-stage build for production deployment
FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY packages/core-shared/package.json ./packages/core-shared/
COPY packages/core-server/package.json ./packages/core-server/
COPY packages/core-client/package.json ./packages/core-client/
COPY packages/web-client/package.json ./packages/web-client/
COPY packages/web-api/package.json ./packages/web-api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build:core-shared \
  && pnpm build:core-server \
  && pnpm build:core-client \
  && pnpm build:web-client \
  && pnpm build:web-api

# Production stage
FROM node:22-alpine AS production

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files for production dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY packages/core-shared/package.json ./packages/core-shared/
COPY packages/core-server/package.json ./packages/core-server/
COPY packages/core-client/package.json ./packages/core-client/
COPY packages/web-client/package.json ./packages/web-client/
COPY packages/web-api/package.json ./packages/web-api/

# Install production dependencies only
ENV HUSKY=0
ENV NPM_CONFIG_IGNORE_SCRIPTS=1
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=builder /app/packages/web-api/dist ./packages/web-api/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

# Start the application
CMD ["pnpm", "start:production"]