# Flow Runtime Pack v0.1 Adoption Checklist

Date: 2026-05-27

Status: planning checklist for `@repo/flow` implementation phases

Source snapshot:

- `docs/ai-workflow-os/_source/flow-language-runtime-pack-v0-1`

Decision:

- [`MADR-097`](../07-madr/MADR-097-flow-runtime-pack-v0-1-blueprint-adoption.md)

Research:

- [`2026-05-27-flow-language-runtime-pack-v0-1-reverse-engineering.md`](../09-research/2026-05-27-flow-language-runtime-pack-v0-1-reverse-engineering.md)

Implementation master plan:

- [`flow-v0-implementation-master-plan.md`](./flow-v0-implementation-master-plan.md)

## Phase 0: Guardrails

- [x] Copy the downloaded pack into repo docs for stable reference.
- [x] Inventory every file and total line count.
- [x] Confirm pack is reference material only.
- [x] Confirm `@repo/flow` remains provider-neutral.
- [x] Confirm no YAML parser dependency enters `@repo/flow`.
- [x] Confirm no Inngest/AI SDK/Vercel Sandbox/DB/Next imports enter `@repo/flow`.
- [ ] Add dependency-cruiser guard if future imports try to violate this boundary.

## Phase 1: Language Vocabulary

- [x] Record pack top-level vocabulary.
- [x] Record pack task type vocabulary.
- [x] Record pack failure policy vocabulary.
- [x] Record pack permission modes.
- [x] Decide MVP accepted vocabulary versus future reserved vocabulary.
- [x] Update grammar doc with future reserved task types.
- [x] Add phase-by-phase `.flow` v0 implementation master plan.
- [x] Add parser diagnostics for unsupported reserved-but-not-implemented features.
- [ ] Decide source interpolation syntax before accepting `{{...}}` examples.

## Phase 2: Lexer and CST

- [x] Keep current custom token/CST contract direction.
- [x] Preserve YAML-only rejection token classes.
- [x] Implement lexer.
- [x] Track source spans for every token.
- [x] Preserve comments and raw values as comment/block/scalar tokens before CST parsing.
- [x] Normalize CRLF consistently.
- [x] Reject tabs and non-two-space indentation.
- [x] Reject YAML anchors, aliases, tags, directives, merge keys, and document markers outside strings/blocks.

## Phase 3: Parser and AST

- [x] Implement CST parser.
- [ ] Normalize source snake_case to internal camelCase where package schemas use camelCase.
- [x] Parse mappings, lists, inline scalar lists, block strings, comments, and scalar values.
- [x] Reject inline maps in v0 by not tokenizing or composing inline-map syntax as supported CST.
- [x] Convert lexer diagnostics to `FlowDiagnostic` with path and span.
- [ ] Parse cleaned `social_media_manager.flow` fixture.
- [ ] Parse cleaned `shopify_inventory.flow` fixture.
- [ ] Parse cleaned `lead_generation.flow` fixture.
- [ ] Add invalid fixtures from pack examples where semantics are intentionally unsafe.

## Phase 4: Structural Validation

- [ ] Use Zod 4 as active internal validation layer.
- [ ] Add strict top-level key validation.
- [ ] Add strict task field validation.
- [ ] Require task fields by task type.
- [ ] Require `max_items` and `max_parallelism` for `foreach` before enabling it.
- [ ] Keep JSON Schema generation deferred until internal contracts stabilize.
- [ ] If JSON Schema is emitted, use Draft 2020-12 and `unevaluatedProperties: false` for composed schemas where needed.

## Phase 5: Symbol Table

- [ ] Build symbol maps for jobs.
- [ ] Build scoped task symbol paths.
- [ ] Build tool references.
- [ ] Build artifact producer/consumer references.
- [ ] Build import/file references.
- [ ] Build worker references.
- [ ] Build event references.
- [ ] Build permissions.
- [ ] Support nested task scopes for `foreach`, `parallel`, and `condition`.
- [ ] Add diagnostics for duplicate IDs, unknown refs, and ambiguous refs.

## Phase 6: Semantic Validation

