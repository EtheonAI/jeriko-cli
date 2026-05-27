# MADR-044: Reset apps/app to a Clean next-forge-Shaped Shell With Better Auth

Status: Accepted

Date: 2026-05-25

## Context

`apps/app` started as a Manus clone and now contains a mixed product surface: chat, file manager, sandbox, collaboration, search, projects, settings, tRPC routers, Redux slices, old tests, and multiple APIs. The target product is a new workflow OS based on `.flow`, durable execution, approvals, tools, and sandboxed execution.

The current codebase is too dirty to evolve safely by renaming old surfaces. The reset needs to preserve useful platform capabilities as concepts, but not preserve their old implementations as active app code.

## Decision

Reset `apps/app` to a clean shell using next-forge-style monorepo boundaries:

- Keep `apps/app` as the app, with `app/` at the app root.
- Keep `packages/*` as shared packages.
- Keep Better Auth as the auth provider.
- Remove Clerk references if any are found.
- Keep `app/api/auth/[...all]/route.ts`, `proxy.ts`, route groups, root layout/error/loading files, app `env.ts`, and app README.
- Delete old Manus pages, APIs, app components, state, and tests unless they are required by the reset shell.
- Rebuild workflow, sandbox, files, search, tools, billing, and artifact viewing later as new workflow-native modules.

## Consequences

Positive:

- Reduces cognitive load before new architecture work.
- Prevents old Manus assumptions from leaking into the `.flow` workflow OS.
- Keeps a production-grade monorepo shape instead of flattening the repo.
- Keeps Better Auth and typed env validation as stable foundations.

Negative:

- Short-term app typecheck and tests may fail while obsolete source/tests are removed.
- Useful old ideas must be reimplemented deliberately.
- The reset needs strict route/API deletion gates to avoid broken imports.

## Alternatives Considered

### Refactor in place

Rejected. The old app has too many product assumptions and stale tests. Incremental refactor would preserve confusion and create false confidence.

### Copy next-forge app exactly

Rejected. next-forge is a structural reference, not the product. This repo already has Better Auth, database, design-system, payments, and app-specific packages.

### Move to `src/app`

Rejected for now. Next.js documents `src` as optional, and next-forge keeps the app surface as a self-contained app. Moving folders would create churn without solving the reset problem.

### Remove Better Auth

Rejected. Better Auth has current Next.js 16 docs, the latest package is already installed, and the user wants Better Auth rather than Clerk.

## Evidence

- next-forge docs say apps are self-contained, independently deployable app surfaces and should compose package env contracts through app-level `env.ts`: https://www.next-forge.com/docs/structure
- next-forge source keeps the main application under `apps/app`: https://github.com/vercel/next-forge/tree/main/apps/app
- Next.js project-structure docs say `app` is the App Router directory and `src` is optional: https://nextjs.org/docs/app/getting-started/project-structure
- Next.js proxy docs say the middleware convention is deprecated and renamed to `proxy`: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Next.js 16 upgrade docs describe Turbopack default, proxy migration, Node/TS requirements, and codemod scope: https://nextjs.org/docs/app/guides/upgrading/version-16
- Better Auth Next.js docs recommend `/api/auth/[...all]` with `toNextJsHandler(auth)`, `createAuthClient`, and server session reads through `auth.api.getSession`: https://better-auth.com/docs/integrations/next
- next-forge Better Auth migration docs describe replacing Clerk with Better Auth and adding Better Auth env: https://www.next-forge.com/docs/migrations/authentication/better-auth
- T3 Env Next.js docs document app-level env schemas and build-time validation: https://env.t3.gg/docs/nextjs
- Registry checks on 2026-05-25 returned `next@16.2.6`, `better-auth@1.6.11`, and `@t3-oss/env-nextjs@0.13.11`.

## Impacted Files and Packages

- `apps/app/app/(authenticated)/**`
- `apps/app/app/(unauthenticated)/**`
- `apps/app/app/api/**`
- `apps/app/lib/**`
- `apps/app/__tests__/**`
- `apps/app/e2e/**`
- `apps/app/env.ts`
- `apps/app/proxy.ts`
- `packages/auth/**`
- `packages/database/**`
- `packages/design-system/**`

## Validation Checklist

- [ ] Delete `/artifacts` route and nav entry.
- [ ] Delete empty/stale authenticated route folders.
- [ ] Delete old app API routes outside auth/health. R11 removed `check-email`.
- [ ] Delete obsolete tests.
- [ ] Trim app state/store to reset shell.
- [ ] Refactor Better Auth env access.
- [ ] Regenerate Next route types.
- [ ] Pass `pnpm --filter app typecheck`.
- [ ] Add new minimal shell/auth tests.
