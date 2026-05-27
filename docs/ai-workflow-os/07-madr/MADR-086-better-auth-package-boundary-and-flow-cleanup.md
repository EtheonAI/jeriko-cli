# MADR-086: Better Auth Package Boundary And Flow Cleanup

Date: 2026-05-27

Status: accepted

Package: `@repo/auth`

## Context

The app is being reset into a package-first monorepo. Authentication should be owned by `@repo/auth`, then consumed by apps through explicit package entrypoints.

The current auth package already contains the correct core direction: Better Auth server config, Better Auth client, Drizzle adapter, email verification, password reset, Google/GitHub social providers, and the organization plugin.

The audit found stale leftovers:

- an unused package-level middleware export that owns app route policy;
- old duplicate validation in `packages/auth/lib/validations/auth.ts`;
- stale app/web config declarations in `packages/auth/types/index.d.ts` that import an app-local `@/components/icons` alias;
- no package-local tests for reusable auth validation schemas.

Better Auth's current Next.js docs recommend mounting handlers with `toNextJsHandler(auth)` and describe proxy checks as an app boundary concern. Therefore `@repo/auth` should expose auth primitives and adapters, not product route lists.

## Decision

Keep `@repo/auth` as the Better Auth owner.

The package owns:

- Better Auth server instance;
- Better Auth React client;
- Next route-handler adapter;
- session-cookie helper for app proxy checks;
- auth env keys through T3 Env;
- auth validation schemas;
- auth email hook wiring to `@repo/email`.

The package does not own:

- app proxy route policy;
- login/signup/reset/verify UI;
- app sidebar/dashboard shell;
- app/web navigation config types;
- CMS/admin route policy;
- product-specific organization onboarding routes.

Remove the unused `@repo/auth/middleware` export and stale files. Add package-local validation tests in `packages/auth/tests`.

## Consequences

Positive:

- Auth package surface becomes smaller and easier to reason about.
- App route policy stays app-local and can differ per deployable app.
- Stale app-local alias imports are removed from the package.
- Password/email validation contracts gain package-level tests.

Negative:

- Apps that want route protection must implement their own proxy policy using `@repo/auth/next`.
- Full auth flow proof still needs later integration tests with database/email/OAuth.

## References

- `docs/ai-workflow-os/09-research/2026-05-27-p2-1-auth-better-auth-research.md`
- `docs/ai-workflow-os/10-audit/auth-p2-1-audit-2026-05-27.md`
- https://better-auth.com/docs/installation
- https://better-auth.com/docs/integrations/next
- https://better-auth.com/docs/authentication/email-password
- https://better-auth.com/docs/authentication/google
- https://better-auth.com/docs/authentication/github

## Checklist

- [x] Package playbook updated.
- [x] Stale middleware export removed.
- [x] Stale duplicate validation removed.
- [x] Stale package-local app/web declarations removed.
- [x] Package-local auth validation tests added.
- [x] Auth package typecheck passes.
- [x] Auth package tests pass.
- [x] Root Vitest suite passes.
- [x] Affected app typecheck passes.
- [x] App production compile checked with webpack.

## Validation Notes

- Auth package tests caught and fixed an email-normalization ordering bug.
- `apps/app` now imports auth email/password validation contracts from `@repo/auth/validations`.
- `apps/app` `next build --webpack` passes with the existing Sentry/OpenTelemetry warning.
- Default Turbopack `next build` stayed silent for several minutes and was terminated; keep that in the later Next/app build phase.
