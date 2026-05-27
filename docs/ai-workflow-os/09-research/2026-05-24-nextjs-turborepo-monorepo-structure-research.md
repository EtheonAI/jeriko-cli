# Next.js And Turborepo Monorepo Structure Research

Date: 2026-05-24

Latest re-check: 2026-05-26

Correction 2026-05-25: [`2026-05-25-advanced-monorepo-app-ownership.md`](./2026-05-25-advanced-monorepo-app-ownership.md) and [`../07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md`](../07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md) supersede the earlier final target that put docs/email/Storybook/studio under `tools/*`. That move is now treated as an intermediate cleanup step. The target is a multi-app monorepo with runnable surfaces under `apps/*`.

## Sources Checked

- Next.js project structure and organization: `https://nextjs.org/docs/app/getting-started/project-structure`
- Next.js App Router colocation: `https://nextjs.org/docs/app/building-your-application/routing/colocation`
- Turborepo package types: `https://turborepo.com/repo/docs/core-concepts/package-types`
- Turborepo package configurations: `https://turborepo.com/repo/docs/reference/package-configurations`
- Turborepo workspace structure: `https://turborepo.com/docs/guides/workspaces`
- Vercel monorepos: `https://vercel.com/docs/monorepos`
- Vercel monorepo FAQ: `https://vercel.com/docs/monorepos/monorepo-faq`
- pnpm workspaces: `https://pnpm.io/workspaces`
- next-forge architecture guidance from local Vercel plugin reference.

## Latest Check Log

Checked again on 2026-05-25 before directory moves, then refreshed Next package metadata on 2026-05-26:

| Source                        | Evidence checked                                                                                                   | Result                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js official docs         | `https://nextjs.org/docs/app/getting-started/project-structure`                                                    | Current docs still define `app` as App Router, `src` as optional, route groups as URL-neutral, private folders as non-routable, and colocation inside `app` as safe because only route files expose routes. |
| Turborepo official docs       | `https://turborepo.com/repo/docs/core-concepts/package-types`                                                      | Current docs still split workspace packages into application packages and library/internal packages; application packages should normally be package-graph endpoints.                                       |
| Turborepo structure docs      | `https://turborepo.com/repo/docs/crafting-your-repository/structuring-a-repository`                                | Current docs still caution against nested workspace package globs like `apps/**` or `packages/**`.                                                                                                          |
| Turborepo package config docs | `https://turborepo.com/repo/docs/reference/package-configurations`                                                 | Current docs support per-package `turbo.json` when specialized tasks are needed.                                                                                                                            |
| Vercel monorepo docs          | `https://vercel.com/docs/monorepos` and FAQ                                                                        | Current docs still treat deployable directories in a monorepo as separate Vercel projects with clear root directories.                                                                                      |
| pnpm workspace docs           | `https://pnpm.io/workspaces`                                                                                       | Current docs still support workspace packages through `pnpm-workspace.yaml` and `workspace:` dependencies.                                                                                                  |
| Official npm registry JSON    | `https://registry.npmjs.org/next/latest`                                                                           | Web registry check reported `next@16.2.6`; the active manifests and lockfile already use `16.2.6`.                                                                                                          |
| Official npm registry JSON    | `https://registry.npmjs.org/react/latest`                                                                          | Web registry check reported `react@19.2.6`; the active manifests and lockfile already use `react`/`react-dom` `19.2.6`.                                                                                     |
| Local registry command        | `npm view next version` and `npm view next dist-tags --json` on 2026-05-26                                         | Local CLI metadata now reports `latest: 16.2.6` and `canary: 16.3.0-canary.29`. Earlier stale `16.2.4` readings are superseded.                                                                             |
| Local registry command        | `npm view @next/eslint-plugin-next version` and `npm view @next/eslint-plugin-next dist-tags --json` on 2026-05-26 | Local CLI metadata now reports `latest: 16.2.6` and `canary: 16.3.0-canary.29`.                                                                                                                             |
| Local registry command        | `pnpm view turbo version` and `npm view turbo version --registry https://registry.npmjs.org --prefer-online`       | Local CLI metadata returned stale `2.8.3`, while the root manifest/lockfile and Turbo dry run use `2.9.6`.                                                                                                  |
| Local registry command        | `pnpm view vitest version`                                                                                         | Local CLI metadata previously returned stale `4.1.5`, while the root manifest/lockfile and Vitest runs use `4.1.7`.                                                                                         |

Package version decisions should use official registry/package-page evidence, direct local commands, and lockfile inspection together. If local CLI metadata conflicts with official registry JSON or an already installed lockfile, record the conflict and do not silently downgrade.

## Source-Backed Findings

### Next.js App Structure

Next.js App Router supports:

- optional `src` folder for separating app source from project config;
- route groups like `(app)` and `(auth)` that do not affect URLs;
- private folders like `_components` and `_lib` for non-routable route-local code;
- colocated files inside `app` because only special files such as `page.tsx` and `route.ts` create public routes.

Implication for AI Workflow OS:

