# Next.js 16.2.6 Enterprise Architecture Research

Date researched: 2026-05-26

Scope: `apps/app`, monorepo structure, package/tooling candidates, and reset standards for a senior Next.js 16.2.6 workflow application.

Status: source-backed research note

## Research Question

Which parts of the provided enterprise/performance references should affect the `apps/app` reset, package choices, route segmentation, and future workflow-platform architecture?

## Source Authority

Use this hierarchy for implementation:

1. Official Next.js, Vercel, Turborepo, React, package, and registry documentation.
2. Current local installed package types/source and this repo's code.
3. next-forge and enterprise starter repos as architecture/product references.
4. Community articles and best-practice repos as supporting context only.

Secondary sources are useful for ideas, but they do not override official docs, current package metadata, or repo MADRs.

## Sources Checked

| Source                                                                              | Type                       | Claim Used                                                                                                                                                           | Repo Impact                                                                                                                             |
| ----------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `https://nextjs.org/docs/app/guides/upgrading/version-16`                           | Official docs              | Next 16 changes include default Turbopack builds, top-level Turbopack config, async request APIs, Proxy naming, React 19.2 baseline, and upgraded caching semantics. | Keep Next pinned to `16.2.6`, keep Turbopack default, do not reintroduce Webpack-only defaults, keep `proxy.ts`.                        |
| `https://nextjs.org/docs/app/getting-started/project-structure`                     | Official docs              | `app` can live at project root; `src` is optional; route groups and private folders support organization without URL changes.                                        | Keep `apps/app/app`; use `(authenticated)`, `(unauthenticated)`, `_components`, `_hooks`, `_lib`, `_schemas`, `_types`.                 |
| `https://nextjs.org/docs/app/getting-started/server-and-client-components`          | Official docs              | Server Components are default; Client Components are for interactivity, browser APIs, state, effects, and client hooks.                                              | Pages/layouts stay server-first; client code must be narrow islands.                                                                    |
| `https://nextjs.org/docs/app/guides/data-security`                                  | Official docs              | Server-only code, DALs, DTOs, and explicit authorization reduce accidental data exposure.                                                                            | Keep auth/session/data access server-side; no raw secrets or resource ownership trust in Client Components.                             |
| `https://nextjs.org/docs/app/getting-started/cache-components`                      | Official docs              | Cache Components and `use cache` are explicit opt-in behavior with new invalidation patterns.                                                                        | Do not add cache directives during cleanup unless data semantics are proven.                                                            |
| `https://nextjs.org/docs/app/api-reference/file-conventions/proxy`                  | Official docs              | `proxy.ts` is the Next 16 request interception convention.                                                                                                           | Keep `apps/app/proxy.ts`; do not add `middleware.ts`.                                                                                   |
| `https://nextjs.org/docs/app/api-reference/cli/next`                                | Official docs              | Next 16 has `next experimental-analyze` for app analysis.                                                                                                            | Keep `apps/app` analyzer scripts on native analyzer; do not default to `@next/bundle-analyzer`.                                         |
| `https://turborepo.com/docs/crafting-your-repository/structuring-a-repository`      | Official docs              | Workspaces should be flat, and nested workspaces are discouraged because they complicate discovery.                                                                  | Keep `apps/*` and `packages/*`; do not create nested workspace globs for product features.                                              |
| `https://turborepo.com/docs/core-concepts/package-types`                            | Official docs              | Internal packages can be shared libraries, config packages, or compiled packages, with explicit package boundaries.                                                  | Keep reusable runtime logic in `packages/*`; apps are deployable endpoints.                                                             |
| `https://turborepo.com/docs/crafting-your-repository/creating-an-internal-package`  | Official docs              | Internal packages should declare exports and dependencies intentionally.                                                                                             | Avoid broad barrel imports and app-to-package leakage.                                                                                  |
| `https://vercel.com/docs/conformance`                                               | Official docs/product docs | Enterprise conformance is governance for rules and quality at scale.                                                                                                 | We may emulate rules with ESLint, dependency-cruiser, typecheck, smoke tests, Renovate, and docs until Vercel Conformance is available. |
| `https://vercel.com/docs/workflow-collaboration/code-owners`                        | Official docs/product docs | Code Owners can enforce review ownership for changed areas.                                                                                                          | Add CODEOWNERS later when package/app owners stabilize.                                                                                 |
| `https://www.next-forge.com/docs/structure`                                         | Starter docs               | next-forge uses apps as independently deployable surfaces and packages as reusable integration boundaries.                                                           | Keep multi-app monorepo shape; do not flatten everything into one app.                                                                  |
| `https://www.next-forge.com/docs/apps/app`                                          | Starter docs               | next-forge's `apps/app` is the authenticated product app and is split by authenticated/unauthenticated route groups.                                                 | `(authenticated)` / `(unauthenticated)` is a senior SaaS structure when it maps to layout/auth boundaries.                              |
| `https://github.com/Blazity/next-enterprise`                                        | Starter repo               | Strong enterprise tooling ideas, but current `package.json` is Next 15 based.                                                                                        | Use patterns selectively; do not copy versions or scripts blindly.                                                                      |
| `https://www.blazity.com/solutions/next-enterprise`                                 | Product page               | Emphasizes production features: testing, observability, performance, security, CI/CD, and maintainability.                                                           | Use as validation checklist context only.                                                                                               |
| `https://github.com/bablukpik/nextjs-best-practices`                                | Community repo             | Useful examples of route/component organization and avoiding oversized components.                                                                                   | Use as secondary support for route-local segmentation, not as authority.                                                                |
| `https://techhub.iodigital.com/articles/nextjs-at-enterprise-level`                 | Enterprise article         | Enterprise Next.js needs clear architecture, security, observability, CI/CD, performance budgets, and team conventions.                                              | Supports governance/checklist work; does not decide package versions.                                                                   |
| `https://www.digitalapplied.com/blog/nextjs-16-performance-server-components-guide` | Performance article        | Useful high-level RSC/performance guidance, but some recommendations need official Next 16 validation.                                                               | Keep server-first/client-island direction; prefer official Cache Components and native analyzer guidance.                               |

