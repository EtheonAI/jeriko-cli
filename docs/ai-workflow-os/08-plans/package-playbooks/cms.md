# CMS Package Playbook

Package: `@repo/cms`

Phase: P3.1

Planned MADRs: MADR-092, MADR-092A

Status: P3.1A BaseHub retirement completed; P3.1B package implementation completed; P3.1C `apps/web` Payload convention integration completed with non-CMS web blockers remaining

## Ownership

Owns:

- CMS provider boundary;
- CMS env validation;
- provider-neutral content contracts;
- Payload content query/config helpers;
- Payload access helpers;
- Payload collections/globals;
- package-local tests.

Must not own:

- marketing page UI;
- app dashboard UI;
- product database schema outside CMS content ownership;
- app-owned Payload App Router convention files.

## Current Surface

Exports:

- `.`
- `./access`
- `./collections`
- `./content`
- `./globals`
- `./keys`
- `./next-config`
- `./payload`

Current provider SDKs:

- `payload`
- `@payloadcms/next`
- `@payloadcms/db-postgres`
- `@payloadcms/richtext-lexical`
- `@payloadcms/storage-vercel-blob`
- `@payloadcms/email-resend`

Approved provider:

- `payload@3.85.0`
- `@payloadcms/next@3.85.0`
- `@payloadcms/db-postgres@3.85.0`
- `@payloadcms/richtext-lexical@3.85.0`
- `@payloadcms/storage-vercel-blob@3.85.0`
- `@payloadcms/email-resend@3.85.0`

## Phase Checklist

- [x] Check Payload official docs, npm latest, peer deps, and Next compatibility.
- [x] Audit all BaseHub usage and decide removal path.
- [x] Decide Payload placement for P3.1.
- [x] Decide Postgres adapter and media storage approach for P3.1.
- [x] Write MADR-092 before installing Payload or deleting BaseHub code.
- [x] Remove BaseHub provider dependency, generated files, scripts, env, and component wrappers.
- [x] Replace root export with provider-neutral content contracts/helpers.
- [x] Add package-local tests.
- [x] Run `pnpm --filter @repo/cms typecheck` and affected validation.
- [x] Read Payload `llms-full.txt`.
- [x] Write Payload implementation MADR.
- [x] Add package-local README.
- [x] Add matching Payload package dependencies.
- [x] Add package-local Payload env keys.
- [x] Add Payload config factory, collections, globals, access helpers, and typed content read API.
- [x] Add app-owned Payload convention files in `apps/web` after package config passes.
- [x] Add `apps/web/payload.config.ts` thin entrypoint.
- [x] Add `apps/web` `@payload-config` path.
- [x] Wrap `apps/web` Next config with `@repo/cms/next-config`.
- [x] Validate CMS package after web integration.
- [x] Validate `apps/web` Payload-specific types are cleared.
- [ ] Fix unrelated `apps/web` contact/i18n/calendar/metadata type errors in the owning package/app phase.

## Verdict

Payload is the approved direction. BaseHub is retired. `@repo/cms` is now a Payload package. The required Payload App Router convention files are integrated in `apps/web`.

## Sources Checked

| Source                                                     | Type                    | Checked Date | Claim Used                                                                                                                                    |
| ---------------------------------------------------------- | ----------------------- | -----------: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://payloadcms.com/docs/getting-started/installation` | Official docs           |   2026-05-27 | Payload supports Next `16.2.6+`, requires app-router `(payload)` files, `withPayload`, `payload.config.ts`, and a DB adapter.                 |
| `https://payloadcms.com/llms-full.txt`                     | Official llms-full docs |   2026-05-27 | Canonical Payload implementation index for install, package structure, Postgres, migrations, auth/access, live preview, uploads, and storage. |
| `https://payloadcms.com/docs/local-api/overview`           | Official docs           |   2026-05-27 | Payload Local API is direct-to-database and usable from Server Components and route handlers.                                                 |
| `https://payloadcms.com/docs/database/postgres`            | Official docs           |   2026-05-27 | Postgres adapter uses Drizzle/pg, requires a pool connection, and needs migration/table-overlap planning.                                     |
| `https://payloadcms.com/docs/upload/storage-adapters`      | Official docs           |   2026-05-27 | Vercel Blob adapter uses `BLOB_READ_WRITE_TOKEN`, collection slug mapping, and `clientUploads` for Vercel limits.                             |
| `https://payloadcms.com/docs/email/overview`               | Official docs           |   2026-05-27 | Resend adapter is preferred for serverless/Vercel and powers Payload auth email needs.                                                        |
| `https://env.t3.gg/docs/nextjs`                            | Official docs           |   2026-05-27 | T3 Env Next package uses explicit runtime env and is ESM-only.                                                                                |
| `https://docs.basehub.com/llms-full`                       | Official docs           |   2026-05-27 | BaseHub scripts/codegen/types are provider-specific and explain the retired package surface.                                                  |
| npm registry checks                                        | Registry metadata       |   2026-05-27 | Payload family latest is `3.85.0`; `graphql@16.14.0`, `sharp@0.34.5`, and `esbuild@0.28.0` are current for this package phase.                |

