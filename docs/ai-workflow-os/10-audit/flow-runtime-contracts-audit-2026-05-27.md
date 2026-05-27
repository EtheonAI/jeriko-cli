# Flow Runtime Contracts Audit

Date: 2026-05-27

Scope: `packages/flow`

Phase: first implementation step after MADR-079 and MADR-080.

## Decision Boundary

This phase implements provider-neutral contracts only.

It does not add:

- Inngest SDK imports;
- Vercel Workflow imports;
- database clients or Drizzle schema;
- Next.js route handlers;
- app UI;
- AI SDK model calls;
- sandbox execution.

Those belong in later adapter/database/app phases.

## Implemented

- Logical `.flow` trigger vocabulary now includes manual, schedule, generic event, app event, workflow event, and webhook triggers.
- Schedule triggers support timezone, jitter, min interval, max runs per day, concurrency key, dedupe key, and misfire policy.
- Tasks can declare emitted events and listened-to events.
- EventContextPacket contract exists for normalized app/tool/worker/workflow context.
- TaskReport contract exists for worker outputs, costs, issues, emitted events, tool/model usage, and suggested patches.
- IssueCard contract exists for user-visible operational failures.
- RunReflectionPacket contract exists for compressed main-AI wakeups.
- Trigger registry record contract exists for DB-backed `workflow_triggers` shape.
- Scheduler tick, scheduler decision, workflow run request, and cancellation request contracts exist.
- `@repo/flow/testing` includes mock ECP and trigger helpers.
- Package tests live under `packages/flow/tests`.
- Root Vitest project list includes `packages/flow/vitest.config.ts`.

## Files Changed

- `packages/flow/src/kernel/index.ts`
- `packages/flow/src/events/index.ts`
- `packages/flow/src/compiler/index.ts`
- `packages/flow/src/runtime/index.ts`
- `packages/flow/src/testing/index.ts`
- `packages/flow/tests/runtime-contracts.test.ts`
- `packages/flow/vitest.config.ts`
- `packages/flow/README.md`
- `vitest.config.ts`

## Checklist

- [x] Keep `@repo/flow` provider-neutral.
- [x] Add DB-backed trigger registry contract without importing Drizzle.
- [x] Add ECP contract.
- [x] Add TaskReport contract.
- [x] Add RunReflectionPacket contract.
- [x] Add cancellation request contract.
- [x] Add package-local tests.
- [x] Validate typecheck.
- [x] Validate package tests.
- [ ] Add actual Drizzle workflow tables in `@repo/database`.
- [ ] Add trigger extraction from compiled `.flow`.
- [ ] Add semantic validation for schedule/event trigger fields.
- [ ] Add Inngest adapter outside `@repo/flow`.
- [ ] Add generic executor implementation.
- [ ] Add approval resume implementation.
- [ ] Add event router implementation.

## Validation

Commands:

```bash
pnpm --filter @repo/flow typecheck
pnpm exec vitest run --config packages/flow/vitest.config.ts
pnpm exec vitest run --project @repo/flow
pnpm test
pnpm --filter "./packages/*" typecheck
pnpm boundaries:cruise --focus packages/flow
git diff --check -- packages/flow vitest.config.ts
```

Results:

- `@repo/flow` typecheck passed.
- Flow Vitest passed: 1 file, 5 tests.
- Root package test suite passed after adding `@repo/flow`: 9 files, 30 tests.
- Active package typecheck passed across 26 workspace package projects.
- Dependency-cruiser focused on `packages/flow` passed with no dependency violations.
- `git diff --check` passed for flow package changes.

## Risks

- These are contracts, not runtime behavior.
- The database schema still needs to map these camelCase contracts to real table columns.
- The eventual Inngest adapter must translate these contracts to Inngest event names, step IDs, cancellation, and concurrency without leaking provider types into `@repo/flow`.
- The parser/compiler still need implementation before user-authored `.flow` can produce these runtime records.

## Next Phase

Recommended next phase: `@repo/database` workflow-native schema.

Add:

- `workflows`
- `workflow_versions`
- `workflow_triggers`
- `workflow_runs`
- `workflow_events`
- `run_steps`
- `task_reports`
- `approvals`
- `artifacts`

Do this as a database package phase with Drizzle docs/release checks, not as part of `@repo/flow`.