- [ ] Validate artifact producers before consumers where required.
- [ ] Validate dependency DAG and cycle detection.
- [ ] Validate tool names against tool manifest registry contract.
- [ ] Validate permission policy against tool manifest risk.
- [ ] Validate external action approval requirements.
- [ ] Validate blocked permission categories.
- [ ] Validate sandbox declared input/output/timeout/network policy.
- [ ] Validate event names and payload declarations.
- [ ] Validate bounded fanout.
- [ ] Validate budgets and plan limits.
- [ ] Validate reflection gates.
- [ ] Validate version/migration compatibility.

## Phase 7: Execution Plan

- [ ] Define execution plan nodes with stable IDs.
- [ ] Define DAG slices for acyclic dependencies.
- [ ] Define CFG/control paths for retry, fallback, rejection, timeout, and failure policies.
- [ ] Define event waits and signal waits.
- [ ] Define approval checkpoints.
- [ ] Define artifact IO.
- [ ] Define idempotency keys for side-effecting actions.
- [ ] Define cost estimate fields.
- [ ] Define run resume/cancel checkpoints.

## Phase 8: Runtime Adapter Contract

- [ ] Keep Inngest adapter out of `@repo/flow`.
- [ ] Define provider-neutral executor interface in `@repo/flow`.
- [ ] Add static runtime function inventory to app/runtime docs.
- [ ] Map `ai_task` to `@repo/ai` worker invocation.
- [ ] Map `tool_call` to `@repo/ai/tools` plus `@repo/connectors`.
- [ ] Map `sandbox_command` to `@repo/sandbox`.
- [ ] Map `human_review` to approval request plus signal/wait.
- [ ] Map `wait_for_event` to event wait.
- [ ] Map `emit_event` to event store plus runtime event.
- [ ] Ensure browser disconnect is never cancellation.
- [ ] Implement explicit cancel event flow.

## Phase 9: Persistence

- [ ] Adapt pack SQL to Drizzle under `@repo/database`.
- [ ] Add workflow versions.
- [ ] Add workflow files/imports.
- [ ] Add workflow triggers.
- [ ] Add workflow runs.
- [ ] Add run events with cursor.
- [ ] Add task events.
- [ ] Add task reports.
- [ ] Add artifacts.
- [ ] Add approval requests.
- [ ] Add tool calls and idempotency keys.
- [ ] Add sandbox sessions.
- [ ] Add usage events and credit ledger.
- [ ] Add retention/access policy fields.

## Phase 10: UI and Resume

- [ ] Add run snapshot endpoint.
- [ ] Add run events replay endpoint with cursor.
- [ ] Add live event subscription after replay.
- [ ] Render timeline from persisted events.
- [ ] Render artifact panel from artifact refs.
- [ ] Render approvals from approval requests.
- [ ] Render AI/tool parts from normalized events and AI SDK UI messages where appropriate.
- [ ] Add reconnect tests for refresh/tab close/network disconnect.
- [ ] Add cancel tests proving Stop emits durable cancellation.

## Phase 11: AI SDK Integration

- [ ] Keep AI SDK code in `@repo/ai`, not `@repo/flow`.
- [ ] Use AI SDK v6 `ToolLoopAgent` only where an agent loop is needed.
- [ ] Use `inputSchema` for tools.
- [ ] Use `stopWhen` / `stepCountIs` for loop limits.
- [ ] Use `Output.object({ schema })` for structured outputs.
- [ ] Use `DefaultChatTransport` when rebuilding chat UI.
- [ ] Treat AI SDK resume streams as chat transport support, not durable workflow execution.
- [ ] Persist messages/parts/artifacts independently of browser stream.

## Phase 12: Verification

- [ ] `pnpm --filter @repo/flow typecheck`.
- [ ] `pnpm exec vitest run --config packages/flow/vitest.config.ts`.
- [ ] `pnpm test`.
- [ ] `pnpm boundaries:cruise --focus packages/flow`.
- [ ] Add fixture tests for pack-derived examples.
- [ ] Add semantic validator tests.
- [ ] Add execution plan tests.
- [ ] Add adapter contract tests with mocks.
- [ ] Add resume/cancel tests.
