# MADR-053: Better Auth Latest-Docs Auth Flow Cleanup

Status: Accepted

Date: 2026-05-26

## Context

R10 left the reset shell buildable and route-correct, but R11 needs to make the auth surface boring and current before new workflow product work starts. The user explicitly asked to use Better Auth `llms.txt`, Better Auth AI resources, latest docs, and not preserve stale auth patterns.

The current app has a custom email-existence API used by the login page. Better Auth current docs already provide enumeration protection for sign-up when `requireEmailVerification: true` or `autoSignIn: false`. This repo has both settings, so the custom preflight is not needed and weakens the security posture.

## Decision

Keep Better Auth `1.6.11` as the latest stable baseline and clean the app auth flow around current docs:

- remove `/api/auth/check-email`;
- remove the route-local client helper that calls it;
- keep explicit sign-in/sign-up mode in the login UI;
- use Better Auth's sign-in/sign-up responses instead of account-existence probing;
- convert safe relative callback paths to same-origin absolute URLs before calling Better Auth client methods;
- queue auth emails with Next.js `after`;
- revoke other sessions on password reset.

## Consequences

Positive:

- Removes a custom API route from the reset shell.
- Avoids leaking credential-account existence before Better Auth handles the request.
- Reduces login state and removes a precheck network hop.
- Aligns email send timing with Better Auth and Next.js current guidance.
- Makes password reset safer by invalidating other sessions.

Negative:

- The login page no longer auto-detects whether an email should sign in or sign up.
- Users must choose sign-in or sign-up mode explicitly.
- Email delivery failures become post-response failures and must be observed through logs/observability rather than blocking the auth response.

## Alternatives Considered

- Keep `/api/auth/check-email` with padding and rate limits: rejected because it still returns existence state to the client.
- Use full DB session validation in `proxy.ts`: rejected for R11 because Better Auth docs recommend cookie-only proxy checks for redirects and server-side page/API checks for real authorization.
- Upgrade to Better Auth beta: rejected because npm latest stable is `1.6.11`; `1.7.0-beta.3` is not the stable production baseline.

## Evidence

- Better Auth latest stable: `pnpm view better-auth version dist-tags --json` returned `latest: 1.6.11`.
- Better Auth AI resources: `https://better-auth.com/docs/ai-resources/skills`
- Better Auth LLM index: `https://better-auth.com/llms.txt`
- Better Auth Next.js integration: `https://better-auth.com/docs/integrations/next`
- Better Auth email/password: `https://better-auth.com/docs/authentication/email-password`
- Next.js `after`: `https://nextjs.org/docs/app/api-reference/functions/after`

## Validation Checklist

- [x] `pnpm --filter @repo/auth typecheck`
- [x] `pnpm --filter app typecheck`
- [x] Targeted ESLint for touched auth files
- [x] `pnpm test:smoke`
- [x] `pnpm --filter app build`
- [x] `git diff --check`
