# Apps/App R18 Support Files Audit

Date: 2026-05-26

Scope: `apps/app` support files after R17 authenticated shell cleanup.

## Audited Files

- `apps/app/env.ts`
- `apps/app/proxy.ts`
- `apps/app/lib/dal.ts`
- `apps/app/instrumentation.ts`
- `apps/app/instrumentation-client.ts`
- `apps/app/next.config.ts`
- `apps/app/sentry.server.config.ts`
- `apps/app/sentry.edge.config.ts`
- `apps/app/app/api/auth/[...all]/route.ts`
- `apps/app/app/api/health/route.ts`
- `apps/app/app/.well-known/vercel/flags/route.ts`
- `apps/app/components/icons.tsx`
- `apps/app/test/*`
- `apps/app/vercel.json`
- `apps/app/.env.example`

## Findings

| Area              | Finding                                                                                                                                     | Decision                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `env.ts`          | Uses `@t3-oss/env-nextjs` and extends active package key contracts. Direct `process.env` appears only inside the env contract.              | Keep.                       |
| Proxy auth        | Uses `getSessionCookie` as an optimistic redirect check. This matches Better Auth guidance when server pages/routes validate real sessions. | Keep.                       |
| Proxy bypasses    | `/api/auth` is explicit, but `/api/health` and Vercel flags discovery are not explicit.                                                     | Refactor.                   |
| Proxy asset check | `pathname.includes(".")` hides the intent of static file bypasses.                                                                          | Replace with named pattern. |
| DAL               | `getSession` uses `auth.api.getSession({ headers })`, is cached, and is `server-only`.                                                      | Keep.                       |
| Auth route        | `api/auth/[...all]/route.ts` uses Better Auth `toNextJsHandler`.                                                                            | Keep.                       |
| Health route      | `GET /api/health` is liveness and `POST /api/health` is readiness, but the comment says `/api/health/ready`.                                | Fix comments/shape.         |
| Flags route       | `getFlags` verifies Authorization itself. Proxy should allow the endpoint through.                                                          | Refactor Proxy.             |
| Instrumentation   | App files delegate to package wrappers and do not block reset.                                                                              | Keep; harden later.         |
| Vercel config     | `ignoreCommand` matches Vercel docs behavior: exit `0` skips, exit `1` builds.                                                              | Keep.                       |
| Test env          | `NEXT_PUBLIC_DOCS_URL` test default uses port `3002`; docs app is `3004`.                                                                   | Fix.                        |
| Icons             | `Icons.spinner` duplicates design-system `Spinner` and is unused.                                                                           | Remove.                     |

## Keep

- Centralized `@/env`.
- `proxy.ts` file and named `proxy` export.
- Better Auth route handler.
- `server-only` DAL.
- App-level social auth icons.
- Vercel `ignoreCommand`.
- Instrumentation wrappers.

## Refactor

- Proxy helper functions/constants.
- Health route comments and response helper.
- Support route tests.
- Test env docs URL.
- Skill freshness in standards.

## Delete / Gate

- Remove unused `Icons.spinner`.
- Do not add new packages.
- Do not move support logic into product routes.
- Do not introduce workflow/sandbox/search/file surfaces in R18.

## Honest Limits

- This is not a full observability hardening pass.
- This is not feature-flag package cleanup.
- This is not a deployment probe migration.
- This is not full root lint/build proof.

## Validation Results

- `pnpm --filter app typecheck`: passed.
- `pnpm test:smoke`: passed, 4 files and 15 tests.
- Targeted ESLint for changed support files: passed.
- `pnpm --filter app build`: passed on Next `16.2.6` Turbopack with documented dummy env.
- `process.env` app scan: only `apps/app/env.ts` and `apps/app/test/setup-env.ts`.
- `Icons.spinner` / `Loader2` app scan: no matches.
- Forbidden old active product route directory scan under `apps/app/app`: no matches.
- `git diff --check`: passed.
