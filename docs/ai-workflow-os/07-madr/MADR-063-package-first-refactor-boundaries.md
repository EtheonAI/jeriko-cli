# MADR-063: Package-First Refactor Boundaries

Status: Accepted

Date: 2026-05-26

## Context

The reset initially focused on `apps/app` because it is the main product surface. That was useful for deleting old pages and proving a bare authenticated shell, but it exposed a deeper issue: app code was starting to own integration details that belong in workspace packages.

The repo already has packages for auth, email, observability, notifications, feature flags, design system, next config, database, payments, security, and more. If app cleanup bypasses those packages, the monorepo becomes a set of duplicated app-local adapters instead of a clean package graph.

Local audit found:

- 24 active `packages/*` package manifests.
- 6 active app surfaces.
- 13 `@repo/*` imports using missing public exports.
- 18 active dependency-cruiser circular dependency errors.
- `@repo/ai` package typecheck failing because package tests import removed `apps/app` internals.
- Several app dependencies and imports that should be mediated by owning packages.

## Decision

All further reset/refactor work is package-first.

Before adding or refactoring behavior in an app:

1. Identify the owning package.
2. Verify its official docs and local usage.
3. Add or repair a public package entrypoint.
4. Keep provider SDKs, integration adapters, config plugins, env key contracts, and shared UI primitives inside the owning package.
5. Make the app consume the package API through `@repo/*`.
6. Validate package typecheck before app typecheck/build.

Apps remain deployable shells and route owners. They may compose `@repo/*` APIs and own route-local UI/workflow code, but they must not own shared provider/config/integration details unless a new MADR changes the package ownership index.

## Concrete Rules

- `apps/*` may import `next`, `react`, `react-dom`, route-local code, and app env composition.
- `apps/*` must import provider functionality through `@repo/*`.
- `apps/*` must not import provider SDK internals when an owning package exists.
- `apps/*` must not import non-exported package internals such as `@repo/feature-flags/lib/*` unless that subpath is intentionally public.
- `packages/*` must not import from `apps/*`.
- Package tests must not reach into app internals.
- Package exports define public API. If an import is legitimate, export it explicitly. If it is not legitimate, move/replace it.
- Shared Next config stays in `@repo/next-config`; package-specific Next plugins must be exported by the owning package and composed by app `next.config.ts`.

## Consequences

Positive:

- The monorepo becomes understandable by package ownership.
- App cleanup stops duplicating integration adapters.
- Package typecheck becomes meaningful again.
- Future workflow packages can be added cleanly.
- `apps/app` becomes a thin workflow product shell instead of a junk drawer.

Negative:

- Cleanup takes longer because package APIs must be repaired before app code moves.
- Some app code that currently builds by path alias will fail once exports are enforced.
- Existing package cycles in `@repo/database` and `@repo/ai` must be fixed before graph health can be claimed.

## Alternatives Considered

### Keep refactoring inside `apps/app`

Rejected. This repeats the old mistake: the app accumulates auth, notifications, env, config, theme, toast, tool, and provider details even though packages already exist.

### Delete packages and make a single app

Rejected. The product target needs reusable workflow/runtime/contracts/tooling packages and multiple app surfaces. A single-app architecture would be faster for a prototype but weaker for this platform.

### Export every package subpath as wildcard

Rejected. Wildcard exports hide ownership mistakes. Public subpaths should be explicit except for intentionally broad primitive buckets such as design-system UI components.

## Evidence

- Research: [`../09-research/2026-05-26-r20-package-first-monorepo-boundaries.md`](../09-research/2026-05-26-r20-package-first-monorepo-boundaries.md)
- Audit: [`../10-audit/workspace-package-boundary-audit-2026-05-26.md`](../10-audit/workspace-package-boundary-audit-2026-05-26.md)
- Plan: [`../08-plans/package-first-boundary-cleanup-plan.md`](../08-plans/package-first-boundary-cleanup-plan.md)

## Validation Checklist

- [x] Active apps and packages inventoried.
- [x] `@repo/*` import/export violations scanned.
- [x] Dependency graph checked with dependency-cruiser.
- [x] Package typecheck sweep run.
- [x] Engineering standards updated with package-first rule.
- [ ] Missing package exports repaired.
- [ ] `@repo/ai` app-internal test import removed or moved behind a package contract.
- [ ] Active package cycles fixed or explicitly isolated.
- [ ] Apps no longer declare provider SDKs when owning packages exist.
