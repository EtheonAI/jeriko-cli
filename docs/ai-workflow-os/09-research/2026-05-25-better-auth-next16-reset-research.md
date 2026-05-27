# Better Auth Next.js 16 Reset Research

Date researched: 2026-05-25

## Sources

| Source                              | Type                          | URL / command                                                            | Claim checked                                                                                                                                                                  |
| ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Better Auth LLM index               | Official docs, LLM source map | https://better-auth.com/llms.txt                                         | Confirms canonical markdown docs paths for adapters, auth methods, integrations, plugins, and concepts.                                                                        |
| Better Auth Next.js markdown        | Official docs, LLM markdown   | https://better-auth.com/llms.txt/docs/integrations/next.md               | Confirms `toNextJsHandler`, `nextCookies()` last, proxy guidance, and Next.js 16 compatibility.                                                                                |
| Better Auth email/password markdown | Official docs, LLM markdown   | https://better-auth.com/llms.txt/docs/authentication/email-password.md   | Confirms `requestPasswordReset`, `resetPassword`, `callbackURL`, email verification, and enumeration protection details.                                                       |
| Better Auth Google markdown         | Official docs, LLM markdown   | https://better-auth.com/llms.txt/docs/authentication/google.md           | Confirms provider env names, base URL requirement, and callback URL shape.                                                                                                     |
| Better Auth GitHub markdown         | Official docs, LLM markdown   | https://better-auth.com/llms.txt/docs/authentication/github.md           | Confirms provider env names, callback URL shape, and email permission requirement.                                                                                             |
| Better Auth Drizzle markdown        | Official docs, LLM markdown   | https://better-auth.com/llms.txt/docs/adapters/drizzle.md                | Confirms Drizzle adapter schema mapping for custom table names.                                                                                                                |
| npm registry                        | Registry metadata             | `npm view better-auth version`; `npm view better-auth dist-tags --json`  | Latest stable Better Auth is `1.6.11`; `1.7.0-beta.3` is beta, not stable.                                                                                                     |
| Better Auth installation            | Official docs                 | https://better-auth.com/docs/installation                                | `BETTER_AUTH_SECRET` must be high entropy and at least 32 characters; `BETTER_AUTH_URL` should be set; Better Auth supports Drizzle adapters and `/api/auth/[...all]`.         |
| Better Auth Next.js integration     | Official docs                 | https://better-auth.com/docs/integrations/next                           | App Router route handlers should use `toNextJsHandler(auth)`; `nextCookies()` should be the last plugin when server actions need cookie writes; Next.js 16 proxy is supported. |
| Better Auth email/password          | Official docs                 | https://better-auth.com/docs/authentication/email-password               | Enable `emailAndPassword`; sign-in/sign-up support `callbackURL`; manual verification supports `callbackURL`; password reset uses `requestPasswordReset` and `resetPassword`.  |
| Better Auth Google provider         | Official docs                 | https://better-auth.com/docs/authentication/google                       | Google OAuth needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `baseURL`, and callback `/api/auth/callback/google`.                                                            |
| Better Auth GitHub provider         | Official docs                 | https://better-auth.com/docs/authentication/github                       | GitHub OAuth needs `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, callback `/api/auth/callback/github`, and `user:email` / email-read permission.                                 |
| Better Auth organization plugin     | Official docs                 | https://better-auth.com/docs/plugins/organization                        | Server and client organization plugins are both required for org/team APIs.                                                                                                    |
| Installed Better Auth source        | Local package source          | `packages/auth/node_modules/better-auth/dist/context/create-context.mjs` | Provider entries with `enabled === false` are ignored; missing provider credentials warn.                                                                                      |
| Installed Better Auth types         | Local package source          | `packages/auth/node_modules/better-auth/dist/api/routes/sign-in.d.mts`   | `signIn.social` accepts `callbackURL`, `newUserCallbackURL`, and `errorCallbackURL`.                                                                                           |

## Current Local Findings

- `@repo/auth` is already on `better-auth@^1.6.11`, matching latest stable.
- `BETTER_AUTH_SECRET` is optional in `packages/auth/keys.ts`; this lets weak/default secrets reach runtime.
- `BETTER_AUTH_URL` is optional with a fallback in `server.ts`; OAuth docs require a correct base URL to prevent provider callback mismatch.
- `apps/app/app/api/auth/[...all]/route.ts` exports `auth.handler` directly instead of the documented `toNextJsHandler(auth)` wrapper.
- `packages/auth/src/server.ts` already enables email/password, email verification, Google, GitHub, organization, cookie cache, and account linking.
- `nextCookies()` is not present; add it last in the plugin chain for future server action cookie writes.
- `apps/app/proxy.ts` manually reads `better-auth.session_token`; docs provide `getSessionCookie(request)` for this optimistic redirect layer.
- Protected app layout already validates the real session with `auth.api.getSession`, so proxy cookie check remains only an optimistic redirect, not the security boundary.
- `apps/app/app/(unauthenticated)/login/page.tsx` ignores `callbackUrl` from proxy redirects.
- `forgot-password-form.tsx` uses a hand-cast `forgetPassword` client method. Current docs use `requestPasswordReset`.
- `databaseHooks.user.create` silently creates an API key for every signup; API keys are not part of the reset shell.
- `packages/auth/src/middleware.ts` is stale (`/register`) and performs a DB/session call in middleware code that is not the active app proxy.

## Implemented Cleanup

- `BETTER_AUTH_SECRET` now requires at least 32 characters in the T3 env boundary.
- The auth route now uses `toNextJsHandler(auth)`.
- `nextCookies()` is now last in the Better Auth plugin list.
- Google/GitHub env names now match Better Auth docs.
- Proxy now uses `getSessionCookie(request)` for optimistic redirects.
- Login/sign-up/social flows now honor safe relative `callbackUrl` values.
- Password reset form now uses `requestPasswordReset`.
- The reset shell no longer auto-creates API keys on user signup.

## Decision Impact

- Keep Better Auth as the auth provider.
- Do not install a beta Better Auth release.
- Enforce the auth env boundary instead of using Better Auth defaults.
- Keep Google/GitHub social providers optional at runtime, but configure them with current env names.
- Keep the route-group split; security remains proxy + authenticated layout + server/API auth checks.
- Remove hidden default API-key side effects during signup.
- Use official client method names in app forms.

## Open Questions

- Email sending hooks still await `sendEmail`. Better Auth recommends avoiding awaited email sends for timing protection and using `waitUntil` or similar on serverless. This should be handled in the Vercel Functions/email delivery phase so email delivery is not accidentally dropped.
- Organization invite acceptance has no active reset-shell route. Keep the plugin, but do not expose org UI until org contracts are defined.
