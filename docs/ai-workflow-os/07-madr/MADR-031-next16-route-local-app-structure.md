# MADR-031: Use Route-Local Next 16 App Structure

Date: 2026-05-23

## Status

Accepted

Updated 2026-05-25: keep the current `apps/app/app` root during Phase -1 cleanup. The earlier `src/app`
target remains only a possible future migration shape, not an approved cleanup move.

## Context

The repo is being reset from a Manus-style clone into AI Workflow OS. Package versions are now normalized, but the app structure is still mixed: global component buckets, route-local folders, legacy test/demo routes, broad Client Component boundaries, and multiple apps with unclear ownership.

Next.js App Router supports route groups, colocation, private folders, Server Components, and Client Component islands. The prediction-market reference repo also shows a cleaner source boundary with route-local `_components`, `_actions`, `_hooks`, `_lib`, `_types`, shared UI primitives, and domain logic in `lib`.

## Decision

Use route-local App Router structure for the reset.

Target conventions:

- primary product app remains under `apps/app/app` during cleanup;
- do not migrate to `apps/app/src/app` without a dedicated route migration plan;
- route groups `(auth)`, `(app)`, and `(public)`;
- route-local `_components`, `_actions`, `_hooks`, `_lib`, `_types`;
- shared primitives only in design-system packages or app-level shared component folders with proven reuse;
- server/data/business logic in `lib/server` and domain folders;
- Client Components only at interaction boundaries;
- Server Components by default for pages and layouts.

## Consequences

- Page ownership becomes obvious.
- Workflow features can be added without growing a global component junk drawer.
- Client bundles can shrink because pages stay server-first.
- The app becomes easier to audit, test, and migrate to the `.flow` workflow UI.
- Moving files requires careful phased work because imports, tests, and route ownership are currently mixed.

## Alternatives Considered

- Keep current `(authenticated)` and `(unauthenticated)` structure with global components. Rejected because route ownership remains unclear.
- Move everything into global `features/*`. Rejected because App Router colocation is a better fit for page-specific UI.
- Copy prediction-market exactly. Rejected because the domain is unrelated; only the structural discipline is relevant.
- Merge all apps immediately. Rejected because app/deploy ownership must be decided before destructive moves.

## Evidence

- Next.js project organization docs support App Router colocation and route groups.
- Next.js Server/Client Component docs state pages/layouts are Server Components by default and Client Components are for interactivity/browser APIs.
- Prediction-market/Kuest reference uses Next 16, React 19, route-local folders, shared UI, and a clear source/domain boundary.
- Next.js official project-structure docs state `src` is optional and private `_folder` directories can separate UI logic from routing logic.
- Local audit found `apps/app` already has route groups and some route-local folders, but also large global component buckets and many page-level Client Components.

## Impacted Files/Packages

- `apps/app`
- `apps/web`
- `apps/api`
- `packages/design-system`
- `packages/ai`
- `packages/internationalization`
- `docs/ai-workflow-os/10-audit/next16-app-structure-audit-2026-05-23.md`

## Validation Checklist

- [ ] New workflow routes are created under route-local folders.
- [ ] Page-specific components stop entering global component buckets.
- [ ] Page files are Server Components unless they genuinely need a client boundary.
- [ ] Client islands are named and isolated.
- [x] Marketing app ownership is decided: keep `apps/web` as a first-class app surface during cleanup.
- [x] Separate API app ownership is decided: keep inactive under `legacy/deactivated-apps/api` until a real separate deploy boundary is justified.
- [ ] Dead-code tooling runs after folder moves.
- [ ] Build, typecheck, and tests pass after each structural move.
