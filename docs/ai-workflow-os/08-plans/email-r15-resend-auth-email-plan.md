# Email R15 Resend Auth Email Plan

Date: 2026-05-26

Status: completed

Scope: add deterministic package-level proof for Better Auth reset/verification emails through Resend.

## References

- Research: [`../09-research/2026-05-26-r15-resend-auth-email-hardening-research.md`](../09-research/2026-05-26-r15-resend-auth-email-hardening-research.md)
- Audit: [`../10-audit/email-r15-resend-auth-email-audit-2026-05-26.md`](../10-audit/email-r15-resend-auth-email-audit-2026-05-26.md)
- Decision: [`../07-madr/MADR-057-r15-resend-auth-email-test-harness.md`](../07-madr/MADR-057-r15-resend-auth-email-test-harness.md)
- Resend Next.js docs: `https://resend.com/docs/send-with-nextjs`
- Resend send email API docs: `https://resend.com/docs/api-reference/emails/send-email`
- React Email render docs: `https://react.email/docs/utilities/render`
- Better Auth email/password docs: `https://better-auth.com/docs/authentication/email-password`

## Checklist

- [x] R15.0: Research Resend, React Email, and Better Auth email flow docs.
- [x] R15.1: Audit `packages/email` and Better Auth email callbacks.
- [x] R15.2: Write research, audit, and MADR before implementation.
- [x] R15.3: Add `packages/email` Vitest project and test script.
- [x] R15.4: Add template render tests for reset and verification URLs.
- [x] R15.5: Add mocked Resend transport tests for success/error/missing env.
- [x] R15.6: Add `packages/email` to root Vitest projects.
- [x] R15.7: Validate typecheck, package tests, app smoke tests, lint, scans, and diff hygiene.

## Validation Results

- `pnpm --filter @repo/email typecheck`: passed.
- `pnpm exec vitest run --project @repo/email`: passed, 1 file and 5 tests.
- `pnpm test:smoke`: passed, 3 app files and 12 tests.
- `pnpm exec vitest run --project @repo/email --project app`: passed, 4 files and 17 tests.
- Targeted ESLint for `packages/email`, `packages/auth/src/server.ts`, and active app auth files: passed.
- Resend wiring scan: `@repo/email` uses `Resend`, `RESEND_TOKEN`/`RESEND_API_KEY`, `RESEND_FROM`, `render()`, and `emails.send`.
- Better Auth callback scan: reset and verification callbacks call `sendEmail` with `PasswordResetEmail` and `VerificationEmail`.
- `git diff --check`: passed.

## Out Of Scope

- Live Resend send.
- Resend domain setup.
- Better Auth endpoint E2E.
- Inbox/capture assertion.