## Official Next.js 16.2.6 Standards For This Repo

### App Structure

The clean target is not `src/app` by default. Next.js documents `src` as optional, and this repo has a monorepo app at `apps/app/app`. Moving to `src/app` would create churn without improving the product.

Use:

```text
apps/app/app/
  (authenticated)/
    _components/
    dashboard/
    workflows/
    approvals/
    artifacts/
    connections/
    settings/
  (unauthenticated)/
    _components/
    login/
    forgot-password/
    reset-password/
    verify-email/
  api/
```

Route groups are correct when they represent layout/auth/product ownership and should not affect URLs. They are not magic security. Security still belongs in the server auth boundary, route handlers, server actions, DALs, and ownership checks.

### Server / Client Boundary

Default rule:

- `page.tsx` and `layout.tsx` are thin Server Components.
- Client Components are small islands for state, browser APIs, event handlers, hooks, and client-only libraries.
- A `"use client"` file turns its dependency subtree into a client graph, so client boundaries must be narrow.
- Do not put data access, secrets, provider clients, or authorization in Client Components.
- If a Client Component uses `useSearchParams`, wrap the relevant subtree in `Suspense`.

The login refactor is the model:

```text
page.tsx                      thin Server Component
_components/login-form.tsx    small Client shell
_hooks/use-login-flow.ts      orchestration/state/effects
_components/*-step.tsx        focused presentational steps
_lib/*.ts                     pure helpers/API wrappers
_schemas/*.ts                 Zod schemas and inferred form types
_types/*.ts                   route-local support types
```

### Data, Security, And Mutations

Use the official data-security direction:

- Server reads use server packages/facades/DALs directly.
- Server Actions are for UI-driven mutations and must check auth/authorization internally.
- Route Handlers are for external HTTP, webhooks, public APIs, SSE/streaming, or explicit BFF boundaries.
- Do not create internal HTTP calls from Server Components to local Route Handlers.
- Use DTOs or shaped return types when sending server data to clients.
- Use `server-only` for modules that must never enter a client graph.

### Caching

Do not apply caching by memory or because an article says so.

For cleanup:

- avoid adding `use cache`, `cacheLife`, `cacheTag`, `updateTag`, or custom cache handlers;
- leave public static pages static where possible;
- keep authenticated request-time surfaces dynamic only where session/request data requires it;
- add Cache Components later only with a route-specific data freshness decision.

