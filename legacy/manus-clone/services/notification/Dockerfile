FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate
RUN apk add --no-cache wget

FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx turbo prune @jeriko/notification --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=@jeriko/notification
RUN pnpm deploy --filter=@jeriko/notification --prod /deployed

FROM node:22-alpine AS runner
RUN apk add --no-cache wget
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -s /bin/sh -D jeriko

WORKDIR /app

COPY --from=installer /deployed/node_modules ./node_modules
COPY --from=installer /deployed/package.json ./
COPY --from=installer /app/services/notification/dist ./dist

USER jeriko

ENV NODE_ENV=production
EXPOSE 4006

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4006/health || exit 1

CMD ["node", "dist/index.js"]
