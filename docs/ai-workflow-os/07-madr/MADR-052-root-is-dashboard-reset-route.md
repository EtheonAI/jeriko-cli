# MADR-052: Use `/` As The Reset Dashboard Route

Date: 2026-05-26

Status: accepted

Supersedes: [`MADR-045`](./MADR-045-keep-auth-route-groups-and-reset-to-dashboard-shell.md) route target only.

## Context

The reset app previously treated `/dashboard` as the only authenticated page and made `/` redirect to `/dashboard`.

The product route model has been corrected:

- `/` is the dashboard.
- `/dashboard` is not needed in the reset app.

This better matches the goal of a bare next-forge-style app shell: the deployable app's home route should be the authenticated product home, not a redirect into a redundant subpath.

## Evidence

- Next.js route groups are organizational and do not affect the URL, so `app/(authenticated)/page.tsx` cleanly maps to `/` while still staying under the authenticated layout boundary.
- Next.js pages/layouts are Server Components by default, so the dashboard shell can live directly in `page.tsx` and keep client islands only where interaction is required.
- Better Auth's Next.js guidance supports fast cookie-only optimistic redirects in `proxy.ts`, with real session validation in pages/layouts. The root route remains protected by `proxy.ts` and the authenticated server layout.
- A `(dashboard)` route group would also map to `/`, but it adds a folder without a current layout, ownership, or route-local implementation boundary.

## Decision

Use:

```text
apps/app/app/(authenticated)/page.tsx -> /
```

Do not keep:

```text
apps/app/app/(authenticated)/dashboard/page.tsx -> /dashboard
```

Do not introduce:

```text
apps/app/app/(authenticated)/(dashboard)/page.tsx
```

unless the dashboard later becomes a real feature area with its own route-local `_components`, `_lib`, or layout boundary.

## Consequences

Positive:

- The active reset surface is smaller and clearer.
- No duplicate `/` -> `/dashboard` redirect.
- Sidebar, auth callback defaults, not-found links, and proxy login redirects all point at the actual app home.
- The build route output should no longer include `/dashboard`.

Tradeoffs:

- Old local links to `/dashboard` will no longer be a first-class route.
- If a compatibility redirect is later needed, it should be added deliberately and tested as a redirect route, not treated as the primary dashboard.

## Validation Checklist

- [x] Move dashboard shell content to `app/(authenticated)/page.tsx`.
- [x] Delete `app/(authenticated)/dashboard/page.tsx`.
- [x] Point sidebar dashboard link to `/`.
- [x] Point authenticated-login redirect to `/`.
- [x] Point auth callback fallback to `/`.
- [x] Point error/not-found dashboard links to `/`.
- [x] Update proxy and dashboard smoke tests.
- [x] Run app typecheck.
- [x] Run targeted ESLint.
- [x] Run smoke tests.
- [x] Run default Turbopack app build and verify route output does not include `/dashboard`.
- [x] Run `git diff --check`.
