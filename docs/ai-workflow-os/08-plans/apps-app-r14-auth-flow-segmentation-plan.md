# Apps/App R14 Auth Flow Segmentation Plan

Date: 2026-05-26

Status: completed

Scope: make login, sign-up, forgot password, reset password, verify email, social sign-in, and sign-out cleanly segmented and source-backed.

## References

- Research: [`../09-research/2026-05-26-r14-better-auth-route-segmentation-research.md`](../09-research/2026-05-26-r14-better-auth-route-segmentation-research.md)
- Audit: [`../10-audit/apps-app-r14-auth-flow-segmentation-audit-2026-05-26.md`](../10-audit/apps-app-r14-auth-flow-segmentation-audit-2026-05-26.md)
- Decision: [`../07-madr/MADR-056-r14-auth-route-owned-flow-segmentation.md`](../07-madr/MADR-056-r14-auth-route-owned-flow-segmentation.md)
- Better Auth email/password docs: `https://better-auth.com/docs/authentication/email-password`
- Better Auth client docs: `https://better-auth.com/docs/concepts/client`
- Better Auth Next.js docs: `https://better-auth.com/docs/integrations/next`
- Resend Next.js docs: `https://resend.com/docs/send-with-nextjs`
- Next.js project structure docs: `https://nextjs.org/docs/app/getting-started/project-structure`

## Checklist

- [x] R14.0: Re-check Better Auth and Next.js docs.
- [x] R14.1: Audit current auth flow segmentation and wiring.
- [x] R14.2: Write research, audit, and MADR before implementation.
- [x] R14.3: Move forgot-password form and helper to route-owned folders.
- [x] R14.4: Move reset-password form to route-owned folder.
- [x] R14.5: Parse reset token/error on the server page with a route-owned helper.
- [x] R14.6: Parse verify-email email on the server page with a route-owned helper.
- [x] R14.7: Update smoke tests for route-owned helpers.
- [x] R14.8: Document local alias policy for `@/*` and `@repo/*`.
- [x] R14.9: Validate typecheck, targeted lint, smoke tests, build, scans, and diff hygiene.

## Validation Results

- `pnpm --filter app typecheck`: passed.
- Targeted ESLint for unauthenticated auth files, `apps/app/test/auth-pages.test.ts`, and `packages/email`: passed.
- `pnpm test:smoke`: passed, 3 files and 12 tests.
- `pnpm --filter app build`: passed on Next.js `16.2.6`.
- Route segmentation scan: forgot, reset, and verify now own route-local `_components` and `_lib` folders.
- Better Auth flow scan: login, sign-up, social sign-in, forgot password, reset password, verify resend, and sign-out references are present.
- Resend scan: `@repo/email` uses `Resend`, `RESEND_TOKEN`/`RESEND_API_KEY`, `RESEND_FROM`, React Email templates, and `emails.send`.
- `git diff --check`: passed.

## Out Of Scope

- Real email-provider delivery test.
- Database seed/user creation.
- Redesign.
- New auth providers.
- Organization invitation UI.
