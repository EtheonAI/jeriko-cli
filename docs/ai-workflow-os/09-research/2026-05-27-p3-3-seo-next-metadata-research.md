# P3.3 SEO Next Metadata Research

Date: 2026-05-27

Package: `@repo/seo`

Status: completed before P3.3 implementation

## Official Docs Checked

Primary official sources:

- https://nextjs.org/docs/app/getting-started/metadata-and-og-images
- https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- https://nextjs.org/docs/app/api-reference/file-conventions/metadata
- https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap

No separate official `llms.txt` or `llms-full.txt` source is needed for the package because the active provider is Next.js itself and the official Next docs were checked directly.

## Sources Checked

| Source                                                                   | Type                 | Evidence Used                                                                                                                                                               |
| ------------------------------------------------------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next metadata and OG guide                                               | Official docs        | App Router metadata is defined by static `metadata`, dynamic `generateMetadata`, and file conventions; metadata exports are Server Component only.                          |
| Next `generateMetadata` API docs                                         | Official docs        | `metadataBase` is required for relative URL metadata fields; Open Graph and Twitter metadata are supported Metadata fields; file-based OG images are preferred when static. |
| Next metadata file conventions                                           | Official docs        | Metadata files such as icons, Open Graph images, robots, and sitemap are special conventions and can be static or dynamic.                                                  |
| Next sitemap docs                                                        | Official docs        | `sitemap.ts` is a special route handler and should return `MetadataRoute.Sitemap`.                                                                                          |
| `pnpm view schema-dts version dist-tags peerDependencies engines --json` | Registry             | `schema-dts@2.0.0` is current stable.                                                                                                                                       |
| `pnpm view lodash.merge version dist-tags deprecated --json`             | Registry             | `lodash.merge@4.6.2` is current but unnecessary for the current small helper.                                                                                               |
| `pnpm outdated --filter @repo/seo --format json`                         | Registry/local proof | No outdated direct dependencies reported for `@repo/seo`.                                                                                                                   |
| Local package audit                                                      | Source               | `@repo/seo` exports metadata and JSON-LD helpers, but metadata defaults still use `next-forge`, `Vercel`, and direct `process.env`.                                         |
| Local web audit                                                          | Source               | `apps/web` consumes `createMetadata` for home/blog/blog-post/legal/contact pages and `JsonLd` for blog structured data.                                                     |

## Version Verdict

- Keep `schema-dts@2.0.0`.
- Keep `react@19.2.6` for the JSX JSON-LD component.
- Remove `lodash.merge` and `@types/lodash.merge`; the helper can use explicit object composition.
- Keep `next@16.2.6` as a dev dependency for `Metadata` and `MetadataRoute` types.

## Implementation Direction

Keep `@repo/seo` as a small shared package.

The package should own:

- typed `createMetadata` helper for shared marketing metadata shape;
- JSON-LD rendering and schema-dts type exports;
- package tests for metadata and JSON-LD escaping.

The package should not own:

- app env validation;
- app-specific CMS content fetching;
- i18n routing;
- dashboard/product-app metadata.

The metadata helper should be pure. It must not read `process.env` directly. Apps can pass URLs through normal Metadata fields when needed, while app env validation stays in app/package env boundaries.

## Required Fixes

- Replace leftover `next-forge`/`Vercel` defaults with Jeriko defaults.
- Remove direct `process.env` usage from `@repo/seo`.
- Remove `lodash.merge`.
- Add package-local tests.
- Keep `description` required for `createMetadata`.
- Fix `apps/web/app/[locale]/contact/page.tsx` by passing a description instead of weakening the SEO helper contract.

## Open Questions

- Final brand name and social handles should be revisited during design/brand phase.
- Locale-specific Open Graph locale should be revisited after CMS localization is implemented.
- `apps/web` sitemap/robots still duplicate URL-building logic and should be cleaned in a later web route/SEO pass if needed.

## Implementation Evidence

P3.3 implementation completed after this research:

- `@repo/seo` remains the shared SEO package.
- `createMetadata` no longer reads env directly.
- `lodash.merge` and `@types/lodash.merge` were removed.
- next-forge/Vercel metadata defaults were replaced with Jeriko defaults.
- `description` remains required.
- Package tests were added for metadata and JSON-LD escaping.
- `apps/web/app/[locale]/contact/page.tsx` now passes a description.

Validation:

- `pnpm install` passed.
- `pnpm --filter @repo/seo typecheck` passed.
- `pnpm --filter @repo/seo test` passed: 2 files / 4 tests.
- root `pnpm test` passed: 23 files / 73 tests.
- `pnpm outdated --filter @repo/seo --format json` returned `{}`.
- `git diff --check` passed.
- `apps/web` typecheck no longer reports the SEO metadata description error.
