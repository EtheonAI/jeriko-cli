# MADR-057: R15 Resend Auth Email Test Harness

Status: Accepted

Date: 2026-05-26

## Context

Better Auth reset and verification emails are now wired through `@repo/email`, but live delivery has not been proven. Before running live/capture inbox E2E tests, the package should have deterministic tests for template rendering, Resend payload construction, and error handling.

## Decision

- Keep Resend as the active email transport.
- Add a `packages/email` Vitest project.
- Mock the Resend SDK in package tests rather than sending real email.
- Test React Email template rendering for reset and verification URLs.
- Test `sendEmail` success, Resend error, and missing credential behavior.
- Add `packages/email` to root Vitest projects.

## Consequences

Positive:

- Auth email code has repeatable proof without live credentials.
- Future transport refactors will catch broken template links and payload shape.
- Live E2E can focus on Resend credentials/domain/inbox behavior, not basic package wiring.

Negative:

- These tests do not prove domain verification, inbox delivery, spam placement, or Better Auth token generation.
- The Resend SDK is mocked, so SDK behavior changes still need package-version and integration checks.

## Evidence

- Resend Next.js docs: `https://resend.com/docs/send-with-nextjs`
- Resend send email API docs: `https://resend.com/docs/api-reference/emails/send-email`
- React Email render docs: `https://react.email/docs/utilities/render`
- Better Auth email/password docs: `https://better-auth.com/docs/authentication/email-password`
- R15 research: [`../09-research/2026-05-26-r15-resend-auth-email-hardening-research.md`](../09-research/2026-05-26-r15-resend-auth-email-hardening-research.md)
- R15 audit: [`../10-audit/email-r15-resend-auth-email-audit-2026-05-26.md`](../10-audit/email-r15-resend-auth-email-audit-2026-05-26.md)

## Validation Checklist

- [x] `pnpm --filter @repo/email typecheck`
- [x] `pnpm exec vitest run --project @repo/email`
- [x] `pnpm test:smoke`
- [x] Targeted ESLint for `packages/email`
- [x] Resend wiring scan
- [x] Better Auth callback scan
- [x] `git diff --check`
