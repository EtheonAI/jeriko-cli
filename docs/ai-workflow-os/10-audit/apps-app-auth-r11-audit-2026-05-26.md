# Apps/App Auth R11 Audit

Date: 2026-05-26

Scope: Better Auth server config, app auth route, proxy, DAL, unauthenticated login/signup/reset routes.

## Active Auth Surface

- `packages/auth/src/server.ts`
- `packages/auth/src/client.ts`
- `packages/auth/keys.ts`
- `apps/app/app/api/auth/[...all]/route.ts`
- `apps/app/proxy.ts`
- `apps/app/lib/dal.ts`
- `apps/app/app/(authenticated)/layout.tsx`
- `apps/app/app/(unauthenticated)/login/*`
- `apps/app/app/(unauthenticated)/forgot-password/*`
- `apps/app/app/(unauthenticated)/reset-password/*`
- `apps/app/app/(unauthenticated)/verify-email/*`

## What Is Already Correct

- Better Auth is on latest stable `1.6.11`.
- App Router handler uses `toNextJsHandler(auth)`.
- `nextCookies()` is last in the Better Auth plugin list.
- `proxy.ts` is present for Next.js 16 and no `middleware.ts` is active in `apps/app`.
- Proxy uses `getSessionCookie(request)` only for optimistic redirect.
- Real protected access is checked in the authenticated layout through the DAL and Better Auth server API.
- T3 Env remains the app/package env boundary.
- Google and GitHub social sign-in buttons exist.

## Problems To Fix In R11

| ID           | Severity | Finding                                                                                                                      | Action                                                                                     |
| ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| AUTH-R11-001 | High     | `/api/auth/check-email` reveals account/credential existence and conflicts with Better Auth sign-up enumeration protection.  | Delete the endpoint and route-local helper; use explicit sign-in/sign-up mode instead.     |
| AUTH-R11-002 | Medium   | Better Auth email callbacks await email delivery. Current docs recommend non-blocking delivery using `waitUntil` or similar. | Use Next.js `after` to queue verification/reset/invitation email sends after the response. |
| AUTH-R11-003 | Medium   | Password reset does not revoke other active sessions.                                                                        | Set `revokeSessionsOnPasswordReset: true`.                                                 |
| AUTH-R11-004 | Low      | Client auth calls pass relative callback URLs.                                                                               | Keep safe relative validation but send same-origin absolute URLs to Better Auth.           |
| AUTH-R11-005 | Low      | Login orchestration still carries precheck state and route helper imports.                                                   | Remove `isCheckingEmail`, `check-email`, and existence result types.                       |

## R11 Non-Goals

- Do not add passkeys, 2FA, magic links, organization UI, or admin UI yet.
- Do not replace Better Auth.
- Do not move auth package code into `apps/app`.
- Do not add a separate `/dashboard` route.
- Do not rebuild the full material redesign in this auth cleanup phase.

## Evidence

- Better Auth docs: `https://better-auth.com/docs/integrations/next`
- Better Auth email/password docs: `https://better-auth.com/docs/authentication/email-password`
- Better Auth AI resources: `https://better-auth.com/docs/ai-resources/skills`
- Better Auth LLM index: `https://better-auth.com/llms.txt`
- Next.js `after`: `https://nextjs.org/docs/app/api-reference/functions/after`
