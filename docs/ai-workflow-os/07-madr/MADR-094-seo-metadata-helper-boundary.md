# MADR-094: SEO Metadata Helper Boundary

Date: 2026-05-27

Status: accepted and implemented

Package: `@repo/seo`

## Context

`@repo/seo` is a small shared package that provides:

- `createMetadata` for Next App Router metadata;
- `JsonLd` for structured data rendering;
- `schema-dts` type exports.

The package is active in `apps/web` routes. The current web typecheck has one SEO-owned failure: the contact page calls `createMetadata({ title: "Contact" })` while the helper correctly requires `description`.

The local package audit also found stale boilerplate from next-forge:

- application name is `next-forge`;
- author/publisher are `Vercel`;
- helper reads `process.env.VERCEL_PROJECT_PRODUCTION_URL` directly;
- helper depends on `lodash.merge` for a very small merge operation.

## Decision

Keep `@repo/seo` as a small shared SEO package.

Keep `description` required in `createMetadata`. Metadata without a description is not an acceptable default for marketing routes.

Make `createMetadata` pure and app-agnostic:

- no direct `process.env`;
- no app env validation;
- no CMS fetching;
- explicit object composition instead of `lodash.merge`;
- Jeriko defaults instead of next-forge/Vercel defaults.

Fix the web contact page by passing a description rather than weakening the helper type.

## Consequences

Positive:

- SEO helper remains strict and catches missing route descriptions.
- The package no longer carries next-forge branding.
- The package no longer reads env directly.
- Dependency surface becomes smaller.
- Metadata and JSON-LD behavior can be tested package-locally.

Negative:

- Apps must intentionally pass route-specific descriptions.
- App-level base URL/canonical policy is deferred to a later web/SEO routing pass.
- Brand/social defaults may need another update after final brand decisions.

## Boundaries

Allowed:

- `@repo/seo` may import Next metadata types.
- `@repo/seo/json-ld` may render a JSON-LD script and export `schema-dts` types.
- `apps/web` may call `createMetadata` from route metadata functions.

Forbidden:

- Do not read env directly in `@repo/seo`.
- Do not fetch CMS content in `@repo/seo`.
- Do not move i18n routing into `@repo/seo`.
- Do not make `description` optional for marketing metadata.

## Checklist

- [x] Research current Next metadata docs and package registry state.
- [x] Audit package exports/deps/consumers.
- [x] Decide strict description contract.
- [x] Remove `lodash.merge` and its type package.
- [x] Remove direct env reads from metadata helper.
- [x] Replace next-forge/Vercel defaults.
- [x] Add package-local tests.
- [x] Fix affected web contact metadata call.
- [x] Validate package and affected web typecheck.

## References

- `docs/ai-workflow-os/09-research/2026-05-27-p3-3-seo-next-metadata-research.md`
- `docs/ai-workflow-os/10-audit/seo-p3-3-audit-2026-05-27.md`
- https://nextjs.org/docs/app/getting-started/metadata-and-og-images
- https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- https://nextjs.org/docs/app/api-reference/file-conventions/metadata

## Validation Notes

- `pnpm install` passed.
- `pnpm --filter @repo/seo typecheck` passed.
- `pnpm --filter @repo/seo test` passed: 2 files / 4 tests.
- `pnpm test` passed: 23 files / 73 tests.
- `pnpm outdated --filter @repo/seo --format json` returned `{}`.
- `git diff --check` passed.
- Active `@repo/seo` source has no direct `process.env`, `lodash.merge`, `next-forge`, or `Vercel` defaults.
- `apps/web` typecheck no longer reports the SEO metadata description error.
- At P3.3 completion, `apps/web` still failed on the non-SEO `Calendar initialFocus` DayPicker issue; P3.3A later resolved it by switching the app usage to `autoFocus`.
