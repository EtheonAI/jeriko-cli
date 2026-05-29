# `.flow` v0 Implementation Master Plan

Date: 2026-05-27

Status: active phased plan for implementing `@repo/flow` after the runtime pack v0.1 reverse-engineering pass

Primary package:

- `@repo/flow`

Source references:

- [`MADR-095`](../07-madr/MADR-095-flow-parser-and-compiler-v0.md)
- [`MADR-096`](../07-madr/MADR-096-resumable-workflow-runs-and-ui-reconnect.md)
- [`MADR-097`](../07-madr/MADR-097-flow-runtime-pack-v0-1-blueprint-adoption.md)
- [`Flow runtime pack reverse engineering`](../09-research/2026-05-27-flow-language-runtime-pack-v0-1-reverse-engineering.md)
- [`Flow runtime pack adoption checklist`](./flow-runtime-pack-v0-1-adoption-checklist.md)
- [`Flow grammar v0`](../02-workflow-kernel/flow-grammar-v0.md)
- [`Flow end-to-end runtime architecture`](../01-architecture/flow-end-to-end-runtime-architecture.md)
- [`Flow end-to-end package build plan`](./flow-end-to-end-package-build-plan.md)
- [`Flow end-to-end readiness audit`](../10-audit/flow-end-to-end-readiness-audit-2026-05-27.md)

## Non-Negotiable Boundaries

`@repo/flow` owns language and provider-neutral contracts only.

It must not import:

- `yaml`;
- `inngest`;
- `ai` / AI SDK;
- `@vercel/sandbox`;
- Drizzle or database clients;
- Next.js;
- React/UI components;
- connector provider SDKs.

Runtime/provider work must be delegated through package boundaries:

| Runtime concern        | Owner                                                 |
| ---------------------- | ----------------------------------------------------- |
| AI calls and subagents | `@repo/ai`                                            |
| platform tools         | `@repo/ai/tools`                                      |
| external connectors    | `@repo/connectors`                                    |
| sandbox execution      | `@repo/sandbox`                                       |
| persistence            | `@repo/database`                                      |
| Inngest functions      | app/server runtime or future provider adapter package |
| UI/reconnect           | `apps/app`                                            |

## Current Truth

Implemented:

- source/span contracts;
- token contracts;
- CST contracts;
- AST schemas;
- kernel schemas;
- parser diagnostics contract;
- compiler/execution plan contracts;
- ECP, TaskReport, IssueCard, RunReflectionPacket contracts;
- run state and runtime adapter contracts;
- patch contracts;
- fixture corpus shell.

Not implemented:

- AST normalization from source;
- symbol table builder;
- semantic validator;
- execution planner;
- interpreter;
- Inngest adapter;
- DB persistence;
- workflow UI/reconnect.
- flow architect agent;
- flow-aware AI worker router;
- connector/sandbox runtime task adapters;
- app workflow draft/run APIs.

## Vocabulary Policy

The pack defines a broad future vocabulary. The package must not accept broad syntax before it can validate and execute it.

### MVP Accepted Task Types

These are accepted in current `@repo/flow` schemas:

- `ai_task`
- `tool_call`
- `sandbox_command`
- `human_review`
- `wait_for_event`
- `subflow`

### Reserved Future Task Types

These are reserved from the pack but not accepted until their full parser, AST, semantic validation, execution planning, and runtime behavior are implemented:

- `sleep`
- `foreach`
- `parallel`
- `condition`
- `verify`
- `emit_event`
- `invoke_workflow`
- `memory_patch`
- `flow_patch`
- `issue_card`

Rule:

- A reserved task type must produce a specific unsupported/reserved diagnostic during parsing or validation, not a generic invalid field error.

## Phase A: Vocabulary Gate

Goal:

- Make accepted versus reserved `.flow` vocabulary explicit in docs, schemas, and tests.

Tasks:

- [x] Record accepted MVP task types.
- [x] Record reserved future task types.
- [x] Add code-level exported constants/schemas for accepted and reserved task types.
- [x] Add parser diagnostic codes for reserved vocabulary.
- [x] Add tests proving reserved task types are known but not accepted as active `FlowTask.type`.
- [ ] Update the adoption checklist.

