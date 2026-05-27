# Package-First Boundary Cleanup Plan

Date: 2026-05-26

Status: active next phase

## Goal

Make package ownership real before continuing app feature cleanup.

Apps should compose exported package APIs. Packages should own provider SDKs, shared UI primitives, config plugins, env key contracts, contracts, and runtime libraries.

## Phase 1: Public Export Repair

- [ ] `@repo/auth`
  - [x] Add `@repo/auth/next` for Better Auth Next handlers/cookie helper.
  - [ ] Decide whether `@repo/auth/provider` is a real public API or remove the design-system dependency on it.
- [ ] `@repo/feature-flags`
  - [ ] Add `@repo/feature-flags/next-config` for `withToolbar`.
  - [ ] Add `@repo/feature-flags/toolbar` for the Toolbar component.
  - [ ] Replace app imports from `@repo/feature-flags/lib/*`.
- [ ] `@repo/notifications`
  - [ ] Add a public provider export.
  - [ ] Keep Knock imports inside `@repo/notifications`.
  - [ ] Remove direct app theme coupling if possible.
- [ ] `@repo/observability`
  - [ ] Add public `@repo/observability/status` or move status UI to web route if app-specific.
- [ ] `@repo/email`
  - [ ] Export `./keys`.
  - [ ] Replace deep template imports with `@repo/email/templates`.
- [ ] `@repo/database`
  - [ ] Export `./keys`.
- [ ] `@repo/design-system`
  - [ ] Export `mode-toggle` intentionally or move it out if app-specific.
  - [ ] Consider a public toast helper wrapper so apps do not import `sonner` directly.
  - [ ] Consider a public theme hook/wrapper so apps do not import `next-themes` directly for package integration.

## Phase 2: App Manifest Cleanup

- [ ] Re-scan `apps/app` direct external imports.
- [ ] Re-scan `apps/web` direct external imports.
- [ ] Remove app dependencies that become package-owned.
- [ ] Keep framework/runtime deps app-owned: `next`, `react`, `react-dom`.
- [ ] Keep app T3 Env composition if it only composes package keys and app-local variables.
- [ ] Keep route-local form deps only while forms are app-specific; move reusable auth form helpers into `@repo/auth` or `@repo/design-system` later if shared.

## Phase 3: Package Internal Graph Cleanup

- [ ] Fix `@repo/ai` test importing removed `apps/app/lib/chat/sse-processor`.
- [ ] Move reusable SSE/message parsing contract to `@repo/ai` or the owning workflow package. Do not use retired `@repo/contracts`.
- [ ] Fix `@repo/ai` tool renderer registry cycles.
- [ ] Fix `@repo/database` schema cycles.
- [ ] Re-run `pnpm boundaries:cruise`.

## Phase 4: Validation Gate

Run and document:

```bash
pnpm --filter "./packages/*" typecheck
pnpm boundaries:cruise
pnpm --filter app typecheck
pnpm --filter web typecheck
pnpm test:smoke
pnpm --filter app build
```

Build env for app remains the documented dummy reset-shell env until real local secrets are configured.

## Phase 5: Continue App Reset

Only after package boundaries are clean:

- continue `apps/app` route cleanup;
- remove remaining stale pages/routes;
- keep `/` as dashboard;
- rebuild workflow-first surfaces route-by-route;
- keep reusable workflow/compiler/runtime logic out of `apps/app`.
