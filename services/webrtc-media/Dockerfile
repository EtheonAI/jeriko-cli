# syntax=docker/dockerfile:1.4
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ===== Dependencies Stage =====
FROM base AS deps
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc turbo.json ./

# Turbo prune for webrtc-media service
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm add -g turbo && \
    turbo prune webrtc-media --docker

# ===== Builder Stage =====
FROM base AS builder
WORKDIR /app

# Copy pruned workspace
COPY --from=deps /app/out/json/ ./
COPY --from=deps /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install dependencies with cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source files
COPY --from=deps /app/out/full/ ./
COPY tsconfig.json ./

# Build the service
RUN pnpm turbo build --filter=webrtc-media

# ===== Production Stage =====
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 rubic && \
    adduser --system --uid 1001 --ingroup rubic rubic

# Copy built files and node_modules
COPY --from=builder --chown=rubic:rubic /app/services/webrtc-media/dist ./dist
COPY --from=builder --chown=rubic:rubic /app/node_modules ./node_modules
COPY --from=builder --chown=rubic:rubic /app/services/webrtc-media/node_modules ./service_modules
COPY --from=builder --chown=rubic:rubic /app/services/webrtc-media/package.json ./package.json

# Copy packages that are dependencies
COPY --from=builder --chown=rubic:rubic /app/packages ./packages

USER rubic

EXPOSE 4016

ENV NODE_ENV=production
ENV PORT=4016

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4016/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

CMD ["node", "dist/index.js"]
