# AI Workflow OS Engineering Standards

Status: canonical working rulebook

Date: 2026-05-26

Scope: all cleanup, refactor, package, Next.js, monorepo, env, architecture, UI, backend, workflow, and future CMS work in this repo.

## Purpose

This file exists to prevent drift.

Before changing code, follow this order:

```text
phase
-> local audit
-> current primary-source research
-> repo-fit decision
-> smallest scoped edit
-> verification
-> documentation update
```

Do not rely on memory for package behavior, framework conventions, version compatibility, environment loading, auth, runtime behavior, deployment behavior, or security-sensitive code.

## Source Hierarchy

Use evidence in this order:

1. Official docs for the framework/package/platform.
2. Official package metadata from the public registry with fresh cache.
3. Local installed types/source and current repo usage.
4. Existing MADRs, audits, and plans in `docs/ai-workflow-os`.
5. Secondary articles only for context or compatibility signals.

Do not use secondary articles, examples, GitHub repos, Reddit, Medium, or memory as the final authority when official docs or package metadata are available.

Local bundled skills, agent memories, and helper summaries are convenience inputs only. If a local skill conflicts with official docs, public registry metadata, installed package types/source, or this repo's MADRs, the higher-priority source wins and the conflict must be documented before code changes.

## Skill Freshness Protocol

Bundled skills and plugin-cached skills can lag official docs.

When a skill is useful but stale:

- verify the current package/framework/platform docs before implementation;
- record the corrected rule in the relevant research note, MADR, package playbook, or engineering standard;
- do not silently follow the stale skill;
- do not edit plugin-cached third-party skill files as part of repo cleanup;
- create or update repo-owned skills only when a dedicated skill-maintenance task exists.

Treat skills as accelerators, not authority. The repo's documented standards and package playbooks must be updated when they need to override or refine a skill.

## Research Protocol

Before any package/framework refactor:

- First look for an official `llms.txt`, `llms-full.txt`, or equivalent AI docs index for the package/platform. Check the common locations such as `/llms.txt`, `/llms-full.txt`, `/docs/llms.txt`, and the package's documented AI resources. If one exists, read/use it as the first official-doc index and record the URL. If it does not exist, document that it was not found and proceed with the normal official docs.
- Check official docs for the exact package/framework area being touched.
- Check the latest version and peer/engine requirements with fresh registry metadata.
- Inspect current repo usage with `rg`.
- Inspect local package types/source when behavior is unclear.
- Record the evidence if the change affects architecture, runtime boundaries, env, build, security, package ownership, or app structure.

Fresh package checks should use explicit registry/cache settings, for example:

```bash
npm view <package> version engines peerDependencies --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-<package> --prefer-online
pnpm outdated -r --format json
```

If `pnpm view` or `npm view` conflicts with npmjs.com, verify with direct package metadata and document the cache/registry condition.

For Next.js work, pin decisions to the requested stable release and current registry metadata. Documentation sidebars can lag package release metadata; record that discrepancy instead of silently downgrading or treating a helper skill as the version source.

For build, lint, typecheck, runtime, or package bugs:

- stop and identify the failing boundary before changing config;
- read official docs and current package/source behavior for the failing subsystem;
- document the observed command, error output, root cause if known, and hypotheses if unknown;
- design an isolation test before applying a config workaround;
- never call a fallback path, such as `next build --webpack`, a fix for a default Turbopack failure.

## Documentation Protocol

Use the correct document type:

- Research note: source-backed facts and package/framework evidence.
- MADR: architecture decision, package boundary, env strategy, app ownership, runtime strategy, or major tradeoff.
- Audit: current repo state, findings, risks, keep/refactor/delete/move decisions.
- Plan/checklist: execution order and validation gates.
- Package playbook: package/app-specific sources, local usage map, env/runtime boundaries, allowed imports, verification gates, and keep/refactor/delete decisions.

Every non-trivial change must leave a trace:

- What was changed.
- Why it was changed.
- Which source or repo evidence justified it.
- Which commands verified it.
- What remains unproven.

