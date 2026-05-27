# Blazity Next-Enterprise Governance And Performance Follow-Up

Date researched: 2026-05-26

Scope: Blazity `next-enterprise` README, package manifest, repo structure, Blazity resources page, Blazity performance/service pages, and downloaded PDF `~/Downloads/The Expert Guide to Next.js Performance Optimization [2025] (1).pdf`.

Status: source-backed follow-up to [`2026-05-26-nextjs16-enterprise-architecture-research.md`](./2026-05-26-nextjs16-enterprise-architecture-research.md)

## Sources Checked

| Source                                                                            | Type                      | Claim checked                                                                                                                                                                                                                  | Repo impact                                                                              |
| --------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `https://github.com/Blazity/next-enterprise`                                      | Starter repo              | README lists enterprise tools: Renovate, patch-package, component graph tooling, semantic release, T3 Env, testing, Storybook, observability, health checks, bundle/perf tracking.                                             | Use these as governance categories, not package install instructions.                    |
| `https://raw.githubusercontent.com/Blazity/next-enterprise/main/package.json`     | Source manifest           | Current manifest is Next `15.5.18`, pnpm `10.0.0`, TypeScript `5.9.3`, Vitest `3.2.4`, Storybook `8.6.x`, and includes `patch-package`, semantic-release packages, `@next/bundle-analyzer`, `madge`, and `@t3-oss/env-nextjs`. | Do not copy versions into this Next `16.2.6` repo.                                       |
| `https://github.com/Blazity/next-enterprise/tree/main/app`                        | Source structure          | App structure is intentionally tiny: `app/api/health`, `layout.tsx`, and `page.tsx`.                                                                                                                                           | Borrow minimal skeleton discipline, not single-app structure.                            |
| `https://github.com/Blazity/next-enterprise/tree/main/components`                 | Source structure          | Component folder is small and primitive-oriented.                                                                                                                                                                              | Confirms our `packages/design-system` should remain the shared primitive surface.        |
| `https://www.blazity.com/resources`                                               | Blazity resources page    | Resources emphasize field-data-backed performance, Core Web Vitals, Next.js 16 topics, AI agents, and performance playbooks.                                                                                                   | Add field data and performance budget rules to standards.                                |
| `https://www.blazity.com/solutions/next-enterprise`                               | Blazity product page      | Product page frames the boilerplate as strategic simplicity with strict quality, testing, Storybook, OpenTelemetry, CI/CD, semantic release, Renovate, and performance tracking.                                               | Adopt the principle that every tool must solve a repeated enterprise problem.            |
| `https://www.blazity.com/services/next-js-performance-optimization`               | Blazity service page      | Performance work should diagnose root causes across rendering, hydration, caching, scripts, bundles, assets, and field data.                                                                                                   | Add performance review checklist for each route/shell phase.                             |
| `https://blazity.com/services/tech-audit`                                         | Blazity service page      | Audits should expose aged dependencies, unmeasured scripts, and architecture decisions that no longer fit scale; field data matters more than lab-only scores.                                                                 | Keep audit-first process and record stale governance config findings.                    |
| `~/Downloads/The Expert Guide to Next.js Performance Optimization [2025] (1).pdf` | Downloaded PDF, 109 pages | Chapters cover code splitting, streaming/Suspense/hydration, `next/image`, third-party scripts, `next/font`, rendering, Web Vitals, development culture, budgets, dependency review, and measurement.                          | Promote performance budget, dependency review, and route-level rendering strategy rules. |
| Renovate docs: `https://docs.renovatebot.com/configuration-options/`              | Official docs             | `packageRules`, `groupName`, `allowedVersions`, automerge, and minimum release age configure dependency update behavior.                                                                                                       | Remove stale Drizzle `allowedVersions` pin from our Renovate config.                     |
| Registry metadata via `pnpm view drizzle-orm version`                             | Package metadata          | Current latest `drizzle-orm` is `0.45.2`; this repo uses `0.45.2`.                                                                                                                                                             | Stale Renovate pin to `0.38.x` was wrong after package normalization.                    |

## What We Already Have

- Renovate config exists and groups updates by ecosystem.
- Dependency Cruiser exists for graph and boundary enforcement.
- Changesets exists; semantic-release would duplicate release ownership.
- T3 Env is already the env contract across active apps/packages.
- `@total-typescript/ts-reset` exists in `packages/typescript-config`.
- Storybook app exists with design-system stories, but dev is currently disabled due a Next 16 compatibility note.
- Lighthouse CI config exists, but it is not yet part of a proven current CI gate.
- `packages/design-system` already uses CVA and Tailwind Merge style composition.

## Findings

### Blazity Package Tooling

Blazity's package list is useful because each item maps to a governance job:

