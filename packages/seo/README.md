# @repo/seo

Status: P3.3 completed. The package owns shared marketing SEO helpers.

Canonical decisions:

- `docs/ai-workflow-os/07-madr/MADR-094-seo-metadata-helper-boundary.md`
- `docs/ai-workflow-os/09-research/2026-05-27-p3-3-seo-next-metadata-research.md`
- `docs/ai-workflow-os/10-audit/seo-p3-3-audit-2026-05-27.md`

## Ownership

`@repo/seo` owns:

- `createMetadata` for shared Next App Router metadata shape;
- `JsonLd` for safe JSON-LD script rendering;
- `schema-dts` type exports;
- package-local tests for metadata and JSON-LD escaping.

`@repo/seo` must not own:

- app env validation;
- CMS content fetching;
- i18n routing;
- dashboard/product app metadata.

## Rules

- Keep `description` required for marketing metadata.
- Do not read `process.env` in this package.
- Do not reintroduce next-forge/Vercel boilerplate defaults.
- Apps pass route-specific metadata values.

## Validation

```bash
pnpm --filter @repo/seo typecheck
pnpm --filter @repo/seo test
pnpm test
pnpm outdated --filter @repo/seo --format json
```
