# Apps/App R17 Authenticated Shell Audit

Date: 2026-05-26

Scope: active `apps/app` authenticated App Router surface before R17 shell cleanup.

## Current Active Surface

Active app route files are limited to:

- root layout/error/loading/not-found/metadata files;
- `(authenticated)/layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`;
- `(authenticated)/_components/notifications-provider.tsx`;
- `(authenticated)/_components/sidebar/*`;
- `(unauthenticated)` auth pages and route-local auth components;
- `api/auth/[...all]/route.ts`;
- `api/health/route.ts`;
- `.well-known/vercel/flags/route.ts`.

The app route tree currently has no active `chat`, `sandbox`, `artifacts`, `settings`, `projects`, or old Manus product route directories.

## Findings

| Area                 | Finding                                                                                                                           | Decision                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Root route           | `/` is correctly owned by `(authenticated)/page.tsx`.                                                                             | Keep.                                        |
| Route groups         | `(authenticated)` and `(unauthenticated)` represent access/layout sections and do not affect URLs.                                | Keep.                                        |
| Auth layout          | `layout.tsx` correctly performs request-time auth and keeps `dynamic = "force-dynamic"`, but composes too much shell UI directly. | Refactor to `AppShell`.                      |
| Dashboard page       | `page.tsx` is small but owns inline stat card and empty-state markup.                                                             | Extract to route-owned dashboard components. |
| Sidebar              | Sidebar is intentionally minimal with only `Dashboard`, but `GlobalSidebar` is too generic for app-owned shell code.              | Rename to `AppSidebar`.                      |
| Sidebar trigger      | `SidebarProvider` and collapsible sidebar exist, but there is no app header with `SidebarTrigger`.                                | Add `AppHeader`.                             |
| Sign out             | Sign-out uses design-system sidebar button, but imports `Loader2Icon` directly.                                                   | Use design-system `Spinner`.                 |
| Notifications        | Notifications provider is a narrow authenticated-shell client wrapper.                                                            | Keep for now; revisit later.                 |
| Empty dirs           | `apps/app/components/auth/forms` exists as an empty stale directory.                                                              | Remove if still empty.                       |
| Old product surfaces | No active old app route tree remains for chat/sandbox/artifacts/settings.                                                         | Do not reintroduce in R17.                   |

## Keep

- `apps/app/app/(authenticated)` route group.
- `/` as the authenticated dashboard.
- Better Auth session checks in `layout.tsx`.
- `SidebarProvider` and design-system sidebar primitives.
- Minimal sidebar navigation.
- Notifications provider as reset-compatible optional shell wrapper.
- Feature-flag banner concept, but move display into app-shell.

## Refactor

- Move shell composition from layout into `_components/app-shell/app-shell.tsx`.
- Add `_components/app-shell/app-header.tsx`.
- Add `_components/app-shell/beta-banner.tsx`.
- Rename sidebar component from `GlobalSidebar` to `AppSidebar`.
- Move dashboard view into `_components/dashboard/dashboard-overview.tsx`.
- Move dashboard stat data into `_components/dashboard/dashboard-stats.tsx`.
- Replace direct `Loader2Icon` loading state in sign-out with `Spinner`.

## Delete / Gate

- Delete empty stale `apps/app/components/auth/forms` directory if still empty.
- Do not add `/dashboard`.
- Do not add workflow, sandbox, artifact, settings, file-rendering, search, or chat routes in R17.
- Do not install new packages in R17.

## Verification Needed

- App typecheck: passed.
- App smoke tests: passed, 3 files and 12 tests.
- Targeted ESLint over changed app files: passed.
- App production build with the documented dummy env: passed on Next `16.2.6` Turbopack.
- Scans proving no active old product route directories were introduced: passed.
- `git diff --check`: passed.

## Honest Limits

- This audit covers the active `apps/app` App Router shell and direct app-owned files.
- This is not a full monorepo lint cleanup.
- This is not a Vercel Sandbox migration.
- This is not workflow runtime implementation.
- This does not prove live Better Auth email delivery.