### Turbopack And Analysis

Next 16 uses Turbopack by default for development and builds. This repo should keep the default Turbopack path and fix code/config for it.

For bundle analysis:

- Default: `next experimental-analyze`.
- Do not add `@next/bundle-analyzer` as the default for `apps/app`.
- `@next/bundle-analyzer@16.2.6` exists and may be kept as a fallback only if native analysis is insufficient and a separate package decision records why.

### Monorepo Boundaries

Keep flat workspaces:

```text
apps/*       deployable app surfaces
packages/*   shared packages, adapters, configs, runtime libraries
docs/*       architecture and decision trail
legacy/*     inactive reference code
```

Rules:

- Apps are graph endpoints.
- Packages must not import apps.
- Route-specific UI stays in app route folders.
- Cross-app primitives belong in `packages/design-system`.
- Runtime/provider abstractions belong in packages, not page folders.
- Do not create services until a real deploy/runtime/security boundary is proven.

## Provided Source Evaluation

### DigitalApplied Next 16 Performance Guide

Useful:

- Server Components first.
- Keep Client Components small.
- Use dynamic imports for heavy client-only code.
- Use streaming/Suspense intentionally.
- Treat performance as architecture, not after-the-fact optimization.

Do not copy blindly:

- If it recommends older caching APIs or generic analyzer packages, validate against official Next 16 docs first.
- Avoid broad advice that makes authenticated surfaces dynamic without evidence.

Repo decision:

- Keep the server-first/client-island standard.
- Use official Next 16 Cache Components docs before adding caching directives.
- Keep native `next experimental-analyze` as the app analyzer.

### Blazity `next-enterprise`

Useful:

- Strict TypeScript posture and `@total-typescript/ts-reset`.
- Component library discipline with CVA/Tailwind Merge style utilities.
- Testing layers: unit/component, browser/e2e, and Storybook/Chromatic.
- Observability and OpenTelemetry as first-class concerns.
- Dependency hygiene, Renovate, package graph checks, and CI gates.
- Monorepo-friendly tooling ideas even though the repo is not a direct template for this codebase.

Do not copy blindly:

- Current `package.json` is Next 15 based, while this repo is pinned to Next `16.2.6`.
- It uses package/version choices that must be rechecked against current registry metadata before adoption.
- It includes `patch-package`; this repo should not add patching infrastructure unless a real upstream package defect blocks us.
- It uses release/governance choices that may conflict with this repo's existing Changesets/Renovate direction.

Repo decision:

- Mine the package/tooling categories.
- Do not copy dependency lists wholesale.
- Convert package ideas into scored candidates before installation.

### Blazity Product Page

Useful as a checklist:

- testing;
- maintainability;
- performance;
- observability;
- security;
- CI/CD;
- scalable architecture.

Not enough for implementation:

- It is product/marketing material and does not define package versions or concrete Next 16 migration steps.

### bablukpik `nextjs-best-practices`

Useful:

- Reinforces route-local organization, small components, and explicit data boundaries.
- Useful as a second opinion when reviewing code style.

Not enough for implementation:

- Community best-practice repos can lag Next major releases.
- Use only after official docs and current package metadata.

### IO Digital Enterprise Next.js Article

Useful:

- Enterprise apps need governance, deployment discipline, observability, security, performance budgets, and clear team conventions.
- Scaling is architecture plus process, not only packages.

Repo decision:

- Add governance gates during cleanup.
- Do not start platform features until base boundaries and app quality gates are clean.

## Package Candidate Review

Fresh package metadata checked with `npm view ... --registry https://registry.npmjs.org --prefer-online` on 2026-05-26.

