# MADR-078: `.flow` orchestrates AI SDK subagents, tools, and reporting

Status: Accepted

Date: 2026-05-26

## Context

Jeriko needs advanced AI behavior: platform tools, connector tools, subagents, tool rendering, human approvals, abort/stop behavior, cron jobs, event triggers, and reporting from subagents back to a main orchestrator.

AI SDK provides strong primitives: `ToolLoopAgent`, tool calls, approval gates, typed tool parts, custom data parts, stop conditions, abort signals, and subagent patterns. It does not replace our product workflow language or durable runtime.

## Decision

Use `.flow` as the orchestration policy layer.

Use AI SDK as the model/tool/agent primitive layer.

Use Inngest/runtime execution for durable workflow runs, scheduled triggers, event triggers, retries, waits, and cancellation.

Concretely:

- `.flow` declares tasks, subagents, allowed tools, connector permissions, reporting policy, approval behavior, retry/failure policy, and triggers.
- `@repo/flow` compiles `.flow` into an execution graph/state machine.
- Inngest executes durable workflow steps.
- `@repo/ai` provides AI SDK capabilities, tool manifests/adapters, agent primitives, message/stream helpers, provider policy, telemetry, retrieval, and media helpers.
- `@repo/ai/tools` normalizes internal platform tools and connector tools before AI SDK exposure.
- `apps/app` renders the custom UI from AI SDK `UIMessage.parts`, runtime events, artifacts, and `.flow` state.

## Subagent Reporting Modes

Subagent reporting must be explicit in `.flow` and validated by the compiler/runtime.

Supported policy vocabulary:

- `none`: subagent output is used internally only.
- `final`: subagent reports one final summary to the main agent.
- `milestone`: subagent reports configured milestone summaries.
- `every_task`: subagent reports after every task.
- `full_trace`: subagent trace is visible to the main agent and user.
- `on_failure`: subagent reports only on failure/retry escalation.
- `scheduled`: subagent reports on a cron/event cadence.

The runtime can summarize subagent output back to the main agent while preserving full traces as artifacts when policy allows.

## Abort And Cancellation

User stop behavior has two layers:

- active HTTP/AI stream: forward `req.signal` to AI SDK calls and persist partial output through `onAbort` where configured;
- durable workflow run: emit a cancellation event that Inngest/runtime steps check between tool/subagent calls.

Do not model durable cancellation as only a client-side stream abort.

## Tool Rendering

The custom UI renders both platform tools and connector tools through one app-local typed registry.

Rules:

- source of truth is AI SDK `UIMessage.parts`;
- tool part state drives rendering;
- normalized manifest metadata from `@repo/ai/tools` drives icons, labels, risk, approval copy, billing/audit hints, and artifact links;
- raw connector/Composio SDK shapes are not rendered directly.

## Consequences

Positive:

- AI SDK remains a focused primitive layer.
- `.flow` remains the product-specific workflow language.
- Durable jobs, cron, event triggers, retries, and cancellation live in the right runtime layer.
- Subagent reporting becomes configurable and testable instead of implicit.
- Tool rendering works for internal tools and connector tools with one normalized contract.

Negative:

- Requires more compiler/runtime policy work before advanced subagents are production-ready.
- Requires explicit tests for stop/cancel, reporting modes, and connector-tool rendering.

## Evidence

- AI SDK workflow docs recommend choosing between flexibility and control and list sequential, parallel, evaluation, orchestration, and routing patterns.
- AI SDK loop control stops when a tool lacks `execute`, requires approval, or a stop condition is met.
- AI SDK subagent docs support parent-agent delegation, independent context, progress streaming, and summarized model output.
- AI SDK human-in-the-loop examples use approval-requested tool states and `addToolApprovalResponse`.
- AI SDK advanced streaming docs require abort signals/backpressure-aware stream behavior.

## Validation Checklist

- [ ] `.flow` grammar/spec includes subagent, report, trigger, approval, retry, and cancellation policy.
- [ ] `@repo/ai/tools` exposes normalized metadata for internal and connector tools.
- [ ] App-local tool renderer registry supports platform and connector tools.
- [ ] Runtime forwards abort signals to AI SDK calls.
- [ ] Durable runs support cancellation events separate from HTTP abort.
- [ ] Subagent reporting modes have tests.
- [ ] Inngest tasks emit progress/artifact events consumable by the custom UI.
