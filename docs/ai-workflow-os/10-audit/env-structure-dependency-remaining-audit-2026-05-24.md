# Env, Structure, And Dependency Remaining Audit

Date: 2026-05-24

## Evidence Checked

- T3 Env Next.js docs: https://env.t3.gg/docs/nextjs
- T3 Env core docs: https://env.t3.gg/docs/core
- T3 Env customization docs: https://env.t3.gg/docs/customization
- Next.js project structure docs: https://nextjs.org/docs/app/getting-started/project-structure
- Next.js Server and Client Components docs: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js environment variables docs: https://nextjs.org/docs/app/guides/environment-variables
- Local package/version checks:
  - `pnpm --filter app exec next --version` -> `Next.js v16.2.6`
  - `pnpm list @t3-oss/env-nextjs next react react-dom typescript eslint drizzle-orm drizzle-kit stripe better-auth -r --depth 0`
  - `pnpm outdated -r --format json`
  - `pnpm view @t3-oss/env-nextjs dist-tags versions --json`
  - `pnpm view @t3-oss/env-nextjs@0.13.11 version dist-tags peerDependencies dependencies --json`

## Current Confirmed State

- Next is installed as `16.2.6` in the app workspaces.
- React and React DOM are installed as `19.2.6`.
- TypeScript is installed as `6.0.3`.
- ESLint is installed as `10.2.1`.
- Drizzle ORM is installed as `0.45.2`; Drizzle Kit is installed as `0.31.10`.
- Stripe is installed as `22.1.1` where used.
- Better Auth is installed as `1.6.11`.
- `@t3-oss/env-nextjs` is installed as `0.13.10`.
- `@t3-oss/env-core` is installed as `0.13.11` in `@repo/service-utils`, which is framework-agnostic Fastify/service code and should not use the Next-specific wrapper.
- `@t3-oss/env-nextjs@0.13.11` is reported by `pnpm outdated`, but exact npm resolution still returns 404. The package's own `dist-tags` and `versions` output list `latest: 0.13.10` and no `0.13.11` version. Do not force `0.13.11` until the package exists in the registry.

## Env Cleanup Completed In This Pass

- No direct source imports of `dotenv`, `dotenv/config`, `@next/env`, or `loadEnvConfig` remain in `apps`, `packages`, `services`, or `scripts`.
- `packages/database/src/client.ts`, `packages/database/src/service-client.ts`, `packages/database/drizzle.config.ts`, and database seed/migration scripts now use the T3 database env contract instead of manual `.env` parsing.
- `packages/database/scripts/billing-migration.mjs` was deleted because it duplicated the TypeScript migration and manually parsed `.env`.
- `packages/storage/keys.ts` now uses `@t3-oss/env-nextjs` with `emptyStringAsUndefined: true`, matching the rest of the package env contracts.
- `packages/service-utils/src/env.ts` now uses `@t3-oss/env-core` for shared Fastify/service runtime config.
- `packages/service-utils` no longer has scattered direct env reads for service defaults, gateway secret, JWT secret, internal service secret, Redis config, webhook dispatch URL, or logger environment.
- `packages/service-utils/src/redis/index.ts` no longer uses `@ts-nocheck` or `any` for ioredis clients.
- Validation passed:
  - `pnpm --filter @repo/database typecheck`
  - `pnpm --filter @repo/storage typecheck`
  - `pnpm --filter @repo/service-utils typecheck`
  - `pnpm --filter app typecheck`
  - `pnpm --filter @jeriko/orchestrator typecheck`
  - `pnpm --filter @jeriko/gateway build`
  - Targeted ESLint on touched env/database/storage/script files

## Remaining Env Debt

Direct `process.env` usage remains and must be staged, not blindly replaced.

Counts from current source scan:

- Total direct `process.env` references in `apps`, `packages`, `services`, `scripts`: 318
- `apps/app`: 70
- `packages`: 82
- `services`: 165

### Keep As Acceptable Exceptions

- T3 `keys.ts` modules must destructure `process.env` in `runtimeEnv`.
- Next/Node runtime selectors such as `NODE_ENV`, `NEXT_RUNTIME`, `VERCEL`, and `CI` may remain where they are framework/runtime flags.
- Test files may mutate `process.env` only when scoped to a test and restored/reset.

