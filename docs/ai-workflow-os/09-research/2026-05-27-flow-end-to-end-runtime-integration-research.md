# `.flow` End-to-End Runtime Integration Research

Date: 2026-05-27

Status: current research gate before wiring `@repo/flow` into AI SDK, Inngest, Vercel Sandbox, connectors, database, and `apps/app`.

## Question

Can the current codebase already run a full prompt-to-`.flow` autonomous workflow with subagents, dynamic routing, tools, approvals, sandbox execution, durable resume, and UI reconnect?

## Honest Verdict

No.

The current codebase has the right package boundaries and several useful contracts, but it is not end-to-end ready:

- `@repo/flow` can lex `.flow` and parse a source-preserving CST, plus it defines AST/runtime/event contracts.
- `@repo/flow` cannot yet normalize CST to AST, build symbols, validate semantics, compile an executable plan, or interpret a plan.
- `@repo/database` does not yet have workflow-native Drizzle tables for versions, triggers, runs, run events, task events, approvals, artifacts, tool calls, or sandbox run records.
- The Inngest runtime adapter is not implemented in active code.
- `@repo/ai` has AI SDK v6 boundaries and platform tool policy, but not a flow-aware worker router or task runner.
- `@repo/sandbox` has a Vercel Sandbox adapter boundary, but workflow task persistence/artifact linking is not wired.
- `@repo/connectors` has Composio/session/provider contracts, but workflow trigger/tool policy persistence is not wired.
- `apps/app` is still a reset dashboard shell with no workflow creation, run timeline, chat, approval, artifact, or reconnect UI.

## Official Sources Checked

| Source                                                                                   | Type                         | Evidence Used                                                                                                                                      | Impact                                                                                                          |
| ---------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent`                          | Official AI SDK docs         | `ToolLoopAgent` is the current reusable multi-step agent class; it accepts `tools`, `stopWhen`, `activeTools`, `output`, and per-step preparation. | Use AI SDK in `@repo/ai` for worker/subagent execution, not inside `@repo/flow`.                                |
| `https://ai-sdk.dev/docs/agents/subagents`                                               | Official AI SDK docs         | A parent agent can delegate work to subagents via tools; subagents can have isolated model, instructions, context, and tools.                      | `.flow` should compile worker/task policy into scoped agent invocations.                                        |
| `https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`                             | Official AI SDK docs         | Tools use `inputSchema`; `execute` is optional; `needsApproval` exists for sensitive tools; multi-step calls use `stopWhen`.                       | Platform tools must be wrapped by `@repo/ai/tools` and gated by permission/approval.                            |
| `https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data`                         | Official AI SDK docs         | Structured output uses `generateText` or `streamText` with `Output.object`; structured output counts as a step when combined with tools.           | Flow creation/repair should use structured output, then parse/validate the emitted `.flow` source.              |
| `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams`                               | Official AI SDK docs         | `useChat` resume is a stream transport feature requiring app-owned persistence and active stream tracking.                                         | Useful for UI continuity, but not sufficient for durable workflow execution.                                    |
| `https://www.inngest.com/docs/learn/inngest-steps`                                       | Official Inngest docs        | `step.run()` stores successful step output and retries thrown errors; non-deterministic work belongs in `step.run`.                                | The runtime executor should run each `.flow` task through durable step boundaries.                              |
| `https://www.inngest.com/docs/features/inngest-functions/steps-workflows/wait-for-event` | Official Inngest docs        | `step.waitForEvent()` pauses until an event arrives or times out; useful for human-in-the-loop and external events.                                | Map `human_review` and `wait_for_event` to durable waits/signals.                                               |
| `https://www.inngest.com/docs/reference/typescript/functions/triggers`                   | Official Inngest docs        | `eventType`, `cron`, and typed trigger helpers support triggers, `step.waitForEvent`, and `step.sendEvent`.                                        | Runtime event names must be typed and normalized at the adapter boundary.                                       |
| `https://www.inngest.com/docs/guides/concurrency`                                        | Official Inngest docs        | Concurrency limits active step execution; sleeping/waiting runs do not count; keyed/scoped limits support multi-tenant control.                    | Compile and runtime policy must include org/workflow/tool/provider concurrency keys.                            |
| `https://vercel.com/docs/workflow`                                                       | Official Vercel docs         | Vercel Workflow is beta, durable, resumable, and code-authored with `"use workflow"` / `"use step"`.                                               | Keep as evaluation path; Inngest remains better for dynamic data-driven `.flow` MVP.                            |
| `https://vercel.com/docs/vercel-sandbox/sdk-reference`                                   | Official Vercel Sandbox docs | Sandbox creates ephemeral Linux microVMs; supports `node24`, `node22`, `python3.13`, commands, files, ports, snapshots, and network policies.      | Use only through `@repo/sandbox`; require explicit task IO, timeout, env, and network policy.                   |
| `https://docs.composio.dev/docs/how-composio-works`                                      | Official Composio docs       | A session defines user scope, enabled toolkits/tools, auth, execution state, MCP URL, and workbench state.                                         | Connector sessions stay in `@repo/connectors`; workflow-visible execution goes through `@repo/ai/tools` policy. |
| `https://docs.composio.dev/docs/configuring-sessions`                                    | Official Composio docs       | Sessions can enable/disable toolkits, select accounts, authorize connections, list toolkits, and provide native tools/MCP URL.                     | `.flow` tool references must resolve to platform manifests, not raw provider tools.                             |

