# Flow Language Runtime Pack v0.1 Reverse Engineering

Date researched: 2026-05-27

Status: source snapshot copied; pack fully inventoried; adoption is blueprint-only, not direct code import

Copied source snapshot:

- `docs/ai-workflow-os/_source/flow-language-runtime-pack-v0-1`
- Original local source: `/Users/khaleelmusleh/Downloads/flow_language_runtime_pack_v0_1`

## Scope

This pass audits the downloaded `flow_language_runtime_pack_v0_1` as source material for the future `.flow` language/runtime work.

The audit does not claim the pack is production-ready. It separates:

- concepts to keep;
- contracts to adapt;
- runtime/provider code to reject from `@repo/flow`;
- gaps that must be fixed before implementation.

## Inventory

The copied pack contains 48 files and 5,226 total lines.

Important file groups:

| Group               | Files | Lines | Audit result                                                                                                              |
| ------------------- | ----: | ----: | ------------------------------------------------------------------------------------------------------------------------- |
| Concept docs        |    14 | 1,756 | Strong architecture blueprint. Contains one conflict with our custom parser decision.                                     |
| Examples            |     3 |   568 | Useful vocabulary stress cases. Not all examples are semantically valid enough to become fixtures unchanged.              |
| Schemas             |     4 |   830 | Useful draft schema contracts, but not strict enough for task fields and not aligned with Zod 4 package direction.        |
| Runtime/source TS   |    18 | 1,385 | Useful sketch code. Not acceptable as active `@repo/flow` code because it mixes parser/runtime/provider responsibilities. |
| SQL migration       |     1 |   271 | Useful table inventory for future Drizzle design. Must be adapted to existing `@repo/database`.                           |
| Prompts             |     3 |    68 | Useful compiler/repair/reflection prompt constraints. Need security hardening and current AI SDK integration.             |
| Test/config/package |     5 |   348 | Minimal validation only. Dependencies and package boundary are not acceptable as-is.                                      |

## Pack Thesis

The pack's core thesis is correct:

```text
User prompt
-> main AI writes workflow.flow
-> parser validates safe .flow
-> compiler emits runtime JSON
-> semantic validator resolves tools, files, artifacts, events, permissions
-> generic durable executor runs the workflow
-> scoped workers emit EventContextPackets and TaskReports
-> reflection proposes FlowPatch changes only when gated
```

This matches the existing repo direction in:

- `docs/ai-workflow-os/07-madr/MADR-020-flow-source-language-compiler-ir-stack.md`
- `docs/ai-workflow-os/07-madr/MADR-078-flow-orchestrates-ai-sdk-subagents-and-tools.md`
- `docs/ai-workflow-os/07-madr/MADR-080-prefer-inngest-over-vercel-workflow-for-dynamic-flow-runtime.md`
- `docs/ai-workflow-os/07-madr/MADR-095-flow-parser-and-compiler-v0.md`
- `docs/ai-workflow-os/07-madr/MADR-096-resumable-workflow-runs-and-ui-reconnect.md`

## Source Documents

### README and Codex brief

Keep:

- `.flow` is an authoring/instruction layer, not the internal runtime data structure.
- Runtime should use static durable functions, not one generated function per customer workflow.
- Main AI writes/repairs workflow specs; it should not orchestrate every task at runtime.
- Workers communicate through typed EventContextPackets, TaskReports, artifacts, approvals, issue cards, and reflection packets.

Reject or correct:

- The package name and active code boundary are wrong for this repo.
- Runtime/provider SDKs do not belong in `@repo/flow`.

### `01_FLOW_LANGUAGE_SPEC.md`

Keep:

- Top-level vocabulary: `flow`, `name`, `goal`, `mode`, `imports`, `files`, `permissions`, `tools`, `workers`, `budgets`, `triggers`, `jobs`, `reflection`, `notifications`, `exports`, `metadata`.
- Modes: `draft_only`, `supervised`, `auto`, `live_orchestration`.
- Permission modes: `auto`, `ask`, `block`.
- Task vocabulary: `ai_task`, `tool_call`, `sandbox_command`, `human_review`, `wait_for_event`, `sleep`, `foreach`, `parallel`, `condition`, `verify`, `emit_event`, `invoke_workflow`, `memory_patch`, `flow_patch`, `issue_card`.
- Failure policies: `stop`, `retry`, `retry_then_stop`, `retry_then_ask`, `continue_degraded`, `use_cached`, `fallback`, `create_issue_card`, `regenerate_once_then_ask`, `ask_user`, `skip_optional`.