### Refactor Next

- App route handlers should consume app/package env contracts instead of raw URLs and secrets.
- `packages/auth/src/server.ts` should use `packages/auth/keys.ts` and `packages/next-config/keys.ts` instead of repeated direct reads.
- `packages/service-utils` now has a typed service env helper. Remaining package direct env reads should be handled package by package.
- `services/*` should move service-specific env into service-local env modules or shared service env helpers before deeper service rewrites.
- `services/orchestrator` needs its own env module before any Vercel Sandbox migration because it currently owns LLM keys, sandbox URLs, TiDB, Stripe test injection, TURN, search keys, Forge, and connector/service URLs.

## App Structure State

Next.js docs support route groups, colocation, private folders, and splitting project files by feature or route. The current app already uses route groups:

- `apps/app/app/(authenticated)`
- `apps/app/app/(unauthenticated)`

That pattern is valid for separating layouts without changing URL paths. It is not enough by itself.

Current app structure facts:

- `apps/app/app` has 19 `page.tsx` files.
- Route-local component folders exist for several pages:
  - `actions/components`
  - `applications/components`
  - `chat/[id]/components`
  - `files/components`
  - `projects/[id]/components`
- A large shared authenticated component folder also exists:
  - `apps/app/app/(authenticated)/_components`
- There are 128 files under app-level `components` folders.

## Structure Findings

### Valid To Keep

- `(authenticated)` and `(unauthenticated)` route groups.
- Route-local `components` folders for page-specific UI.
- Shared package-level UI in `packages/design-system`.
- `proxy.ts` instead of legacy `middleware.ts` for Next 16.

### Needs Refactor

- Shared authenticated components are too broad and should be split by feature ownership:
  - shell/sidebar/header
  - settings
  - projects
  - search
  - prompt/composer
  - collaboration
- Test/demo routes under authenticated chat need a keep/delete decision before the reset:
  - `chat/test`
  - `chat/test-stream`
  - `chat/test-ide`
- Route handlers should be grouped by product domain and env ownership, not left as scattered proxy shims.
- App-level CSS should be audited against the target material/workflow design direction before UI reset.

## Dependency Remaining State

`pnpm outdated -r --format json` currently returns package drift output, but the focused check shows the only mismatch in the core framework/env list is the `@t3-oss/env-nextjs` metadata conflict. Do not upgrade that package beyond `0.13.10` until exact npm resolution succeeds.

Remaining dependency work:

- Run package-by-package upgrade checks for packages outside the focused list.
- Validate each package's latest docs before changing its usage:
  - Better Auth
  - Drizzle
  - Stripe
  - Vercel Sandbox
  - Vercel Workflow/AI SDK
  - Inngest
  - Typesense/search
  - AWS SDK/storage
  - Sentry/observability
  - PostHog/analytics
- Split dependency upgrades into risk groups:
  - framework/runtime
  - auth/security
  - database
  - payments
  - AI/tooling
  - UI/design
  - test/CI

## Required Next Steps

- [x] Remove direct dotenv/manual env loading.
- [x] Convert storage config to T3 Env.
- [x] Create service env module pattern and apply it first to `packages/service-utils`.
- [ ] Create `services/orchestrator/src/env.ts` before Vercel Sandbox migration.
- [ ] Move app route handler env reads to T3 env modules.
- [ ] Audit `packages/auth/src/server.ts` against Better Auth latest docs before refactor.
- [ ] Audit `packages/storage` against AWS SDK latest docs before changing storage behavior.
- [ ] Convert remaining package config modules to typed env access where appropriate.
- [ ] Decide keep/delete for chat test routes.
- [ ] Split `apps/app/app/(authenticated)/_components` into feature-owned folders.
- [ ] Run full `pnpm lint` after scoped lint debt cleanups; current historical full lint debt is still not resolved.
- [ ] Run builds only with real required env present; do not fake production secrets.

## Verdict

The codebase is cleaner than before, but it is not yet senior-clean. The env loading layer is now corrected, storage is aligned with T3 Env, shared service config has a T3 Core contract, and core framework versions are verified. Remaining work is mostly service-specific env ownership, app route/component ownership, full lint debt, and package-specific upgrade audits.
