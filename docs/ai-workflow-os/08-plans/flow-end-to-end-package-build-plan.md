# `.flow` End-To-End Package Build Plan

Date: 2026-05-27

Status: active package-by-package build checklist before app workflow rebuild.

Related:

- [`MADR-098`](../07-madr/MADR-098-end-to-end-flow-runtime-package-boundaries.md)
- [`Flow end-to-end architecture`](../01-architecture/flow-end-to-end-runtime-architecture.md)
- [`Flow readiness audit`](../10-audit/flow-end-to-end-readiness-audit-2026-05-27.md)
- [`Flow integration research`](../09-research/2026-05-27-flow-end-to-end-runtime-integration-research.md)

## Non-Negotiable Rule

No package code changes for a runtime phase without:

1. Latest official docs checked.
2. Local package audit checked.
3. Package-local `.md` plan updated.
4. MADR/checklist updated when architecture changes.
5. Package tests/typecheck run.
6. Affected consumers checked.

## Phase 1: `@repo/flow` Compiler Completion

Goal: turn source into a valid execution plan without provider imports.

Package-local plan: `packages/flow/END_TO_END_BUILD_PLAN.md`

Checklist:

- [ ] AST normalizer from CST.
- [ ] Source field mapping from snake case to contract camel case.
- [ ] Top-level unknown key diagnostics.
- [ ] Task unknown key diagnostics.
- [ ] Reserved task type diagnostics.
- [ ] Symbol table builder.
- [ ] Artifact/import/file symbols.
- [ ] Worker symbols and worker policy shape.
- [ ] Tool symbols.
- [ ] Event symbols.
- [ ] Semantic validator.
- [ ] Dependency/cycle planner.
- [ ] Approval/permission validator.
- [ ] Sandbox policy validator.
- [ ] Execution plan generator.
- [ ] Mock interpreter.
- [ ] Fixtures for five-subagent workflow.
- [ ] Typecheck/tests/dependency-cruise.

Exit criteria:

- A valid `.flow` fixture compiles to a serializable execution plan.
- Invalid fixtures produce source-spanned diagnostics.
- `@repo/flow` imports no provider SDKs.

## Phase 2: `@repo/database` Workflow Persistence

Goal: persist workflow source, versions, triggers, runs, events, artifacts, approvals, tools, sandbox sessions, and usage.

Package-local plan: `packages/database/FLOW_PERSISTENCE_PLAN.md`

Checklist:

- [ ] Convert source pack SQL into Drizzle tables.
- [ ] Use `flowSource`, not `yamlSource`.
- [ ] Add `workflows`.
- [ ] Add `workflowVersions`.
- [ ] Add `workflowFiles`.
- [ ] Add `workflowTriggers`.
- [ ] Add `workflowRuns`.
- [ ] Add `workflowRunSteps`.
- [ ] Add `workflowEvents` with sequence/cursor.
- [ ] Add `taskReports`.
- [ ] Add `issueCards`.
- [ ] Add `approvalRequests`.
- [ ] Add `artifacts`.
- [ ] Add `toolCalls` with idempotency key.
- [ ] Add provider-neutral sandbox run/session tables or migrate existing `sandboxes`.
- [ ] Link usage/credits to workflow/run/task.
- [ ] Add indexes and unique constraints.
- [ ] Add migration.
- [ ] Run Drizzle check/typecheck/tests.

Exit criteria:

- Workflow runs can be reconstructed from persisted rows.
- Cursor replay is possible.
- Existing `agent_sessions` is not the workflow source of truth.

## Phase 3: Runtime Adapter / Inngest

Goal: run compiled plans durably through a small static function inventory.

Package-local plan: future `packages/runtime-inngest/README.md` or app-local `apps/app/app/api/inngest/RUNTIME_PLAN.md`, depending on the implementation decision.

Checklist:

- [ ] Decide adapter location.
- [ ] Add Inngest client/serve route.
- [ ] Define typed events.
- [ ] `workflow.scheduler.tick`.
- [ ] `workflow.event_router`.
- [ ] `workflow.run`.
- [ ] `workflow.approval.resume`.
- [ ] `workflow.worker.callback`.
- [ ] `workflow.reflection`.
- [ ] `watchdog.stuck_runs`.
- [ ] Cancellation event handling.
- [ ] Concurrency keys.
- [ ] Idempotency keys.
- [ ] Mock provider tests.