Correct:

- `.flow` is not a YAML subset in implementation. It is a custom source language inspired by YAML readability.
- Source uses snake_case; package contracts may normalize to camelCase internally.
- The first production parser must reject unsupported YAML features before AST creation.

### `02_EBNF_GRAMMAR.md`

Keep:

- EBNF should become the grammar documentation for parser, formatter, syntax highlighting, and repair prompts.

Reject:

- The note that first implementation can use a restricted YAML parser. This is superseded by MADR-095.

### `03_COMPILER_PIPELINE.md`

Keep the pipeline shape:

```text
.flow source
-> lexer tokens
-> CST
-> AST
-> structural validation
-> symbol table
-> semantic validation
-> ASG / semantic graph
-> execution plan
-> persisted runtime JSON
```

Correct:

- Replace YAML parser loading with the custom `.flow` lexer/parser.
- Use Zod 4 for active TypeScript package validation. JSON Schema can still be emitted later for external/editor contracts.

### `04_SEMANTIC_VALIDATION.md`

Keep all semantic passes as required implementation work:

- duplicate IDs;
- artifact producer/consumer resolution;
- tool registry resolution;
- permission resolution;
- approval requirements;
- cycle detection;
- bounded fanout;
- event validation;
- budget validation;
- sandbox policy;
- reflection policy;
- migration validation.

Critical note:

- Schema validation alone is not enough. The pack correctly treats semantic validation as a separate compiler phase.

### `05_RUNTIME_INGGEST.md`

Keep:

- Static function inventory:
  - scheduler tick;
  - event router;
  - generic run executor;
  - approval resume;
  - worker callback;
  - reflection;
  - notification dispatch;
  - usage rollup;
  - watchdog;
  - cleanup.
- `ai_task` and `tool_call` execute inside durable steps.
- approvals and events use waits/signals.
- DB-backed triggers produce `workflow.run.requested` events.
- external side effects require idempotency keys.

Correct:

- Inngest code must not live inside `@repo/flow`.
- `@repo/flow` defines contracts and execution plan semantics only.
- The Inngest adapter belongs in app/server runtime code or a future provider package.

### `06_ECP_EVENT_CONTEXT.md`

Keep:

- EventContextPacket is the typed routing layer for workers, tools, workflows, UI, notifications, and reflection.
- Main AI should wake only through reflection gates.
- Worker communication should not be freeform chat by default.

Needed additions:

- event cursor support for resumable UI;
- schema versioning;
- payload size constraints aligned with Inngest limits;
- artifact indirection for large payloads.

### `07_WORKER_ROUTING.md`

Keep:

- Worker registry concept.
- Worker selection by capability, quality, reliability, cost, latency, and user/org preference.
- Workers return TaskReports and ECP packets.

Correct:

- Default hard-coded workers in the sample source are only a test fixture idea.
- Worker selection must be data-backed and observable.

### `08_SECURITY_PERMISSIONS.md`

Keep:

- `auto`, `ask`, and `block` permission modes.
- Runtime must re-enforce tool permissions, even after compiler validation.
- External content is untrusted and cannot override permissions.
- Generated code runs only in sandbox.

Correct:

- The sample implementation checks action risk by string hints. That is not enough.
- Real enforcement must use tool manifests with risk categories, required permission, approval policy, scopes, idempotency, and audit metadata.

### `09_STORAGE_KV_CACHE.md`

Keep:

- Postgres is source of truth.
- Object storage holds large artifacts, logs, images, CSVs, scripts, and source snapshots.
- KV/Redis is cache and dedupe/rate state, not source of truth.

Needed additions:

- separate durable run event cursor model;
- artifact metadata schema;
- retention and access policy;
- replay contract for UI refresh/reconnect.

### `10_BILLING_SCALE.md`

Keep:

- Bill work performed, not just model tokens.
- Meter runs, steps, AI calls, tool calls, sandbox seconds, images, storage, notifications, events, and reflection.
- Event storm protection must pause sources and create issue cards.

Needed additions:

- reserve/commit/refund credit semantics;
- idempotent usage writes;
- per-org/per-workflow quotas.

### `11_VERSIONING_MIGRATIONS.md`

Keep:

- Version source, compiled JSON, imports, scripts, permissions, triggers, worker policy, memory, and reflection.
- Running runs keep original version.
- Draft changes require validation before activation.
- FlowPatch is the safe tree-transform mechanism.

Needed additions:

- migration compatibility for in-flight runs;
- explicit `source_hash`;
- formatter/source-preserving patch behavior through CST.

### `12_RESEARCH_NOTES.md`

Keep:

- YAML feature rejection list.
- JSON Schema Draft 2020-12 as external schema reference.
- Inngest durable runtime fit.
- Vercel Sandbox for generated code execution.

Correct:

- "safe YAML subset loader first" is superseded. Use custom `.flow` parser first.

### `13_RESEARCH_AND_COMPLETION_CHECKLIST.md`

Keep:

- checklist discipline.

Correct:

- Add package-boundary gates and provider-neutral restrictions from the current repo.

## Example File Findings

### `social_media_manager.flow`

Useful as the primary product fixture because it exercises:

- schedule trigger;
- research worker;
- content drafting;
- foreach over platforms;
- image generation;
- sandbox validation;
- human approval;
- external publishing;
- weekly analytics;
- memory patching;
- reflection.

Needs cleanup before becoming a passing fixture:

- templating syntax such as `{{platform}}` needs a formal expression/interpolation language;
- nested task scoping needs explicit ID/path semantics;
- `foreach` needs both `max_items` and `max_parallelism`;
- tool manifests must define publishing approval.

### `shopify_inventory.flow`

Useful because it exercises:

- app event triggers;
- workflow events;
- supplier email intake;
- low-stock approval;
- weekly aggregation.

Needs cleanup:

- event payload mapping is underspecified;
- some emitted events do not define payload shape;
- connector scopes and tool manifests need real definitions.

### `lead_generation.flow`

Useful because it exercises:

- sandbox-generated scraper code;
- CSV artifact handling;
- dedupe/update flow;
- approval before outreach;
- blocked risky categories.

Needs cleanup:

- persistent files such as `artifacts/leads_master.csv` must be modeled as imports or workflow files;
- CAPTCHA bypass and spam categories must be explicit blocked permissions;
- notification/tool inputs must be schema-validated.

## Schema Findings

### `flow.schema.json`

Good:

- Draft 2020-12 schema;
- strict top-level `additionalProperties: false`;
- task-specific `allOf` constraints for some task types;
- clear required top-level fields.

Problems:

- task schema uses `additionalProperties: true`, which conflicts with docs that say unknown task fields must be rejected;
- `foreach` does not require `max_items`;
- external action approval cannot be expressed only by JSON Schema;
- worker/tool/artifact references require semantic validation;
- JSON Schema is not the active internal validator direction for `@repo/flow`; Zod 4 is.

### ECP, TaskReport, RunReflection schemas

Good:

- They capture the right concepts.

Problems:

- payloads are intentionally loose;
- routing and artifact metadata need stronger versioned contracts before production;
- event cursor/replay fields are missing for resumable UI.

## TypeScript Source Findings

### Parser

The sample parser uses `yaml.parseDocument`.

Decision:

- Do not import this parser into `@repo/flow`.
- Use it only as evidence for features that must be rejected by our custom parser.

### Compiler

Useful:

- source hash;
- structural validation before semantic validation;
- compiled flow object;
- semantic summary.

Gaps:

- no source-preserving CST;
- no real expression/interpolation model;
- no version migration model;
- no strict provider boundary.

### Symbol table

Useful:

- maps jobs, tasks, tools, workers, artifacts, imports, events, permissions.

Gaps:

- nested task IDs and foreach scopes need path/instance semantics;
- artifact references with template variables are stored literally;
- ordering and dependency semantics are incomplete.

### Semantic validator

Useful:

- catches duplicate IDs, missing artifacts, unknown tools/workers, external actions without approval, sandbox path issues, and bounded foreach basics.

Gaps:

- no real cycle detection;
- no complete event validation;
- weak string-hint permission model;
- no budget/reflection/migration validation;
- no tool manifest resolution;
- branch/nested dependency context is incomplete.

