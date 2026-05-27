# MADR-056: R14 Auth Route-Owned Flow Segmentation

Status: Accepted

Date: 2026-05-26

## Context

R13 completed the visible Better Auth lifecycle, but route ownership is uneven. Login already uses route-local components, hooks, libs, and types. Forgot password and reset password still keep page-specific forms in a shared auth components folder. Verify email still parses query state in a client hook.

Better Auth separates flow responsibilities clearly: client methods start auth actions, while configured server callbacks send verification and reset emails. Next.js App Router supports private `_components` and `_lib` folders inside route segments, making route-owned auth flow code appropriate here.

The repo already uses Resend through `@repo/email`, and the intended auth email flow should stay on that transport.

## Decision

- Keep reusable auth primitives shared under `(unauthenticated)/_components` and `(unauthenticated)/_lib`.
- Move page-specific forgot-password code under `forgot-password/_components` and `forgot-password/_lib`.
- Move page-specific reset-password code under `reset-password/_components` and `reset-password/_lib`.
- Add verify-email route-local query parsing under `verify-email/_lib` and keep resend interaction in route-local client code.
- Parse route query inputs on the server page where practical, then pass sanitized serializable values to client components.
- Keep Resend as the active email transport through `@repo/email`.
- Use `@repo/*` for workspace packages and `@/*` for app-owned cross-boundary imports; keep short relative imports for tight route-local colocation.
- Do not claim live email delivery until a dedicated E2E email capture pass proves it.

## Consequences

Positive:

- Auth routes become easier to inspect independently.
- Shared folders remain real shared primitives, not mixed workflow buckets.
- Query parsing becomes testable and less dependent on client effects.
- The reset shell better matches senior App Router colocation standards.

Negative:

- More files and folders are introduced.
- Some shared imports must be updated after moving forms.

## Evidence

- Better Auth email/password docs: `https://better-auth.com/docs/authentication/email-password`
- Better Auth client docs: `https://better-auth.com/docs/concepts/client`
- Better Auth Next.js integration docs: `https://better-auth.com/docs/integrations/next`
- Resend Next.js docs: `https://resend.com/docs/send-with-nextjs`
- Next.js project structure docs: `https://nextjs.org/docs/app/getting-started/project-structure`
- R14 research: [`../09-research/2026-05-26-r14-better-auth-route-segmentation-research.md`](../09-research/2026-05-26-r14-better-auth-route-segmentation-research.md)
- R14 audit: [`../10-audit/apps-app-r14-auth-flow-segmentation-audit-2026-05-26.md`](../10-audit/apps-app-r14-auth-flow-segmentation-audit-2026-05-26.md)

## Validation Checklist

- [x] `pnpm --filter app typecheck`
- [x] Targeted ESLint
- [x] `pnpm test:smoke`
- [x] `pnpm --filter app build`
- [x] Route segmentation scan
- [x] Better Auth flow scan
- [x] Resend email wiring scan
- [x] `git diff --check`
