# Database Package Playbook

Package: `@repo/database`

Date: 2026-05-27

Status: active P2.2 package cleanup

Priority: P2 foundation package

## Ownership

What this package owns:

- Drizzle table schemas;
- Drizzle relation definitions;
- database client factories;
- migrations and Drizzle Kit commands;
- database env contract.

What this package must not own:

- app route handlers;
- auth provider behavior beyond exported schema/client support;
- workflow parser/runtime logic;
- provider SDKs outside persistence concerns.

## Current Surface

Exports:

- `@repo/database`
- `@repo/database/client`
- `@repo/database/schema`
- `@repo/database/keys`

Provider SDKs:

- `drizzle-orm`
- `drizzle-kit`
- `@neondatabase/serverless`

Env keys:

- package-local `keys.ts`; deeper env review is deferred to the database package modernization phase.

## Sources Checked

| Source                                                       | Type              | Checked Date | Claim Used                                                                                                        |
| ------------------------------------------------------------ | ----------------- | -----------: | ----------------------------------------------------------------------------------------------------------------- |
| `https://orm.drizzle.team/docs/sql-schema-declaration`       | Official docs     |   2026-05-27 | Drizzle schema is the TypeScript source of truth and can be organized across exported schema files.               |
| `https://orm.drizzle.team/docs/kit-overview`                 | Official docs     |   2026-05-27 | Drizzle Kit supports generate/migrate/push/pull/check/up/studio and requires dialect/schema config.               |
| `https://orm.drizzle.team/docs/drizzle-kit-push`             | Official docs     |   2026-05-27 | `push` applies direct schema diffs; useful but not a replacement for reviewed migrations.                         |
| `https://orm.drizzle.team/docs/get-started-postgresql`       | Official docs     |   2026-05-27 | PostgreSQL drivers differ; this repo currently uses Neon serverless HTTP.                                         |
| `https://better-auth.com/docs/adapters/drizzle`              | Official docs     |   2026-05-27 | Better Auth schema mapping matters when table names differ; relation passthrough is needed for join optimization. |
| `npm view drizzle-orm version dist-tags --json`              | Registry metadata |   2026-05-27 | Stable latest `drizzle-orm` is `0.45.2`, matching the package.                                                    |
| `npm view drizzle-kit version dist-tags --json`              | Registry metadata |   2026-05-27 | Stable latest `drizzle-kit` is `0.31.10`, matching the package.                                                   |
| `npm view @neondatabase/serverless version dist-tags --json` | Registry metadata |   2026-05-27 | Stable latest is `1.1.0`, matching the package.                                                                   |
| `npm view @paralleldrive/cuid2 version dist-tags --json`     | Registry metadata |   2026-05-27 | Stable latest is `3.3.0`, matching the package.                                                                   |
| Local package audit                                          | Repo evidence     |   2026-05-27 | Service clients/exports and seed scripts have no active non-doc consumers after service removal.                  |

## Local Audit

Commands:

```bash
rg "@repo/database/(service|service-index)|service-client|service-index" apps packages docs
rg "seed-connectors|seed-devices|billing-migration" . --glob '!legacy/**'
pnpm outdated --filter @repo/database --format json
pnpm --filter @repo/database typecheck
```

Findings:

- Direct package dependencies are current on stable dist-tags.
- Existing multi-file schema is valid Drizzle organization and should not be flattened.
- Old service database exports have no active source consumers.
- Old connector/device seed scripts have no active source consumers or package scripts.
- One-off billing migration script has no package script or active source consumer.
- Schema/migration deletion is out of scope because it is a data-retention and migration decision.

## Decision

Verdict: refactor service/script leftovers, preserve schema and migrations.

Reason:

- Keep the active `@repo/database` and schema exports stable for auth/app consumers.
- Remove only unused service-era entrypoints and one-off scripts.
- Enforce server-only client usage in the active database client.
- Do not alter migrations or database table names in cleanup.

## P2.2 Refactor Checklist

- [x] Research current Drizzle/Neon/Better Auth database docs and npm latest.
- [x] Audit database package exports, deps, env, scripts, schema, and active consumers.
- [x] Write MADR-087.
- [x] Remove `@repo/database/service` export.
- [x] Remove `@repo/database/service-index` export.
- [x] Delete `src/service-client.ts`.
- [x] Delete `src/service-index.ts`.
- [x] Delete `src/seed-connectors.ts`.
- [x] Delete `src/seed-devices.ts`.
- [x] Delete `scripts/billing-migration.ts`.
- [x] Add `server-only` to `src/client.ts`.
- [x] Run `pnpm --filter @repo/database typecheck`.
- [x] Run affected auth/app typechecks.
- [x] Run root `pnpm test`.

## Validation

```bash
pnpm --filter @repo/database typecheck
pnpm --filter @repo/auth typecheck
pnpm --filter app typecheck
pnpm test
DATABASE_URL=postgresql://user:pass@localhost:5432/jeriko pnpm --filter @repo/database exec drizzle-kit check
```

Latest validation:

- `pnpm --filter @repo/database typecheck` passed.
- `pnpm --filter @repo/auth typecheck` passed.
- `pnpm --filter app typecheck` passed.
- root `pnpm test` passed: 14 files / 50 tests.
- `drizzle-kit check` passed.

## Open Risks

- The package still has a large Manus-era schema surface; P2.2 cleanup does not mean product schema is final.
- Workflow-native tables should be added later through a dedicated migration and MADR, not during cleanup.
- Current `agent_sessions.activeStreamId` and `messages.parts` are resume-related hints, but they are not a complete workflow resume model.
- Future workflow-native persistence must satisfy MADR-096 with `workflow_runs`, `run_events`, task events, artifacts, active stream/run mapping, cursors, and cancellation records.
- Better Auth schema conformance and joins need a later focused pass.
