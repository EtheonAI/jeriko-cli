# MADR-034: Deactivate Redundant API App and Legacy Compose Services

**Status:** Accepted

## Context

After the old Manus-style services were moved to `legacy/manus-clone`, the active repo still had configuration surfaces pointing at removed or redundant runtime boundaries:

- `apps/api` remained an active workspace app even though its local route surface was only health/cron style behavior and the main app already owns product API routes under `apps/app/app/api`.
- root Vitest project config still referenced `apps/api`, `packages/service-utils`, and every old service test config.
- root Docker Compose files still described old Fastify service builds under `services/*`, which no longer exists as an active top-level directory.
- root ESLint still listed `apps/api` as a Next app root.

Keeping those surfaces active made the repo look larger and more runnable than it actually is.

## Decision

Deactivate the redundant standalone API app and legacy compose service definitions.

- Move `apps/api` to `legacy/deactivated-apps/api`.
- Keep active API work inside `apps/app/app/api` until a concrete separate deploy boundary is proven.
- Move old root compose files to `legacy/manus-clone/docker`.
- Add one active infrastructure compose file: `docker-compose.infra.yml`.
- Replace the deprecated Vitest workspace helper with current `test.projects` config and limit it to active test configs that still exist.
- Remove `apps/api` from the Next ESLint root list.

## Consequences

- The active app graph is smaller and clearer.
- Default workspace install/typecheck/test surfaces no longer point at moved service code.
- Docker now starts local dependencies only: Postgres, Redis, and Typesense.
- If a separate API app is needed later, it must be reintroduced intentionally with route ownership, deploy ownership, env scope, and tests.

## Alternatives Considered

- Keep `apps/api` active and keep fixing it. Rejected because no current route ownership justified another Next deploy.
- Delete `apps/api` immediately. Rejected because it is cheap to keep briefly as reference while app route replacement is audited.
- Keep old compose files in root. Rejected because they reference inactive service paths and make local infra misleading.

## Evidence

- Next.js App Router route handlers can live inside the app route tree, and project files can be colocated safely until `page` or `route` files make routes public.
- Next.js supports route groups, private folders, and optional `src` to organize route ownership without creating extra apps.
- Turborepo classifies deployable apps as application packages and recommends that application packages sit at the end of the package graph.
- Vercel monorepo docs expect each deployable project directory to be intentional.
- Vitest 4 documents test projects through `test.projects`; the old workspace naming is deprecated.

Sources:

- `https://nextjs.org/docs/app/getting-started/project-structure`
- `https://turborepo.com/repo/docs/core-concepts/package-types`
- `https://vercel.com/docs/monorepos`
- `https://vitest.dev/guide/projects`

## Impacted Files

- `apps/api` -> `legacy/deactivated-apps/api`
- `docker-compose.services.yml` -> `legacy/manus-clone/docker/docker-compose.services.legacy.yml`
- `docker-compose.dev.yml` -> `legacy/manus-clone/docker/docker-compose.dev.legacy.yml`
- `docker-compose.prod.yml` -> `legacy/manus-clone/docker/docker-compose.prod.legacy.yml`
- `docker-compose.typesense.yml` -> `legacy/manus-clone/docker/docker-compose.typesense.legacy.yml`
- `docker-compose.infra.yml`
- `eslint.config.mjs`
- `vitest.workspace.ts` -> `vitest.config.ts`
- `package.json`
- `pnpm-lock.yaml`

## Validation Checklist

- [x] `apps/api` is no longer under active `apps/*`.
- [x] root ESLint no longer lists `apps/api`.
- [x] Vitest config no longer references moved legacy services.
- [x] root infra scripts point at `docker-compose.infra.yml`.
- [x] `legacy/**/node_modules`, `legacy/**/.turbo`, and `legacy/**/dist` generated directories removed.
- [x] `pnpm install`
- [x] `pnpm -r list --depth -1`
- [x] `pnpm --filter app typecheck`
- [x] `pnpm --filter web typecheck`
- [x] `pnpm --filter @repo/contracts typecheck`
- [x] `pnpm exec vitest list --passWithNoTests`
- [x] `pnpm exec vitest run --project @repo/contracts --passWithNoTests`
- [x] `pnpm exec vitest run --project @repo/search --passWithNoTests`
- [x] `pnpm exec turbo run typecheck --dry` shows no `apps/api`, no `@repo/service-utils`, and no `@jeriko/*` service packages.
