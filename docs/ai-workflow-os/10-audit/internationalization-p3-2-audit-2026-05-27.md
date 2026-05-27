# P3.2 Internationalization Package Audit

Date: 2026-05-27

Package: `@repo/internationalization`

Status: P3.2 implementation completed

## Current Package Surface

Files audited:

- `packages/internationalization/package.json`
- `packages/internationalization/index.ts`
- `packages/internationalization/routing.ts`
- `packages/internationalization/navigation.ts`
- `packages/internationalization/middleware.ts`
- `packages/internationalization/plugin.ts`
- `packages/internationalization/server.ts`
- `packages/internationalization/i18n.d.ts`
- `packages/internationalization/dictionaries/*.json`
- `apps/web/next.config.ts`
- `apps/web/proxy.ts`
- `apps/web/i18n/request.ts`
- `apps/web/app/[locale]/layout.tsx`
- `apps/web/app/[locale]/contact/components/contact-form.tsx`

Active exports before implementation:

- `@repo/internationalization`
- `@repo/internationalization/i18n.d.ts`
- `@repo/internationalization/plugin`
- `@repo/internationalization/middleware`
- `@repo/internationalization/routing`
- `@repo/internationalization/navigation`
- `@repo/internationalization/server`
- `@repo/internationalization/messages/*`
- `@repo/internationalization/dictionaries/*`

Active consumers:

- `apps/web/next.config.ts`
- `apps/web/proxy.ts`
- `apps/web/i18n/request.ts`
- `apps/web/app/[locale]/layout.tsx`
- `apps/web/app/[locale]/(home)/**`
- `apps/web/app/[locale]/blog/page.tsx`
- selected home components using server translations.

## Findings

### Keep

- `next-intl@4.12.0`.
- `@repo/internationalization` package boundary.
- Package-owned dictionaries.
- `defineRouting` and `createNavigation` package helpers.
- Server translation helpers under `@repo/internationalization/server`.

### Refactor

- Remove unused `next-international`, `negotiator`, and `@types/negotiator`.
- Keep server APIs out of the client-consumed root entrypoint.
- Add package-local tests under `packages/internationalization/tests`.
- Remove request-config debug logging from `apps/web/i18n/request.ts`.
- Use resolved locale for `html lang`.
- Update proxy matcher so Payload `/api/*` routes bypass i18n middleware.

### Delete

- No dictionaries should be deleted in P3.2.
- No active localized routes should be deleted in P3.2.

### Defer

- CMS/Payload localized content modeling.
- Translation governance, extraction, and Languine workflow hardening.
- `apps/web` non-i18n type errors:
  - invalid `Calendar initialFocus`;
  - missing SEO metadata description.

## Validation Before Implementation

Commands:

```bash
pnpm view next-intl version dist-tags peerDependencies engines --json
pnpm view next-international version dist-tags peerDependencies engines --json
pnpm why next-international
pnpm --filter @repo/internationalization typecheck
rg "next-international|negotiator|@types/negotiator" apps packages package.json pnpm-lock.yaml
rg "@repo/internationalization|next-intl|getTranslations|useTranslations|createNavigation|defineRouting|routing|proxy" apps packages --glob '!**/node_modules/**'
```

Results:

- `next-intl` stable latest is `4.12.0`.
- `next-intl` peer range supports Next `^16.0.0` and React `^19.0.0`.
- `next-international` is declared only by `@repo/internationalization` and has no active source imports.
- `negotiator` and `@types/negotiator` have no active source imports.
- `@repo/internationalization` typecheck passed before implementation.

## Implementation Checklist

- [x] Update package playbook and MADR before code changes.
- [x] Remove stale dependencies.
- [x] Add tests and Vitest config.
- [x] Include package in root Vitest projects.
- [x] Clean request config and layout locale.
- [x] Fix proxy matcher.
- [x] Remove stale web root `getTranslations` type import.
- [x] Run package install/typecheck/test.
- [x] Run root tests.
- [x] Run affected `apps/web` typecheck and document remaining blockers.

## Implementation Results

Changed package files:

- `packages/internationalization/package.json`
- `packages/internationalization/index.ts`
- `packages/internationalization/routing.ts`
- `packages/internationalization/navigation.ts`
- `packages/internationalization/middleware.ts`
- `packages/internationalization/plugin.ts`
- `packages/internationalization/server.ts`
- `packages/internationalization/i18n.d.ts`
- `packages/internationalization/vitest.config.ts`
- `packages/internationalization/tests/internationalization.test.ts`

Changed affected web/root files:

- `apps/web/proxy.ts`
- `apps/web/i18n/request.ts`
- `apps/web/app/[locale]/layout.tsx`
- `apps/web/app/[locale]/contact/components/contact-form.tsx`
- `apps/web/i18n-env.d.ts` deleted
- `vitest.config.ts`
- `pnpm-lock.yaml`

Dependency verdict:

- `next-intl@4.12.0` remains the only direct i18n provider.
- Direct `next-international`, `@ezy/i18n`, and `@types/negotiator` references were removed from active source/package files.
- `negotiator` remains only as transitive lockfile state owned by other installed packages.

## Validation After Implementation

Commands:

```bash
pnpm install
pnpm --filter @repo/internationalization typecheck
pnpm --filter @repo/internationalization test
pnpm test
pnpm --filter web typecheck
pnpm outdated --filter @repo/internationalization --format json
pnpm why next-international
rg "next-international|@ezy/i18n|@types/negotiator" packages/internationalization apps/web package.json pnpm-lock.yaml --glob '!**/node_modules/**'
git diff --check
```

Results:

- `pnpm install` passed.
- `@repo/internationalization` typecheck passed.
- `@repo/internationalization` tests passed: 1 file / 3 tests.
- root `pnpm test` passed: 21 files / 69 tests.
- `pnpm outdated --filter @repo/internationalization --format json` returned `{}`.
- `pnpm why next-international` returned no dependency owner.
- Direct stale i18n provider references are gone from active source/package files.
- `git diff --check` passed.
- `apps/web` typecheck no longer reports the i18n `getTranslations` root export error.
- `apps/web` typecheck still fails on two non-i18n blockers:
  - `apps/web/app/[locale]/contact/components/contact-form.tsx`: `Calendar initialFocus` is invalid.
  - `apps/web/app/[locale]/contact/page.tsx`: `createMetadata` call is missing `description`.
