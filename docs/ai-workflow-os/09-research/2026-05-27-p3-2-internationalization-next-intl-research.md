# P3.2 Internationalization next-intl Research

Date: 2026-05-27

Package: `@repo/internationalization`

Status: completed before P3.2 implementation

## Official Docs Index

Official `next-intl` docs checked:

- https://next-intl.dev/docs
- https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing
- https://next-intl.dev/docs/routing/setup
- https://next-intl.dev/docs/routing/middleware
- https://next-intl.dev/docs/routing/navigation
- https://next-intl.dev/docs/usage/configuration
- https://next-intl.dev/docs/environments/server-client-components

No official `llms.txt` or `llms-full.txt` endpoint was found for `next-intl` during this phase. The normal official docs were used as the primary source.

## Sources Checked

| Source                                                                           | Type          | Evidence Used                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing          | Official docs | App Router setup uses `[locale]`, `i18n/request.ts`, `NextIntlClientProvider`, `notFound`, `hasLocale`, request config, and `NextIntlClientProvider` composition.                                                |
| https://next-intl.dev/docs/routing/setup                                         | Official docs | Routing setup uses `defineRouting`, `createNavigation`, `createMiddleware`, `getRequestConfig`, and a request config path consumed by `next-intl/plugin`.                                                        |
| https://next-intl.dev/docs/routing/middleware                                    | Official docs | Middleware/proxy integration uses `createMiddleware(routing)`. The matcher excludes `/api`, `/_next`, `/_vercel`, and dotted assets by default. This matters because Payload now owns `/api/*` in `apps/web`.    |
| https://next-intl.dev/docs/routing/navigation                                    | Official docs | `createNavigation(routing)` creates locale-aware `Link`, `redirect`, `usePathname`, `useRouter`, and `getPathname` wrappers.                                                                                     |
| https://next-intl.dev/docs/usage/configuration                                   | Official docs | Request configuration should load messages for the resolved locale and can live in `i18n/request.ts`; plugin can point to that path.                                                                             |
| https://next-intl.dev/docs/environments/server-client-components                 | Official docs | Server components should use server APIs such as `getTranslations`; client components use hooks from `next-intl` through provider context.                                                                       |
| `pnpm view next-intl version dist-tags peerDependencies engines --json`          | Registry      | Latest stable is `4.12.0`; peer range supports Next `^16.0.0` and React `^19.0.0`.                                                                                                                               |
| `pnpm view next-international version dist-tags peerDependencies engines --json` | Registry      | Latest stable is `1.3.1`, but the package is unused in active source and duplicates the selected `next-intl` provider.                                                                                           |
| Local package audit                                                              | Source        | `@repo/internationalization` exports next-intl wrappers, dictionaries, routing, navigation, middleware, and server helpers. It also declares unused `next-international`, `negotiator`, and `@types/negotiator`. |
| Local web audit                                                                  | Source        | `apps/web` consumes `@repo/internationalization` for plugin, proxy middleware, routing, request config, layout provider, dictionaries, and server translations.                                                  |

## Version Verdict

- Keep `next-intl@4.12.0`.
- Remove `next-international`; it is not used and creates provider confusion.
- Remove direct `negotiator` and `@types/negotiator`; `next-intl` owns negotiation internally.
- Keep `server-only` only if package server helpers need it; avoid adding server-only to the root export because client components import `NextIntlClientProvider` from the root package.

## Implementation Direction

Keep `@repo/internationalization` as the monorepo i18n package.

Reasons:

- `apps/web` is localized now and needs a stable package boundary for routing/messages/navigation.
- Future `apps/app` localization should not invent a second i18n provider.
- Dictionaries are already package-owned and can be tested centrally.
- `next-intl` is compatible with Next `16.2.6` and React `19.2.6`.

Do not move i18n entirely into `apps/web` in P3.2. That would make later app/documentation reuse harder and would violate the current package-first direction.

## Required Fixes

- Export server translation helpers only from `@repo/internationalization/server`.
- Keep root export for shared types, dictionaries, `hasLocale`, `NextIntlClientProvider`, and client-safe next-intl APIs.
- Remove the stale type import from `apps/web/app/[locale]/contact/components/contact-form.tsx`.
- Update `apps/web/proxy.ts` matcher to exclude `/api`, `/_next`, `/_vercel`, and dotted assets so Payload API routes do not go through locale routing.
- Remove request-config debug logging.
- Set the root layout `lang` attribute to the resolved locale instead of hard-coded `en`.
- Add package-local tests for locale normalization and dictionary loading.

## Open Questions

- Message type augmentation should be revisited after dictionaries stabilize; it currently uses `en.json` as the type source.
- CMS/Payload localization should be handled after P3.2 and CMS content route rendering are stable.
- `apps/web` still has non-i18n blockers: `Calendar initialFocus` and missing SEO metadata description.

## Implementation Evidence

P3.2 implementation completed after this research:

- `@repo/internationalization` remains the i18n package boundary.
- `next-intl@4.12.0` remains the only direct i18n provider.
- Direct `next-international`, `negotiator`, and `@types/negotiator` package dependencies were removed.
- Stale `apps/web/i18n-env.d.ts` reference to `@ezy/i18n` was removed.
- Package-local tests were added for dictionary fallback and locale checks.
- `apps/web/proxy.ts` now keeps i18n middleware away from `/api/*`, preserving Payload API routes.

Validation:

- `pnpm install` passed.
- `pnpm --filter @repo/internationalization typecheck` passed.
- `pnpm --filter @repo/internationalization test` passed: 1 file / 3 tests.
- root `pnpm test` passed: 21 files / 69 tests.
- `pnpm outdated --filter @repo/internationalization --format json` returned `{}`.
- `git diff --check` passed.