| Package / Tool               | Latest Checked | Local State                                                                                                      | Decision                                                                                                                    |
| ---------------------------- | -------------: | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `@next/bundle-analyzer`      |       `16.2.6` | Not installed in `apps/app`; native analyzer scripts exist.                                                      | Do not add by default. Use `next experimental-analyze` first.                                                               |
| `@total-typescript/ts-reset` |        `0.6.1` | Already in `packages/typescript-config`.                                                                         | Keep. This is already adopted.                                                                                              |
| `madge`                      |        `8.0.0` | Not installed. `dependency-cruiser` exists.                                                                      | Do not add now. Keep `dependency-cruiser` for enforceable boundary rules; consider Madge only for diagrams.                 |
| `patch-package`              |        `8.0.1` | Not installed.                                                                                                   | Do not add unless an upstream package bug is proven and documented. No senior reset should start with patch infrastructure. |
| `@vercel/otel`               |        `2.1.2` | Not installed; observability uses Sentry/Logtail package.                                                        | Candidate for observability phase, not cleanup. Requires OpenTelemetry package peers and instrumentation plan.              |
| `@testing-library/react`     |       `16.3.2` | Present in `packages/ai`, not app-level.                                                                         | Candidate when we add component tests for app routes/design-system. Do not add until tests are being written.               |
| `@playwright/test`           |       `1.60.0` | E2E intentionally reset/removed.                                                                                 | Candidate after stable user flows exist. Do not add during bare app reset.                                                  |
| `@storybook/nextjs`          |       `10.4.1` | Storybook app already has `10.4.1`; dev is disabled due compat note.                                             | Keep as future design-system validation surface; fix later with a Storybook-specific phase.                                 |
| `next-safe-action`           |        `8.5.3` | Not installed.                                                                                                   | Candidate only if Server Actions become a primary mutation surface. Not needed for current login/auth SDK flow.             |
| `@tanstack/react-query`      |     `5.100.14` | Not installed in `apps/app`; virtual package exists in design-system dependencies for virtualization, not query. | Candidate for workflow live/client cache views later. Do not add while RSC/server reads can cover the reset shell.          |

## Package Adoption Rules

Before adding any package from a starter repo:

1. Prove the product problem it solves.
2. Check official docs and current registry metadata.
3. Check React/Next/Node/pnpm peer compatibility.
4. Check whether we already have a repo-native equivalent.
5. Add it to the package playbook with keep/refactor/delete impact.
6. Install only after the affected app/package has a validation plan.

Do not add a package because an enterprise template has it. Add it because this codebase has a concrete gap.

## Concrete App Reset Standards

For `apps/app`, the next cleanup/refactor slices should follow:

- Keep `apps/app/app`, not `apps/app/src/app`.
- Keep `(authenticated)` and `(unauthenticated)` route groups.
- Keep `dashboard` bare but clean.
- Add new product surfaces route-by-route, with route-local `_components`, `_hooks`, `_lib`, `_schemas`, and `_types`.
- Keep the sidebar shell code as reference/product shell, but do not preserve old Manus route/page logic.
- Delete or keep legacy references only under `legacy/*`; active app routes should not contain Manus/E2B/product-test leftovers.
- Use typed T3 Env via `@/env`, not direct `process.env`, except env contract/config boundary files.
- Keep Better Auth current and server-safe; social login additions require Better Auth docs and package playbook update first.
- Keep default Turbopack and fix code for it.
- Add Playwright/component tests only after the user flow being tested is stable enough to be worth pinning.

## What Is Missing Before More Feature Work

Required before building the new workflow OS:

- Route-by-route cleanup of remaining auth pages and app-level auth form buckets.
- App shell/sidebar audit: keep reusable shell pieces; remove old product assumptions.
- Design-system audit: keep primitives, remove route/product-specific leakage.
- Package boundary audit for old optional integrations.
- Observability decision: Sentry-only versus adding OpenTelemetry.
- Testing strategy decision: smoke, component, Storybook, Playwright sequence.
- CODEOWNERS/conformance-like governance after ownership stabilizes.
- New workflow routes only after the reset skeleton is clean.

## Open Questions

- Should `@repo/observability` adopt `@vercel/otel` alongside Sentry, or keep Sentry-only until deployment architecture is known?
- Should app component tests use Vitest Browser Mode, Testing Library, or Playwright component testing?
- Should Storybook remain a first-class app after its Next 16 compatibility issue is fixed, or be replaced by app-level visual smoke tests?
- Should mutation work use plain Server Actions plus Zod, or adopt `next-safe-action` when workflow mutations start?
- Should live workflow timelines use Server Components plus polling/SSE first, or add TanStack Query for client cache/state?
