# `.flow` End-to-End Readiness Audit

Date: 2026-05-27

Scope: `@repo/flow`, `@repo/ai`, `@repo/connectors`, `@repo/sandbox`, `@repo/database`, runtime adapter boundary, and `apps/app`.

## Verdict

The platform direction is correct, but the end-to-end `.flow` runtime is not ready yet.

Do not claim the workflow stack is 100% working. It is currently in the foundation phase.

## Current Readiness Matrix

| Area                 | Ready now                                                                                         | Missing before app wiring                                                                                                    | Risk                                  |
| -------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `.flow` source model | Custom source decision, lexer, CST parser, diagnostics, YAML-feature rejection.                   | AST normalization, syntax-to-schema mapping, reserved-vocabulary diagnostics through AST stage.                              | High if app starts before AST exists. |
| Compiler             | Symbol/execution plan schemas.                                                                    | Real symbol table, semantic validation, execution plan generator, control-flow/failure-policy planner.                       | High.                                 |
| Runtime contracts    | Run request, trigger record, ECP, TaskReport, reflection, cancellation contracts.                 | Interpreter, mock executor, Inngest adapter, cancellation checkpointing.                                                     | High.                                 |
| AI SDK package       | AI SDK v6 boundary, `ToolLoopAgent`, server helpers, platform tool policy, connector tool bridge. | Flow-aware worker registry/router, task runner, subagent reporting adapter, TaskReport output mapping.                       | Medium-high.                          |
| Connectors           | Composio session/direct/mock contracts and adapters.                                              | Persisted connection/session references, workflow trigger mapping, platform manifest registry, production audit/idempotency. | Medium-high.                          |
| Sandbox              | Provider-neutral contracts, Vercel adapter, mock adapter.                                         | Workflow task runner, artifact persistence, task-level network/env policy validation, sandbox session table migration.       | Medium-high.                          |
| Database             | Existing auth/org/project/session/message/sandbox/scheduled-task primitives.                      | Workflow-native Drizzle tables and migrations.                                                                               | Critical.                             |
| Inngest/runtime      | MADR and research exist.                                                                          | Active code implementation and serve endpoint.                                                                               | Critical.                             |
| App UI/API           | Reset shell, auth, dashboard, sidebar.                                                            | Prompt-to-flow, editor, validation UI, runs API, timeline, approvals, artifacts, reconnect.                                  | Critical.                             |
| Resume               | Contracts and legacy hints exist.                                                                 | End-to-end durable run/event persistence and cursor replay.                                                                  | Critical.                             |

## Local Evidence

### `@repo/flow`

Checked:

- `packages/flow/src/lexer/index.ts`
- `packages/flow/src/parser/index.ts`
- `packages/flow/src/ast/index.ts`
- `packages/flow/src/compiler/index.ts`
- `packages/flow/src/runtime/index.ts`
- `packages/flow/src/events/index.ts`
- `packages/flow/README.md`
- `packages/flow/ARCHITECTURE.md`

Finding:

- Lexer/CST parser are real.
- AST schema is real.
- Compiler and runtime are contracts, not implementation.

Decision:

- Continue `@repo/flow` phases before adding app workflow routes.

### `@repo/ai`

Checked:

- `packages/ai/README.md`
- `packages/ai/src/agents/index.ts`
- `packages/ai/src/tools/connectors.ts`
- `packages/ai/src/tools/contracts.ts`

Finding:

- AI SDK package boundary is clean enough to build on.
- Connector bridge has the right approval/risk/permission direction.
- Missing flow-specific worker router and task runner.

Decision:

- Add `@repo/ai` flow worker runner only after `@repo/flow` execution plan shape is real.

### `@repo/connectors`

Checked:

- `packages/connectors/src/contracts.ts`
- `packages/connectors/src/composio.ts`

Finding:

- Connector provider/session/action/trigger contracts exist.
- Runtime must still map `.flow` tool IDs to platform manifests and persist execution.

Decision:

- Keep connector provider details out of `@repo/flow` and apps.

### `@repo/sandbox`

Checked:

- `packages/sandbox/src/contracts.ts`
- `packages/sandbox/src/vercel.ts`

Finding:

- Provider-neutral sandbox boundary exists.
- Workflow semantics need explicit task IO, timeout, env, network policy, persistence, and artifacts.

Decision:

- Use `@repo/sandbox` from runtime task adapters only.

### `@repo/database`

Checked:

- `packages/database/src/schema/sessions.ts`
- `packages/database/src/schema/sandboxes.ts`
- `packages/database/src/schema/connectors.ts`
- `packages/database/src/schema/scheduledTasks.ts`
- `packages/database/src/schema/agents.ts`
- `docs/ai-workflow-os/_source/flow-language-runtime-pack-v0-1/migrations/001_core_schema.sql`

