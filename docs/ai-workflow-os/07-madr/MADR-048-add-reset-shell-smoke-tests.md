# MADR-048: Add Reset Shell Smoke Tests

Status: Accepted

Date: 2026-05-25

## Context

The old `apps/app` tests were coupled to removed Manus clone features. Keeping them would create false failures and make the reset harder to reason about, but having no app tests leaves the new shell without a guardrail.

## Decision

Use an app-local Vitest project for minimal reset-shell tests.

The app smoke suite covers:

- dashboard page rendering;
- authenticated root redirect target;
- proxy behavior for public auth pages;
- proxy redirect for protected routes without a Better Auth session cookie;
- proxy redirect away from `/login` with a Better Auth session cookie.

## Consequences

Positive:

- Restores a fast app-level smoke test without reintroducing the old test tree.
- Keeps the root Vitest `test.projects` monorepo pattern.
- Tests the current reset contract instead of deleted product features.

Negative:

- This is not a full auth integration test.
- This is not browser coverage for future workflow UX.
- Async Server Component and real Better Auth flows still need later integration/E2E coverage.

## Alternatives Considered

- Restore the old `apps/app/__tests__` tree: rejected because those tests targeted deleted code and old product assumptions.
- Add Playwright now: rejected because the reset shell is intentionally thin and no final workflow UX exists yet.
- Keep `test:smoke` as an echo: rejected because the reset should have a real guardrail before the Better Auth and UI rebuild phases.

## Evidence

- Next.js Vitest guide: https://nextjs.org/docs/app/guides/testing/vitest
- Vitest test projects guide: https://vitest.dev/guide/projects
- Local Vitest version: `./node_modules/.bin/vitest --version` returned `vitest/4.1.7`.

## Impacted Files and Packages

- `apps/app/vitest.config.ts`
- `apps/app/test/setup-env.ts`
- `apps/app/test/dashboard.test.ts`
- `apps/app/test/proxy.test.ts`
- `vitest.config.ts`
- `package.json`
- `docs/ai-workflow-os/08-plans/apps-app-reset-phases-checklist.md`
- `docs/ai-workflow-os/10-audit/apps-app-reset-gate-audit-2026-05-25.md`

## Validation Checklist

- [x] Run `./node_modules/.bin/vitest run --project app`.
- [x] Run `pnpm test:smoke` when the command environment has a compatible pnpm/Corepack path.
- [x] Run `pnpm --filter app typecheck`.
- [x] Run default `pnpm --filter app build` with Turbopack outside command sandbox.
- [x] Run `git diff --check`.
