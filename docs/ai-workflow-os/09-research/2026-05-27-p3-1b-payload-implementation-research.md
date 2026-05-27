# P3.1B Payload CMS Implementation Research

Date: 2026-05-27

Package: `@repo/cms`

Status: completed before Payload implementation work

## Official Docs Index

Primary official AI docs source:

- https://payloadcms.com/llms-full.txt

This single file was used as the implementation index for Payload's current docs. The package phase must still inspect installed types/source during implementation, but `llms-full.txt` is the first official-doc source for Payload decisions.

## Sources Checked

| Source                                                                                       | Type                    | Evidence Used                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------- |
| https://payloadcms.com/llms-full.txt                                                         | Official llms-full docs | Payload is a code-first Next.js fullstack CMS/framework with Admin Panel, Local API, REST/GraphQL APIs, access control, auth, file storage, live preview, and DB migrations.                                                                                   |
| `llms-full.txt` installation section                                                         | Official docs           | Payload requires Node `20.9.0+`, Next `16.2.6+` in the current supported range, a DB adapter, `(payload)` App Router files, `withPayload`, `payload.config.ts`, and `@payload-config` tsconfig path.                                                           |
| `llms-full.txt` package structure section                                                    | Official docs           | Official Payload package versions are published in sync and must match. `@payloadcms/next` owns Admin/HTTP layer; `payload` owns core Local API/business logic; `@payloadcms/db-postgres` owns the Postgres adapter; Lexical is recommended for new rich text. |
| `llms-full.txt` Postgres section                                                             | Official docs           | Postgres adapter uses Drizzle/pg, defaults to development push mode, supports migrations, `migrationDir`, experimental `schemaName`, generated Drizzle schema, and direct Drizzle access. Do not mix local push and migrations.                                |
| `llms-full.txt` auth/access sections                                                         | Official docs           | Payload has collection-level auth, password reset/verification/email flow, Admin Panel users, and operation-specific access control. This should be separate from product Better Auth until SSO is intentionally designed.                                     |
| `llms-full.txt` upload/storage/live preview sections                                         | Official docs           | Upload collections, image processing, storage adapters, and live preview are first-class Payload features but require explicit storage/preview/env design.                                                                                                     |
| https://payloadcms.com/docs/upload/storage-adapters                                          | Official docs           | Vercel Blob adapter uses `@payloadcms/storage-vercel-blob`, requires matching collection slugs, uses `BLOB_READ_WRITE_TOKEN`, disables local storage when enabled, and supports `clientUploads` for Vercel upload limits.                                      |
| https://payloadcms.com/docs/email/overview                                                   | Official docs           | Payload email adapters power auth-related emails; Resend adapter is preferred for serverless/Vercel and requires API key plus default from name/address.                                                                                                       |
| https://env.t3.gg/docs/nextjs                                                                | Official docs           | `@t3-oss/env-nextjs` is ESM-only, uses explicit `runtimeEnv` for Next compatibility, and supports server/client schema separation.                                                                                                                             |
| `npm view payload version dist-tags peerDependencies engines --json`                         | Registry                | Latest stable is `3.85.0`; Node engine is `^18.20.2                                                                                                                                                                                                            |     | >=20.9.0`; peer requires `graphql ^16.8.1`. |
| `npm view @payloadcms/next version dist-tags peerDependencies engines --json`                | Registry                | Latest stable is `3.85.0`; peers with `payload@3.85.0`, `graphql ^16.8.1`, and `next >=16.2.6 <17.0.0`.                                                                                                                                                        |
| `npm view @payloadcms/db-postgres version dist-tags peerDependencies engines --json`         | Registry                | Latest stable is `3.85.0`; peers with `payload@3.85.0`.                                                                                                                                                                                                        |
| `npm view @payloadcms/richtext-lexical version dist-tags peerDependencies engines --json`    | Registry                | Latest stable is `3.85.0`; peers with `@payloadcms/next@3.85.0`, `payload@3.85.0`, and React 19-compatible ranges.                                                                                                                                             |
| `npm view @payloadcms/storage-vercel-blob version dist-tags peerDependencies engines --json` | Registry                | Latest stable is `3.85.0`; peers with `payload@3.85.0`.                                                                                                                                                                                                        |
| `npm view @payloadcms/email-resend version dist-tags peerDependencies engines --json`        | Registry                | Latest stable is `3.85.0`; peers with `payload@3.85.0`.                                                                                                                                                                                                        |
| `npm view @payloadcms/live-preview-react version dist-tags peerDependencies engines --json`  | Registry                | Latest stable is `3.85.0`; React 19-compatible peer range.                                                                                                                                                                                                     |
| `npm view create-payload-app version dist-tags engines --json`                               | Registry                | Latest stable is `3.85.0`; useful only as reference/template source, not as a blind scaffold over the repo.                                                                                                                                                    |
| `npm view sharp version dist-tags engines peerDependencies --json`                           | Registry                | Latest stable is `0.34.5`; active repo already uses `sharp@0.34.5`.                                                                                                                                                                                            |
| `npm view graphql version dist-tags engines peerDependencies --json`                         | Registry                | Latest stable is `16.14.0`; satisfies Payload `^16.8.1`.                                                                                                                                                                                                       |
| `npm view vite version peerDependencies`                                                     | Registry                | Latest stable is `8.0.14`; peer requires `esbuild ^0.27.0                                                                                                                                                                                                      |     | ^0.28.0`.                                   |
| `npm view esbuild version`                                                                   | Registry                | Latest stable is `0.28.0`; used to satisfy Vite's strict peer requirement.                                                                                                                                                                                     |

