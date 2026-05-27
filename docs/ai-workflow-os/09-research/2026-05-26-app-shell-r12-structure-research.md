# Apps/App R12 Shell Structure Research

Date researched: 2026-05-26

Scope: `apps/app` route groups, reset shell, auth UI, empty route folders, and legal-link routing.

## Sources

| Source                                                                     | Type                           | Claim checked                                                                                                                                                 |
| -------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://nextjs.org/docs/app/getting-started/project-structure`            | Official Next.js docs          | Confirms `src` is optional, project organization is team-dependent, route-local splitting is valid, and route groups can organize without changing URLs.      |
| `https://nextjs.org/docs/app/api-reference/file-conventions/route-groups`  | Official Next.js docs          | Confirms route groups are for organization/layout ownership, are omitted from URL paths, and must avoid conflicting route paths.                              |
| `https://nextjs.org/docs/app/getting-started/server-and-client-components` | Official Next.js docs          | Confirms Server Components are default and Client Components should be narrow interactive islands to reduce JS bundle size.                                   |
| `https://nextjs.org/docs/app/guides/data-security`                         | Official Next.js docs          | Confirms protected actions/routes need server-side auth checks and DAL/server-only boundaries should own auth and authorization.                              |
| `https://next-forge.com/docs` and local Vercel `next-forge` skill          | Starter architecture reference | Confirms app surfaces should be self-contained deployable apps, package integrations should be isolated, and optional integrations should degrade gracefully. |
| Local app audit                                                            | Repository source              | Confirms active `apps/app` has only reset dashboard/auth/health/auth API route files, but empty deleted-route folders still exist in the filesystem.          |

## Findings

- Keeping `apps/app/app` is still correct. Next.js says `src` is optional and consistency matters more than the folder preference.
- Keeping `(authenticated)` and `(unauthenticated)` is still correct. They own different layout/auth concerns without changing the URL.
- Current active route files are small and aligned with reset-shell scope.
- Four empty directories remain after earlier route deletions:
  - `apps/app/app/(authenticated)/dashboard`
  - `apps/app/app/(unauthenticated)/_components/ui`
  - `apps/app/app/(unauthenticated)/login/_schemas`
  - `apps/app/app/api/auth/check-email`
- No active `apps/app` implementation code references Manus, E2B, artifacts, canvas, chat, project, workflow, `/dashboard`, or `check-email`; remaining matches are docs/test env guardrails only.
- Auth UI still links to `/terms` and `/privacy` from a protected app domain. Those paths do not exist in `apps/app` and are not public routes, so they would proxy back to `/login`.

## R12 Decision Impact

- Do not create new product routes yet.
- Do not move `app` to `src/app`.
- Keep the route-group split.
- Remove empty deleted-route directories.
- Route legal links to `NEXT_PUBLIC_WEB_URL` absolute marketing URLs.
- Keep the dashboard root `/` as the only authenticated app page.

## Validation Checklist

- [x] `pnpm --filter app typecheck`
- [x] Targeted ESLint for touched app files
- [x] `pnpm test:smoke`
- [x] `pnpm --filter app build`
- [x] Active old-surface scan
- [x] Empty route folder scan
- [x] `git diff --check`
