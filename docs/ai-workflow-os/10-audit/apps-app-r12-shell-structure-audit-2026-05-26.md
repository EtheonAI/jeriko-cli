# Apps/App R12 Shell Structure Audit

Date: 2026-05-26

Scope: Current reset shell after R11 Better Auth cleanup.

## Active File Surface

Active route files:

- `app/(authenticated)/page.tsx`
- `app/(authenticated)/layout.tsx`
- `app/(authenticated)/loading.tsx`
- `app/(authenticated)/error.tsx`
- `app/(authenticated)/_components/notifications-provider.tsx`
- `app/(authenticated)/_components/sidebar/*`
- `app/(unauthenticated)/layout.tsx`
- `app/(unauthenticated)/login/page.tsx`
- `app/(unauthenticated)/forgot-password/page.tsx`
- `app/(unauthenticated)/reset-password/page.tsx`
- `app/(unauthenticated)/verify-email/page.tsx`
- `app/api/auth/[...all]/route.ts`
- `app/api/health/route.ts`
- app metadata files

Supporting app files:

- `components/icons.tsx`
- `lib/dal.ts`
- `proxy.ts`
- `env.ts`
- `test/*`

## Findings

| ID          | Severity | Finding                                                                                                                                             | Action                                                                                                       |
| ----------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| APP-R12-001 | Low      | Empty route folders remain after deletion-first cleanup.                                                                                            | Remove empty `dashboard`, `check-email`, login `_schemas`, and unauthenticated `_components/ui` directories. |
| APP-R12-002 | Medium   | Auth sign-up and auth footer point to `/terms` and `/privacy`, but those routes are not public app routes and should live on the marketing web app. | Use absolute legal URLs based on `NEXT_PUBLIC_WEB_URL`.                                                      |
| APP-R12-003 | Low      | Auth footer computes the year inline.                                                                                                               | Use a module-level constant so the component is deterministic and simple.                                    |
| APP-R12-004 | Low      | Authenticated layout import order has `next/navigation` after local imports.                                                                        | Normalize import order while touching the file.                                                              |
| APP-R12-005 | Info     | The app still has a minimal reset shape and no active old Manus implementation surface.                                                             | Keep the reset shell; do not add product modules in R12.                                                     |

## Keep

- `apps/app/app`, not `apps/app/src/app`.
- `(authenticated)` and `(unauthenticated)` route groups.
- `/` as dashboard.
- Route-local auth component folders.
- `lib/dal.ts` with `server-only`.
- `proxy.ts` optimistic Better Auth cookie redirect.

## Do Not Do In R12

- Do not add `/dashboard`.
- Do not add workflow/product routes.
- Do not add Payload, Vercel Sandbox, `.flow`, or file rendering.
- Do not widen Client Component boundaries.
- Do not reintroduce deleted API surfaces.
