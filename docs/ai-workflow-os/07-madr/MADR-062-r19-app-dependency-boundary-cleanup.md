# MADR-062: R19 Apps/App Dependency Boundary Cleanup

Status: Accepted

Date: 2026-05-26

## Context

`apps/app` is now a reset shell with support files cleaned through R18. Its `package.json` still needs to match active imports.

Two dependency issues were found:

- `apps/app` directly imports Better Auth subpaths, which bypasses the `@repo/auth` boundary.
- `apps/app` declares `motion`, but active app code does not import it; `packages/design-system` owns `motion`.

## Decision

Make `apps/app/package.json` match direct app ownership:

- Keep `better-auth` owned by `packages/auth`.
- Add `@repo/auth/next` as the app-facing Next.js auth adapter/helper surface.
- Update `apps/app` to import auth route handlers and session-cookie checks from `@repo/auth/next`.
- Remove `motion` from `apps/app` dependencies.
- Keep `babel-plugin-react-compiler` because the app consumes shared Next config with `reactCompiler: true`.
- Keep workspace package dependencies used by `env.ts`; the app env contract intentionally composes package key contracts.
- Do not remove payments/email/notifications/analytics/security dependencies during this phase because they are part of the current app env/runtime wiring and user explicitly wants centralized T3 Env.

## Consequences

Positive:

- `apps/app` no longer relies on transitive dependency access for direct Better Auth imports.
- The app package no longer carries an unused animation runtime dependency.
- Package ownership is clearer before workflow surfaces are added.

Negative:

- App env composition still keeps optional integration package dependencies in the app package.
- `publicHoistPattern` remains for a later workspace install audit.

## Evidence

- Research: [`../09-research/2026-05-26-r19-app-dependency-boundary-research.md`](../09-research/2026-05-26-r19-app-dependency-boundary-research.md)
- Audit: [`../10-audit/apps-app-r19-dependency-boundary-audit-2026-05-26.md`](../10-audit/apps-app-r19-dependency-boundary-audit-2026-05-26.md)
- Plan: [`../08-plans/apps-app-r19-dependency-boundary-cleanup-plan.md`](../08-plans/apps-app-r19-dependency-boundary-cleanup-plan.md)
- Registry check: `better-auth@1.6.11`, `motion@12.40.0`, `next@16.2.6`, `babel-plugin-react-compiler@1.0.0`.

## Validation Checklist

- [ ] `apps/app` imports Better Auth adapter helpers only through `@repo/auth/next`.
- [ ] `better-auth` is not declared in `apps/app/package.json`.
- [ ] `@repo/auth/next` is exported from `packages/auth`.
- [ ] `motion` is removed from `apps/app/package.json`.
- [ ] `pnpm-lock.yaml` is updated through `pnpm install`.
- [ ] App typecheck passes.
- [ ] App smoke tests pass.
- [ ] Targeted ESLint passes.
- [ ] App build passes with documented dummy env.
- [ ] App dependency scans show no active `motion` import and no direct app `better-auth` import.
- [ ] `git diff --check` passes.

## Impacted Files

- `apps/app/package.json`
- `apps/app/proxy.ts`
- `apps/app/app/api/auth/[...all]/route.ts`
- `packages/auth/package.json`
- `packages/auth/src/next.ts`
- `pnpm-lock.yaml`
- `docs/ai-workflow-os/08-plans/package-playbooks/apps-app.md`