Do not mark work complete if build, typecheck, lint, tests, or docs still fail unless the failure is explicitly documented as remaining debt.

## Package-Specific Playbooks

The repo-level standard is not a substitute for package-specific evidence.

Before changing any P0 app/package or architecture-level P1 package behavior, create or update a playbook under:

```text
docs/ai-workflow-os/08-plans/package-playbooks/
```

Use the priority matrix and template in:

```text
docs/ai-workflow-os/08-plans/package-best-practices-registry.md
```

Required before refactor:

- official `llms.txt` / `llms-full.txt` / AI-resource docs search result;
- official docs for the package/framework area being touched;
- latest package metadata when an external package is involved;
- local import/dependency/env usage map;
- env contract and server/client/runtime boundary;
- allowed and forbidden imports;
- concrete keep/refactor/delete decisions;
- verification commands.

Do not document every transitive dependency in full before cleanup can proceed. Document every repo app/package that is being refactored, and document external packages when their APIs, versions, peers, engines, runtime behavior, or security assumptions affect the change.

If a package has a non-trivial provider/runtime boundary, add or update a package-local `README.md` or architecture note in that package. The central docs stay canonical, but the package folder must summarize ownership, allowed imports, current provider state, env keys, and validation commands for engineers working locally.

## Enterprise Tooling Discipline

Enterprise starter repos are reference inputs, not package manifests to copy.

When a starter such as Blazity `next-enterprise` includes tooling, translate it into the problem it solves before adopting anything:

- dependency/security updates: Renovate;
- upstream emergency patching: patch-package;
- graph/coupling visibility: dependency-cruiser or madge;
- release automation: Changesets or semantic-release;
- env contract: T3 Env;
- component validation: Storybook/Chromatic/component tests;
- runtime visibility: OpenTelemetry, Speed Insights, Sentry, or other RUM;
- performance regression checks: Lighthouse, WebPageTest, native Next analyzer, or bundle budgets.

Then check current repo coverage:

- Reuse existing tooling before adding a duplicate.
- Do not add `patch-package` unless a documented upstream defect blocks delivery.
- Do not add semantic-release while Changesets owns release/versioning.
- Use dependency-cruiser before adding another graph tool.
- Use Next `experimental-analyze` before adding `@next/bundle-analyzer`.
- Keep Renovate rules aligned with current package normalization; stale `allowedVersions` pins are maintenance bugs.

Before adding a new dependency, record:

- latest official docs and package metadata;
- native Next.js, React, browser, or existing repo alternatives;
- bundle/runtime impact;
- tree-shaking or modular import support;
- peer dependency and engine compatibility;
- maintenance health;
- intended ownership location: app, design-system, runtime adapter, testing, or tooling.

## No-Drift Rules

- Do not remove a feature to make a build pass unless the feature is already classified as dead, legacy, or intentionally deferred.
- Do not replace a package or pattern without checking its latest docs and local usage.
- Do not use `process.env` directly in app code when an app env contract exists.
- Do not bypass T3 Env in Next app/runtime code.
- Do not add `dotenv` or `@next/env` to app runtime env loading. Use `@next/env` only for standalone scripts when documented.
- Do not move `app` to `src/app` unless a dedicated MADR and route migration plan exist.
- Do not introduce a new service boundary until a deploy/runtime/security reason is proven.
- Do not add package-level module imports that force unrelated env validation during build.
- Do not claim a full audit unless the audited scope and skipped scope are explicitly documented.
- Do not mix cleanup, package upgrade, UI redesign, CMS migration, sandbox migration, and workflow-kernel implementation in one unbounded change.
- For `.flow`, research YAML and workflow syntax as reference material only. Do not add `yaml` or make `.flow` a YAML-backed dialect unless a future MADR explicitly reverses MADR-095.

## Current Phase Discipline

Current phase: package-by-package base modernization.

Allowed now:

- remove active old Manus/BaseHub/service coupling;
- clean app/package boundaries;
- upgrade package implementations to current supported providers;
- migrate package provider boundaries when the package phase and MADR approve the migration;
- refactor and build each package behind its public `@repo/*` API before app integration;
- make build/typecheck/lint meaningful;
- document keep/refactor/delete decisions;
- isolate optional integrations;
- preserve or implement future choices such as Payload according to the package's own MADR, docs gate, and validation plan.

