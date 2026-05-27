# MADR-055: R13 Better Auth UI Completeness and Client Boundaries

Status: Accepted

Date: 2026-05-26

## Context

The reset app is now clean enough to start removing small structural friction. The next safe cleanup is to complete the visible Better Auth UI contract, narrow app-owned Client Component boundaries, and remove duplicated auth form UI without adding product features.

Next.js guidance says Client Components are needed for hooks, event handlers, effects, browser APIs, and custom hooks. The app currently marks some shell wrappers as client even though they only compose design-system Client Components and pass serializable props.

## Decision

- Remove `"use client"` from app-owned sidebar wrapper/footer files that do not own client logic.
- Keep design-system sidebar primitives, `NavSection`, `ModeToggle`, and `NotificationsProvider` as Client Components where they own real interactivity.
- Add one route-local password visibility button and reuse it in login and reset forms.
- Add a sidebar sign-out action using Better Auth `signOut`.
- Prefill forgot-password email from a safe query value.
- Pass a same-origin callback URL when resending verification email.
- Keep the cleanup route-local; do not promote it into the shared design system yet.

## Consequences

Positive:

- The app-owned component graph better matches Next.js Server/Client boundaries.
- Password visibility UI is easier to keep consistent.
- The reset shell exposes the full basic auth lifecycle: sign-up, sign-in, social sign-in, verify email resend, forgot password, reset password, and sign-out.
- R13 reduces small duplicated markup without changing product behavior.

Negative:

- The sidebar still depends on client design-system primitives, so this is a boundary cleanup, not a full bundle-size optimization.
- The password visibility component remains route-local until design-system reuse is proven.

## Evidence

- Next.js Server and Client Components docs: `https://nextjs.org/docs/app/getting-started/server-and-client-components`
- Next.js page file convention docs: `https://nextjs.org/docs/app/api-reference/file-conventions/page`
- Next.js data security docs: `https://nextjs.org/docs/app/guides/data-security`
- React `useMemo` docs: `https://react.dev/reference/react/useMemo`
- React `useCallback` docs: `https://react.dev/reference/react/useCallback`
- Better Auth email/password docs: `https://better-auth.com/docs/authentication/email-password`
- Better Auth Next.js integration docs: `https://better-auth.com/docs/integrations/next`
- Better Auth client docs: `https://better-auth.com/docs/concepts/client`
- npm registry check on 2026-05-26: `better-auth@1.6.11` latest stable; `next@16.2.6` latest stable.
- R13 research: [`../09-research/2026-05-26-r13-auth-ui-client-boundary-research.md`](../09-research/2026-05-26-r13-auth-ui-client-boundary-research.md)
- R13 audit: [`../10-audit/apps-app-r13-auth-ui-client-boundary-audit-2026-05-26.md`](../10-audit/apps-app-r13-auth-ui-client-boundary-audit-2026-05-26.md)

## Validation Checklist

- [x] `pnpm --filter app typecheck`
- [x] Targeted ESLint
- [x] `pnpm test:smoke`
- [x] `pnpm --filter app build`
- [x] Client-boundary scan
- [x] Old-surface scan
- [x] `git diff --check`
