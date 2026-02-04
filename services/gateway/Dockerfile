# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./

# Copy package files for dependency installation
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/database/package.json packages/database/
COPY packages/service-utils/package.json packages/service-utils/
COPY services/gateway/package.json services/gateway/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter=@rubic/gateway...

# Copy source files
COPY packages/typescript-config packages/typescript-config/
COPY packages/database packages/database/
COPY packages/service-utils packages/service-utils/
COPY services/gateway services/gateway/

# Build packages and service
RUN pnpm turbo build --filter=@rubic/gateway

# Production stage
FROM node:20-alpine AS runner

# Add labels
LABEL org.opencontainers.image.source="https://github.com/etheon/rubic"
LABEL org.opencontainers.image.description="Rubic Gateway Service"
LABEL org.opencontainers.image.licenses="MIT"

# Install security updates
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate \
    && apk update && apk upgrade --no-cache

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 rubic

# Set working directory
WORKDIR /app

# Copy production dependencies
COPY --from=builder --chown=rubic:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=rubic:nodejs /app/packages/service-utils/dist ./packages/service-utils/dist
COPY --from=builder --chown=rubic:nodejs /app/packages/service-utils/package.json ./packages/service-utils/
COPY --from=builder --chown=rubic:nodejs /app/services/gateway/dist ./services/gateway/dist
COPY --from=builder --chown=rubic:nodejs /app/services/gateway/package.json ./services/gateway/

# Set environment
ENV NODE_ENV=production
ENV PORT=4001

# Switch to non-root user
USER rubic

# Expose port
EXPOSE 4001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4001/health || exit 1

# Start the service
WORKDIR /app/services/gateway
CMD ["node", "dist/index.js"]