Not allowed now unless explicitly moved into a new phase:

- implement `.flow` parser/runtime;
- redesign the whole app UI;
- migrate sandbox provider;
- rewrite auth from scratch;
- create new backend services.

## Monorepo Standards

The repo is a multi-app Turborepo monorepo.

Target graph:

```text
apps/*      deployable app surfaces and dev app surfaces
packages/*  reusable packages, contracts, adapters, config, design system
docs/*      architecture, audit, research, plans, decisions
scripts/*   repo maintenance scripts
legacy/*    inactive reference code only
```

Rules:

- App packages are graph endpoints.
- Reusable packages must not import app packages.
- Shared code goes into `packages/*`, not another app.
- Package ownership comes before app refactors. Before adding provider, config, integration, shared UI, env, runtime, contract, or adapter behavior inside an app, identify the owning `@repo/*` package and add or repair its public API first.
- Apps must not import provider SDK internals when a workspace package owns that provider.
- If a provider has a package boundary, apps import the package API, for example `@repo/auth/*`, `@repo/email`, `@repo/payments`, `@repo/storage`, or `@repo/observability`, not the underlying provider SDK.
- Direct provider SDK imports are allowed only inside the owning package unless a MADR explicitly proves the app is the owner.
- Apps must not import non-exported package internals. If an app needs `@repo/package/internal-path`, either expose an intentional public subpath from that package or move the app code to the correct owner.
- App `next.config.ts` files must stay thin composition files. Baseline config belongs in `@repo/next-config`; package-specific Next config contributors belong in the owning package, for example `@repo/feature-flags/next-config`, not app-local provider wiring or internal `lib/*` imports.
- Apps may directly own framework/runtime dependencies such as `next`, `react`, and `react-dom`, app route files, route-local UI, and app env composition. Provider SDKs, config plugins, reusable UI primitives, package env key contracts, and runtime adapters belong in packages.
- Platform tools live in `@repo/ai/tools`, not in a separate `@repo/tools` package. Keep this subpath server-only and isolated from AI UI/chat component imports. Composio, direct provider adapters, connected-account sessions, connector toolkits/actions, and connector trigger normalization belong in `@repo/connectors`. `@repo/ai/tools` may call `@repo/connectors` and internal packages after applying platform permission/risk/approval/idempotency/audit policy.
- UI ownership is layered: `@repo/design-system` owns shared primitives, tokens, global styles, and generic visual patterns; `apps/app` owns the first workflow/AI product UI route-locally; future reusable workflow UI needs a dedicated MADR/package only after multiple consumers exist. `@repo/ai` is not a React UI package. Do not move product/domain UI wholesale into design-system, and do not hand-roll primitive controls when a design-system primitive exists.
- New package tests belong in a package-level `tests/` folder, not mixed into `src/`. Keep test-only stubs and fixtures under `tests/support` or `tests/fixtures` so source exports remain production code.
- Package tests must not import from `apps/*`. If a reusable package test needs behavior from an app, move that behavior behind a package contract first.
- `apps/api` stays deactivated until a separate deploy/security/runtime boundary is proven.
- `services/*` stays legacy until a new service boundary is proven.
- `tools/*` is only for repo-only CLIs/scripts, not runnable app surfaces.

## Next.js 16.2.6 Standards

Use App Router conventions.

Version anchor, rechecked 2026-05-26:

- `npm view next version` returns `16.2.6`.
- `npm view @next/eslint-plugin-next version` returns `16.2.6`.
- `npm view next dist-tags --json` reports `latest: 16.2.6` and `canary: 16.3.0-canary.29`.
- Keep active stable Next packages on exact `16.2.6`; do not move to canary without a dedicated upgrade MADR.

Enterprise source-backed rule, accepted in [`MADR-050`](./07-madr/MADR-050-nextjs16-enterprise-app-standards.md):