## Local Evidence Checked

| Local file                                                                  | Evidence                                                                            | Meaning                                                                             |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/flow/src/lexer/index.ts`                                          | Custom lexer exists.                                                                | `.flow` source can be tokenized with spans and YAML-feature rejection.              |
| `packages/flow/src/parser/index.ts`                                         | CST parser exists.                                                                  | Source shape can be preserved for editor/repair diagnostics.                        |
| `packages/flow/src/ast/index.ts`                                            | AST schemas exist.                                                                  | Target structural model exists but is not produced by the parser yet.               |
| `packages/flow/src/compiler/index.ts`                                       | Symbol table and execution plan schemas exist.                                      | Compiler contracts exist; implementation is missing.                                |
| `packages/flow/src/runtime/index.ts`                                        | Runtime adapter contracts include run request, resume, and cancel.                  | Provider-neutral runtime shape exists; no provider adapter implementation exists.   |
| `packages/flow/src/events/index.ts`                                         | ECP, TaskReport, IssueCard, RunReflectionPacket exist.                              | Event/report primitives exist for runtime/UI, but are not persisted or emitted yet. |
| `packages/ai/README.md`                                                     | AI SDK v6 package boundary is defined.                                              | AI primitives are intentionally separate from workflow language.                    |
| `packages/ai/src/tools/connectors.ts`                                       | Connector tool bridge wraps `@repo/connectors` with risk, permission, and approval. | Correct direction for connector tools; workflow runtime still needs to consume it.  |
| `packages/connectors/src/contracts.ts`                                      | Session, toolkit, action, trigger, connection, execute contracts exist.             | Connector provider boundary exists; app/runtime persistence missing.                |
| `packages/sandbox/src/contracts.ts`                                         | Provider-neutral sandbox adapter exists.                                            | Sandbox task execution can be abstracted; workflow task runner missing.             |
| `packages/database/src/schema/sessions.ts`                                  | `activeStreamId` and `messages.parts` exist.                                        | Helpful chat resume hints, not workflow run persistence.                            |
| `packages/database/src/schema/sandboxes.ts`                                 | E2B-named fields remain.                                                            | Needs provider-neutral workflow run/task association migration.                     |
| `packages/database/src/schema/scheduledTasks.ts`                            | Legacy scheduled task and trigger concepts exist.                                   | Useful reference, but not rich enough for `.flow` versions/runs/events.             |
| `apps/app/README.md`                                                        | Reset shell explicitly forbids reintroducing workflow/chat surfaces yet.            | Active app is not a workflow UI.                                                    |
| `apps/app/app/(authenticated)/_components/dashboard/dashboard-overview.tsx` | Empty state says no workflows yet.                                                  | No active workflow surface.                                                         |

## Architecture Finding

The platform must be built as a chain of independently testable package phases:

```text
user prompt
-> flow architect agent in @repo/ai
-> generated .flow source + support files
-> persist draft workflow version in @repo/database
-> @repo/flow lex/parse/CST
-> AST normalization
-> symbol table
-> semantic validation against tool/worker/permission/artifact registries
-> execution plan
-> persist validated version + triggers
-> Inngest adapter requests durable run
-> runtime executes task-by-task
-> @repo/ai executes AI/subagent tasks
-> @repo/ai/tools executes policy-wrapped tools
-> @repo/connectors handles Composio/direct external app execution
-> @repo/sandbox runs sandbox commands
-> @repo/database persists events/reports/artifacts/approvals
-> apps/app replays snapshot/events and subscribes live by cursor
```

## Multi-Subagent Finding

The five-subagent example is achievable only after worker policy exists in `.flow` AST/semantic validation:

- `researcher`: read-only web/search/retrieval tools.
- `writer`: content generation and brand instructions.
- `image_worker`: image prompt/generation/media artifacts.
- `code_worker`: code generation plus sandbox-bound validation tools.
- `verifier`: policy/content/schema validation and issue reporting.

The main orchestrator should not dump every tool into every model call. The compiled plan must scope tools by task/worker:

```text
task.worker or task.worker_policy
-> resolve worker symbol
-> resolve allowed tools
-> resolve model policy
-> create scoped ToolLoopAgent call
-> emit TaskReport + ECP
```

## Implementation Impact

Do not start with `apps/app` workflow UI.

The correct next implementation sequence is:

1. Finish `@repo/flow` Phase D/E/F/G: AST normalization, symbol table, semantic validation, execution planner.
2. Add `@repo/database` workflow-native persistence.
3. Add a runtime adapter package/module for Inngest static functions.
4. Add `@repo/ai` flow worker router and task runners.
5. Wire `@repo/sandbox` and `@repo/connectors` through policy-wrapped runtime tasks.
6. Only then build `apps/app` workflow creation, run timeline, chat, approvals, artifacts, and reconnect UI.

## Open Questions

- Should the Inngest adapter live in `apps/app/app/api/inngest` first or in a future `@repo/runtime-inngest` package consumed by the app route?
- Should `workers` and `worker_policy` land in `.flow` v0.1 AST now, or be reserved until the execution planner supports them?
- What is the minimum artifact storage package boundary: reuse `@repo/storage` or create a workflow-specific artifact facade?
- What should be the first production-grade tool registry source: static manifests in `@repo/ai/tools`, database-backed manifests, or a hybrid?
- Which run event transport should be MVP: SSE with cursor replay first, WebSocket later only for collaboration?
