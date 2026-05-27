# P3.1 CMS Package Research

Date: 2026-05-27

Package: `@repo/cms`

Status: completed before P3.1 CMS cleanup

## Sources Checked

| Source                                                                                    | Type                 | Evidence Used                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------- | --- | ----------------- | --- | ------------------ |
| https://payloadcms.com/docs/getting-started/installation                                  | Official docs        | Payload requires Node `20.9.0+`, compatible Next.js ranges including `16.2.6+`, a database adapter, a `payload.config.ts`, `@payloadcms/next`, app-router `(payload)` files, and the `withPayload` Next config wrapper. |
| https://payloadcms.com/docs/getting-started/concepts                                      | Official docs        | Payload is code-first/config-driven, database-backed, and exposes Local API, REST, and GraphQL; the Admin Panel is built with Next.js App Router.                                                                       |
| https://payloadcms.com/docs/local-api/overview                                            | Official docs        | Payload Local API is direct-to-database and suitable for React Server Components, route handlers, hooks, and access control.                                                                                            |
| https://payloadcms.com/docs/configuration/overview                                        | Official docs        | Payload config owns collections, globals, access control, endpoints, localization, plugins, and server URL.                                                                                                             |
| https://payloadcms.com/docs/configuration/environment-vars                                | Official docs        | Payload env belongs server-side; client access requires `NEXT_PUBLIC_`; outside Next.js, `dotenv` is suggested.                                                                                                         |
| https://payloadcms.com/docs/database/postgres                                             | Official docs        | `@payloadcms/db-postgres` uses Drizzle and `node-postgres`, requires a pool connection string, and can generate/manage migrations; table-name overlap with existing schema must be avoided.                             |
| https://payloadcms.com/docs/upload/storage-adapters                                       | Official docs        | Upload/media storage adapter choice is part of the Payload architecture decision, not a blind CMS package install.                                                                                                      |
| https://docs.basehub.com/llms-full                                                        | Official docs        | BaseHub recommends codegen in dev/build scripts and uses BaseHub-specific generated types/components; this explains why the existing package carries provider-specific generated surface.                               |
| `npm view payload version dist-tags peerDependencies engines --json`                      | Registry             | Stable latest is `3.85.0`; Node engine is `^18.20.2                                                                                                                                                                     |     | >=20.9.0`; peer requires `graphql ^16.8.1`. |
| `npm view @payloadcms/next version dist-tags peerDependencies engines --json`             | Registry             | Stable latest is `3.85.0`; peers with `payload@3.85.0`, `graphql ^16.8.1`, and `next >=15.2.9 <15.3.0                                                                                                                   |     | >=15.3.9 <15.4.0                            |     | >=15.4.11 <15.5.0 |     | >=16.2.6 <17.0.0`. |
| `npm view @payloadcms/db-postgres version dist-tags peerDependencies engines --json`      | Registry             | Stable latest is `3.85.0`; peers with `payload@3.85.0`.                                                                                                                                                                 |
| `npm view @payloadcms/richtext-lexical version dist-tags peerDependencies engines --json` | Registry             | Stable latest is `3.85.0`; peers with `@payloadcms/next@3.85.0`, `payload@3.85.0`, and React 19-compatible ranges.                                                                                                      |
| `npm view basehub version dist-tags peerDependencies engines --json`                      | Registry             | Stable latest is `9.5.3`, matching the current package.                                                                                                                                                                 |
| `pnpm outdated --filter @repo/cms --format json`                                          | Registry/local proof | No outdated direct dependencies reported for `@repo/cms`; this is still the wrong provider direction.                                                                                                                   |

## Version Verdict

- Payload target versions are `payload@3.85.0`, `@payloadcms/next@3.85.0`, `@payloadcms/db-postgres@3.85.0`, and likely `@payloadcms/richtext-lexical@3.85.0` when implementation starts.
- Do not install Payload in P3.1 cleanup. The docs require app route group placement, Payload config, DB adapter, secret, storage, and admin access decisions first.
- Remove BaseHub from active `@repo/cms` because no active app consumes it and the product direction rejects BaseHub investment.

## Implementation Guidance

- `@repo/cms` should remain a package boundary, but be provider-neutral until the Payload placement phase.
- Delete BaseHub-generated types, BaseHub config, BaseHub component wrappers, BaseHub env keys, and BaseHub scripts from the active package.
- Keep a small typed content facade so future `apps/web` work can consume a stable package contract without importing provider SDKs.
- Do not add `payload`, `@payloadcms/next`, or `@payloadcms/db-postgres` until the Payload implementation phase decides:
  - whether Payload is embedded under `apps/web/app/(payload)` or separated into a future `apps/cms`;
  - whether Payload shares the current Postgres database or gets a dedicated schema/database;
  - how Payload admin auth maps to Better Auth/product auth;
  - how media uploads map to Vercel Blob or another storage adapter;
  - how content preview, revalidation, and localization are wired.
