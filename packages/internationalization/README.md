# @repo/internationalization

Status: P3.2 completed. The package is standardized on `next-intl`.

Canonical decisions:

- `docs/ai-workflow-os/07-madr/MADR-093-next-intl-package-boundary.md`
- `docs/ai-workflow-os/09-research/2026-05-27-p3-2-internationalization-next-intl-research.md`
- `docs/ai-workflow-os/10-audit/internationalization-p3-2-audit-2026-05-27.md`

## Ownership

`@repo/internationalization` owns:

- locale routing config;
- locale-aware navigation wrappers;
- dictionaries/messages;
- i18n middleware export;
- server translation exports;
- package-local locale tests.

`@repo/internationalization` must not own:

- CMS content models;
- app-specific page layouts;
- SEO metadata policy;
- marketing page presentation components;
- Payload route handling.

## Current Provider

Use:

- `next-intl@4.12.0`

Do not add:

- `next-international`
- direct `negotiator`
- generated `@ezy/i18n` references

## Public API

Exports:

- `@repo/internationalization`
- `@repo/internationalization/plugin`
- `@repo/internationalization/middleware`
- `@repo/internationalization/routing`
- `@repo/internationalization/navigation`
- `@repo/internationalization/server`
- `@repo/internationalization/messages/*`
- `@repo/internationalization/dictionaries/*`

Server-only translation helpers should be imported from
`@repo/internationalization/server`. The root export is consumed by client and
server files, so do not add `server-only` to the root entrypoint.

## App Integration Rules

`apps/web` owns its route-specific request config at `apps/web/i18n/request.ts`.

Payload API routes must not be processed by i18n middleware. Keep `/api/*`
excluded from i18n handling in `apps/web/proxy.ts`.

## Validation

Current validation:

```bash
pnpm --filter @repo/internationalization typecheck
pnpm --filter @repo/internationalization test
pnpm test
pnpm outdated --filter @repo/internationalization --format json
```

Known external blockers:

- `apps/web` typecheck still fails on a contact `Calendar initialFocus` issue.
- `apps/web` typecheck still fails on a missing SEO metadata description.
