# R20 Package-First Monorepo Boundary Research

Date researched: 2026-05-26

Status: active cleanup evidence

## Question

Should the reset continue by building/refactoring inside `apps/app`, or should we audit and repair package ownership first?

## Verdict

Repair package ownership first.

`apps/*` are deployable app shells and route owners. `packages/*` own reusable integrations, provider SDKs, env key contracts, shared UI primitives, framework adapters, config plugins, contracts, runtime libraries, and tests that are not app-specific.

The app can compose package APIs, but it must not become the owner of provider/config/integration details that already belong to a workspace package.

## Sources

| Source                                                                         | Type                  | Claim Used                                                                                                       | Impact                                                                                             |
| ------------------------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `https://turborepo.com/repo/docs/core-concepts/package-types`                  | Official docs         | Turborepo distinguishes app packages from library packages; library packages encapsulate reusable code for apps. | Treat `apps/*` as deployable surfaces and `packages/*` as ownership boundaries.                    |
| `https://turborepo.com/docs/crafting-your-repository/structuring-a-repository` | Official docs         | Use a clear workspace shape and avoid unclear nesting/ownership.                                                 | Keep active roots as `apps/*` and `packages/*`; do not rebuild shared logic in apps.               |
| `https://pnpm.io/workspaces`                                                   | Official docs         | Workspace packages can depend on each other through workspace links and explicit package manifests.              | Use `workspace:*` and `@repo/*` package APIs as the local dependency contract.                     |
| `https://nodejs.org/api/packages.html#subpath-exports`                         | Official docs         | Package `exports` define public subpaths; non-exported internals are not public API.                             | App imports must use exported subpaths only. Missing exports are package API bugs or app bypasses. |
| `https://www.next-forge.com/docs/structure`                                    | Official starter docs | next-forge is a multi-app/package monorepo where apps compose shared packages.                                   | Keep app code thin and package-owned integrations explicit.                                        |
| `https://nextjs.org/docs/app/getting-started/project-structure`                | Official docs         | Next App Router supports route groups/private folders, while app code stays organized by routes.                 | Route-local `_components/_lib/_hooks` remain app-owned; reusable concerns move to packages.        |

## Local Evidence Collected

Commands run:

```bash
rg --files -g 'package.json' -g '!node_modules/**' -g '!.next/**' -g '!dist/**'
node -e '<workspace package manifest inventory>'
node -e '<@repo import/export boundary scan>'
pnpm boundaries:cruise
pnpm --filter "./packages/*" typecheck
```

Active workspace inventory:

- Apps: `apps/app`, `apps/web`, `apps/docs`, `apps/email`, `apps/storybook`, `apps/studio`.
- Packages: `@repo/agentmail`, `@repo/ai`, `@repo/analytics`, `@repo/auth`, `@repo/cms`, `@repo/collaboration`, `@repo/contracts`, `@repo/database`, `@repo/design-system`, `@repo/email`, `@repo/feature-flags`, `@repo/internationalization`, `@repo/next-config`, `@repo/notifications`, `@repo/observability`, `@repo/payments`, `@repo/rate-limit`, `@repo/search`, `@repo/security`, `@repo/seo`, `@repo/storage`, `@repo/testing`, `@repo/typescript-config`, `@repo/webhooks`.

Boundary scan result:

- 13 `@repo/*` imports use missing package exports.
- `pnpm boundaries:cruise` reports 18 circular dependency errors and 21 informational orphan findings.
- Package typecheck passes for 23 of 24 active packages; `@repo/ai` fails because a package test imports removed app internals: `../../../../../apps/app/lib/chat/sse-processor`.

## Important Correction

The previous app-local instinct was wrong.

Do not add provider SDKs or integration libraries directly to `apps/app` when a workspace package owns that provider.

Examples:

- Better Auth framework adapters belong in `@repo/auth`, exposed through `@repo/auth/next`.
- Vercel Toolbar/flags Next config belongs in `@repo/feature-flags`, exposed through an explicit public entrypoint such as `@repo/feature-flags/next-config`.
- Knock provider UI belongs in `@repo/notifications`, exposed through a public provider entrypoint.
- Sentry, Better Stack, and logging UI/helpers belong in `@repo/observability`.
- Resend and React Email templates belong in `@repo/email`.
- Theme and toast wrappers belong in `@repo/design-system`, not direct app imports from `next-themes` or `sonner` unless explicitly app-owned.

## App-Owned Exceptions

The app can directly own:

- `next`, `react`, and `react-dom` framework/runtime dependencies;
- app route files and route-local `_components`, `_hooks`, `_lib`, `_schemas`, and `_types`;
- app env composition through T3 Env when it composes package `keys()` contracts;
- route-local form orchestration when it is not reusable and does not own a provider SDK;
- app-specific icons/copy/layout semantics.

When a route-local pattern becomes reusable, move it to `packages/design-system`, `packages/auth`, `packages/notifications`, or the correct owning package before another app imports it.

## Implementation Impact

Before continuing `apps/app` cleanup:

1. Repair package exports so app imports use public package APIs.
2. Remove app/package dependencies that only exist because an app bypassed a package.
3. Move provider/framework adapters into owning packages.
4. Run package typechecks before app builds.
5. Use dependency-cruiser as the package graph guard.
