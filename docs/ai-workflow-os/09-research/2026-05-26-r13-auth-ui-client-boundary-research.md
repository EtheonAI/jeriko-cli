# R13 Auth UI and Client Boundary Research

Date researched: 2026-05-26

Scope: `apps/app` authenticated sidebar shell and complete Better Auth UI coverage for login, sign-up, forgot password, reset password, verify email, social sign-in, and sign-out.

## Sources

| Source                                                                     | Type                      | Claim checked                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `https://nextjs.org/docs/app/getting-started/server-and-client-components` | Official Next.js docs     | Pages/layouts are Server Components by default; Client Components should be used for state, events, effects, browser APIs, custom hooks, and narrowing JS bundle size. Server Components can pass serializable props to Client Components. |
| `https://nextjs.org/docs/app/api-reference/file-conventions/page`          | Official Next.js docs     | Page files receive `searchParams` as a promise in the current App Router API, so server-side query parsing should await it.                                                                                                                |
| `https://nextjs.org/docs/app/guides/data-security`                         | Official Next.js docs     | Auth/security checks should remain in server/DAL boundaries; UI cleanup must not move protected data checks into client components.                                                                                                        |
| `https://react.dev/reference/react/useMemo`                                | Official React docs       | Memoization is not a substitute for correct component boundaries; use it for expensive recalculation only.                                                                                                                                 |
| `https://react.dev/reference/react/useCallback`                            | Official React docs       | Stable callbacks are useful only when needed for memoized children or effect dependencies; do not add callback indirection as generic cleanup.                                                                                             |
| `https://better-auth.com/docs/authentication/email-password`               | Official Better Auth docs | Confirms client methods for sign-up, sign-in, sign-out, manual verification email, request password reset, reset password, and revoking sessions on password reset.                                                                        |
| `https://better-auth.com/docs/integrations/next`                           | Official Better Auth docs | Confirms App Router handler, `nextCookies()`, proxy cookie-only redirect caveat, and server-side session validation.                                                                                                                       |
| `https://better-auth.com/docs/concepts/client`                             | Official Better Auth docs | Confirms client error handling, fetch options, session hooks, and sign-out usage.                                                                                                                                                          |
| npm registry                                                               | Registry metadata         | Latest stable `better-auth` is `1.6.11`; `1.7.0-beta.3` is beta. Latest stable `next` is `16.2.6`.                                                                                                                                         |
| Local `@repo/design-system/components/ui/sidebar.tsx`                      | Repository source         | Sidebar primitives are Client Components because they own state, effects, mobile behavior, and keyboard shortcuts. Parent wrappers that do not own hooks can stay server components and render those client primitives.                    |
| Local `@repo/design-system/components/mode-toggle.tsx`                     | Repository source         | Theme toggle is an interactive Client Component; parent footer does not need its own client boundary unless it owns hooks/events.                                                                                                          |

## Findings

- `app/(authenticated)/_components/sidebar/index.tsx` has `"use client"` but owns no hooks, state, effects, events, or browser APIs.
- `app/(authenticated)/_components/sidebar/sidebar-footer.tsx` has `"use client"` but owns no hooks, state, effects, events, or browser APIs.
- `NavSection` correctly remains a Client Component because it uses `usePathname`.
- `NotificationsProvider` correctly remains a Client Component because it uses `useTheme`.
- Password visibility controls are duplicated in login password and reset-password forms.
- The duplicated visibility controls are text buttons in fixed input overlays. This is acceptable functionally, but the design rule for tool-like controls prefers icon buttons with accessible labels.
- Sign-up is present through explicit mode selection and `signUp.email`.
- Forgot password is present through `requestPasswordReset`, but it does not prefill the `email` query passed from the login password step.
- Reset password is present through `resetPassword` and server config already revokes other sessions.
- Verify email is present through `sendVerificationEmail`, but resend does not pass a callback URL.
- Social login is present for Google and GitHub through `signIn.social`.
- Sign-out is exported from `@repo/auth/client` but not exposed in the app shell.

## R13 Decisions

- Remove unnecessary app-owned client boundaries from sidebar wrapper/footer.
- Keep real interactive sidebar primitives and `NavSection` as client code.
- Add one route-local password visibility button component using lucide `Eye` / `EyeOff`.
- Reuse it in login password and reset-password forms.
- Add a sidebar sign-out action using Better Auth `signOut`.
- Prefill forgot-password email from the safe `email` query parameter through a route-local helper covered by smoke tests.
- Pass an explicit same-origin callback URL when resending verification email.
- Do not introduce factories, global auth abstractions, or new design-system exports in R13.

## Validation Checklist

- [x] `pnpm --filter app typecheck`
- [x] Targeted ESLint for touched files
- [x] `pnpm test:smoke`
- [x] `pnpm --filter app build`
- [x] Client-boundary scan
- [x] Old-surface scan
- [x] `git diff --check`

## Validation Results

- `better-auth` latest stable on 2026-05-26: `1.6.11`.
- `next` latest stable on 2026-05-26: `16.2.6`.
- `pnpm test:smoke`: passed, 3 files and 8 tests after adding forgot-password email-query helper coverage.
- Production build routes after R13: `/`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`, `/api/auth/[...all]`, `/api/health`, metadata routes, and proxy.
- No `/dashboard` route or deleted `auth/check-email` route was reintroduced.