Acceptance:

- `@repo/flow` still rejects reserved task types in active AST schemas.
- Tests prove reserved task types are intentionally recognized as future vocabulary.
- No parser/runtime behavior is implied for reserved task types.

Current validation:

- `packages/flow` typecheck passes.
- `packages/flow` Vitest passes with 3 files / 14 tests.

## Phase B: Lexer

Goal:

- Tokenize `.flow` source with spans and reserved YAML diagnostics.

Tasks:

- [x] Implement `lexFlowSource(source: FlowSource): FlowLexResult`.
- [x] Track line, column, and offset.
- [x] Emit structural tokens.
- [x] Emit scalar tokens.
- [x] Emit comments.
- [x] Emit `INDENT` and `DEDENT`.
- [x] Normalize CRLF.
- [x] Reject tabs in indentation.
- [x] Reject indentation not divisible by two.
- [x] Detect YAML-only tokens:
  - `%YAML`;
  - `---`;
  - `...`;
  - `!tag`;
  - `&anchor`;
  - `*alias`;
  - `<<`.

Acceptance:

- Valid fixture token streams are deterministic.
- Invalid YAML-only fixture cases return `FLOW_PARSE_YAML_FEATURE_UNSUPPORTED`.
- Diagnostics include source spans.

Current validation:

- `packages/flow` typecheck passes.
- `packages/flow` Vitest passes with 4 files / 26 tests.

## Phase C: CST Parser

Goal:

- Convert tokens into a source-preserving CST.

Tasks:

- [x] Parse document root.
- [x] Parse mappings.
- [x] Parse pairs.
- [x] Parse sequences.
- [x] Parse inline scalar lists.
- [x] Parse literal blocks.
- [x] Preserve comments.
- [x] Preserve raw token references.
- [x] Reject inline maps in v0.
- [x] Produce diagnostics instead of throwing for expected user errors.

Acceptance:

- CST includes comments, order, spans, and raw token IDs.
- Invalid fixture diagnostics match expected codes.
- Parser still does not use YAML package.

Current validation:

- `packages/flow` typecheck passes.
- `packages/flow` Vitest passes with 5 files / 30 tests.

## Phase D: AST Normalization

Goal:

- Convert CST to current AST contracts.

Tasks:

- [ ] Map source `flow` to AST `version`.
- [ ] Map snake_case source fields to camelCase contracts:
  - `depends_on` -> `dependsOn`;
  - `requires_approval` -> `requiresApproval`;
  - `if_fail` -> `ifFail`;
  - `listens_to` -> `listensTo`;
  - `min_interval_seconds` -> `minIntervalSeconds`;
  - `jitter_seconds` -> `jitterSeconds`;
  - `max_runs_per_day` -> `maxRunsPerDay`;
  - `concurrency_key` -> `concurrencyKey`;
  - `dedupe_key` -> `dedupeKey`;
  - `misfire_policy` -> `misfirePolicy`;
  - `match_rules` -> `matchRules`.
- [ ] Apply defaults only after parse.
- [ ] Convert Zod errors to `FlowDiagnostic`.
- [ ] Preserve source spans on AST nodes.

Acceptance:

- Minimal manual fixture produces valid AST.
- Scheduled, event, and webhook fixtures produce valid AST.
- Reserved future task types produce explicit diagnostics.

## Phase E: Symbol Table

Goal:

- Resolve names without executing anything.

Tasks:

- [ ] Build job symbols.
- [ ] Build task symbols.
- [ ] Build scoped task paths.
- [ ] Build artifact references.
- [ ] Build imports/files references.
- [ ] Build worker references.
- [ ] Build tool references.
- [ ] Build event references.
- [ ] Build permission symbols.

Acceptance:

- Duplicate task IDs are diagnosed.
- Unknown references are diagnosed.
- Nested future task scopes are designed before enabled.

## Phase F: Semantic Validation

Goal:

- Prove the workflow makes sense beyond shape.

Tasks:

