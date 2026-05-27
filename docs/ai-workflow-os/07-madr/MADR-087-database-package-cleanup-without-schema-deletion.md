# MADR-087: Database Package Cleanup Without Schema Deletion

Date: 2026-05-27

Status: accepted

Package: `@repo/database`

## Context

`@repo/database` is a foundation package. It owns Drizzle schemas, migrations, database client creation, and the database env contract.

The repo has already removed the old services architecture from the active workspace. The database package still exposes service-safe client entrypoints and contains old seed/one-off scripts created for Manus-clone service surfaces. These are no longer consumed.

The schema itself is large and contains old product domains. However, those tables are represented in committed migrations and snapshots. Deleting schema tables during a cleanup pass would create data-loss and migration questions outside this phase.

## Decision

Keep the existing schema and migrations in P2.2.

Remove only unused code surfaces:

- `@repo/database/service`
- `@repo/database/service-index`
- `src/service-client.ts`
- `src/service-index.ts`
- `src/seed-connectors.ts`
- `src/seed-devices.ts`
- `scripts/billing-migration.ts`

Add `server-only` to the active database client.

Do not delete old tables or migrations in this cleanup phase.

## Consequences

Positive:

- Removes service-era dead code without touching data model history.
- Keeps app/auth/database consumers stable.
- Makes the active database client safer in Next.js by blocking client-component imports.
- Keeps future schema cleanup as an explicit migration decision.

Negative:

- Old tables remain until a dedicated migration phase.
- Seed data for connectors/devices is removed from active source and must be rebuilt intentionally in connector/device/product phases if needed.
- Billing seed/migration behavior is deferred to the payments phase.

## References

- `docs/ai-workflow-os/09-research/2026-05-27-p2-2-database-drizzle-research.md`
- `docs/ai-workflow-os/10-audit/database-p2-2-audit-2026-05-27.md`
- https://orm.drizzle.team/docs/sql-schema-declaration
- https://orm.drizzle.team/docs/kit-overview
- https://orm.drizzle.team/docs/drizzle-kit-push
- https://orm.drizzle.team/docs/get-started-postgresql
- https://better-auth.com/docs/adapters/drizzle

## Checklist

- [x] Package playbook updated.
- [x] Service database exports removed.
- [x] Service database client files deleted.
- [x] Old seed scripts deleted.
- [x] One-off billing migration script deleted.
- [x] Active database client marked server-only.
- [x] Database package typecheck passes.
- [x] Affected auth/app typechecks pass.
- [x] Root tests pass.
- [x] Drizzle migration collision check passes.

## Validation Notes

- `@repo/database` typecheck passed after cleanup.
- `@repo/auth` and `apps/app` typechecks passed as affected consumers.
- root `pnpm test` passed with 14 files / 50 tests.
- `drizzle-kit check` passed using a dummy local `DATABASE_URL`.
- No active source references the deleted service/seed/script surfaces.
