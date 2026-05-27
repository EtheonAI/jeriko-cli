# Email R15 Resend Auth Email Audit

Date: 2026-05-26

Scope: `packages/email` and Better Auth email callbacks.

## Findings

| ID            | Severity | Finding                                                                       | Action                                                                                              |
| ------------- | -------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| EMAIL-R15-001 | Medium   | `@repo/email` has no package-level test coverage for the Resend wrapper.      | Add Vitest project and transport mock tests.                                                        |
| EMAIL-R15-002 | Medium   | Auth email templates are not tested for preserving Better Auth callback URLs. | Add render tests for password reset and verification templates.                                     |
| EMAIL-R15-003 | Low      | Root Vitest projects omit `packages/email`.                                   | Add the package project to the root Vitest config.                                                  |
| EMAIL-R15-004 | Medium   | Live Resend delivery is not proven.                                           | Keep this as explicit non-proof and reserve it for an E2E pass with real credentials/capture inbox. |

## Current Flow

```text
Better Auth client request
→ Better Auth server callback
→ @repo/email sendEmail()
→ React Email render()
→ Resend.emails.send({ from, to, subject, html })
→ { success, id? } or { success: false, error }
```

## Keep

- Keep Resend as the email provider.
- Keep React Email templates in `packages/email/templates`.
- Keep `RESEND_TOKEN` and `RESEND_API_KEY` compatibility.
- Keep the email package lazy so importing templates does not require credentials.

## Non-Proof

This audit does not claim real email delivery. That requires valid Resend credentials, a verified domain, a DB user, and an E2E request through Better Auth.

## Resolution

- Added a Vitest project for `@repo/email`.
- Added reset and verification template render tests.
- Added mocked Resend wrapper tests for success, provider error, and missing credentials.
- Added `@repo/email` to the root Vitest project list.

## Validation Results

- `pnpm --filter @repo/email typecheck`: passed.
- `pnpm exec vitest run --project @repo/email`: passed, 1 file and 5 tests.
- `pnpm test:smoke`: passed, 3 files and 12 tests.
- `pnpm exec vitest run --project @repo/email --project app`: passed, 4 files and 17 tests.
- Targeted ESLint: passed.
- Resend wiring scan: passed.
- Better Auth callback scan: passed.
- `git diff --check`: passed.