```text
apps/app/src/app/(app)/workflows/[workflowId]/_components
apps/app/src/app/(app)/runs/[runId]/_lib
apps/app/src/app/api/workflows/compile/route.ts
```

This is an eventual target shape, not a cleanup-phase requirement. Next.js does not require `src`, and the current cleanup must not move `apps/app/app` to `apps/app/src/app` without a dedicated route reset plan. The immediate rule is route-local ownership: `_components`, `_lib`, `_hooks`, `_actions`, and `_types` near the routes that use them.

### Server/Client Boundary

Next pages and layouts are Server Components by default. Client Components should be narrow islands for state, effects, event handlers, browser APIs, and client-only libraries.

Implication:

- `page.tsx` should load data and compose.
- interactive panels/forms/editors should be isolated Client Components.
- server-only modules belong in `lib/server` or route-local `_lib`.

### Route Handlers

Route handlers are for external HTTP APIs, public APIs, webhooks, file uploads, and streaming endpoints. UI-triggered mutations should prefer Server Actions where appropriate.

Implication:

- keep webhooks and SSE in `app/api`;
- avoid route handlers as a dumping ground for internal service-proxy calls;
- collapse old proxy routes into app/server facades or delete them.

### Turborepo Package Types

Turborepo distinguishes:

- application packages: deployable apps, usually under `apps`;
- library packages: reusable code consumed by applications, usually under `packages`.

Application packages should normally be graph endpoints, not imported into other packages.

Implication:

```text
apps/app      deployable product app
apps/web      deployable marketing app
apps/docs     documentation app/content surface
apps/email    React Email preview/build app
apps/storybook design-system workshop app
apps/studio   database/admin studio app
packages/*    reusable libraries/contracts/adapters
legacy/*      not active workspace code
```

### Nested Packages

Turborepo documentation cautions against nested package globs like `apps/**` or `packages/**` because package managers can behave ambiguously.

Implication:

Do not reorganize active packages into nested workspace package paths such as:

```text
packages/platform/auth
packages/runtime/workflow
```

Instead keep active package directories flat:

```text
packages/auth
packages/workflow-kernel
packages/runtime
packages/sandbox
packages/tools
```

Use naming, README files, and docs for category clarity.

### Vercel Monorepos

Vercel treats monorepo apps as separate projects/deployables. A Vercel monorepo can contain multiple apps, but each deployable should have a clear root and purpose.

Implication:

- `apps/app` is the product app.
- `apps/web` can stay as a separate marketing app if it remains content-only.
- `apps/api` should be justified as a separate deployable or folded into `apps/app/api`.
- `apps/docs`, `apps/email`, `apps/storybook`, and `apps/studio` are not core runtime product apps, but they are runnable app surfaces and should remain under `apps/*` with explicit ownership, scripts, and env contracts.

## Applied Decisions

- `services/*` moved to `legacy/manus-clone/services`.
- `apps/api` moved to `legacy/deactivated-apps/api` after inspection found no current route ownership strong enough to justify another active Next deploy.
- old service compose files moved to `legacy/manus-clone/docker`; active Docker is now `docker-compose.infra.yml` for Postgres, Redis, and Typesense.
- stale `vitest.workspace.ts` was replaced with root `vitest.config.ts` and Vitest `test.projects` after checking current Vitest docs.
- `packages/service-utils` moved to `legacy/manus-clone/service-utils`.
- `pnpm-workspace.yaml` now includes `apps/*`, `packages/*`, and `tools/*`.
- `apps/docs`, `apps/email`, `apps/storybook`, and `apps/studio` were moved to `tools/docs`, `tools/email`, `tools/storybook`, and `tools/studio` as an intermediate cleanup. This is superseded by MADR-037; move them back under `apps/*` if they remain runnable package surfaces.
- root scripts no longer include legacy service commands.
- Docker commands are infra-only for shared dependencies.

## Active Target

```text
apps/
  app          product app
  web          marketing/content app
  docs         docs/content app
  email        email preview/build app
  storybook    design-system workshop app
  studio       database/admin app

packages/
  auth
  database
  design-system
  contracts
  ai
  storage
  search
  payments
  observability
  next-config
  typescript-config

legacy/
  manus-clone
```

## Next Cleanup Checklist

- [x] Move old service tree out of active top-level architecture.
- [x] Move service-utils out of active package namespace.
- [x] Verify active workspace still resolves.
- [x] Decide whether `apps/api` remains a separate app: deactivated until a separate deploy boundary is proven.
- [x] Move dev/content utilities from `apps/*` to `tools/*` as an intermediate cleanup.
- [ ] Move runnable docs/email/storybook/studio package surfaces back under `apps/*` per MADR-037.
- [ ] Later, decide whether to move `apps/app` to `src/app`; do not do it during this cleanup pass.
- [ ] Move `apps/web` to the same route-local conventions if it stays.
- [ ] Add package READMEs/classifications for active packages.
- [ ] Add dead-code tooling after app/package scope is stable.
