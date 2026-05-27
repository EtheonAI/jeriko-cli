# apps/app Reset Research - next-forge Shape, Next.js 16, T3 Env, Better Auth

Date researched: 2026-05-25

## Scope

This note validates the reset direction for `apps/app` before more source deletion:

- Keep the monorepo `apps/*` and `packages/*` shape.
- Reset `apps/app` to a clean product shell, not the old Manus clone application.
- Keep Better Auth, not Clerk.
- Keep T3 Env as the typed env contract.
- Treat workflow product features as new modules, not as renamed legacy chat/pages.

## Sources

| Source                                                                | Type                               | Evidence                                                                                                                                                                                                                                                                   | Implementation impact                                                                                                                 |
| --------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| https://www.next-forge.com/docs/structure                             | Official next-forge docs           | next-forge is a Turborepo monorepo; each app is independently deployable and self-contained; each app should have an `env.ts` that composes package env contracts.                                                                                                         | Keep `apps/app`; do not move it into `src/app`; keep package env composition at app root.                                             |
| https://github.com/vercel/next-forge/tree/main/apps/app               | Source repository                  | `apps/app` is the application surface inside a multi-app monorepo.                                                                                                                                                                                                         | Use next-forge as structural reference, not as a direct copy.                                                                         |
| https://vercel.com/academy/production-monorepos/next-forge-patterns   | Vercel Academy                     | next-forge is presented as a production monorepo pattern with app and shared package separation.                                                                                                                                                                           | Shared logic belongs in packages; product route code belongs under the app.                                                           |
| https://nextjs.org/docs/app/getting-started/project-structure         | Official Next.js docs              | `app` is the App Router directory; `src` is optional; route groups and private folders are first-class structure tools.                                                                                                                                                    | Keeping `apps/app/app` is valid; `apps/app/src/app` is optional and not required.                                                     |
| https://nextjs.org/docs/app/api-reference/file-conventions/proxy      | Official Next.js docs              | `proxy.ts` replaces the middleware convention and runs before routes for auth/redirect logic.                                                                                                                                                                              | Keep `apps/app/proxy.ts`; do not reintroduce `middleware.ts`.                                                                         |
| https://nextjs.org/docs/app/guides/upgrading/version-16               | Official Next.js docs              | Next 16 codemod covers config, ESLint CLI, proxy migration, stabilized APIs; Node 20.9+ and TS 5+ are required; Turbopack is default.                                                                                                                                      | Keep Next 16.2.6 target; run type/build gates after reset; do not build new code against older conventions.                           |
| https://better-auth.com/docs/integrations/next                        | Official Better Auth docs          | Better Auth recommends `/api/auth/[...all]` with `toNextJsHandler(auth)`, `createAuthClient` from `better-auth/react`, server `auth.api.getSession({ headers: await headers() })`, `nextCookies()` when server actions need cookie writes, and proxy/page checks for auth. | Keep `app/api/auth/[...all]`; keep Better Auth server/client package; add `nextCookies()` later if server actions do sign-in/sign-up. |
| https://www.next-forge.com/docs/migrations/authentication/better-auth | Official next-forge migration docs | Better Auth migration removes Clerk dependencies, installs Better Auth in `@repo/auth`, adds `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, and can include `nextCookies()`.                                                                                                  | Verify no active Clerk dependency remains; keep Better Auth in `packages/auth`.                                                       |
| https://env.t3.gg/docs/nextjs                                         | Official T3 Env docs               | Next.js package requires explicit env access, supports build-time validation in `next.config.ts`, and recommends importing the env file in config for Next 16+.                                                                                                            | Keep `apps/app/env.ts`; prefer `@/env` inside app code instead of direct `process.env` outside env schema boundaries.                 |
| https://env.t3.gg/docs/core                                           | Official T3 Env docs               | `emptyStringAsUndefined: true` is recommended for new projects; core works for non-Next packages.                                                                                                                                                                          | Keep package `keys.ts` contracts and app-level composition.                                                                           |
| `npm view next version`                                               | Registry metadata                  | Latest returned `16.2.6`.                                                                                                                                                                                                                                                  | Matches user target and current `apps/app/package.json`.                                                                              |
| `npm view better-auth version`                                        | Registry metadata                  | Latest returned `1.6.11`.                                                                                                                                                                                                                                                  | Current `@repo/auth` uses `^1.6.11`; no upgrade required for Better Auth package version.                                             |
| `npm view @t3-oss/env-nextjs version`                                 | Registry metadata                  | Latest returned `0.13.11`.                                                                                                                                                                                                                                                 | Current `apps/app` and `@repo/auth` use `^0.13.11`; no upgrade required for T3 Env package version.                                   |

## Local Findings

Current active versions:

- `apps/app/package.json`: `next` is `16.2.6`.
- `apps/app/package.json`: `react` and `react-dom` are `19.2.6`.
- `apps/app/package.json`: `@t3-oss/env-nextjs` is `^0.13.11`.
- `packages/auth/package.json`: `better-auth` is `^1.6.11`.

Current auth shape:

- `packages/auth/src/server.ts` uses `betterAuth`, Drizzle adapter, organization plugin, email/password, social providers, and DB hooks.
- `packages/auth/src/client.ts` uses `createAuthClient` from `better-auth/react`.
- `apps/app/app/api/auth/[...all]/route.ts` exists and should stay.
- `apps/app/proxy.ts` exists and uses Better Auth session cookie checks.
- `rg` found no active `@clerk/*` package references in the inspected `apps/app`, `packages/auth`, root package files, workspace file, or Turbo config.

Current reset blockers:

- `apps/app` still contains old Manus chat, sandbox, files, collaboration, websocket, search, project, and session code.
- `apps/app/__tests__` and `apps/app/e2e` still target deleted chat/settings/canvas surfaces.
- `apps/app/lib/store` still has dozens of Redux slices from the old app.
- `apps/app/app/api` still exposes old API routes unrelated to the clean reset shell.
- `packages/auth/src/server.ts` and `packages/auth/src/client.ts` still read `process.env` directly; reset target is to route application env access through T3 Env contracts.

## Claims Validated

- It is valid to reset `apps/app` instead of moving to `src/app`. Next.js treats `src` as optional, and next-forge keeps app source under each app surface.
- It is valid to keep Better Auth as the auth provider. Better Auth has current official Next.js 16 guidance and current package latest is already installed.
- It is valid to delete legacy pages first. The old routes and tests encode a Manus clone product model, while the target platform is a workflow OS.
- It is not valid to keep old chat/sandbox/search APIs as active code just because future platform features need browsing, files, or execution. Those capabilities should return as new workflow/tool modules with new contracts.

## Implementation Rules From Research

- Do not expose legacy routes unless they are part of the reset MVP.
- Keep `app/api/auth/[...all]/route.ts`, `proxy.ts`, route groups, top-level `env.ts`, app-level `README.md`, root layout/error/loading/metadata files, and product shell.
- Keep Better Auth package, but refactor direct env reads after the route/API deletion pass.
- Keep feature flags and package env composition, but remove old product consumers while resetting app pages.
- Prefer server components for pages by default; add `"use client"` only at interactive component boundaries.
- Route-local components should live near their page once new product modules are created.

## Open Questions

- Whether the first reset shell should include only `/workflows`, or `/workflows`, `/approvals`, and `/connections`.
- Whether billing/Stripe should remain active during reset or be reintroduced after the workflow kernel is drafted.
- Whether tRPC should survive the reset or be removed from `apps/app` until a new API contract is defined.
- Whether Redux should be removed entirely from `apps/app` during reset, replaced later by route-local state and TanStack Query where useful.
