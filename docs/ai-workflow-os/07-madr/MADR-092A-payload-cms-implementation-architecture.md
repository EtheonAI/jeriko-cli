# MADR-092A: Payload CMS Implementation Architecture

Date: 2026-05-27

Status: accepted; package implemented; `apps/web` convention integration implemented

Package: `@repo/cms`

Companion decision: [`MADR-092-retire-basehub-cms-and-defer-payload-install.md`](./MADR-092-retire-basehub-cms-and-defer-payload-install.md)

## Context

MADR-092 removed BaseHub from the active package graph and left `@repo/cms` as a provider-neutral package. That was necessary cleanup, but it is not the full CMS modernization phase.

The package-by-package rule is now clarified: each package phase is not only cleanup. It is research, upgrade, refactor, migration, package build-out, tests, and consumer integration where appropriate.

Payload's current official `llms-full.txt` docs support adding Payload to an existing Next.js App Router app. Payload is code-first, version-controlled, database-backed, and includes Admin Panel, Local API, REST/GraphQL APIs, access control, auth, file storage, live preview, and migrations.

Registry metadata on 2026-05-27 confirms Payload `3.85.0` supports the active stack:

- Node `22.22.1` satisfies Payload's Node requirement.
- `@payloadcms/next@3.85.0` peers with `next >=16.2.6 <17.0.0`.
- Payload official packages are published in sync and should use matching versions.

## Decision

Adopt Payload as the CMS provider for `@repo/cms`.

Do it in two layers:

1. `@repo/cms` owns Payload schema/config/domain:
   - Payload package dependencies and version sync;
   - env key contract;
   - collection/global definitions;
   - access-control helpers;
   - config factory;
   - typed content read API;
   - package-local tests;
   - Payload migration ownership for Payload tables.

2. `apps/web` owns Next.js convention integration:
   - `(payload)` App Router files required by Payload;
   - thin `payload.config.ts` / `@payload-config` path;
   - `next.config.ts` composition through `@repo/cms/next-config`;
   - frontend presentation routes and live preview integration.

Initial Payload implementation should target `apps/web`, not a new `apps/cms`, because the content system is for the marketing/content app and Payload's own docs optimize for an existing Next app integration. A separate `apps/cms` remains an exit path if web build isolation, compliance, or admin deployment boundaries require it.

Follow-up app integration confirms this split: `@repo/cms` owns Payload domain/config, while `apps/web` contains only the app-owned convention surface required by Payload and Next.js.

## Consequences

Positive:

- CMS becomes a real package implementation, not an empty placeholder.
- Payload schema/config remains reusable and testable in `@repo/cms`.
- App Router boilerplate stays app-owned where Next.js requires it.
- Payload tables/migrations stay separate from product Drizzle schema ownership.
- Payload can power blog/legal/marketing content without reviving BaseHub.

Negative:

- `apps/web` build will become heavier after Payload route files are added.
- Payload admin auth initially remains separate from Better Auth.
- Payload implementation must be sequenced carefully to avoid env/build coupling.
- GraphQL, media storage, live preview, and localization require additional scoped work.

## Boundaries

Allowed direct provider imports:

- `packages/cms/**` may import `payload`, `@payloadcms/*`, `graphql`, and package-local Payload adapters.
- `apps/web` may contain the required Payload App Router convention files and thin config entrypoint, but business config must come from `@repo/cms`.
- `apps/web/next.config.ts` should consume `@repo/cms/next-config` instead of importing `@payloadcms/next/withPayload` directly.

Forbidden:

- Do not put Payload collections, access rules, DB adapter config, or CMS domain logic directly in `apps/web`.
- Do not use product `DATABASE_URL` implicitly for Payload.
- Do not merge Payload migrations into `@repo/database` migrations.
- Do not mix Payload admin auth with Better Auth until a dedicated auth/security decision exists.
- Do not reintroduce BaseHub.

## Implementation Checklist

- [x] Add `@repo/cms` package-local docs.
- [x] Add matching Payload package dependencies.
- [x] Add `@repo/cms/keys` for Payload env.
- [x] Add package server-only Payload config factory.
- [x] Add initial collections/globals.
- [x] Add package tests for config/access/static fallback.
- [x] Add app `payload.config.ts` and `@payload-config` path only after package config passes.
- [x] Add Payload `(payload)` App Router files to `apps/web`.
- [x] Wrap web Next config through `@repo/cms/next-config`.
- [ ] Add migration workflow and document local push versus production migrations.
- [x] Validate `@repo/cms` typecheck/tests.
- [ ] Validate `apps/web` typecheck/build after its known contact/i18n debt is handled or isolated.

## References

- `docs/ai-workflow-os/09-research/2026-05-27-p3-1b-payload-implementation-research.md`
- `packages/cms/README.md`
- https://payloadcms.com/llms-full.txt

## Status Notes

The package-owned Payload implementation is complete:

- `@repo/cms` now exports `access`, `collections`, `content`, `globals`, `keys`, `next-config`, and `payload`.
- Payload official packages are pinned in sync at `3.85.0`.
- Postgres, Lexical, Vercel Blob, optional Resend email, Sharp, access helpers, initial collections/globals, config factory, and content adapter live in `packages/cms`.
- Local implementation file is named `config.ts` while the public export remains `@repo/cms/payload`; this avoids a TypeScript `baseUrl` collision where a local `payload.ts` shadows the npm `payload` package.
- Strict pnpm peer validation required explicit `esbuild@0.28.0` at the root and in `@repo/cms` so `vite@8.0.14` resolves its `esbuild ^0.27 || ^0.28` peer correctly.

Validation on 2026-05-27:

- `pnpm install` passed under `pnpm@11.3.0`.
- `pnpm --filter @repo/cms typecheck` passed.
- `pnpm --filter @repo/cms test` passed: 3 files / 8 tests.
- `pnpm --filter @repo/cms build` passed.
- `pnpm test` passed: 20 files / 66 tests.
- `pnpm outdated --filter @repo/cms --format json` returned `{}`.

Remaining scope:

- Payload migrations, live preview, localization, and web route rendering remain later scoped work.
- `apps/web` Payload-specific type errors were cleared after adding the app convention files and local CSS module declaration.
- `apps/web` full typecheck still fails on existing non-CMS contact/i18n/calendar/metadata issues:
  - `apps/web/app/[locale]/contact/components/contact-form.tsx` imports missing `getTranslations` from `@repo/internationalization`.
  - `Calendar` usage passes invalid `initialFocus`.
  - `apps/web/app/[locale]/contact/page.tsx` calls `createMetadata` without required `description`.

## App Integration Notes

`apps/web` now owns the required Payload convention layer:

- `apps/web/payload.config.ts` is a thin entrypoint calling `createPayloadConfigFromEnv()` from `@repo/cms/payload`.
- `apps/web/tsconfig.json` maps `@payload-config` to that app entrypoint.
- `apps/web/next.config.ts` composes through `withCMS` from `@repo/cms/next-config`.
- `apps/web/app/(payload)` contains the generated Payload App Router layout, admin routes, REST route, GraphQL route, and GraphQL Playground route.
- `apps/web/payload-env.d.ts` declares `@payloadcms/next/css` because the package exports the CSS module without TypeScript declarations.

Direct `@payloadcms/next` imports in `apps/web` are limited to these Payload convention files. Payload collections, access control, DB adapter setup, storage, email, and content adapter code remain in `@repo/cms`.