## Version Verdict

All official Payload packages must be installed at the same stable version:

- `payload@3.85.0`
- `@payloadcms/next@3.85.0`
- `@payloadcms/db-postgres@3.85.0`
- `@payloadcms/richtext-lexical@3.85.0`
- `@payloadcms/storage-vercel-blob@3.85.0` when media storage is implemented
- `@payloadcms/email-resend@3.85.0` when Payload auth emails are implemented
- `@payloadcms/live-preview-react@3.85.0` when preview UI is implemented

Keep `next@16.2.6`, `react@19.2.6`, `react-dom@19.2.6`, `sharp@0.34.5`, and `graphql@16.14.0` if GraphQL is enabled.

## Implementation Direction

Payload should be adopted as the CMS provider, not just documented as an option.

Target architecture:

```text
packages/cms
  owns Payload schema, collections, globals, access helpers, env keys,
  config factory, typed content read API, tests, and future migrations

apps/web
  owns Next.js App Router convention files required by Payload,
  a thin payload.config.ts re-export/factory call,
  and the frontend route rendering/content presentation
```

The first implementation subphase should build the package contract before app integration:

1. Add package-local Payload dependencies and matching versions.
2. Add `@repo/cms/keys` for `PAYLOAD_SECRET`, `PAYLOAD_DATABASE_URL`, preview URL/secret, and optional storage/email keys.
3. Add `@repo/cms/payload` or equivalent server-only subpath containing collection configs, globals, access helpers, and `createPayloadConfig`.
4. Add initial content collections: CMS admins, media, pages, posts, legal pages, and site settings.
5. Add typed content read API that uses Payload Local API when configured and static fallback when not configured.
6. Add tests for config shape, static fallback, Payload content mapping, and access helpers without requiring a live database.
7. Only then add `apps/web` Payload route files and `withCMS` integration.

## Open Implementation Decisions

- Use a separate `PAYLOAD_DATABASE_URL`; do not reuse product `DATABASE_URL` implicitly.
- Prefer a dedicated database/schema for Payload-managed tables. If sharing a physical database, use Payload's Postgres `schemaName` option and document it as experimental.
- Keep Payload admin auth separate from Better Auth initially; SSO/unification needs a later security MADR.
- Use Payload migrations for Payload tables. Do not mix Payload migrations into `@repo/database` Drizzle migrations.
- Keep GraphQL disabled unless we need it; Local API is the preferred internal read path.
- Use Vercel Blob storage adapter for media when `BLOB_READ_WRITE_TOKEN` exists; keep local behavior available when absent.
- Add live preview after `apps/web` content routes and localization are stable.

## Implementation Evidence

P3.1B package implementation completed after this research:

- Payload official packages installed in sync at `3.85.0`.
- `@repo/cms/keys`, `access`, `collections`, `globals`, `content`, `next-config`, and public `payload` export added.
- `config.ts` intentionally backs the public `@repo/cms/payload` export to avoid a local `payload.ts` filename shadowing the npm `payload` package under TypeScript `baseUrl`.
- Vercel Blob storage is enabled only when `BLOB_READ_WRITE_TOKEN` is present.
- Payload Resend email adapter is enabled only when `RESEND_API_KEY` and `PAYLOAD_EMAIL_FROM_ADDRESS` are present.
- Strict pnpm peer validation required explicit `esbuild@0.28.0` where Vite/Vitest runs.

Validation:

- `pnpm install` passed.
- `pnpm --filter @repo/cms typecheck` passed.
- `pnpm --filter @repo/cms test` passed: 3 files / 8 tests.
- `pnpm --filter @repo/cms build` passed.
- `pnpm test` passed: 20 files / 66 tests.
- `pnpm outdated --filter @repo/cms --format json` returned `{}`.

## App Convention Integration Evidence

P3.1C integrated the required Payload app convention files into `apps/web`
after the package implementation passed:

- `apps/web/payload.config.ts` calls `createPayloadConfigFromEnv()` from `@repo/cms/payload`.
- `apps/web/tsconfig.json` maps `@payload-config`.
- `apps/web/next.config.ts` composes `withCMS` from `@repo/cms/next-config`.
- `apps/web/app/(payload)` contains the generated Payload Admin, REST, GraphQL, GraphQL Playground, layout, import map, and custom Sass files.
- `apps/web/payload-env.d.ts` declares `@payloadcms/next/css` because the package CSS export has no TypeScript declaration.

Validation after app integration:

- `pnpm --filter @repo/cms typecheck` passed.
- `pnpm --filter @repo/cms test` passed: 3 files / 8 tests.
- `pnpm --filter @repo/cms build` passed.
- root `pnpm test` passed: 20 files / 66 tests.
- `pnpm outdated --filter web --format json` returned `{}`.
- `git diff --check` passed.
- `pnpm --filter web typecheck` no longer reports Payload-specific errors, but still fails on existing contact/i18n/calendar/metadata issues outside CMS.
