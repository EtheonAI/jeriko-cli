# R18 App Support Files Research

Date researched: 2026-05-26

Scope: `apps/app` support files around the reset shell: `proxy.ts`, `env.ts`, `lib/dal.ts`, route handlers, instrumentation, Vercel config, tests, and app-level shared files.

## Sources

| Source                                                                         | Type                        | Claim used                                                                                                                                                                                   |
| ------------------------------------------------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://nextjs.org/docs/app/api-reference/file-conventions/proxy`             | Official Next.js docs       | Next 16 uses `proxy.ts`; `config.matcher` must be statically analyzable; proxy is suitable for request-boundary redirects and can be unit tested.                                            |
| `https://nextjs.org/docs/app/getting-started/proxy`                            | Official Next.js docs       | Proxy should not be used as full session management or slow data fetching; use it for optimistic checks and request-boundary routing.                                                        |
| `https://nextjs.org/docs/app/api-reference/file-conventions/route`             | Official Next.js docs       | Route handlers own API endpoints, use named HTTP exports, and should stay separate from page UI routes.                                                                                      |
| `https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation` | Official Next.js docs       | `instrumentation.ts` can export `register`; async observability initialization is valid.                                                                                                     |
| `https://better-auth.com/docs/integrations/next`                               | Official Better Auth docs   | Better Auth recommends `api/auth/[...all]/route.ts` with `toNextJsHandler`; Proxy may use `getSessionCookie` only as an optimistic redirect and pages/routes must validate the real session. |
| `https://better-auth.com/docs/concepts/cookies`                                | Official Better Auth docs   | Default session cookie prefix is `better-auth`, with `session_token` storing the session token unless auth config changes it.                                                                |
| `https://env.t3.gg/docs/nextjs`                                                | Official T3 Env docs        | `@t3-oss/env-nextjs` is the correct Next.js env contract package; `runtimeEnv`/`experimental__runtimeEnv` are the documented boundaries where `process.env` is read.                         |
| `https://vercel.com/docs/llms-full.txt`                                        | Official Vercel docs bundle | Vercel docs confirm environment-variable discipline, Vercel Toolbar/Flags Explorer requirements, and `ignoreCommand` behavior.                                                               |

## Findings

1. Proxy shape is mostly correct.
   The app uses `proxy.ts`, not deprecated `middleware.ts`. It uses `getSessionCookie` only for optimistic redirects, and the authenticated layout validates the real Better Auth session.

2. Proxy public bypasses should be explicit.
   `/api/auth` is explicit. `/api/health` should be explicit so liveness probes do not redirect to `/login`. `/.well-known/vercel/flags` should be explicit so Vercel Toolbar reaches the flags discovery endpoint and the endpoint itself can return `401` when authorization is missing.

3. Static asset bypass should be named, not hidden inside `pathname.includes(".")`.
   The matcher already excludes many static assets, but the runtime check is easier to audit if it is an explicit public-file pattern.

4. Health route should communicate its current contract honestly.
   The code exposes `GET /api/health` for liveness and `POST /api/health` for database readiness, but its comment says `GET /api/health/ready`, which is not the active route.

5. `env.ts` should remain the app env contract.
   Direct `process.env` reads inside `env.ts` and package `keys.ts` files are intentional T3 Env runtime boundaries. App/runtime code should import `env` instead.

6. `lib/dal.ts` is aligned with Better Auth docs.
   It uses `auth.api.getSession({ headers: await headers() })` and stays `server-only`. This should remain the authenticated server-side session boundary for the app.

7. Instrumentation files are acceptable for reset.
   `instrumentation.ts` delegates to the observability package. The client instrumentation initializes Sentry and analytics lazily through package wrappers. No R18 code change is required.

8. App icons contain one stale helper.
   `apps/app/components/icons.tsx` exports `Icons.spinner`, but the app now uses `@repo/design-system/components/ui/spinner` for loading states. The app-level spinner should be removed.

9. Skill guidance needs freshness discipline.
   Local bundled skills are useful but can lag official docs. If a skill conflicts with official docs, registry metadata, installed package types, or repo MADRs, the repo standards/playbooks must record the correction before implementation. Plugin-cached skills should not be edited directly as part of app cleanup.

## Implementation Impact

- Refactor `proxy.ts` into named helpers/constants.
- Explicitly allow `/api/auth`, `/api/health`, and `/.well-known/vercel/flags` through Proxy.
- Keep Better Auth session validation in layout/DAL, not Proxy.
- Keep `env.ts` T3 Env centralized.
- Fix health route comments and response shape without changing endpoint paths.
- Add smoke coverage for public support routes.
- Remove unused `Icons.spinner`.
- Add a skill-freshness rule to engineering standards.

## Open Questions

- Whether `POST /api/health` should become `/api/health/ready` later. R18 does not change endpoint paths to avoid deployment/probe churn.
- Whether Vercel Toolbar and Flags Explorer should remain enabled in the reset app. Current decision: keep feature flags.
- Whether instrumentation should be hardened with OpenTelemetry later. Current decision: defer to observability phase.
