# Internationalization Package Playbook

Package: `@repo/internationalization`

Phase: P3.2

Planned MADR: MADR-093

Status: P3.2 completed; later non-i18n web blockers resolved in P3.3/P3.3A

## Ownership

Owns:

- localization routing helpers if retained as package boundary;
- dictionaries/messages;
- i18n navigation/server helpers;
- translation tooling policy.

Must not own:

- CMS content modeling;
- app dashboard routing unless product requires localized app;
- SEO metadata without coordination with `@repo/seo`.

## Current Surface To Audit

Exports:

- `.`
- `./i18n.d.ts`
- `./plugin`
- `./middleware`
- `./routing`
- `./navigation`
- `./server`
- `./messages/*`
- `./dictionaries/*`

Current/candidate libraries:

- `next-intl@4.12.0`

## Phase Checklist

- [x] Check `next-intl` official docs and npm latest.
- [x] Check whether `next-international` should be removed.
- [x] Audit app/web routing consumers, proxy integration, and dictionaries.
- [x] Decide package wrapper vs `apps/web`-local i18n ownership.
- [x] Document metadata/sitemap/route-handler impact.
- [x] Write MADR-093 before migration.
- [x] Remove unused stale dependencies.
- [x] Add package-local tests.
- [x] Update web proxy matcher for Payload `/api/*`.
- [x] Clean request config debug logging and layout locale.
- [x] Remove stale web import that causes the `getTranslations` type error.
- [x] Run `pnpm --filter @repo/internationalization typecheck` and affected `apps/web` validation.

## Initial Verdict

Keep `@repo/internationalization` and standardize on `next-intl@4.12.0`.
Remove `next-international`, `negotiator`, and `@types/negotiator`.

## Sources Checked

| Source                                                                    | Type              | Checked Date | Claim Used                                                                                               |
| ------------------------------------------------------------------------- | ----------------- | -----------: | -------------------------------------------------------------------------------------------------------- |
| `https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing` | Official docs     |   2026-05-27 | App Router setup uses `[locale]`, request config, `hasLocale`, `notFound`, and `NextIntlClientProvider`. |
| `https://next-intl.dev/docs/routing/setup`                                | Official docs     |   2026-05-27 | Routing setup uses `defineRouting`, `createNavigation`, `createMiddleware`, and plugin request config.   |
| `https://next-intl.dev/docs/routing/middleware`                           | Official docs     |   2026-05-27 | Proxy matcher should exclude `/api`, `/_next`, `/_vercel`, and dotted assets.                            |
| `https://next-intl.dev/docs/routing/navigation`                           | Official docs     |   2026-05-27 | `createNavigation` owns locale-aware navigation wrappers.                                                |
| npm registry checks                                                       | Registry metadata |   2026-05-27 | `next-intl@4.12.0` is current stable and supports Next 16/React 19.                                      |

## Boundary Verdict

- Package owns routing, navigation, dictionaries, middleware export, server export, and shared locale helpers.
- `apps/web` owns route-specific request config and localized layout composition.
- Root package export remains client-safe; server helpers are consumed from `@repo/internationalization/server`.
- Payload `/api/*` routes must bypass i18n proxy matching.

## P3.2 Implementation Results

- Removed direct stale `next-international`, `negotiator`, and `@types/negotiator` dependencies from `@repo/internationalization`.
- Added package-local Vitest config and tests for dictionary fallback and locale checks.
- Added `@repo/internationalization` to the root Vitest project list.
- Cleaned i18n helper formatting and structured exports.
- Removed stale `apps/web/i18n-env.d.ts` generated reference to `@ezy/i18n`.
- Removed request-config debug logging.
- Changed localized web layout `html lang` from hard-coded `en` to the resolved locale.
- Updated `apps/web/proxy.ts` so i18n middleware does not run on `/api/*`; the proxy matcher also excludes `/_next`, `/_vercel`, `ingest`, and dotted asset paths.
- Removed the stale contact form root `getTranslations` type import.

## Latest Validation

- `pnpm install` passed.
- `pnpm --filter @repo/internationalization typecheck` passed.
- `pnpm --filter @repo/internationalization test` passed: 1 file / 3 tests.
- root `pnpm test` passed: 21 files / 69 tests.
- `pnpm outdated --filter @repo/internationalization --format json` returned `{}`.
- `git diff --check` passed.
- At P3.2 completion, `apps/web` still failed on non-i18n blockers:
  - invalid `Calendar initialFocus`;
  - missing SEO metadata `description`.
- Later P3.3 resolved the SEO metadata blocker and P3.3A resolved the DayPicker Calendar blocker.