- [ ] Artifact producer/consumer validation.
- [ ] Dependency ordering and cycle detection.
- [ ] Tool manifest resolution contract.
- [ ] Permission policy resolution.
- [ ] Approval policy validation.
- [ ] Blocked action validation.
- [ ] Sandbox IO/network/timeout policy validation.
- [ ] Event names and wait/emit validation.
- [ ] Budget validation.
- [ ] Reflection gate validation.

Acceptance:

- Schema-valid but unsafe workflows fail semantic validation.
- External actions cannot pass without approval policy.
- Sandbox tasks cannot pass without declared IO and timeout.

## Phase G: Execution Plan

Goal:

- Compile valid AST and semantics into runtime-neutral execution plan.

Tasks:

- [ ] Stable node IDs.
- [ ] DAG slice generation.
- [ ] waits/signals/events.
- [ ] approval checkpoints.
- [ ] failure policy control paths.
- [ ] idempotency keys.
- [ ] artifact IO.
- [ ] run resume checkpoints.
- [ ] cancellation checkpoints.

Acceptance:

- Plan is serializable.
- Plan contains no provider SDK objects.
- Plan can be interpreted by a mock adapter.

## Phase H: Adapter Contracts

Goal:

- Define how runtime providers execute the plan without polluting `@repo/flow`.

Tasks:

- [ ] Add executor adapter test doubles.
- [ ] Define Inngest mapping doc.
- [ ] Define AI task worker invocation contract.
- [ ] Define platform tool invocation contract.
- [ ] Define sandbox command invocation contract.
- [ ] Define approval/wait/cancel contract.

Acceptance:

- `@repo/flow` compiles without provider SDKs.
- Adapter contracts can be consumed by future app/server runtime code.

## Phase I: Persistence Plan

Goal:

- Prepare `@repo/database` for workflows/runs/events/artifacts without implementing runtime UI yet.

Tasks:

- [ ] Convert pack SQL inventory into Drizzle design.
- [ ] Include workflow versions.
- [ ] Include trigger registry.
- [ ] Include run events with cursors.
- [ ] Include task reports.
- [ ] Include artifacts.
- [ ] Include approvals.
- [ ] Include tool calls/idempotency.
- [ ] Include sandbox sessions.
- [ ] Include usage ledger.

Acceptance:

- Database plan supports durable runs and UI reconnect.
- Browser disconnect remains separate from cancel.

## Phase J: Runtime and UI Reconnect

Goal:

- Implement Manus-style resume after the language/compiler foundation is stable.

Tasks:

- [ ] `POST /api/runs`.
- [ ] `GET /api/runs/:runId/events?cursor=...`.
- [ ] `POST /api/runs/:runId/cancel`.
- [ ] persisted event replay.
- [ ] live subscription after replay.
- [ ] artifact panel.
- [ ] approvals.
- [ ] run timeline.
- [ ] reconnect tests.

Acceptance:

- Refresh does not stop runs.
- Closing the tab does not stop runs.
- Stop/Cancel emits durable cancellation.

## Validation For Every Phase

Run the narrowest relevant checks first:

```bash
pnpm --filter @repo/flow typecheck
pnpm exec vitest run --config packages/flow/vitest.config.ts
pnpm boundaries:cruise --focus packages/flow
```

Then run broader checks only when package contracts change consumers:

```bash
pnpm test
pnpm --filter "./packages/*" typecheck
```

Local note:

- This repo currently requires Node `22.22.1+`.
- If shell `pnpm` fails through Corepack, use the repo-local tool binaries under Node `22.22.1` until the local Corepack issue is resolved.

## End-To-End Wiring Gate

The app workflow surface must wait until the package phases have clear contracts.

Required package order:

1. `@repo/flow` AST/symbols/semantics/plan/mock interpreter.
2. `@repo/database` workflow-native tables and migrations.
3. Inngest runtime adapter.
4. `@repo/ai` worker/subagent execution and flow architect/repair agents.
5. `@repo/ai/tools`, `@repo/connectors`, and `@repo/sandbox` runtime adapters.
6. `apps/app` workflow draft, validation, activation, run, timeline, approval, artifact, and reconnect UI.