- Official Next.js, Vercel, Turborepo, React, package docs, and fresh registry metadata are implementation authority.
- next-forge, Blazity `next-enterprise`, community best-practice repos, and articles are reference inputs only.
- Do not copy package lists, scripts, route shapes, or caching/performance patterns from starter repos until current docs and local fit are checked.
- Keep Next `16.2.6` and React `19.2.x` package versions unified across active apps.

Project structure:

- Keep active app roots as `apps/app/app`, `apps/web/app`, etc.
- Use route groups such as `(authenticated)` and `(unauthenticated)` when they represent auth/layout/product sections and should not affect URLs.
- Keep each app's local `@/*` alias enabled for app-owned imports. `apps/app` and `apps/web` already define this alias.
- Use `@repo/*` only for workspace packages.
- Use `@/*` for app-owned imports that cross route, app-boundary, or shared app folders.
- Prefer short relative imports inside tightly colocated route folders when they make route ownership clearer.
- Use route-local private folders for route-specific implementation:

```text
_components
_actions
_hooks
_lib
_types
```

- Keep app-wide UI limited and intentional.
- Put shared primitives in `packages/design-system`.
- Do not create broad global `components` buckets for route-specific UI.

Server and Client Components:

- Pages and layouts are Server Components by default.
- Add `"use client"` only at leaf components that need state, effects, event handlers, browser APIs, custom client hooks, or client-only libraries.
- Do not make Client Components async.
- Do not pass non-serializable props from Server Components into Client Components.
- Use `server-only` for server-only modules that may be imported incorrectly.
- Use client wrapper components for third-party browser-only components.

Component coding style:

- `page.tsx` files should be thin route composers, not full workflow implementations.
- Keep route-local UI in `_components`, client orchestration in `_hooks`, pure helpers in `_lib`, schemas in `_schemas`, and support types in `_types`.
- Before creating local UI, check `@repo/design-system` for an existing primitive. Use current design-system primitives first, then restyle the design system later.
- Route-local UI may wrap design-system primitives only to add route-specific semantics or composition, not to fork visual styling.
- A Client Component that owns multiple screens, network calls, form state, error mapping, and large JSX is not clean enough; split it before building on it.
- Prefer pure functions for mapping and normalization, custom hooks for state/effects/handlers, and small presentational components for UI screens.
- Do not use factory patterns for ordinary React components or route forms. Reserve factories/adapters for runtime/provider selection such as sandbox, tools, storage, connectors, or model providers.
- With React Compiler enabled, do not ignore `react-hooks/incompatible-library`; use documented compatible APIs such as React Hook Form `useWatch` instead of `watch`.

Performance review:

- Treat performance as route architecture, not late polish.
- Each route/shell cleanup should identify the LCP candidate, client boundaries, third-party scripts, image/font behavior, Suspense/loading states, and rendering/caching strategy.
- Do not dynamically import small or above-the-fold critical UI by default.
- Dynamically import heavy conditional UI, non-critical modals, below-fold panels, editors, charts, maps, and large external libraries when the user flow justifies it.
- Use `next/image` for meaningful raster images and set dimensions or `sizes`; prioritize only true LCP images.
- Use `next/font` or an approved self-hosted font strategy; do not add external font requests.
- Loading and skeleton states must reserve stable dimensions and avoid layout shifts.
- Do not add `use cache`, PPR, runtime cache, or route-level dynamic/static overrides without a route-specific freshness and rendering decision.
- Combine synthetic checks with real-user monitoring once observability is in phase.

Enterprise route implementation:

- A route page should read like composition, not business logic.
- Route-local code should be private by default using `_components`, `_hooks`, `_lib`, `_schemas`, `_types`, and `_actions`.
- App-level `components/*` is allowed only for proven cross-route app glue.
- Shared design primitives live in `packages/design-system`.
- Runtime/provider adapters live in packages, not route components.
- Keep package imports explicit enough that app code does not accidentally pull optional provider env validation into build.

Data and API patterns:

- Server Component reads should access server data directly through server packages/facades.
- Server Actions are for mutations and must verify authentication and authorization internally.
- Route Handlers are for external HTTP APIs, webhooks, SSE/streaming endpoints, public API contracts, or explicit BFF boundaries.
- Do not create internal Route Handlers just to call them from Server Components.
- Avoid data waterfalls with `Promise.all`, preloading, or Suspense where appropriate.

Next 15/16 async APIs:

- Treat `params` and `searchParams` as promises in pages, layouts, metadata, and route handlers.
- Await `headers()`, `cookies()`, and `draftMode()`.
- Use generated route types or `RouteContext` where available for Route Handlers.

Proxy:

- Use `proxy.ts` for request interception in Next 16.
- Do not reintroduce `middleware.ts` unless researching a specific backward-compatibility case.
- Env used by proxy should still come from the app env contract when possible.

Images, scripts, and metadata:

- Prefer `next/image` over raw `<img>` in product UI.
- Use `next/script` for scripts that need framework loading strategies.
- Use file-based metadata or `generateMetadata` with typed async params.

Caching:

- Do not add caching directives by memory.
- Research current Next 16 Cache Components behavior before adding `use cache`, `cacheLife`, `cacheTag`, `updateTag`, or cache handlers.
- Do not use deprecated unstable cache APIs in new code without an explicit migration note.

Analysis and performance tooling:

- Use `next experimental-analyze` for `apps/app` bundle/app analysis first.
- Do not add `@next/bundle-analyzer` as the default analyzer unless native analysis is insufficient and a package decision records why.
- Use dynamic imports for heavy client-only UI only after the component boundary is already correct.
- Treat `force-dynamic` as a request-data boundary, not a convenience switch.
- When default Turbopack build stalls or fails, research and document the cause before changing scripts/config. Use Webpack only as evidence and temporary comparison, not as the accepted fix.

Enterprise package adoption:

- Do not add packages just because an enterprise starter includes them.
- Before adding a package, prove the repo problem, check official docs, check latest registry metadata, check peers/engines, check local equivalents, update the package playbook, then install.
- Current researched candidates from MADR-050 are deferred unless their phase starts: `@vercel/otel`, `@testing-library/react`, `@playwright/test`, `next-safe-action`, `@tanstack/react-query`, and optional `madge`.
- Current explicit non-defaults: `@next/bundle-analyzer`, `patch-package`, and `semantic-release`.

## Env Standards

Accepted env contract: T3 Env.

Rules:

- App code imports the app env object, normally `@/env`.
- Package envs expose `keys()` modules using T3 Env.
- Optional integrations must use optional env schemas and feature-boundary validation.
- Do not require unrelated integration secrets during app build.
- Do not centralize every possible secret into one app env file if it couples unrelated features.
- Do not use direct `process.env` in pages/components/routes/proxy when a typed env field exists.
- Direct `process.env` is acceptable only inside env contract modules, package `keys.ts`, carefully documented standalone scripts, or rare framework config paths where no typed env contract can be imported.

Pattern:

```ts
// app env
import { env } from "@/env";

// package env
import { keys } from "@repo/package/keys";
```

When fixing an env issue:

1. Read T3 Env docs.
2. Inspect current app/package env composition.
3. Decide if the variable is required, optional, client, or server.
4. Keep optional feature secrets optional.
5. Verify build/typecheck with and without the secret if the feature is optional.

## Package Boundary Standards

Packages should not validate env or import heavy product dependencies at module load unless every importer truly requires that dependency.

If a package has optional behavior:

- keep metadata/types/importable definitions light;
- lazy-load auth/database/provider clients only inside the function path that needs them;
- keep package `keys.ts` optional when the feature is optional;
- document why a lazy import exists.

The `@repo/feature-flags` rule is now canonical:

- keep feature flags available to `apps/web`;
- keep `FLAGS_SECRET` in T3 Env;
- lazy-load product auth/database only when a flag is actually evaluated.

## TypeScript Standards

