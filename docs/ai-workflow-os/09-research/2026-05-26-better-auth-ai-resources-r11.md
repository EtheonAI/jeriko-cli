# Better Auth AI Resources R11 Research

Date researched: 2026-05-26

Scope: `packages/auth` and `apps/app` unauthenticated auth routes.

## Sources

| Source                                                                                          | Type                                                        | Claim checked                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://better-auth.com/llms.txt`                                                              | Official LLM docs index                                     | Confirms current markdown paths for Next.js, email/password, cookies, session, OAuth, plugins, and AI resources.                                                                                                                                      |
| `https://better-auth.com/docs/ai-resources/skills`                                              | Official AI-resource docs                                   | Confirms Better Auth publishes coding-assistant skills and tells agents to consult Better Auth docs for latest APIs.                                                                                                                                  |
| `https://raw.githubusercontent.com/better-auth/skills/main/better-auth/best-practices/SKILL.md` | Official Better Auth skill                                  | Confirms env, adapter, session, plugin, client, and common-gotcha guidance for coding assistants.                                                                                                                                                     |
| `https://better-auth.com/llms.txt/docs/integrations/next.md`                                    | Official LLM markdown                                       | Confirms App Router route handler uses `toNextJsHandler(auth)`, `nextCookies()` belongs last in the plugin array, Next 16 uses `proxy.ts`, proxy cookie checks are optimistic only, and protected pages/routes must validate the session server-side. |
| `https://better-auth.com/llms.txt/docs/authentication/email-password.md`                        | Official LLM markdown                                       | Confirms `signUp.email`, `signIn.email`, `requestPasswordReset`, `resetPassword`, `callbackURL`, `requireEmailVerification`, email-enumeration protection, and non-blocking email-send guidance.                                                      |
| npm registry                                                                                    | `pnpm view better-auth version dist-tags --json`            | Latest stable Better Auth is `1.6.11`; `1.7.0-beta.3` is beta and should not be installed as the stable baseline.                                                                                                                                     |
| Next.js docs                                                                                    | `https://nextjs.org/docs/app/api-reference/functions/after` | `after` is the current framework API for post-response work in Server Components, Server Actions, Route Handlers, and Proxy.                                                                                                                          |

## Current Version

- Installed package: `better-auth@^1.6.11`.
- npm latest stable: `1.6.11`.
- Decision: do not upgrade to beta; align code with `1.6.11` current docs.

## Findings

- The auth route already uses the documented App Router pattern: `toNextJsHandler(auth)`.
- `nextCookies()` is already present as the last Better Auth plugin.
- The app proxy already uses `getSessionCookie(request)` for optimistic redirect only.
- The authenticated layout validates the real session through `auth.api.getSession({ headers })`, which is the actual security boundary.
- `packages/auth/src/server.ts` still awaits verification/reset/invitation email sends. Better Auth docs warn against awaiting auth email sends because it increases timing risk; Next.js `after` is the correct framework-backed post-response primitive for this app.
- The login flow calls `/api/auth/check-email` before sign-in/sign-up. This reveals whether a credential account exists and bypasses Better Auth's built-in sign-up enumeration protection.
- Better Auth docs say sign-up enumeration protection is active when `requireEmailVerification: true` or `autoSignIn: false`; this repo has both.
- Password reset currently does not revoke other sessions after reset. Better Auth supports `revokeSessionsOnPasswordReset: true`.
- Client auth calls currently pass relative callback URLs. Better Auth examples and the official skill prefer absolute callback URLs; the app should keep validating safe relative paths but convert them to same-origin absolute URLs before sending them to Better Auth.

## R11 Decisions

- Keep Better Auth stable `1.6.11`.
- Remove the custom email-existence preflight from the reset login flow.
- Delete `/api/auth/check-email` from `apps/app`; it is no longer needed by the reset shell.
- Keep the login UX as a simple sign-in/sign-up mode, not a hidden existence lookup.
- Convert safe relative callback paths to same-origin absolute URLs at the client boundary.
- Queue auth emails with Next.js `after` rather than awaiting them inside Better Auth callbacks.
- Revoke other sessions on password reset.

## Validation Checklist

- [x] `pnpm --filter @repo/auth typecheck`
- [x] `pnpm --filter app typecheck`
- [x] Targeted ESLint for touched auth files
- [x] `pnpm test:smoke`
- [x] `pnpm --filter app build`
- [x] `git diff --check`
