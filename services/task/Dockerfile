FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY services/task ./services/task

RUN pnpm install --frozen-lockfile

WORKDIR /app/services/task
RUN pnpm build

FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/services/task/dist ./services/task/dist
COPY --from=base /app/services/task/package.json ./services/task/

WORKDIR /app/services/task

ENV NODE_ENV=production

EXPOSE 3002

CMD ["node", "dist/index.js"]
