# Tests R21 Cleanup Audit

Date: 2026-05-27

Scope: active Vitest tests and test runner configuration.

Out of scope for this phase:

- UI component refactors
- design-system lint cleanup
- Storybook stories
- k6/load tests
- Playwright/E2E reintroduction
- product feature behavior changes

## References Checked

| Source                                              | Type                           | Decision Used                                                                                                                                                                               |
| --------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://nextjs.org/docs/app/guides/testing/vitest` | Official Next.js docs          | Use Vitest for unit tests, but do not rely on Vitest for async Server Components; keep app tests focused on helpers, route handlers, middleware/proxy behavior, and synchronous components. |
| `https://vitest.dev/config/projects`                | Official Vitest docs           | Use root `test.projects` for the monorepo instead of the old workspace file.                                                                                                                |
| `https://v3.vitest.dev/guide/projects`              | Official Vitest migration docs | `workspace` is deprecated since Vitest 3.2; use `projects`.                                                                                                                                 |

## Current Active Test Surface

Active root config:

- `vitest.config.ts`
- uses `test.projects`.

Active app tests:

- `apps/app/test/auth-pages.test.ts`
- `apps/app/test/dashboard.test.ts`
- `apps/app/test/health-route.test.ts`
- `apps/app/test/proxy.test.ts`

Active package tests:

- `packages/ai/tests/public-api.test.ts`
- `packages/ai/tests/tools/connectors.test.ts`
- `packages/connectors/tests/composio.test.ts`
- `packages/connectors/tests/mock.test.ts`
- `packages/email/test/email.test.ts`
- `packages/flow/tests/runtime-contracts.test.ts`
- `packages/sandbox/src/mock.test.ts`
- `packages/sandbox/src/vercel.test.ts`
- `packages/search/src/__tests__/search.test.ts`

Deleted old app test surface already visible in git status:

- `apps/app/__tests__/**`

That deletion is correct for the reset. Those tests targeted the removed chat/tRPC/Manus app, old Redux, old sandbox flows, and deleted pages. They should not be reanimated during the reset.

## Findings

### R21-1: Root `pnpm test` Does Not Run The App Tests

Current root script:

```json
"test": "vitest run --project @repo/ai --project @repo/connectors --project @repo/email --project @repo/flow --project @repo/search --project @repo/sandbox"
```

Problem:

- root `vitest.config.ts` includes `apps/app/vitest.config.ts`;
- root `pnpm test` bypasses it;
- app reset tests only run through `pnpm test:smoke`.

Decision:

- change root `test` to `vitest run`;
- keep `test:smoke` as an app-only focused command.

### R21-2: Test Folders Are Not Consistent

Current layout is mixed:

- `apps/app/test`
- `packages/email/test`
- `packages/sandbox/src/*.test.ts`
- `packages/search/src/__tests__`
- `packages/ai/tests`
- `packages/connectors/tests`
- `packages/flow/tests`

Decision:

- normalize active tests into `tests/` folders;
- keep package source clean of `.test.ts` files;
- update per-project Vitest includes.

Target layout:

- `apps/app/tests/**`
- `packages/ai/tests/**`
- `packages/connectors/tests/**`
- `packages/email/tests/**`
- `packages/flow/tests/**`
- `packages/sandbox/tests/**`
- `packages/search/tests/**`

### R21-3: Old `vitest.workspace.ts` Is Correctly Removed

Status:

- `vitest.workspace.ts` is deleted.

Decision:

- keep it deleted;
- root `vitest.config.ts` is the canonical project list.

### R21-4: Load Tests Are A Separate Phase

Current:

- `k6/**`
- `load-tests/**`

Risk:

- some load tests still target removed gateway/tRPC/device services.

Decision:

- do not delete or rewrite them in R21;
- create a later R22 load/perf test audit to decide keep/archive/delete.

## Checklist

- [x] Move `apps/app/test` to `apps/app/tests`.
- [x] Move `packages/email/test` to `packages/email/tests`.
- [x] Move `packages/sandbox/src/*.test.ts` to `packages/sandbox/tests`.
- [x] Move `packages/search/src/__tests__` to `packages/search/tests`.
- [x] Update all affected Vitest `include` paths.
- [x] Update moved test imports.
- [x] Change root `pnpm test` to run all configured projects.
- [x] Keep `pnpm test:smoke` as app-only.
- [x] Run root `pnpm test`.
- [x] Run `pnpm test:smoke`.
- [x] Run affected package typechecks if imports moved.
- [x] Update operating memory after validation.

## Validation Results

Root all-project test command:

```bash
pnpm test
```

Result:

- passed;
- 13 test files;
- 45 tests.

App-only smoke command:

```bash
pnpm test:smoke
```

Result:

- passed;
- 4 app test files;
- 15 tests.

The root test script now runs all configured Vitest projects, including `apps/app`.

## Non-Goals

- Do not fix root lint in this phase.
- Do not touch design-system components.
- Do not touch web app components.
- Do not add Playwright yet.
- Do not rebuild deleted chat/Manus tests.
