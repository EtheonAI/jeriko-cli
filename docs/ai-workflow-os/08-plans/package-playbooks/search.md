# Package Playbook: @repo/search

Package: `@repo/search`

Date: 2026-05-26

Status: completed for generic Typesense boundary reset

Priority: P2 platform package

## Ownership

What this package owns:

- Typesense client boundary.
- Package-local search env validation.
- Generic collection/document/search helpers.
- Future workflow/artifact search infrastructure.

What this package must not own:

- Old Manus-specific product domains.
- Workflow schema ownership; `@repo/flow` owns flow/run contracts.
- Artifact metadata ownership; future `@repo/artifacts` owns artifact contracts.
- App route handlers or UI.
- Web-search tools; server-only `@repo/ai/tools` owns platform tool policy for those.

## Current Surface

Exports before refactor:

- Old collection schemas: `files`, `sessions`, `tasks`, `projects`, `actions`.
- Old index/search/sync services for app entities that are not active in the reset shell.
- Typesense client helpers.

Consumers:

- No active app imports.
- `packages/testing/setup.ts` mocks `@repo/search`.
- Package tests import the package services.

Provider SDKs:

- `typesense`

Env keys:

- `TYPESENSE_HOST`
- `TYPESENSE_PORT`
- `TYPESENSE_PROTOCOL`
- `TYPESENSE_API_KEY`

## Sources Checked

| Source                                                                                       | Type               | Checked Date | Claim Used                                                                                                             |
| -------------------------------------------------------------------------------------------- | ------------------ | -----------: | ---------------------------------------------------------------------------------------------------------------------- |
| https://typesense.org/docs/                                                                  | Official docs      |   2026-05-26 | Current Typesense docs are versioned; latest shown is v30.2.                                                           |
| https://typesense.org/docs/30.2/api/collections.html                                         | Official docs      |   2026-05-26 | Collections define schemas for indexed documents; schema fields are indexed in memory.                                 |
| https://typesense.org/docs/30.2/api/documents.html                                           | Official docs      |   2026-05-26 | Documents are inserted/upserted into collections through document APIs.                                                |
| https://typesense.org/docs/30.2/api/search.html                                              | Official docs      |   2026-05-26 | Search uses collection document search and multi-search APIs with query/filter/sort params.                            |
| `pnpm view typesense version engines peerDependencies --registry https://registry.npmjs.org` | Registry metadata  |   2026-05-26 | Latest `typesense` is `3.0.6`; installed package matches and supports Node `>=18`.                                     |
| `pnpm outdated -r`                                                                           | Registry metadata  |   2026-05-26 | No outdated dependencies after contracts deletion and lock refresh.                                                    |
| `packages/search/**` local audit                                                             | Local source/types |   2026-05-26 | Package has current SDK versions, but public schemas/services are old product domains and no active app consumes them. |

## Local Audit

Commands:

```bash
find packages/search -maxdepth 4 -type f | sort
rg -n "@repo/search|typesense|Typesense|TYPESENSE" apps packages --glob '!node_modules/**' --glob '!legacy/**'
pnpm --filter @repo/search typecheck
pnpm --filter @repo/search test
```

Findings:

- Typesense is isolated in `@repo/search`; apps do not import `typesense` directly.
- The package is not product-active yet, which makes it safe to reset its public surface.
- Old collection names and sync services are tied to stale app concepts.
- Search should stay as infrastructure, not an active product schema until workflow/artifact models exist.

## Decision

Verdict: keep package, delete stale domain surface, reset to generic Typesense boundary

Reason:

- Keeping Typesense is viable for workflow/artifact search later.
- Keeping old `sessions/tasks/projects/actions` contracts is misleading during the reset.
- A generic provider boundary lets future `@repo/flow`/`@repo/artifacts` define their own indexed document schemas without app coupling.

## Refactor Checklist

- [x] Keep package-local T3 Env boundary.
- [x] Remove stale domain collection schemas.
- [x] Remove stale DB sync service.
- [x] Replace domain-specific index helpers with generic document helpers.
- [x] Replace domain-specific search results with generic collection search helpers.
- [x] Keep `server-only` on provider-boundary modules.
- [x] Update tests to assert generic boundary behavior.
- [x] Run package typecheck and tests.
- [x] Run active package/app/graph validation.

## Validation

```bash
pnpm --filter @repo/search typecheck
pnpm --filter @repo/search test
pnpm --filter "./packages/*" typecheck
pnpm test
pnpm --filter app --filter web typecheck
pnpm boundaries:cruise
```

Result:

- `pnpm --filter @repo/search typecheck` passed.
- `pnpm --filter @repo/search test` passed: 1 file, 5 tests.
- `pnpm --filter "./packages/*" typecheck` passed.
- `pnpm test` passed: 2 files, 10 tests.
- `pnpm --filter app --filter web typecheck` passed.
- `pnpm boundaries:cruise` passed with 0 errors and 0 warnings.

## Open Risks

- This package remains gated until workflow/artifact schemas exist.
- Typesense infra is useful only if backed by an indexing lifecycle and clear deletion/tenant isolation policy.