Finding:

- Existing schema is Manus-era and chat/scheduled-task oriented.
- The source pack SQL has a closer workflow model, but must be converted to Drizzle with repo naming and migration discipline.
- `sandboxes.ts` still has E2B-specific fields and comments.

Decision:

- Next database phase must add workflow-native tables instead of overloading `agent_sessions` or `scheduled_tasks`.

### `apps/app`

Checked:

- `apps/app/README.md`
- `apps/app/app/(authenticated)/page.tsx`
- `apps/app/app/(authenticated)/_components/dashboard/dashboard-overview.tsx`
- `apps/app/app/(authenticated)/_components/app-shell/app-shell.tsx`

Finding:

- App is intentionally reset to dashboard shell.
- No workflow route/API/UI exists.

Decision:

- App workflow work waits until package contracts and persistence exist.

## How The Five-Subagent User Prompt Should Work

The future system should process a prompt as follows:

```text
user prompt
-> app route creates draft workflow generation request
-> @repo/ai flow architect agent emits .flow source + files
-> @repo/database persists draft source/files
-> @repo/flow parses and compiles
-> semantic validation resolves 5 workers, tools, artifacts, permissions
-> user reviews/activates workflow version
-> workflow_triggers rows are created
-> Inngest scheduler/event router requests runs
-> workflow.run executes tasks
-> each ai_task invokes scoped @repo/ai worker/subagent
-> tool_call invokes @repo/ai/tools policy wrapper and @repo/connectors if external
-> sandbox_command invokes @repo/sandbox
-> events/reports/artifacts are persisted
-> UI reconnects by runId/cursor
```

This is the target. It is not fully implemented today.

## Missing Implementation Checklist

### P4.1 `@repo/flow`

- [x] Lexer.
- [x] CST parser.
- [ ] AST normalizer.
- [ ] Symbol table builder.
- [ ] Semantic validator.
- [ ] Execution planner.
- [ ] Mock interpreter.
- [ ] Reserved feature diagnostics.
- [ ] Worker/worker_policy AST design.

### P4.2 `@repo/database`

- [ ] Drizzle tables for workflows.
- [ ] Workflow versions with `flowSource`, `compiledPlan`, `sourceHash`, diagnostics, status.
- [ ] Workflow files.
- [ ] Workflow triggers.
- [ ] Workflow runs.
- [ ] Run steps.
- [ ] Run event log with cursor/sequence.
- [ ] Task reports.
- [ ] Artifacts.
- [ ] Approval requests.
- [ ] Tool calls with idempotency.
- [ ] Sandbox sessions.
- [ ] Usage events/credit ledger links.
- [ ] Migration tests/checks.

### P4.3 Runtime/Inngest

- [ ] Static Inngest function inventory.
- [ ] Scheduler tick.
- [ ] Event router.
- [ ] Generic executor.
- [ ] Approval resume.
- [ ] Worker callback.
- [ ] Cancellation handler.
- [ ] Stuck-run watchdog.
- [ ] Mock runtime tests before provider side effects.

### P4.4 `@repo/ai`

- [ ] Flow worker registry contracts.
- [ ] Worker router scoring.
- [ ] Scoped tool selection.
- [ ] AI task runner.
- [ ] Subagent reporting modes.
- [ ] TaskReport/ECP output mapping.
- [ ] Flow generation/repair agent with structured output.
- [ ] Abort/cancel boundary docs and tests.

### P4.5 Tools, Connectors, Sandbox

- [ ] Platform tool registry.
- [ ] Connector manifest persistence.
- [ ] Direct workflow runtime consumption of `@repo/ai/tools`.
- [ ] Sandbox task adapter.
- [ ] Artifact persistence adapter.
- [ ] Approval/idempotency/audit tests.

### P4.6 `apps/app`

- [ ] `POST /api/workflows/draft`.
- [ ] `.flow` editor/validation UI.
- [ ] `POST /api/workflows/:id/activate`.
- [ ] `POST /api/runs`.
- [ ] `GET /api/runs/:runId`.
- [ ] `GET /api/runs/:runId/events?cursor=...`.
- [ ] `POST /api/runs/:runId/cancel`.
- [ ] Workflow dashboard/list.
- [ ] Run timeline.
- [ ] Artifact panel.
- [ ] Approval cards.
- [ ] Tool cards.
- [ ] Reconnect/replay tests.

## Next Correct Phase

Start with `@repo/flow` Phase D: AST normalization from CST.

Reason:

- Database schema depends on knowing the compiled plan/version shape.
- Runtime depends on compiled plans.
- AI worker routing depends on semantic task/worker/tool resolution.
- App UI should consume validation/runtime APIs, not invent route-local workflow objects.