### Runtime dispatcher and Inngest adapter

Useful:

- demonstrates how a generic executor might map task types.

Reject as active code:

- directly imports Inngest in the package;
- directly recurses with `Promise.all`, which is not durable by itself;
- uses placeholders for conditions, waits, approvals, event routing, sandbox, AI, tools, and billing;
- has failure policy as error reporting, not runtime control flow;
- does not implement resume/cancel/replay.

### Permissions

Useful:

- simple sketch of blocked vs approval-gated actions.

Reject as production:

- substring matching cannot be the policy engine.
- real policy must use typed manifests and runtime enforcement.

### Worker router

Useful:

- score-based worker selection model.

Needs change:

- registry must be data-backed;
- scoring weights must be transparent and testable;
- worker selection should emit reasoning/telemetry.

### FlowPatch

Useful:

- confirms patch objects are the right direction instead of exposing Lisp/macros.

Needs change:

- patch should target CST/AST paths with validation;
- patch application must preserve comments/source where possible;
- patch must run parse/semantic validation before activation.

### Billing, KV, SQL

Useful:

- table inventory and categories are aligned with the platform.

Needs change:

- adapt to Drizzle schema;
- no global in-memory singleton for production;
- add idempotent usage ledger semantics;
- add run event cursor tables for resume.

## Online Research Validation

### AI SDK v6

Sources:

- `https://ai-sdk.dev/llms.txt`
- `https://ai-sdk.dev/docs/agents/building-agents`
- `https://ai-sdk.dev/docs/agents/subagents`
- `https://ai-sdk.dev/docs/agents/loop-control`
- `https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`
- `https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data`
- `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams`

Claims used:

- AI SDK v6 is provider-agnostic and supports tools, agents, structured output, streaming UI messages, media, and chat UI transports.
- `ToolLoopAgent` is the current agent abstraction for tool-loop agents.
- Tool definitions use `inputSchema`.
- Loop control uses `stopWhen`, commonly with `stepCountIs`.
- Structured output uses `Output.object({ schema })`.
- `useChat` v6 uses `DefaultChatTransport`.
- AI SDK resume streams are useful for chat transport, but they are not enough for durable workflow execution. They still require app-owned persistence and a stream endpoint.

Impact:

- `.flow` should compile `ai_task` and subagent policy into provider-neutral worker invocation contracts.
- `@repo/ai` should implement AI SDK v6 adapters and platform tools.
- `@repo/flow` should not import AI SDK.
- UI stream abort is not workflow cancellation. Durable cancellation is a run event.

### Inngest

Sources:

- `https://www.inngest.com/llms.txt`
- `https://www.inngest.com/docs/learn/inngest-steps`
- `https://www.inngest.com/docs/guides/sending-events-from-functions`
- `https://www.inngest.com/docs/guides/concurrency`
- `https://www.inngest.com/docs/features/inngest-functions/cancellation`
- `https://www.inngest.com/docs/reference/typescript/functions/triggers`
- `https://www.inngest.com/docs/usage-limits/inngest`

Claims used:

- Inngest is a durable workflow engine for AI applications with step retries, event coordination, throttling, concurrency controls, and human-in-the-loop patterns.
- `step.run` memoizes successful step output and should wrap non-deterministic work.
- `step.waitForEvent` and `step.waitForSignal` pause runs.
- `step.invoke` composes functions; `step.sendEvent` triggers fan-out.
- Waiting/sleeping does not count as active concurrency execution.
- Cancellation does not stop an already executing step; it prevents future steps and marks the run canceled.
- Managed usage limits must shape event payload, step output, run state, and fan-out design.

Impact:

- The pack's static Inngest function inventory is directionally correct.
- The runtime adapter must store large payloads as artifacts and keep step outputs small.
- Cancellation needs explicit safe points and cleanup handling.
- DB-backed triggers still matter because user-defined triggers are product data, not static code.

### Vercel Sandbox

Sources:

- `https://vercel.com/docs/vercel-sandbox/sdk-reference`
- `https://vercel.com/docs/agent-resources`

Claims used:

- Vercel Sandbox provides ephemeral Linux microVMs for evaluating user-generated code, agent output, and reproducible integration tests.
- SDK usage centers on `Sandbox.create()` and command execution.
- Project linking and env pulling are needed so the SDK can read Vercel OIDC configuration.
- Supported runtimes include Node and Python runtimes.