Exit criteria:

- A mock workflow run can continue without an open browser request.
- Approval waits and event waits are durable.
- Cancellation is explicit and persisted.

## Phase 4: `@repo/ai` Flow Worker Runtime

Goal: execute `ai_task` nodes through scoped AI SDK agents/subagents.

Package-local plan: `packages/ai/FLOW_AI_SDK_INTEGRATION_PLAN.md`

Checklist:

- [ ] Flow architect agent for prompt-to-`.flow`.
- [ ] Flow repair agent for diagnostics-to-patch/source.
- [ ] Worker registry contracts.
- [ ] Worker router scoring.
- [ ] Model policy resolver.
- [ ] Scoped tool resolver.
- [ ] AI task runner.
- [ ] Subagent runner.
- [ ] Subagent reporting mode mapping.
- [ ] TaskReport output mapping.
- [ ] ECP output mapping.
- [ ] Abort signal forwarding for active calls.
- [ ] Durable cancellation check boundary.
- [ ] Tests with mocked models/tools.

Exit criteria:

- A compiled `ai_task` can run with a scoped toolset and produce a TaskReport.
- Main agent/subagent reporting policy is explicit.

## Phase 5: Tools, Connectors, Sandbox

Goals:

- Execute side effects only through policy-wrapped server paths.
- Execute untrusted code only through sandbox adapters.

Package-local plans:

- `packages/connectors/FLOW_CONNECTORS_INTEGRATION_PLAN.md`
- `packages/sandbox/FLOW_SANDBOX_TASK_PLAN.md`

Checklist:

- [ ] Platform tool manifest registry.
- [ ] Connector action to platform tool mapping.
- [ ] Connection/session persistence.
- [ ] Approval policy enforcement.
- [ ] Idempotency rows for external writes.
- [ ] Billing/audit event writes.
- [ ] Sandbox task adapter.
- [ ] Sandbox file/artifact adapter.
- [ ] Network policy validation.
- [ ] Timeout and resource policy validation.
- [ ] Tests for blocked/ask/auto permissions.

Exit criteria:

- No raw Composio/Vercel Sandbox provider SDK import leaks into app or flow.
- External writes require approval/idempotency/audit.

## Phase 6: `apps/app` Workflow Product Surface

Goal: rebuild the product UI on top of package/runtime contracts.

Checklist:

- [ ] `POST /api/workflows/draft`.
- [ ] `POST /api/workflows/:workflowId/versions/:versionId/validate`.
- [ ] `POST /api/workflows/:workflowId/activate`.
- [ ] `POST /api/runs`.
- [ ] `GET /api/runs/:runId`.
- [ ] `GET /api/runs/:runId/events?cursor=...`.
- [ ] `POST /api/runs/:runId/cancel`.
- [ ] Workflow list/dashboard.
- [ ] `.flow` source editor.
- [ ] Validation diagnostics panel.
- [ ] Run timeline.
- [ ] Task detail panel.
- [ ] Approval cards.
- [ ] Artifact/file renderer.
- [ ] Tool cards.
- [ ] Sandbox output renderer.
- [ ] Reconnect/replay tests.

Exit criteria:

- Refresh/close does not cancel active work.
- A run can be opened after completion and reconstructed from DB.
- UI never depends on in-memory route state as the source of truth.

## Validation Ladder

Run narrow checks first:

```bash
pnpm --filter @repo/flow typecheck
pnpm exec vitest run --config packages/flow/vitest.config.ts
pnpm boundaries:cruise --focus packages/flow
```

Then broaden only when contracts affect consumers:

```bash
pnpm --filter "./packages/*" typecheck
pnpm test
pnpm boundaries:cruise
```

For app phases:

```bash
pnpm --filter app typecheck
pnpm test:smoke
pnpm --filter app build
```

## Latest Validation

2026-05-27 focused validation after this documentation/readiness phase:

- `git diff --check` passed.
- Prettier check passed for the touched Markdown files.
- `@repo/flow` TypeScript check passed.
- `@repo/flow` Vitest passed: 5 files, 30 tests.
- `depcruise --focus packages/flow apps packages` passed with no dependency violations.
