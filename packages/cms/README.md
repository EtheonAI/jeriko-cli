# @repo/cms

Status: BaseHub retired; Payload package implementation completed. `apps/web`
Payload convention integration is installed, with unrelated web type blockers
remaining outside CMS.

Canonical decisions:

- `docs/ai-workflow-os/07-madr/MADR-092-retire-basehub-cms-and-defer-payload-install.md`
- `docs/ai-workflow-os/07-madr/MADR-092A-payload-cms-implementation-architecture.md`
- `docs/ai-workflow-os/09-research/2026-05-27-p3-1b-payload-implementation-research.md`
- `docs/ai-workflow-os/10-audit/cms-p3-1b-payload-implementation-audit-2026-05-27.md`
- `docs/ai-workflow-os/10-audit/cms-p3-1c-web-payload-route-integration-audit-2026-05-27.md`

## Ownership

`@repo/cms` owns:

- CMS provider boundary;
- provider-neutral content types;
- Payload env keys;
- Payload collection/global config;
- Payload access helpers;
- typed content read API;
- package-local tests.

`@repo/cms` must not own:

- marketing page UI;
- `apps/web` route presentation;
- Next.js App Router convention files required by Payload;
- product Better Auth user/session policy;
- product database schema outside Payload-owned CMS tables.

## Current Public API

Exports:

- `@repo/cms`
- `@repo/cms/access`
- `@repo/cms/collections`
- `@repo/cms/content`
- `@repo/cms/globals`
- `@repo/cms/keys`
- `@repo/cms/next-config`
- `@repo/cms/payload`

The root export is a provider-neutral content contract with static fallback and
Payload Local API adapter helpers. Payload-specific imports stay behind package
subpaths.

## Payload Stack

Use matching official versions:

- `payload@3.85.0`
- `@payloadcms/next@3.85.0`
- `@payloadcms/db-postgres@3.85.0`
- `@payloadcms/richtext-lexical@3.85.0`
- `@payloadcms/storage-vercel-blob@3.85.0`
- `@payloadcms/email-resend@3.85.0`
- `@payloadcms/live-preview-react@3.85.0` when live preview is implemented
- `graphql@16.14.0`
- `sharp@0.34.5`

Docs source:

- https://payloadcms.com/llms-full.txt

## Payload Boundary

`packages/cms` owns:

- `@repo/cms/keys`
- `@repo/cms/payload`
- `@repo/cms/collections`
- `@repo/cms/globals`
- `@repo/cms/access`
- `@repo/cms/content`

Current package-owned implementation:

- `keys.ts`: `PAYLOAD_*`, `BLOB_READ_WRITE_TOKEN`, and Payload Resend env contract through T3 Env.
- `access.ts`: CMS role helpers, first-user bootstrap, published/public read policy.
- `collections/*`: `cms-users`, `media`, `pages`, `posts`, and `legal-pages`.
- `globals/*`: `site-settings`.
- `config.ts`: `createPayloadConfig` and `createPayloadConfigFromEnv` with Postgres, Lexical, Vercel Blob, optional Resend, Sharp, migrations, and generated type/schema paths.
- `content.ts`: static fallback plus Payload Local API content adapter.
- `next-config.ts`: package-owned `withPayload` wrapper.

`apps/web` owns:

- Payload `(payload)` App Router convention files;
- a thin `payload.config.ts` entrypoint;
- `@payload-config` path mapping;
- route rendering and live preview UI.

Installed app convention surface:

- `apps/web/payload.config.ts`
- `apps/web/payload-env.d.ts`
- `apps/web/app/(payload)/layout.tsx`
- `apps/web/app/(payload)/admin/*`
- `apps/web/app/(payload)/api/[...slug]/route.ts`
- `apps/web/app/(payload)/api/graphql/route.ts`
- `apps/web/app/(payload)/api/graphql-playground/route.ts`
- `apps/web/next.config.ts` composed through `@repo/cms/next-config`

## Validation

Current validation:

```bash
pnpm install
pnpm --filter @repo/cms typecheck
pnpm --filter @repo/cms test
pnpm --filter @repo/cms build
pnpm test
pnpm outdated --filter @repo/cms --format json
pnpm outdated --filter web --format json
```

Known external blocker:

- `apps/web` typecheck no longer reports Payload-specific integration errors.
- `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues outside this package.
