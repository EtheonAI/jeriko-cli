# Apps/App R11 Better Auth Cleanup Plan

Date: 2026-05-26

Status: completed

Scope: `packages/auth` plus `apps/app` auth routes and unauthenticated auth UI.

## References

- Better Auth AI resources: `https://better-auth.com/docs/ai-resources/skills`
- Better Auth LLM index: `https://better-auth.com/llms.txt`
- Better Auth Next.js integration: `https://better-auth.com/docs/integrations/next`
- Better Auth email/password: `https://better-auth.com/docs/authentication/email-password`
- Next.js `after`: `https://nextjs.org/docs/app/api-reference/functions/after`
- Decision record: [`../07-madr/MADR-053-better-auth-latest-docs-auth-flow-cleanup.md`](../07-madr/MADR-053-better-auth-latest-docs-auth-flow-cleanup.md)
- Research: [`../09-research/2026-05-26-better-auth-ai-resources-r11.md`](../09-research/2026-05-26-better-auth-ai-resources-r11.md)
- Audit: [`../10-audit/apps-app-auth-r11-audit-2026-05-26.md`](../10-audit/apps-app-auth-r11-audit-2026-05-26.md)

## Checklist

- [x] R11.0: Confirm latest stable Better Auth package from npm registry.
- [x] R11.1: Read Better Auth `llms.txt`, AI resources, Next.js integration, and email/password docs.
- [x] R11.2: Audit active auth route, proxy, DAL, login, reset, and auth server config.
- [x] R11.3: Write research, audit, and MADR before code edits.
- [x] R11.4: Remove email-existence preflight route and helper.
- [x] R11.5: Refactor login flow to explicit sign-in/sign-up mode.
- [x] R11.6: Convert safe callback paths to same-origin absolute URLs before Better Auth calls.
- [x] R11.7: Queue auth emails with Next.js `after`.
- [x] R11.8: Revoke sessions on password reset.
- [x] R11.9: Update older checklists/docs that still mention `check-email`.
- [x] R11.10: Validate typecheck, targeted lint, smoke tests, production build, and active scans.
- [x] R11.11: Validate diff hygiene.

## Implementation Notes

- Deleted `apps/app/app/api/auth/check-email/route.ts`.
- Deleted the login route-local `check-email` helper and removed `EmailCheckResult`.
- Moved callback URL utilities to `app/(unauthenticated)/_lib/callback-url.ts`.
- Login now uses explicit sign-in/sign-up mode instead of account-existence probing.
- Better Auth client calls now convert safe relative callbacks to same-origin absolute URLs.
- Better Auth verification, reset, and organization invitation emails are queued with Next.js `after`.
- Password reset now sets `revokeSessionsOnPasswordReset: true`.

## Validation

- `pnpm --filter @repo/auth typecheck` passed.
- `pnpm --filter app typecheck` passed.
- Targeted ESLint for touched auth files passed.
- `pnpm test:smoke` passed: 2 files, 5 tests.
- `pnpm --filter app build` passed on Next `16.2.6` with Turbopack.
- Build output no longer includes `/api/auth/check-email`.
- Active source scan found no `check-email`, `checkEmailAddress`, `EmailCheckResult`, `isCheckingEmail`, or `auth/check-email` references in `apps/app` or `packages`.
- `git diff --check` passed.

## Out Of Scope

- Passkeys.
- 2FA.
- Organization UI.
- Admin UI.
- New material redesign.
- `.flow` runtime work.
