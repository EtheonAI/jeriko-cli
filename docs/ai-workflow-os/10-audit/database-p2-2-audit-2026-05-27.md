# P2.2 Database Package Audit

Date: 2026-05-27

Package: `@repo/database`

Status: completed before P2.2 database cleanup

## Current Package Surface

Files audited:

- `packages/database/package.json`
- `packages/database/drizzle.config.ts`
- `packages/database/keys.ts`
- `packages/database/src/client.ts`
- `packages/database/src/index.ts`
- `packages/database/src/service-client.ts`
- `packages/database/src/service-index.ts`
- `packages/database/src/schema/index.ts`
- `packages/database/src/schema/*.ts`
- `packages/database/src/seed-connectors.ts`
- `packages/database/src/seed-devices.ts`
- `packages/database/scripts/billing-migration.ts`

Active exports before cleanup:

- `@repo/database`
- `@repo/database/client`
- `@repo/database/schema`
- `@repo/database/service`
- `@repo/database/service-index`
- `@repo/database/keys`

Active consumers:

- `@repo/auth` consumes auth/user/org tables and `db`.
- `apps/app/env.ts` consumes `@repo/database/keys`.
- `apps/app/app/api/health/route.ts` consumes `@repo/database`.
- `apps/studio` declares `@repo/database` as a workspace dependency.

No active non-doc consumer imports:

- `@repo/database/service`
- `@repo/database/service-index`
- `packages/database/src/service-client.ts`
- `packages/database/src/service-index.ts`
- `packages/database/src/seed-connectors.ts`
- `packages/database/src/seed-devices.ts`
- `packages/database/scripts/billing-migration.ts`

## Findings

### Keep

- Drizzle + Neon serverless HTTP client direction.
- T3 Env `DATABASE_URL` contract.
- Multi-file Drizzle schema organization.
- Existing migrations and snapshots.
- Current schema exports needed by auth, app, and future package phases.

### Refactor

- `src/client.ts` creates the active database client but does not import `server-only`; add it to enforce server-only usage.
- `@repo/database/service` and `@repo/database/service-index` are leftovers from the removed services architecture.

### Delete

- `src/service-client.ts` and `src/service-index.ts`: no active source consumers; they duplicate the regular database client but intentionally omit server-only behavior for removed services.
- `src/seed-connectors.ts` and `src/seed-devices.ts`: old Manus-era seed datasets; no package scripts or active consumers.
- `scripts/billing-migration.ts`: one-off raw SQL billing/plan migration and seed script; no package script or active consumer. Billing seed/migration ownership belongs to P5.1 payments/database migration work, not a cleanup package script.

### Defer

- Removing old schema tables such as devices, websites, smart-home, media, and website-builder tables. They are present in committed migrations; removal requires a migration/data-retention decision.
- Better Auth generated schema comparison and join optimization. This belongs to a focused auth/database schema conformance pass.
- Workflow-native tables. These require a future MADR after `@repo/flow` contracts stabilize.
- Payment/usage/billing model redesign. This belongs to P5.1.

## Validation Before Cleanup

Commands:

```bash
npm view drizzle-orm version dist-tags --json
npm view drizzle-kit version dist-tags --json
npm view @neondatabase/serverless version dist-tags --json
npm view @paralleldrive/cuid2 version dist-tags --json
pnpm outdated --filter @repo/database --format json
pnpm --filter @repo/database typecheck
rg "@repo/database/(service|service-index)|service-client|service-index" apps packages docs
rg "seed-connectors|seed-devices|billing-migration" . --glob '!legacy/**'
```

Results:

- `drizzle-orm` stable latest: `0.45.2`.
- `drizzle-kit` stable latest: `0.31.10`.
- `@neondatabase/serverless` stable latest: `1.1.0`.
- `@paralleldrive/cuid2` stable latest: `3.3.0`.
- `pnpm outdated --filter @repo/database --format json` returned `{}`.
- `@repo/database` typecheck passed before cleanup.
- Service clients/exports and seed scripts have no active non-doc consumers.

## Cleanup Checklist

- [x] Update package playbook and MADR before code changes.
- [x] Remove `@repo/database/service` export.
- [x] Remove `@repo/database/service-index` export.
- [x] Delete `src/service-client.ts`.
- [x] Delete `src/service-index.ts`.
- [x] Delete `src/seed-connectors.ts`.
- [x] Delete `src/seed-devices.ts`.
- [x] Delete `scripts/billing-migration.ts`.
- [x] Add `server-only` to `src/client.ts`.
- [x] Run `@repo/database` typecheck.
- [x] Run affected auth/app typechecks.
- [x] Run root tests.
- [x] Confirm no active source references deleted surfaces.

## Validation After Cleanup

Commands:

```bash
pnpm --filter @repo/database typecheck
pnpm --filter @repo/auth typecheck
pnpm --filter app typecheck
pnpm test
DATABASE_URL=postgresql://user:pass@localhost:5432/jeriko pnpm --filter @repo/database exec drizzle-kit check
rg "@repo/database/(service|service-index)|service-client|service-index|seed-connectors|seed-devices|billing-migration" apps packages
```

Results:

- `@repo/database` typecheck passed.
- `@repo/auth` typecheck passed.
- `apps/app` typecheck passed.
- root `pnpm test` passed: 14 files / 50 tests.
- `drizzle-kit check` passed with the package config.
- Active app/package source has no references to deleted service exports, service clients, seed scripts, or billing migration script.
- Adding `server-only` required a test-only alias in `apps/app/vitest.config.ts`; production code keeps the server-only guard.
