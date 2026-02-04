FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY services/website ./services/website

RUN pnpm install --frozen-lockfile

WORKDIR /app/services/website
RUN pnpm build

FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/services/website/dist ./services/website/dist
COPY --from=base /app/services/website/package.json ./services/website/

WORKDIR /app/services/website

ENV NODE_ENV=production

EXPOSE 3004

CMD ["node", "dist/index.js"]
