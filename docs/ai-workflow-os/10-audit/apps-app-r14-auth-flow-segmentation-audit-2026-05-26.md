# Apps/App R14 Auth Flow Segmentation Audit

Date: 2026-05-26

Scope: route-level auth organization and Better Auth flow wiring in the reset app.

## Findings

| ID          | Severity | Finding                                                                                                     | Action                                                                                                                  |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| APP-R14-001 | Medium   | Forgot-password form is page-specific but lives in shared `(unauthenticated)/_components/forms`.            | Move it to `forgot-password/_components`.                                                                               |
| APP-R14-002 | Medium   | Forgot-password query helper is page-specific but lives in shared `(unauthenticated)/_lib`.                 | Move it to `forgot-password/_lib`.                                                                                      |
| APP-R14-003 | Medium   | Reset-password form is page-specific but lives in shared `(unauthenticated)/_components/forms`.             | Move it to `reset-password/_components`.                                                                                |
| APP-R14-004 | Low      | Reset-password token/error interpretation is embedded in a client component through `useSearchParams`.      | Parse `searchParams` at the server page and use a route-local helper.                                                   |
| APP-R14-005 | Low      | Verify-email route reads email from `useSearchParams` in a client hook and redirects from an effect.        | Parse/sanitize email on the server page and pass it into the client resend component.                                   |
| APP-R14-006 | Medium   | R13 proves structural wiring, but not real email delivery.                                                  | Keep code cleanup separate from later E2E email-provider verification.                                                  |
| APP-R14-007 | Medium   | Resend is already the active email transport through `@repo/email`, but delivery has not been E2E proven.   | Keep Resend, document the flow, and validate with a real/capture inbox in a later pass.                                 |
| APP-R14-008 | Low      | `apps/app` and `apps/web` already have local `@/*` aliases plus `@repo/*`; the codebase needs a usage rule. | Use `@repo/*` for packages, `@/*` for app-owned cross-boundary imports, and short relatives inside route-local folders. |

## Keep Shared

- `(unauthenticated)/_components/auth-page-shell.tsx`
- `(unauthenticated)/_components/auth-header.tsx`
- `(unauthenticated)/_components/auth-footer.tsx`
- `(unauthenticated)/_components/forms/form-styles.ts`
- `(unauthenticated)/_components/forms/password-strength.tsx`
- `(unauthenticated)/_components/forms/password-visibility-button.tsx`
- `(unauthenticated)/_lib/callback-url.ts`
- `(unauthenticated)/_lib/legal-links.ts`
- `(unauthenticated)/_schemas/auth.ts`

## Flow Status

- Login: wired through Better Auth `signIn.email`.
- Sign-up: wired through Better Auth `signUp.email` and email verification.
- Forgot password: wired through Better Auth `requestPasswordReset` and server `sendResetPassword`.
- Reset password: wired through Better Auth `resetPassword`.
- Verify email: wired through Better Auth `sendVerificationEmail`.
- Social sign-in: wired through Better Auth `signIn.social`.
- Sign-out: wired through Better Auth `signOut()`.
- Email transport: wired through `@repo/email`, React Email templates, and Resend SDK with `RESEND_TOKEN`/`RESEND_API_KEY` and `RESEND_FROM`.

## Explicit Non-Proof

This audit does not claim reset or verification emails have been delivered in a live inbox. That requires valid Resend credentials and sending domain, a configured email provider/capture service, a real DB user, a generated Better Auth reset/verification URL, and a browser/API execution of the full flow.

## Resolution

- Moved forgot-password form to `forgot-password/_components`.
- Moved forgot-password query helper to `forgot-password/_lib`.
- Moved reset-password form to `reset-password/_components`.
- Added reset token/error helper under `reset-password/_lib`.
- Moved reset token/error parsing to the server page.
- Added verify-email query helper under `verify-email/_lib`.
- Moved verify-email query parsing and missing-email redirect to the server page.
- Documented local import alias policy: `@repo/*` for packages, `@/*` for app-owned cross-boundary imports, relative imports for tight route colocation.

## Validation Results

- `pnpm --filter app typecheck`: passed.
- Targeted ESLint: passed.
- `pnpm test:smoke`: passed, 3 files and 12 tests.
- `pnpm --filter app build`: passed on Next.js `16.2.6`.
- Route segmentation scan: passed.
- Better Auth flow scan: passed.
- Resend wiring scan: passed.
- `git diff --check`: passed.
