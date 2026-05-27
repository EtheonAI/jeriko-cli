# P3.1C Web Payload Route Integration Audit

Date: 2026-05-27

Package/App: `@repo/cms`, `apps/web`

Status: completed with non-CMS web typecheck blockers remaining

## Scope

This phase integrated the required Payload App Router convention files into
`apps/web` after the package-owned Payload implementation passed.

In scope:

- app-owned `payload.config.ts`;
- `@payload-config` TypeScript path;
- Payload `(payload)` App Router route group;
- REST, GraphQL, GraphQL Playground, and Admin routes;
- `apps/web` Next config composition through `@repo/cms/next-config`;
- web package dependency sync;
- validation of package boundary and known web blockers.

Out of scope:

- Payload migrations;
- Payload admin SSO with Better Auth;
- live preview;
- localized Payload content routing;
- replacing existing marketing page data calls;
- fixing unrelated web contact/i18n/calendar/metadata type errors.

## Docs And Registry Evidence

- Payload `llms-full.txt` was used as the official docs index.
- Payload installation docs require app-owned App Router files, `payload.config.ts`, `@payload-config`, and `withPayload`.
- Installed `@payloadcms/next` package exports confirm the CSS entrypoint is exported but has no TypeScript declaration, so `apps/web/payload-env.d.ts` declares it locally.
- Registry checks confirmed:
  - `@payloadcms/next@3.85.0` peers with `payload@3.85.0`, `graphql ^16.8.1`, and `next >=16.2.6 <17.0.0`.
  - `payload@3.85.0` is current stable.
  - `sass@1.100.0` is current stable and satisfies the app Sass import requirement.

## Implemented Files

Added:

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

Changed:

- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/next.config.ts`
- `pnpm-lock.yaml`

## Boundary Verdict

Allowed:

- `apps/web/payload.config.ts` imports `createPayloadConfigFromEnv` from `@repo/cms/payload`.
- Generated Payload convention files under `apps/web/app/(payload)` import `@payload-config` and `@payloadcms/next/*`.
- `apps/web/next.config.ts` imports `withCMS` from `@repo/cms/next-config`.

Forbidden:

- Do not put Payload collections, globals, access rules, DB adapter setup, media storage, email adapter setup, or content mapping in `apps/web`.
- Do not import `@payloadcms/db-postgres`, `@payloadcms/richtext-lexical`, `@payloadcms/storage-vercel-blob`, or `@payloadcms/email-resend` directly from apps.
- Do not reuse product `DATABASE_URL` implicitly for Payload.
- Do not merge Payload migrations into `@repo/database`.

## Validation

Commands run:

```bash
pnpm install
pnpm --filter @repo/cms typecheck
pnpm --filter @repo/cms test
pnpm --filter @repo/cms build
pnpm --filter web typecheck
pnpm test
pnpm outdated --filter web --format json
git diff --check
```

Results:

- `pnpm install` passed.
- `@repo/cms` typecheck passed.
- `@repo/cms` tests passed: 3 files / 8 tests.
- `@repo/cms` build passed.
- root `pnpm test` passed: 20 files / 66 tests.
- `pnpm outdated --filter web --format json` returned `{}`.
- `git diff --check` passed.
- `pnpm --filter web typecheck` no longer reports Payload-specific integration errors.

Remaining `apps/web` typecheck failures are pre-existing and outside CMS:

- `apps/web/app/[locale]/contact/components/contact-form.tsx` imports missing `getTranslations` from `@repo/internationalization`.
- `apps/web/app/[locale]/contact/components/contact-form.tsx` passes invalid `initialFocus` to `Calendar`.
- `apps/web/app/[locale]/contact/page.tsx` calls `createMetadata` without required `description`.

## Remaining Checklist

- [ ] Add Payload migration scripts and document local push versus production migrations.
- [ ] Decide admin auth/SSO posture with Better Auth in a security/auth MADR.
- [ ] Add live preview only after web route rendering and preview secret handling are designed.
- [ ] Handle CMS localization during `@repo/internationalization` / next-intl phase.
- [ ] Fix the existing web contact/i18n/calendar/metadata type errors in the owning phase.
- [ ] Run `apps/web` build after web typecheck blockers are fixed.