- Renovate: dependency and security update flow.
- patch-package: emergency upstream patch escape hatch.
- madge/component graph: coupling and cycle visibility.
- semantic-release: automated release and changelog flow.
- T3 Env: typed environment boundary.
- Storybook/Testing/Playwright: validation layers.
- OpenTelemetry: runtime traceability.
- Bundle analyzer/Lighthouse: performance regression visibility.

For this repo, several categories are already covered by different tools:

- Renovate: already present, but had one stale Drizzle pin.
- Component graph: dependency-cruiser already present; do not add madge until depcruise is insufficient.
- Release: Changesets already present; do not add semantic-release.
- Env: T3 Env already present; keep `@/env` and package `keys()` contracts.
- Design-system variants: CVA/Tailwind Merge already present in `packages/design-system`.

### Blazity Structure

Blazity is not a monorepo model for us. It is a compact single-app starter. The useful lesson is not its folder names; it is the lack of accidental surfaces.

Repo decision:

- Keep `apps/*` and `packages/*`.
- Keep route-local `_components`, `_hooks`, `_lib`, `_schemas`, `_types`, `_actions`.
- Keep shared primitives in `packages/design-system`.
- Keep deployable app surfaces under `apps/*`, not a root `app`.

### Performance PDF

Useful standards from the PDF:

- Dynamically import heavy conditional UI and external libraries, but do not dynamically import small or above-the-fold critical UI by default.
- Use Suspense boundaries to stream independent slow content while keeping loading states visually stable.
- Keep Client Components small; a `"use client"` boundary pulls its import subtree into the client graph.
- Use `next/image` for non-trivial images, prioritize true LCP images, lazy-load below-fold images, and define stable dimensions or `sizes`.
- Use `next/font` or equivalent self-hosted font strategy to avoid external font loading and layout shift.
- Treat third-party scripts as performance liabilities; choose script strategy intentionally and defer non-critical scripts.
- Do not apply PPR/caching by memory. Use route-specific rendering and freshness decisions.
- Establish performance budgets and review dependency additions for native alternatives, bundle impact, tree-shaking, peer conflicts, and maintenance.
- Combine synthetic testing with real-user monitoring where available.

## Decisions

| Category            | Decision                                                                  | Reason                                                                  |
| ------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Renovate            | Keep and harden. Remove stale Drizzle `0.38.x` allowed-version rule.      | It conflicted with the repo's current/latest `drizzle-orm@0.45.2`.      |
| patch-package       | Do not add by default.                                                    | Hidden patch state is debt unless an upstream blocker is documented.    |
| Component graph     | Use existing dependency-cruiser first.                                    | It already enforces app/package boundaries and cycle checks.            |
| madge               | Defer.                                                                    | Only add if dependency-cruiser cannot produce required visualization.   |
| semantic-release    | Do not add.                                                               | Changesets already owns release/versioning direction.                   |
| T3 Env              | Keep as canonical app/package env contract.                               | Already adopted and documented.                                         |
| Storybook           | Keep as future design-system validation surface; repair in its own phase. | Useful, but not a blocker for app cleanup.                              |
| Playwright          | Defer until product flows are stable.                                     | E2E should pin stable workflows, not the reset churn.                   |
| OpenTelemetry       | Keep observability package and harden later.                              | Useful after app shell/API boundaries stabilize.                        |
| Bundle analysis     | Use Next `experimental-analyze` first.                                    | Next 16 native path avoids adding `@next/bundle-analyzer` by default.   |
| Performance budgets | Add to route/review standards.                                            | Prevents cleanup from reintroducing slow shells and heavy dependencies. |

## Checklist Added To Standards

- [x] Check starter package manifests for categories and versions, not just README claims.
- [x] Compare each proposed tool with current repo coverage before installing anything.
- [x] Keep Renovate, but audit `allowedVersions` pins after package normalization.
- [x] Keep dependency-cruiser as the graph gate before adding madge.
- [x] Keep Changesets instead of adding semantic-release.
- [x] Treat `patch-package` as an exception-only tool.
- [x] Add dependency-addition review requirements: native alternative, bundle cost, tree-shaking/modular imports, peer conflicts, maintenance, and runtime boundary.
- [x] Add route performance review requirements: LCP asset, image dimensions, Suspense/loading stability, client boundary, third-party scripts, and rendering/caching strategy.

## Open Follow-Ups

- Run current Renovate config through the next dependency-maintenance phase after the stale Drizzle rule removal.
- Decide whether to enforce Lighthouse CI after the authenticated shell is stable.
- Repair Storybook dev/build in a dedicated design-system validation phase.
- Add Playwright only after the workflow app has stable user flows.
- Consider Vercel Speed Insights or `useReportWebVitals` instrumentation during the observability phase.
