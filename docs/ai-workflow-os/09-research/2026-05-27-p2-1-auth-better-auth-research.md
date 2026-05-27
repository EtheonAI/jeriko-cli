# P2.1 Auth Package Research

Date: 2026-05-27

Package: `@repo/auth`

Status: completed before P2.1 auth cleanup

## Sources Checked

| Source                                                     | Type                 | Evidence Used                                                                                                                                                                                                    |
| ---------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://better-auth.com/llms.txt                           | Official LLM index   | Better Auth exposes current docs and AI resources; use official docs before changing auth behavior.                                                                                                              |
| https://better-auth.com/docs/installation                  | Official docs        | Better Auth uses `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, an exported `auth` instance, database adapter, route handler, and client instance.                                                                     |
| https://better-auth.com/docs/basic-usage                   | Official docs        | Built-in email/password and social provider auth are primary capabilities. `signUp.email`, `signIn.email`, `signOut`, and `signIn.social` are client-level APIs.                                                 |
| https://better-auth.com/docs/authentication/email-password | Official docs        | Email verification and password reset are configured in `emailVerification.sendVerificationEmail` and `emailAndPassword.sendResetPassword`; reset uses `requestPasswordReset` then `resetPassword` with a token. |
| https://better-auth.com/docs/integrations/next             | Official docs        | Next App Router mounts Better Auth through `toNextJsHandler(auth)`; server components/actions use `auth.api`; Next 16 proxy can either do full session validation or optimistic cookie checks.                   |
| https://better-auth.com/docs/authentication/google         | Official docs        | Google OAuth requires matching redirect URI and `baseURL` to avoid redirect mismatch.                                                                                                                            |
| https://better-auth.com/docs/authentication/github         | Official docs        | GitHub OAuth requires client id/secret and, for GitHub Apps, email read permission.                                                                                                                              |
| https://better-auth.com/docs/plugins/organization          | Official docs        | Organization plugin owns org, member, invitation, and invitation email lifecycle. Legacy organization creation hooks are deprecated in favor of `organizationHooks`.                                             |
| https://better-auth.com/docs/ai-resources/skills           | Official docs        | Better Auth publishes agent skills; this repo does not install them during package cleanup, but the docs are a source reference.                                                                                 |
| `npm view better-auth version dist-tags --json`            | Registry             | `latest` is `1.6.11`; installed package spec already targets `^1.6.11`. `beta` is `1.7.0-beta.3` and is not the stable target.                                                                                   |
| `npm view @t3-oss/env-nextjs version dist-tags --json`     | Registry             | `latest` is `0.13.11`; installed package spec already targets `^0.13.11`.                                                                                                                                        |
| `pnpm outdated --filter @repo/auth --format json`          | Registry/local proof | No outdated direct dependencies reported for the auth package.                                                                                                                                                   |

## Research Notes

Better Auth remains a good fit for this repo because it is framework-integrated but still owned inside the app, supports email/password, social sign-on, sessions, organization/team behavior, verification, and password reset without handing the whole auth surface to a hosted provider.

For Next.js 16, route protection belongs at the application boundary. Better Auth's docs explicitly describe proxy checks as either full session validation or optimistic cookie redirects. This repo currently uses optimistic cookie checks in `apps/app/proxy.ts` and validates real sessions in layouts/data access through `auth.api.getSession`. That is a valid split as long as protected pages and route handlers never trust the proxy alone.

The `nextCookies()` plugin is still appropriate because the auth package exposes Better Auth APIs that may be called from server actions or route handlers that need Set-Cookie propagation.

`@repo/auth` should not own product route lists or UI shell routing. Those decisions are app-local because public routes differ between `apps/app`, `apps/web`, future docs, and any future admin/CMS app.

## Version Verdict

- Keep `better-auth@1.6.11` as the stable latest.
- Keep `@t3-oss/env-nextjs@0.13.11`.
- Do not adopt Better Auth `1.7.0-beta.3` in this cleanup phase.
- Do not install the external Better Auth skill pack into the repo during package cleanup.

## Implementation Guidance

- Keep `@repo/auth/server` as the only Better Auth server config owner.
- Keep `@repo/auth/client` as the only Better Auth React client owner.
- Keep `@repo/auth/next` for route-handler and session-cookie adapter helpers.
- Keep app login/signup/forgot/reset/verify UI in `apps/app`.
- Remove dead package files that import app-local aliases or duplicate old auth schemas.
- Remove package-level middleware/proxy policy exports if there are no consumers; route protection belongs to apps.