- Prefer precise domain types.
- Use `unknown` plus narrowing instead of `any`.
- Use Zod for untrusted external data.
- Do not use `@ts-ignore`.
- Use `@ts-expect-error` only with a specific reason and only when the error is intentional.
- Keep generated files marked as generated and excluded from active cleanup unless they are the source of truth.
- Keep server/client imports clean enough that typecheck catches environment poisoning.

## Security Standards

Every Server Action, Route Handler, tool call, sandbox action, file action, billing action, and workflow action must define its auth boundary.

Rules:

- Do not trust `userId` from path, body, query, or client state.
- Derive user/org identity from the server session.
- Add ownership checks before reading or mutating user resources.
- Do not forward raw user identity to legacy services as authority.
- Optional service auth is not acceptable outside local-only development.
- Human approval, tool permission, sandbox command, billing, and external action boundaries must be explicit.

## Frontend And Design Standards

The target app is a dense workflow operating system, not a marketing landing page.

Rules:

- Build the actual product surface first, not a hero page.
- Use route-local components for route-specific UI.
- Use current `@repo/design-system` primitives for UI first, including form fields, input groups, buttons, spinners, dialogs, sheets, sidebars, and common controls.
- Do not hand-roll local controls when the design system already has a primitive; compose or wrap the primitive instead.
- Keep route-specific wrappers local until reuse is proven, then promote to `packages/design-system`.
- Build AI/workflow UI as app-local custom UI on Vercel AI SDK message parts first. Do not reintroduce assistant-ui or package-level `@repo/ai/components` unless a new decision proves the shared package boundary.
- Keep Client Components small.
- Use icons for tools/actions where appropriate.
- Keep cards for repeated items, modals, and framed tools.
- Avoid decorative one-note palettes, gradient blob backgrounds, and marketing-heavy layouts for the product app.
- Make dimensions stable for boards, toolbars, counters, tiles, tabs, and workbench panels.
- Ensure text does not overflow buttons/cards/panels at mobile and desktop widths.

## Verification Standards

Choose verification by blast radius.

Minimum after source changes:

```bash
git diff --check
pnpm --filter <changed-package-or-app> typecheck
```

Add as needed:

```bash
pnpm --filter <app> build
pnpm --filter <package> test
pnpm --filter docs lint
pnpm outdated -r --format json
pnpm lint
```

For UI behavior:

- start the relevant dev server;
- verify with browser tooling/screenshots when visual layout matters;
- do not claim visual correctness without rendering.

For package upgrades:

- check fresh registry metadata;
- check official migration docs;
- run install under the repo Node/pnpm baseline;
- rerun typecheck and targeted tests;
- update research/audit docs.

## Cleanup Queue After Current Web/BaseHub Work

Current next work:

1. Confirm root build state after `apps/web` build passes.
2. Audit and fix `apps/app` production build behavior.
3. Reduce active lint debt in `apps/app`, `packages/ai`, and app tests.
4. Decide whether `packages/cms` is archived, deleted, or kept as inactive legacy until the Payload/static-content decision.
5. Add dead-code/dependency tooling after app/package boundaries settle.
6. Only then start Payload evaluation, sandbox migration, `.flow` kernel implementation, or redesign.

## Required References

Primary docs checked for this standard:

- Next.js 16 upgrade guide: `https://nextjs.org/docs/app/guides/upgrading/version-16`
- Next.js project structure: `https://nextjs.org/docs/app/getting-started/project-structure`
- Next.js Server and Client Components: `https://nextjs.org/docs/app/getting-started/server-and-client-components`
- Next.js Route Handlers: `https://nextjs.org/docs/app/getting-started/route-handlers`
- Next.js Mutating Data / Server Functions: `https://nextjs.org/docs/app/getting-started/mutating-data`
- Next.js Proxy: `https://nextjs.org/docs/app/getting-started/proxy`
- T3 Env Next.js docs: `https://env.t3.gg/docs/nextjs`
- T3 Env core docs: `https://env.t3.gg/docs/core`
- Turborepo package types: `https://turborepo.dev/docs/core-concepts/package-types`
- Turborepo repository structuring: `https://turborepo.com/repo/docs/handbook/workspaces`
- pnpm settings: `https://pnpm.io/settings`
