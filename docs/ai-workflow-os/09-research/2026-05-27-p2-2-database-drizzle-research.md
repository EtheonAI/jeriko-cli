# P2.2 Database Package Research

Date: 2026-05-27

Package: `@repo/database`

Status: completed before P2.2 database cleanup

## Sources Checked

| Source                                                       | Type                 | Evidence Used                                                                                                                                                      |
| ------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| https://orm.drizzle.team/docs/sql-schema-declaration         | Official docs        | Drizzle schema is the TypeScript source of truth for queries and migrations; multi-file schema organization is supported when exported for Drizzle Kit.            |
| https://orm.drizzle.team/docs/kit-overview                   | Official docs        | Drizzle Kit supports `generate`, `migrate`, `push`, `pull`, `check`, `up`, and `studio`; config requires at least dialect and schema path.                         |
| https://orm.drizzle.team/docs/drizzle-kit-push               | Official docs        | `push` diffs schema against the database and applies generated SQL directly; useful but not a substitute for reviewed committed migrations in controlled releases. |
| https://orm.drizzle.team/docs/get-started-postgresql         | Official docs        | Drizzle supports PostgreSQL through `node-postgres` and `postgres.js`; this repo currently uses Neon serverless HTTP instead of those drivers.                     |
| https://better-auth.com/docs/adapters/drizzle                | Official docs        | Better Auth Drizzle adapter needs schema mapping when table names differ; joins require relations to be passed through the adapter schema.                         |
| `npm view drizzle-orm version dist-tags --json`              | Registry             | Stable latest is `0.45.2`; `1.0.0-rc.3` is the `rc` tag, not stable latest.                                                                                        |
| `npm view drizzle-kit version dist-tags --json`              | Registry             | Stable latest is `0.31.10`; `1.0.0-rc.3` is the `rc` tag, not stable latest.                                                                                       |
| `npm view @neondatabase/serverless version dist-tags --json` | Registry             | Stable latest is `1.1.0`.                                                                                                                                          |
| `npm view @paralleldrive/cuid2 version dist-tags --json`     | Registry             | Stable latest is `3.3.0`.                                                                                                                                          |
| `npm view postgres version dist-tags --json`                 | Registry             | Stable latest is `3.4.9`; not currently installed by this package.                                                                                                 |
| `pnpm outdated --filter @repo/database --format json`        | Registry/local proof | No outdated direct dependencies reported for `@repo/database`.                                                                                                     |

## Version Verdict

- Keep `drizzle-orm@0.45.2`.
- Keep `drizzle-kit@0.31.10`.
- Keep `@neondatabase/serverless@1.1.0`.
- Keep `@paralleldrive/cuid2@3.3.0`.
- Do not move to Drizzle `1.0.0-rc.*` in cleanup; it is not the stable `latest` dist-tag.

## Implementation Guidance

- Keep Drizzle schema files and existing migrations during cleanup; deleting tables requires a migration/MADR with data-retention impact.
- Keep multi-file schema organization. It matches Drizzle docs and is necessary for this schema size.
- Remove service-era clients/exports only if active consumers are gone.
- Remove seed/one-off scripts only when they have no package script or active consumer.
- Use `server-only` in the active database client so apps cannot accidentally bundle database credentials into client components.
- Do not add workflow-native tables in P2.2; that belongs to a future workflow schema migration phase after `@repo/flow` contracts are settled.
