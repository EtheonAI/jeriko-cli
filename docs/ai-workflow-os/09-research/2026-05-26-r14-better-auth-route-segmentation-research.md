# R14 Better Auth Route Segmentation Research

Date researched: 2026-05-26

Scope: login, sign-up, forgot password, reset password, verify email, social sign-in, and sign-out in `apps/app`.

## Sources

| Source                                                          | Type                      | Claim checked                                                                                                                                                                                         |
| --------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://better-auth.com/docs/authentication/email-password`    | Official Better Auth docs | `signUp.email`, `signIn.email`, `signOut`, `sendVerificationEmail`, `requestPasswordReset`, `resetPassword`, `sendResetPassword`, and `revokeSessionsOnPasswordReset` are the documented flow pieces. |
| `https://better-auth.com/docs/concepts/client`                  | Official Better Auth docs | Client calls return `{ data, error }` and support fetch options/callbacks; UI should handle errors explicitly.                                                                                        |
| `https://better-auth.com/docs/integrations/next`                | Official Better Auth docs | App Router integration uses a route handler and `nextCookies()` plugin; auth redirects/protection still need server-side checks outside cookie-only proxy assumptions.                                |
| `https://resend.com/docs/send-with-nextjs`                      | Official Resend docs      | Resend supports sending email from Next.js with the Node SDK and examples include React Email and Better Auth integrations.                                                                           |
| `https://nextjs.org/docs/app/getting-started/project-structure` | Official Next.js docs     | `_components`, `_lib`, and other underscore folders are private implementation folders and are valid for colocating route-specific code.                                                              |
| Local `packages/auth/src/server.ts`                             | Repository source         | Server auth config has `emailAndPassword.enabled`, `sendResetPassword`, `requireEmailVerification`, `revokeSessionsOnPasswordReset`, `sendVerificationEmail`, social providers, and `nextCookies()`.  |
| Local `packages/email/index.ts`                                 | Repository source         | The email package uses `resend`, `react-email`, `RESEND_TOKEN`/`RESEND_API_KEY`, `RESEND_FROM`, and `Resend.emails.send` with rendered React Email HTML.                                              |
| Local `apps/app/app/(unauthenticated)`                          | Repository source         | Login is route-segmented; forgot/reset still import page-specific forms from shared auth components.                                                                                                  |
| Local `apps/app/tsconfig.json` and `apps/web/tsconfig.json`     | Repository source         | Both apps already define local `@/*` aliases and monorepo `@repo/*` aliases.                                                                                                                          |

## Flow Evidence

- Sign-up is implemented through `signUp.email` with `callbackURL`, and server config has `emailVerification.sendOnSignUp`.
- Sign-in is implemented through `signIn.email` with `callbackURL`.
- Social sign-in is implemented through `signIn.social` for Google and GitHub.
- Forgot password calls `requestPasswordReset({ email, redirectTo })`.
- Better Auth then calls the configured server `sendResetPassword` callback when the user exists.
- The configured callback queues `PasswordResetEmail` with the Better Auth `url` through `@repo/email`.
- `@repo/email` currently sends through Resend using rendered React Email HTML.
- Better Auth reset URLs return to the app with either `?token=...` or an error query, so reset-token parsing should be route-owned and testable.
- Reset password calls `resetPassword({ newPassword, token })`.
- Server config has `revokeSessionsOnPasswordReset: true`.
- Verify email resend calls `sendVerificationEmail({ email, callbackURL })`.
- Sign-out calls `signOut()`.

## R14 Architecture Finding

Shared `(unauthenticated)/_components/forms` should only contain reusable auth form primitives such as input styles, password strength, and password visibility.

Route-specific workflow code should live under the owning route:

- `login/_components`, `login/_hooks`, `login/_lib`, `login/_types`
- `forgot-password/_components`, `forgot-password/_lib`
- `reset-password/_components`, `reset-password/_lib`
- `verify-email/_components`, `verify-email/_hooks`, `verify-email/_lib`

This keeps Better Auth flow orchestration close to the page that owns it and avoids a shared folder becoming another generic dumping ground.

## Import Alias Finding

Use two import lanes:

- `@repo/*` for workspace packages only.
- `@/*` for app-owned code when importing across route or app boundaries.

Inside a route segment, short relative imports are acceptable because they make colocation obvious. Do not replace every local relative import with `@/` mechanically; use `@/` when relative paths become noisy or cross ownership boundaries.

## Limits

R14 can prove source wiring, Resend transport wiring, build correctness, and route helper behavior. It still cannot prove real email delivery without a real database user, valid Resend credentials/sending domain, and a capture inbox or delivered email assertion.

## Validation Results

- `pnpm --filter app typecheck`: passed.
- Targeted ESLint: passed.
- `pnpm test:smoke`: passed, 3 files and 12 tests.
- `pnpm --filter app build`: passed on Next.js `16.2.6`.
- Build route output marks `/forgot-password`, `/reset-password`, and `/verify-email` dynamic, which matches server-side query parsing.
- Resend wiring is present in `packages/email`, but live delivery remains a separate E2E proof.