## Payload Implementation Decisions

- Use `apps/web` as the first Payload app host.
- Keep Payload domain/config code in `@repo/cms`.
- Keep Payload admin auth separate from Better Auth initially.
- Use `PAYLOAD_DATABASE_URL`, not product `DATABASE_URL`.
- Keep Payload migrations separate from `@repo/database` migrations.
- Prefer Local API for internal content reads.
- Enable Vercel Blob media only when `BLOB_READ_WRITE_TOKEN` exists.
- Enable Payload Resend email only when `RESEND_API_KEY` and `PAYLOAD_EMAIL_FROM_ADDRESS` exist.
- Defer GraphQL consumers and live preview until package/app baseline passes.

## P3.1B Implementation Results

- Added Payload official packages at matching `3.85.0`.
- Added `@repo/cms/keys`, `@repo/cms/access`, `@repo/cms/collections`, `@repo/cms/globals`, `@repo/cms/content`, and `@repo/cms/payload`.
- Added initial Payload collections: `cms-users`, `media`, `pages`, `posts`, and `legal-pages`.
- Added initial Payload global: `site-settings`.
- Added package-owned `createPayloadConfig` and `createPayloadConfigFromEnv`.
- Added optional Vercel Blob media storage when `BLOB_READ_WRITE_TOKEN` exists.
- Added optional Payload Resend email adapter when `RESEND_API_KEY` and `PAYLOAD_EMAIL_FROM_ADDRESS` exist.
- Kept public export `@repo/cms/payload`, but implementation file is `config.ts` to avoid local `payload.ts` shadowing the npm `payload` package.
- Added `esbuild@0.28.0` explicitly for Vite peer correctness under strict pnpm.

## Latest Validation

- `pnpm install` passed.
- `pnpm --filter @repo/cms typecheck` passed.
- `pnpm --filter @repo/cms test` passed: 3 files / 8 tests.
- `pnpm --filter @repo/cms build` passed.
- root `pnpm test` passed: 20 files / 66 tests.
- `pnpm outdated --filter @repo/cms --format json` returned `{}`.
- `pnpm outdated --filter web --format json` returned `{}` after adding the Payload app dependencies.
- `git diff --check` passed.
- `pnpm --filter web typecheck` no longer reports Payload integration errors, but still fails on existing contact/i18n/calendar/metadata issues outside CMS.

## P3.1C App Integration Results

Implemented app-owned files:

- `apps/web/payload.config.ts`
- `apps/web/payload-env.d.ts`
- `apps/web/app/(payload)/layout.tsx`
- `apps/web/app/(payload)/custom.scss`
- `apps/web/app/(payload)/admin/importMap.js`
- `apps/web/app/(payload)/admin/[[...segments]]/page.tsx`
- `apps/web/app/(payload)/admin/[[...segments]]/not-found.tsx`
- `apps/web/app/(payload)/api/[...slug]/route.ts`
- `apps/web/app/(payload)/api/graphql/route.ts`
- `apps/web/app/(payload)/api/graphql-playground/route.ts`

Changed app config:

- `apps/web/package.json` now declares the required Payload app runtime dependencies.
- `apps/web/tsconfig.json` maps `@payload-config`.
- `apps/web/next.config.ts` composes `withCMS(withNextIntl(resolvedConfig))`.

Boundary verdict:

- Allowed: direct `@payloadcms/next` imports in generated Payload convention files.
- Allowed: `apps/web/payload.config.ts` importing `@repo/cms/payload`.
- Forbidden: Payload collections, globals, access rules, DB adapter setup, storage, email, or content mapping in `apps/web`.