Impact:

- `.flow` `sandbox_command` should compile to a provider-neutral sandbox task contract.
- `@repo/sandbox` should own Vercel Sandbox SDK usage.
- `@repo/flow` should only validate sandbox task policy, declared IO, timeout, output limits, and network policy.

### JSON Schema Draft 2020-12

Source:

- `https://json-schema.org/draft/2020-12`

Claims used:

- Draft 2020-12 is current enough for external schema artifacts and includes `unevaluatedProperties`.

Impact:

- JSON Schema can be emitted for editor/docs/runtime interop.
- Internal TypeScript validation should remain Zod 4-first in `@repo/flow`.
- If JSON Schema is kept for external contracts, use `unevaluatedProperties: false` where `allOf` would otherwise bypass top-level strictness.

## Adoption Verdict

Adopt the pack as a reference blueprint.

Do not copy its active implementation into `@repo/flow`.

Keep these concepts:

- `.flow` top-level vocabulary and task taxonomy;
- compiler pipeline;
- symbol table and semantic validation phase list;
- static durable runtime function inventory;
- ECP, TaskReport, IssueCard, RunReflectionPacket;
- FlowPatch as safe workflow mutation;
- DB-backed triggers and run/event/artifact persistence;
- permissions as `auto`, `ask`, `block`;
- human approval and external action idempotency;
- reflection-gated main AI.

Reject or replace:

- YAML parser dependency;
- direct Inngest import in `@repo/flow`;
- direct AI SDK import in `@repo/flow`;
- direct sandbox/provider SDK import in `@repo/flow`;
- runtime placeholders as production code;
- substring-based permission enforcement;
- schema-only safety;
- unscoped nested task IDs;
- route-stream-only resume.

## Correct Package Boundaries

| Concern                                                                                  | Owner                                                 |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `.flow` source grammar, tokens, CST, AST, parser diagnostics                             | `@repo/flow`                                          |
| semantic validation, symbol table contracts, execution plan contracts                    | `@repo/flow`                                          |
| ECP, TaskReport, IssueCard, RunReflectionPacket contracts                                | `@repo/flow`                                          |
| FlowPatch contract and validation contracts                                              | `@repo/flow`                                          |
| AI SDK v6 model calls, ToolLoopAgent/subagent wrappers, structured output, tool adapters | `@repo/ai`                                            |
| Platform tool manifests, risk metadata, approval policy wrappers                         | `@repo/ai/tools`                                      |
| Composio sessions, connector auth, provider tool execution                               | `@repo/connectors`                                    |
| Vercel Sandbox SDK and sandbox sessions                                                  | `@repo/sandbox`                                       |
| tables, Drizzle schema, persistence helpers                                              | `@repo/database`                                      |
| Inngest functions/static runtime adapter                                                 | app/server runtime or future provider adapter package |
| run/chat/workflow UI, SSE routes, reconnect UI                                           | `apps/app`                                            |

## Implementation Risks

- The vocabulary is broad. Implement MVP task types first and keep future task types documented but not parsed as accepted until tested.
- Expression/interpolation syntax is currently underspecified. Do not accept `{{...}}` templates in production until the expression grammar exists.
- Nested execution (`foreach`, `parallel`, `condition`) needs scoped task paths and bounded fanout.
- Tool and connector permission enforcement must happen in both semantic validation and runtime.
- Durable run resume needs DB/event cursor design before workflow UI is rebuilt.
- Runtime provider limits must be designed into compiled plans. Large artifacts should not live in durable step state.

## Next Implementation Order

1. Update `@repo/flow` docs and package-local memory with this adoption verdict.
2. Expand the grammar doc with pack-derived future vocabulary while keeping MVP accepted vocabulary smaller.
3. Implement custom lexer and CST parser.
4. Normalize CST to AST with source spans.
5. Add fixture corpus using cleaned versions of the three pack examples.
6. Add symbol table builder.
7. Add semantic validator passes.
8. Add execution plan model with DAG slices plus event/state-machine control.
9. Add runtime adapter contracts for Inngest without importing Inngest.
10. Add database schema plan for runs/events/artifacts/approvals/tool calls/sandbox sessions/usage.
