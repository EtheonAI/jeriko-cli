# Auth Package Playbook

Package: `@repo/auth`

Date: 2026-05-27

Status: active P2.1 package cleanup

Priority: P2 foundation package

## Ownership

What this package owns:

- Better Auth server configuration;
- Better Auth React client exports;
- Next.js auth route handler adapter;
- session cookie helper for proxy;
- auth env keys;
- auth email hooks through `@repo/email`;
- reusable auth validation schemas.

What this package must not own:

- app proxy route policy;
- generic UI provider composition;
- design-system primitives;
- app route UI;
- app/web navigation config types;
- database schema beyond consuming `@repo/database` public exports.

## Current Surface

Exports:

- `@repo/auth`
- `@repo/auth/server`
- `@repo/auth/client`
- `@repo/auth/next`
- `@repo/auth/validations`
- `@repo/auth/keys`

Provider SDKs:

- `better-auth`

Env keys:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- optional Google/GitHub OAuth keys.

## Sources Checked

| Source                                                       | Type              | Checked Date | Claim Used                                                                                                    |
| ------------------------------------------------------------ | ----------------- | -----------: | ------------------------------------------------------------------------------------------------------------- |
| `https://better-auth.com/llms.txt`                           | Official llms.txt |   2026-05-27 | Use Better Auth official docs and AI resources before auth changes.                                           |
| `https://better-auth.com/docs/installation`                  | Official docs     |   2026-05-27 | Better Auth requires secret/base URL, exported auth instance, DB adapter, route handler, and client instance. |
| `https://better-auth.com/docs/basic-usage`                   | Official docs     |   2026-05-27 | Email/password and social sign-on are first-class flows.                                                      |
| `https://better-auth.com/docs/authentication/email-password` | Official docs     |   2026-05-27 | Verification and password reset are Better Auth config hooks and client APIs.                                 |
| `https://better-auth.com/docs/integrations/next`             | Official docs     |   2026-05-27 | App Router uses `toNextJsHandler(auth)`; Next 16 proxy route policy is app-owned.                             |
| `https://better-auth.com/docs/authentication/google`         | Official docs     |   2026-05-27 | OAuth redirect URI depends on `baseURL`.                                                                      |
| `https://better-auth.com/docs/authentication/github`         | Official docs     |   2026-05-27 | GitHub provider requires app credentials and email access.                                                    |
| `https://better-auth.com/docs/plugins/organization`          | Official docs     |   2026-05-27 | Organization plugin owns org/member/invitation lifecycle.                                                     |
| `npm view better-auth version dist-tags --json`              | Registry metadata |   2026-05-27 | Stable latest `better-auth` is `1.6.11`, matching the package.                                                |
| `npm view @t3-oss/env-nextjs version dist-tags --json`       | Registry metadata |   2026-05-27 | Stable latest `@t3-oss/env-nextjs` is `0.13.11`, matching the package.                                        |
| Local package audit                                          | Repo evidence     |   2026-05-27 | Middleware export, stale `lib/validations`, and stale `types/index.d.ts` have no active source consumers.     |

## Local Audit

Commands:

```bash
rg "@repo/auth/middleware|authMiddleware|publicRoutes|isPublicRoute" apps packages docs
rg "packages/auth/lib|lib/validations/auth|userAuthSchema|types/index.d.ts|DashboardConfig|MarketingConfig" packages apps docs
pnpm outdated --filter @repo/auth --format json
pnpm --filter @repo/auth typecheck
```

Findings:

- Core Better Auth package dependencies are current.
- `src/server.ts`, `src/client.ts`, `src/next.ts`, `keys.ts`, and `src/validations/auth.ts` are the active package surface.
- `@repo/auth/middleware` is unused and duplicates app proxy route policy.
- `lib/validations/auth.ts` is a stale duplicate with weaker password rules.
- `types/index.d.ts` is stale app/web config typing and imports the app-local `@/components/icons` alias from inside a package.
- No app imports Better Auth directly; apps consume public `@repo/auth` exports.

## Decision

Verdict: keep Better Auth core and remove stale package surfaces.

Reason:

- Auth package is correctly the Better Auth owner.
- App route protection policy belongs in app proxy/layout/API code, not shared auth package middleware.
- Stale duplicate validation and stale app/web types violate package ownership.
- Adding package-local validation tests gives reusable auth contracts proof without requiring DB/OAuth integration.

## P2.1 Refactor Checklist

- [x] Research current Better Auth docs and npm latest.
- [x] Audit auth package exports, deps, env, tests, and active consumers.
- [x] Write MADR-086.
- [x] Remove `@repo/auth/middleware` export.
- [x] Delete `src/middleware.ts`.
- [x] Delete stale `lib/validations/auth.ts`.
- [x] Delete stale `types/index.d.ts`.
- [x] Add package-local validation tests under `packages/auth/tests`.
- [x] Include auth package in root Vitest projects.
- [x] Verify no app imports `better-auth` directly.
- [x] Run `pnpm --filter @repo/auth typecheck`.
- [x] Run `pnpm --filter @repo/auth test`.
- [x] Run root `pnpm test`.
- [x] Run affected `apps/app` typecheck.

## Validation

```bash
pnpm --filter @repo/auth typecheck
pnpm --filter @repo/auth test
pnpm --filter app typecheck
pnpm test
pnpm --filter app exec next build --webpack
```

Latest validation:

- `pnpm --filter @repo/auth typecheck` passed.
- `pnpm --filter @repo/auth test` passed: 1 file / 5 tests.
- `pnpm --filter app typecheck` passed.
- root `pnpm test` passed: 14 files / 50 tests.
- `apps/app` `next build --webpack` passed with the existing Sentry/OpenTelemetry warning.
- Default Turbopack `next build` stayed silent for several minutes and was terminated; defer to the Next/app build phase.

## Open Risks

- Full auth flow tests still need database/email/OAuth integration proof.
- Organization invitation route behavior is not implemented yet.
- Better Auth schema conformance belongs to P2.2 database.
