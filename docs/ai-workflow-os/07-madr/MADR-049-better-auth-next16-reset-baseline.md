# MADR-049: Better Auth Next.js 16 Reset Baseline

Status: Accepted

Date: 2026-05-25

## Context

The app reset keeps Better Auth, but the current integration still has old reset artifacts, weak env permissiveness, direct handler export, a stale package middleware helper, and auth UI that ignores callback URLs. Before building workflow features, auth must be boring, documented, and aligned with current Better Auth and Next.js 16 guidance.

## Decision

Keep Better Auth `1.6.11` as the stable auth baseline.

Refactor the reset shell to:

- use `toNextJsHandler(auth)` for the Next.js App Router auth route;
- add `nextCookies()` as the last Better Auth plugin;
- enforce `BETTER_AUTH_SECRET` as a 32+ character env value;
- require or locally derive `BETTER_AUTH_URL`;
- use current social provider env names: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`;
- keep Google/GitHub providers disabled unless both credentials exist;
- use `getSessionCookie(request)` in proxy for optimistic redirects;
- keep real authorization in server layout/API/session checks;
- respect safe relative `callbackUrl` values in login/signup/social flows;
- use `requestPasswordReset` and `resetPassword` for password reset;
- remove automatic default API-key creation during signup.

## Consequences

Positive:

- Aligns auth route, proxy, cookies, social providers, and password reset with current docs.
- Keeps social login ready without requiring credentials in local reset validation.
- Removes hidden side effects from signup.
- Keeps a clean separation between optimistic redirect and real server-side authorization.

Negative:

- Local builds now require a valid-length `BETTER_AUTH_SECRET`.
- Existing environments using `GITHUB_ID`/`GITHUB_SECRET` need migration to `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`.
- Better Auth email-send timing hardening remains a follow-up until we pick the serverless `waitUntil` mechanism.

## Alternatives Considered

- Replace Better Auth: rejected because the reset already has working Better Auth schemas and route handler, and the user explicitly wants Better Auth kept.
- Keep direct `auth.handler` export: rejected because current Better Auth Next docs show `toNextJsHandler(auth)` for App Router route handlers.
- Use DB-backed session validation in proxy: rejected for now because the active authenticated layout already validates the session and Better Auth docs warn that cookie-only proxy checks are optimistic.
- Keep default API-key generation on user create: rejected because API keys are not part of the reset shell.

## Evidence

- Better Auth latest stable: `npm view better-auth version` returned `1.6.11`.
- Better Auth LLM docs index: https://better-auth.com/llms.txt
- Better Auth LLM Next.js markdown: https://better-auth.com/llms.txt/docs/integrations/next.md
- Better Auth LLM email/password markdown: https://better-auth.com/llms.txt/docs/authentication/email-password.md
- Better Auth LLM Google markdown: https://better-auth.com/llms.txt/docs/authentication/google.md
- Better Auth LLM GitHub markdown: https://better-auth.com/llms.txt/docs/authentication/github.md
- Better Auth LLM Drizzle markdown: https://better-auth.com/llms.txt/docs/adapters/drizzle.md
- Better Auth installation docs: https://better-auth.com/docs/installation
- Better Auth Next.js integration docs: https://better-auth.com/docs/integrations/next
- Better Auth email/password docs: https://better-auth.com/docs/authentication/email-password
- Better Auth Google docs: https://better-auth.com/docs/authentication/google
- Better Auth GitHub docs: https://better-auth.com/docs/authentication/github
- Better Auth organization docs: https://better-auth.com/docs/plugins/organization
- Local source confirms `enabled: false` provider configs are ignored: `packages/auth/node_modules/better-auth/dist/context/create-context.mjs`.

## Impacted Files and Packages

- `packages/auth/keys.ts`
- `packages/auth/src/server.ts`
- `packages/auth/src/client.ts`
- `packages/auth/src/middleware.ts`
- `apps/app/app/api/auth/[...all]/route.ts`
- `apps/app/proxy.ts`
- `apps/app/app/(unauthenticated)/login/page.tsx`
- `apps/app/components/auth/forms/forgot-password-form.tsx`
- `apps/app/.env.example`
- `packages/auth/.env.example`
- reset smoke tests and audit docs

## Validation Checklist

- [x] Run `pnpm --filter @repo/auth typecheck`.
- [x] Run `pnpm --filter app typecheck`.
- [x] Run `pnpm test:smoke`.
- [x] Run default `pnpm --filter app build` with Turbopack.
- [x] Run `git diff --check`.
