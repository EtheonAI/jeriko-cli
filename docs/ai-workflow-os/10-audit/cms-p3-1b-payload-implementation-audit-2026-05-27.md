# P3.1B CMS Payload Implementation Audit

Date: 2026-05-27

Package: `@repo/cms`

Status: package implementation completed; `apps/web` integration completed in P3.1C

## Scope

This phase implemented Payload inside `@repo/cms` after P3.1A retired BaseHub.

In scope:

- Payload dependencies and version sync;
- package exports;
- Payload env keys;
- access helpers;
- collections and globals;
- config factory;
- content read adapter;
- package-local tests;
- strict pnpm peer validation.

Out of scope:

- `apps/web` route presentation beyond Payload conventions;
- Payload migration workflow;
- live preview;
- localization;
- web page rendering from Payload content.

## Docs And Registry Evidence

- Payload `llms-full.txt` was read first as the official AI docs index.
- Payload installation docs require Next `16.2.6+`, a DB adapter, `(payload)` App Router files, `withPayload`, `payload.config.ts`, and `@payload-config`.
- Payload docs state official Payload package versions are published in sync and should match.
- Payload Postgres docs confirm `@payloadcms/db-postgres`, `pool.connectionString`, `migrationDir`, and experimental `schemaName`.
- Payload storage docs confirm Vercel Blob uses `@payloadcms/storage-vercel-blob`, `BLOB_READ_WRITE_TOKEN`, and optional `clientUploads`.
- Payload email docs confirm the Resend adapter is preferred for serverless/Vercel.
- T3 Env Next docs confirm explicit `runtimeEnv` and `emptyStringAsUndefined` usage.
- Registry checks confirmed current versions:
  - `payload@3.85.0`
  - `@payloadcms/next@3.85.0`
  - `@payloadcms/db-postgres@3.85.0`
  - `@payloadcms/richtext-lexical@3.85.0`
  - `@payloadcms/storage-vercel-blob@3.85.0`
  - `@payloadcms/email-resend@3.85.0`
  - `graphql@16.14.0`
  - `sharp@0.34.5`
  - `vite@8.0.14`
  - `esbuild@0.28.0`

## Implemented Surface

Exports:

- `@repo/cms`
- `@repo/cms/access`
- `@repo/cms/collections`
- `@repo/cms/content`
- `@repo/cms/globals`
- `@repo/cms/keys`
- `@repo/cms/next-config`
- `@repo/cms/payload`

Files added or materially changed:

- `packages/cms/access.ts`
- `packages/cms/collections/*`
- `packages/cms/globals/*`
- `packages/cms/config.ts`
- `packages/cms/content.ts`
- `packages/cms/keys.ts`
- `packages/cms/next-config.ts`
- `packages/cms/tests/*`
- `packages/cms/package.json`
- root `package.json`
- `pnpm-lock.yaml`

## Keep / Refactor / Defer Verdict

Keep:

- Payload as the approved CMS provider.
- `@repo/cms` as the owner of Payload domain/schema/config/access/content code.
- `apps/web` as first Payload host.
- `PAYLOAD_DATABASE_URL` separate from product `DATABASE_URL`.
- Payload admin auth separate from Better Auth until a dedicated auth/security decision exists.

Refactor done:

- Replaced no-op `withCMS` with a package-owned `withPayload` wrapper.
- Moved provider-neutral content code to `content.ts`.
- Added Payload Local API content mapping without requiring a live DB in tests.
- Added `config.ts` as implementation for public `@repo/cms/payload` export.

Important implementation detail:

- Do not name the local implementation file `payload.ts`. With this package's `baseUrl`, that filename shadows the npm `payload` package and causes circular TypeScript resolution errors. Keep `config.ts` behind the public `@repo/cms/payload` export.

Defer:

- Payload migrations.
- live preview.
- CMS localization.
- GraphQL consumer decision.
- Payload admin SSO/unification with Better Auth.

## Validation

Commands run:

```bash
pnpm install
pnpm --filter @repo/cms typecheck
pnpm --filter @repo/cms test
pnpm --filter @repo/cms build
pnpm outdated --filter @repo/cms --format json
rg '@payloadcms|from "payload"|from "@repo/cms/payload"|PAYLOAD_' packages/cms apps/web apps/app packages --glob '!packages/cms/node_modules/**'
git diff --check
pnpm test
```

Results:

- `pnpm install` passed under `pnpm@11.3.0`.
- `@repo/cms` typecheck passed.
- `@repo/cms` tests passed: 3 files / 8 tests.
- `@repo/cms` build passed.
- `pnpm outdated --filter @repo/cms --format json` returned `{}`.
- Provider imports are confined to `packages/cms`.
- `git diff --check` passed before documentation updates.
- root `pnpm test` passed: 20 files / 66 tests.

Peer dependency fix:

- Initial install failed because `vite@8.0.14` requires `esbuild ^0.27.0 || ^0.28.0` while one package-local resolution selected `esbuild@0.25.12` from the Drizzle/Payload graph.
- Added explicit `esbuild@0.28.0` at the root and `@repo/cms` dev dependency so strict pnpm peer validation stays enabled and passes.

## Remaining Checklist

- [x] Add `apps/web/payload.config.ts` as a thin app-owned entrypoint.
- [x] Add `@payload-config` path in `apps/web/tsconfig.json`.
- [x] Add Payload `(payload)` App Router convention files in `apps/web/app`.
- [x] Compose `apps/web/next.config.ts` through `@repo/cms/next-config`.
- [ ] Add Payload migration commands and document local push versus production migrations.
- [ ] Decide live preview route and preview secret handling.
- [ ] Decide CMS localization with the P3.2 `next-intl` phase.
- [ ] Validate `apps/web` after its existing contact/i18n/calendar/metadata debt is handled or isolated.

## P3.1C App Integration Link

The app-owned convention layer is documented separately:

- `docs/ai-workflow-os/10-audit/cms-p3-1c-web-payload-route-integration-audit-2026-05-27.md`
