FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY services/gateway ./services/gateway

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the service
WORKDIR /app/services/gateway
RUN pnpm build

# Production image
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

WORKDIR /app

# Copy built files
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/services/gateway/dist ./services/gateway/dist
COPY --from=base /app/services/gateway/package.json ./services/gateway/

WORKDIR /app/services/gateway

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/index.js"]
