# Package Phase Ledger Foundation Research

Date researched: 2026-05-27

Status: source-backed planning evidence

## Purpose

This note records the external evidence used to create the package-by-package phase ledger. It does not approve implementation changes by itself. Each package still needs its own phase audit before code changes.

## Sources

| Source                                                                           | Type          | Checked Date | Claim Used                                                                                                                                                               | Impact                                                                                                                                                                  |
| -------------------------------------------------------------------------------- | ------------- | -----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://turborepo.dev/docs/core-concepts/internal-packages                       | Official docs |   2026-05-27 | Internal packages are workspace libraries consumed through package exports; just-in-time packages can export TypeScript but have cache/typecheck tradeoffs.              | Apps should consume `@repo/*` public APIs, not package internals. Package phase docs must record export shape and consumers.                                            |
| https://turborepo.dev/docs/crafting-your-repository/creating-an-internal-package | Official docs |   2026-05-27 | Package `name` and `exports` define importable workspace APIs and contribute to Turborepo's package graph.                                                               | Every package phase must audit `package.json`, exports, and dependency graph impact.                                                                                    |
| https://payloadcms.com/docs/getting-started/installation                         | Official docs |   2026-05-27 | Payload can be added to an existing Next.js app; current docs list Node 20.9+, Next `16.2.6`+, package install steps, `(payload)` route group, and `withPayload` config. | `@repo/cms` should be a dedicated Payload migration phase, not a blind BaseHub swap. Placement under app route group vs separate app remains an explicit P3.1 decision. |
| https://payloadcms.com/docs/getting-started/concepts                             | Official docs |   2026-05-27 | Payload has a typed Local API usable in server contexts and separates `payload` core from `@payloadcms/next` HTTP/admin integration and DB adapters.                     | `@repo/cms` must define whether it owns config/query helpers only, or whether a deployable `apps/cms` owns the admin/runtime.                                           |
| https://next-intl.dev/docs/routing/setup                                         | Official docs |   2026-05-27 | App Router routing uses `defineRouting`, proxy/matcher, `createNavigation`, request config, `[locale]` layout validation, and static rendering helpers.                  | `@repo/internationalization` can wrap `next-intl`, but the route/proxy integration must be planned against `apps/web` before implementation.                            |
| https://next-intl.dev/docs/environments/actions-metadata-route-handlers          | Official docs |   2026-05-27 | `next-intl/server` supports metadata, server actions, Open Graph images, manifest, sitemap, and route handlers.                                                          | i18n phase must include metadata/SEO interactions, not just UI translations.                                                                                            |

## Registry Checks

Command used with pinned local toolchain:

```bash
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs view <package> version
```

Results checked on 2026-05-27:

- `payload`: `3.85.0`
- `@payloadcms/next`: `3.85.0`
- `@payloadcms/db-postgres`: `3.85.0`
- `next-intl`: `4.12.0`
- `turbo`: `2.9.15`

## Conclusions

- The package-ledger approach is valid for this monorepo because workspace package exports are the correct ownership boundary.
- CMS/Payload and i18n/next-intl should be planned as separate package phases because both touch route structure, runtime boundaries, and app builds.
- `apps/app` and `apps/web` should not be rebuilt seriously until their package dependencies have documented public APIs and validation commands.

## Open Questions For Package Phases

- Should Payload be embedded under `apps/web/app/(payload)`, moved into a deployable `apps/cms`, or exposed through `@repo/cms` config/query helpers only?
- Should `@repo/internationalization` remain a package wrapper, or should localization be scoped to `apps/web` once product needs are clearer?
- Which internal packages should remain just-in-time TypeScript packages, and which need compiled outputs for CI/cache/runtime reasons?
