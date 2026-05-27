# SEO Package Playbook

Package: `@repo/seo`

Phase: P3.3

Planned MADR: MADR-094

Status: P3.3 completed; non-SEO web blocker resolved in P3.3A

## Ownership

Owns:

- marketing metadata helpers;
- JSON-LD helpers;
- shared SEO types/utilities.

Must not own:

- app dashboard metadata;
- CMS content fetching;
- i18n routing;
- analytics.

## Current Surface To Audit

Exports:

- `.`
- `./metadata`
- `./json-ld`

Current dependencies:

- `schema-dts`
- `lodash.merge`
- `react`
- `next` as dev dependency

## Phase Checklist

- [x] Check Next Metadata docs and `schema-dts` latest.
- [x] Audit web consumers and i18n/CMS interactions.
- [x] Decide whether SEO remains web-scoped or general package.
- [x] Write MADR-094 before code changes if ownership changes.
- [x] Remove unnecessary `lodash.merge` dependency.
- [x] Remove direct env reads from `@repo/seo`.
- [x] Add package-local tests.
- [x] Fix affected web metadata call.
- [x] Run `pnpm --filter @repo/seo typecheck` and affected `apps/web` validation.

## Initial Verdict

Keep small and shared. `@repo/seo` owns metadata and JSON-LD helpers, but not app env, CMS fetching, i18n routing, or dashboard metadata.

## Sources Checked

| Source                                                                  | Type              | Checked Date | Claim Used                                                                                                                       |
| ----------------------------------------------------------------------- | ----------------- | -----------: | -------------------------------------------------------------------------------------------------------------------------------- |
| `https://nextjs.org/docs/app/getting-started/metadata-and-og-images`    | Official docs     |   2026-05-27 | App Router metadata uses static `metadata`, dynamic `generateMetadata`, and file conventions; metadata is Server Component only. |
| `https://nextjs.org/docs/app/api-reference/functions/generate-metadata` | Official docs     |   2026-05-27 | `metadataBase`, Open Graph, Twitter, and robots fields are part of Next `Metadata`.                                              |
| `https://nextjs.org/docs/app/api-reference/file-conventions/metadata`   | Official docs     |   2026-05-27 | File-based metadata should handle static icons/OG assets where appropriate.                                                      |
| npm registry checks                                                     | Registry metadata |   2026-05-27 | `schema-dts@2.0.0` and `lodash.merge@4.6.2` are current; lodash merge is unnecessary here.                                       |

## Boundary Verdict

- Keep `description` required.
- Keep JSON-LD escaping in package.
- Remove direct env access from package.
- Apps pass route-specific metadata values.

## P3.3 Implementation Results

- `createMetadata` is pure and no longer reads `process.env`.
- Removed `lodash.merge` and `@types/lodash.merge`.
- Replaced `next-forge`/`Vercel` defaults with Jeriko defaults.
- Kept `description` required.
- Added package-local tests for metadata defaults, image metadata, route overrides, and JSON-LD escaping.
- Added package README.
- Fixed `apps/web/app/[locale]/contact/page.tsx` to pass a description.

## Latest Validation

- `pnpm install` passed.
- `pnpm --filter @repo/seo typecheck` passed.
- `pnpm --filter @repo/seo test` passed: 2 files / 4 tests.
- root `pnpm test` passed: 23 files / 73 tests.
- `pnpm outdated --filter @repo/seo --format json` returned `{}`.
- `git diff --check` passed.
- `apps/web` typecheck no longer reports the SEO metadata description error.
- The contact form `Calendar initialFocus` DayPicker issue discovered after P3.3 was resolved in P3.3A by switching the app call site to `autoFocus`.
