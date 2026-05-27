# Apps/App R13 Auth UI and Client Boundary Plan

Date: 2026-05-26

Status: completed

Scope: complete the visible Better Auth lifecycle, narrow app-owned Client Component boundaries, and remove duplicated password visibility UI.

## References

- Research: [`../09-research/2026-05-26-r13-auth-ui-client-boundary-research.md`](../09-research/2026-05-26-r13-auth-ui-client-boundary-research.md)
- Audit: [`../10-audit/apps-app-r13-auth-ui-client-boundary-audit-2026-05-26.md`](../10-audit/apps-app-r13-auth-ui-client-boundary-audit-2026-05-26.md)
- Decision: [`../07-madr/MADR-055-r13-narrow-app-owned-client-boundaries.md`](../07-madr/MADR-055-r13-narrow-app-owned-client-boundaries.md)
- Next.js Server and Client Components docs: `https://nextjs.org/docs/app/getting-started/server-and-client-components`
- Next.js page file convention docs: `https://nextjs.org/docs/app/api-reference/file-conventions/page`
- Next.js data security docs: `https://nextjs.org/docs/app/guides/data-security`
- Better Auth email/password docs: `https://better-auth.com/docs/authentication/email-password`
- Better Auth Next.js integration docs: `https://better-auth.com/docs/integrations/next`
- Better Auth client docs: `https://better-auth.com/docs/concepts/client`

## Checklist

- [x] R13.0: Re-check current Next.js, React, and Better Auth docs for Server/Client boundary and auth lifecycle guidance.
- [x] R13.1: Audit active client components and Better Auth UI coverage in `apps/app`.
- [x] R13.2: Write research, audit, and MADR before code edits.
- [x] R13.3: Remove unnecessary `"use client"` from app-owned sidebar wrappers.
- [x] R13.4: Add reusable route-local password visibility button.
- [x] R13.5: Replace duplicated password visibility button markup in login and reset forms.
- [x] R13.6: Add app-shell sign-out.
- [x] R13.7: Prefill forgot-password email from query.
- [x] R13.8: Pass callback URL for verify-email resend.
- [x] R13.9: Validate typecheck, targeted lint, smoke tests, build, scans, and diff hygiene.

## Validation Results

- `pnpm --filter app typecheck`: passed.
- Targeted ESLint for touched auth/sidebar files: passed.
- `pnpm test:smoke`: passed, 3 files and 8 tests.
- `pnpm --filter app build`: passed on Next.js `16.2.6`.
- Client-boundary scan: only `nav-section.tsx` and `sign-out-button.tsx` remain client in the sidebar folder.
- Old-surface scan: only the guardrail sentence in `apps/app/README.md` mentions old removed surfaces.
- `git diff --check`: passed.

## Out Of Scope

- Redesign.
- Product routes.
- Better Auth behavior changes.
- Shared design-system exports.
