# MADR-084: Reset Testing Package To Shared Vitest Config

Status: Accepted

Date: 2026-05-27

## Context

`@repo/testing` should support current tests, not preserve old Manus fixtures. The active repo now has normalized `tests/` folders from R21, and no active code imports `@repo/testing`.

Current stale surfaces include:

- session/message/agent/device/file/connector factories;
- database seed/mock helpers;
- tRPC caller helpers;
- MSW handlers for old chat/SSE/tool flows;
- generic setup mocks for old app internals.

## Decision

Reset `@repo/testing` to a narrow shared Vitest config helper package.

Keep:

- React/jsdom Vitest config factory;
- Node Vitest config factory.

Remove:

- stale factories;
- stale DB seed/mock helpers;
- stale tRPC helpers;
- stale MSW handlers;
- stale app-specific setup mocks;
- unused Faker/MSW/React dependencies.

Future shared factories should be added only after the owning package's model is stable and at least two consumers need the same helper.

## Evidence

- Vitest docs support monorepo project configs and package-specific config helpers.
- Vitest docs state workspace terminology is replaced by `projects`.
- MSW Node docs support explicit server setup, but this package has no active current handlers.
- Faker docs support generated data, but factories must match current domain models.
- Registry checks on 2026-05-27 show current installed/latest versions: `vitest@4.1.7`, `vite@8.0.14`, `msw@2.14.6`, `@faker-js/faker@10.4.0`.
- Local search found no active non-doc consumers of `@repo/testing`.

## Consequences

Positive:

- removes stale Manus-era testing surface;
- reduces package dependencies;
- keeps the package useful as a shared config helper;
- avoids exporting fake domain models before the `.flow` schema is real.

Negative:

- future tests that need factories must add them deliberately;
- no shared MSW layer exists until current API handlers stabilize.

## Impacted Files

- `packages/testing/index.ts`
- `packages/testing/package.json`
- `packages/testing/tsconfig.json`
- `packages/testing/setup.ts`
- `packages/testing/src/**`
- `docs/ai-workflow-os/08-plans/package-playbooks/testing.md`
- `docs/ai-workflow-os/10-audit/testing-p1-3-audit-2026-05-27.md`

## Validation Checklist

- [x] Official docs checked.
- [x] Registry metadata checked.
- [x] Consumers searched.
- [x] Package playbook updated.
- [x] Remove stale exports/files/dependencies.
- [x] `@repo/testing` typecheck passes.
- [x] Root tests pass.
