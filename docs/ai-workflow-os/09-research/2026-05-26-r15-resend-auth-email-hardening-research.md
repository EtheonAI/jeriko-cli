# R15 Resend Auth Email Hardening Research

Date researched: 2026-05-26

Scope: Better Auth verification/reset emails through `@repo/email`, React Email templates, and Resend.

## Sources

| Source                                                       | Type                      | Claim checked                                                                                                                                                                                 |
| ------------------------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://resend.com/docs/send-with-nextjs`                   | Official Resend docs      | Next.js email sending uses the Resend Node SDK, requires an API key and verified domain, and can send React email templates.                                                                  |
| `https://resend.com/docs/api-reference/emails/send-email`    | Official Resend docs      | `emails.send` requires `from`, `to`, and `subject`; supports `html`, `text`, and Node SDK `react`; returns either `data` with an id or an `error`.                                            |
| `https://react.email/docs/utilities/render`                  | Official React Email docs | React Email templates can be rendered into HTML strings for transport APIs.                                                                                                                   |
| `https://better-auth.com/docs/authentication/email-password` | Official Better Auth docs | Forgot/reset and email verification flows are driven by `requestPasswordReset`, `resetPassword`, `sendResetPassword`, `sendVerificationEmail`, and `emailVerification.sendVerificationEmail`. |
| Local `packages/email/index.ts`                              | Repository source         | `sendEmail` renders React Email to HTML, reads `RESEND_TOKEN` or `RESEND_API_KEY`, sends through `Resend.emails.send`, and returns a `{ success, id?, error? }` result.                       |
| Local `packages/email/templates/*.tsx`                       | Repository source         | Password reset and verification templates include CTA links passed from Better Auth callbacks.                                                                                                |
| Local `packages/auth/src/server.ts`                          | Repository source         | Better Auth server callbacks call `sendEmail` with `PasswordResetEmail` and `VerificationEmail`.                                                                                              |

## Findings

- The repo already uses Resend and should keep it as the auth email transport.
- `RESEND_TOKEN` and `RESEND_API_KEY` are treated as aliases, with `RESEND_TOKEN` receiving either value.
- `RESEND_FROM` defaults to `Jeriko <noreply@etheon.ai>`.
- The current `sendEmail` implementation renders React Email to HTML before calling Resend. This is acceptable because Resend supports `html` and React Email supports rendering templates to HTML.
- Resend docs also support passing `react` directly to `emails.send`, but changing that is not required for R15 because the current implementation is explicit, testable, and transport-neutral.
- Live delivery still requires valid Resend credentials, verified sending domain, a real or captured recipient, a database user, and executing Better Auth endpoints.

## R15 Decision Input

Add package-level tests for:

- password reset template renders the reset URL;
- verification template renders the verification URL;
- `sendEmail` sends rendered HTML through Resend with the configured sender;
- `sendEmail` returns a structured error when Resend returns an error;
- `sendEmail` returns a structured error when Resend credentials are missing.

## Validation Results

- Added `packages/email/vitest.config.ts`.
- Added `packages/email/test/email.test.ts`.
- Added `packages/email` to root Vitest projects.
- `pnpm exec vitest run --project @repo/email`: passed, 1 file and 5 tests.
- `pnpm exec vitest run --project @repo/email --project app`: passed, 4 files and 17 tests.
- Live Resend delivery remains unproven by design.
