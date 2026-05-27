# MADR-093: next-intl Package Boundary

Date: 2026-05-27

Status: accepted and implemented

Package: `@repo/internationalization`

## Context

`@repo/internationalization` currently mixes the selected provider, `next-intl`, with unused stale dependencies from `next-international` and manual negotiation.

The package is active:

- `apps/web/next.config.ts` consumes `@repo/internationalization/plugin`.
- `apps/web/proxy.ts` consumes `@repo/internationalization/middleware` and routing config.
- `apps/web/i18n/request.ts` consumes request config and dictionaries.
- localized pages and layouts consume dictionaries, `NextIntlClientProvider`, routing, and server translations.

Payload added `/api/*` routes to `apps/web`. Current `next-intl` docs recommend excluding `/api`, `/_next`, `/_vercel`, and dotted assets from the proxy matcher. The current web proxy matcher does not exclude `/api`, so the i18n middleware can interfere with Payload routes.

## Decision

Keep `@repo/internationalization` as the i18n package boundary and standardize it on `next-intl@4.12.0`.

Remove unused `next-international`, `negotiator`, and `@types/negotiator` from the package.

Do not move i18n into `apps/web` during this phase. Apps may own their request config file and route-specific layout, but package-owned routing, navigation, dictionaries, and provider wrappers remain in `@repo/internationalization`.

## Consequences

Positive:

- One i18n provider remains active.
- `apps/web` keeps a clean package-owned i18n boundary.
- Payload API routes are protected from locale routing.
- Future app/doc localization can reuse the same package surface.

Negative:

- `apps/web` still owns app-specific request config and localized layout code.
- Message typing remains based on the English dictionary until a deeper translation governance phase.
- This phase does not fix unrelated calendar or SEO metadata web type errors.

## Boundaries

Allowed:

- `@repo/internationalization` may import/export `next-intl` APIs.
- `apps/web/i18n/request.ts` may import package routing and dictionaries.
- `apps/web/proxy.ts` may compose package i18n middleware with security middleware.

Forbidden:

- Do not add a second i18n provider.
- Do not reintroduce `next-international`.
- Do not put marketing page copy ownership into `apps/web` when it belongs in dictionaries or CMS content.
- Do not run i18n middleware over Payload `/api/*` routes.
- Do not export server-only APIs from a client-consumed root package entrypoint.

## Checklist

- [x] Research current `next-intl` official docs and registry metadata.
- [x] Audit current package exports/dependencies/consumers.
- [x] Decide package boundary versus app-local i18n.
- [x] Remove unused stale dependencies.
- [x] Clean package exports and helper formatting.
- [x] Add package-local tests.
- [x] Fix web proxy matcher for `/api` and assets.
- [x] Remove stale web root `getTranslations` type import.
- [x] Remove request-config debug logging.
- [x] Set localized layout `lang` to the resolved locale.
- [x] Validate package typecheck/tests and affected web typecheck.

## References

- `docs/ai-workflow-os/09-research/2026-05-27-p3-2-internationalization-next-intl-research.md`
- `docs/ai-workflow-os/10-audit/internationalization-p3-2-audit-2026-05-27.md`
- https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing
- https://next-intl.dev/docs/routing/middleware
- https://next-intl.dev/docs/routing/navigation

## Validation Notes

- `pnpm install` passed.
- `pnpm --filter @repo/internationalization typecheck` passed.
- `pnpm --filter @repo/internationalization test` passed: 1 file / 3 tests.
- `pnpm test` passed: 21 files / 69 tests.
- `pnpm outdated --filter @repo/internationalization --format json` returned `{}`.
- `git diff --check` passed.
- `apps/web` typecheck no longer reports the i18n `getTranslations` root export error.
- At P3.2 completion, `apps/web` still failed on non-i18n issues:
  - `Calendar initialFocus` is invalid for the current DayPicker/Calendar type.
  - `createMetadata({ title })` is missing required `description`.
- P3.3 and P3.3A later resolved those non-i18n issues.
