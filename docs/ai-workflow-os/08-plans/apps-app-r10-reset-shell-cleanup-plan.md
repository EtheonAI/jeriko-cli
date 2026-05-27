# Apps/App R10 Reset Shell Cleanup Plan

Date: 2026-05-26

Status: completed

Scope: `apps/app` only, after R9 auth segmentation and the observability-boundary fix.

## References

- Next.js project structure docs: `https://nextjs.org/docs/app/getting-started/project-structure`
- Next.js route groups docs: `https://nextjs.org/docs/app/api-reference/file-conventions/route-groups`
- Next.js Server and Client Components docs: `https://nextjs.org/docs/app/getting-started/server-and-client-components`
- Next.js `use client` directive docs: `https://nextjs.org/docs/app/api-reference/directives/use-client`
- Next.js data security docs: `https://nextjs.org/docs/app/guides/data-security`
- next-forge app docs: `https://www.next-forge.com/docs/apps/app`
- R9 checklist: [`apps-app-structure-cleanup-checklist.md`](apps-app-structure-cleanup-checklist.md)
- Observability boundary decision: [`../07-madr/MADR-051-observability-boundary-for-reset-app.md`](../07-madr/MADR-051-observability-boundary-for-reset-app.md)

## Current Reset App Surface

Active route files:

- Authenticated:
  - `app/(authenticated)/page.tsx`
  - `app/(authenticated)/layout.tsx`
  - `app/(authenticated)/_components/sidebar/*`
  - `app/(authenticated)/_components/notifications-provider.tsx`
- Unauthenticated:
  - `app/(unauthenticated)/login/page.tsx`
  - `app/(unauthenticated)/forgot-password/page.tsx`
  - `app/(unauthenticated)/reset-password/page.tsx`
  - `app/(unauthenticated)/verify-email/page.tsx`
  - `app/(unauthenticated)/_components/*`
  - route-local login/reset/verify components, hooks, libs, schemas, and types
- API:
  - `app/api/auth/[...all]/route.ts`
  - `app/api/health/route.ts`
- Metadata:
  - `manifest.ts`
  - `robots.ts`
  - `sitemap.ts`
  - icons and Open Graph image

Global app files still present:

- `apps/app/components/icons.tsx`
- `apps/app/lib/dal.ts`
- `apps/app/test/*`
- `apps/app/env.ts`
- `apps/app/proxy.ts`
- Sentry/Next instrumentation files

## Findings

- No `Manus`, `E2B`, `artifact`, `canvas`, `chat`, `project`, `workflow`, or `/dashboard` implementation code remains inside `apps/app`; only README guardrails mention old product surfaces.
- No app code imports `@sentry/nextjs` directly after MADR-051.
- `apps/app/components/icons.tsx` is the only remaining app-global component file.
- `apps/app/lib/dal.ts` is a server/session boundary and should stay app-local for now.
- `apps/app/test/*` is small and still aligned with the reset app: root dashboard and proxy auth routing.
- The authenticated sidebar is correctly private to `app/(authenticated)/_components/sidebar/*`; it should not move into global app components.

## R10 Decisions

- Keep `(authenticated)` and `(unauthenticated)` route groups.
- Keep `apps/app/app`; do not move to `src/app`.
- Keep `/` as the dashboard route.
- Do not add `/dashboard` unless a future compatibility redirect is deliberately specified and tested.
- Do not add `(dashboard)` for the reset shell; it would not affect the URL and currently adds no ownership or layout boundary.
- Keep the authenticated sidebar route-group-local.
- Keep `components/icons.tsx` global only until the design-system icon strategy is decided.
- Keep `lib/dal.ts` app-local because it binds Next request headers to Better Auth session access.
- Do not add workflow, sandbox, files, browser, search, or chat surfaces in R10.

## Implementation Checklist

- [x] R10.0: Re-audit `app/(authenticated)/layout.tsx`, `providers.tsx`, sidebar components, and notifications provider for correct Server/Client boundaries. Removed the empty client-only `providers.tsx` wrapper and narrowed the sidebar user prop to the rendered email only.
- [x] R10.1: Confirm authenticated root `/` and `/dashboard` should both exist. Decision: `/` is the dashboard; `/dashboard` is removed from the reset app.
- [x] R10.2: Audit `app/styles.css` for old Manus naming, one-off CSS, or theme drift before redesign begins. Current file only imports design-system globals.
- [x] R10.3: Audit `components/icons.tsx`; either keep it as app-local auth/social glue or move stable icons into `@repo/design-system`. Decision: keep it app-local for auth/social icon glue until the design-system icon strategy is revisited, but shrink it to only `spinner`, `google`, and `gitHub`.
- [x] R10.4: Audit `lib/dal.ts` for server-only enforcement and Better Auth latest-doc alignment before expanding authenticated data access. Added explicit `server-only`; Better Auth server-session usage matches current Next.js integration docs.
- [x] R10.5: Audit `proxy.ts` and proxy tests against Better Auth latest docs before changing route protection. Kept cookie-only optimistic proxy checks and real session validation in the authenticated layout.
- [x] R10.6: Keep all changes validated by `pnpm --filter app typecheck`, targeted ESLint, `pnpm test:smoke`, default `pnpm --filter app build`, and `git diff --check`.

## R10 Route Correction

Decision record: [`../07-madr/MADR-052-root-is-dashboard-reset-route.md`](../07-madr/MADR-052-root-is-dashboard-reset-route.md)

Implementation:

- `apps/app/app/(authenticated)/page.tsx` now renders the dashboard shell.
- `apps/app/app/(authenticated)/dashboard/page.tsx` is deleted.
- Sidebar, auth callback fallback, not-found link, authenticated error link, and proxy auth-page redirect point to `/`.
- Smoke tests now import the root dashboard page.
- `components/icons.tsx` now contains only active auth/social icons.
- Sidebar user data now passes only `userEmail`, not unused name/image fields.

Validation:

- `pnpm --filter app typecheck` passed after route types were regenerated by `next build`.
- targeted ESLint for touched app files passed.
- `pnpm test:smoke` passed: 2 files, 5 tests.
- default `pnpm --filter app build` passed on Next `16.2.6` with Turbopack.
- build route output no longer includes `/dashboard`.
- active app scan found no old Manus/E2B/artifact/canvas/chat/project/workflow implementation code; only the README guardrail mentions retired surfaces.
- `git diff --check` passed.

## Out Of Scope

- Payload/Basehub CMS decision.
- Vercel Sandbox migration.
- `.flow` parser/runtime.
- New workflow UI.
- Material redesign.
- Rebuilding services/backend packages.
