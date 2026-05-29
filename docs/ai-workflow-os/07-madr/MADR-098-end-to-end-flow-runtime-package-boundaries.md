# MADR-098: Build `.flow` End-To-End Runtime Through Package Phases

Status: Accepted

Date: 2026-05-27

## Context

The product goal is a full `.flow` workflow platform:

- user prompt creates a workflow;
- AI drafts `.flow` and support files;
- parser/compiler validates it;
- database stores versions, triggers, runs, events, artifacts, approvals, tool calls, and sandbox sessions;
- Inngest executes durable runs;
- AI SDK runs scoped subagents/workers;
- connector and sandbox packages execute side effects behind policy;
- app UI renders/reconnects by `runId` and cursor.

The current implementation is not complete. `@repo/flow` has lexer/CST/contracts, not a full compiler/runtime. `apps/app` is a reset dashboard shell. The database does not yet have workflow-native tables.

## Decision

Build the `.flow` platform through strict package phases before rebuilding the app workflow UI.

The accepted order is:

1. `@repo/flow`: AST normalization, symbol table, semantic validation, execution plan, mock interpreter.
2. `@repo/database`: workflow-native Drizzle tables and migrations.
3. Runtime adapter: Inngest static function inventory and generic executor.
4. `@repo/ai`: flow architect agent, worker router, subagent task runner, TaskReport/ECP mapping.
5. `@repo/ai/tools`, `@repo/connectors`, `@repo/sandbox`: policy-wrapped side-effect execution.
6. `apps/app`: workflow draft/validation/activation APIs, runs APIs, timeline, approvals, artifacts, reconnect UI.

`@repo/flow` remains provider-neutral and must not import AI SDK, Inngest, Vercel Sandbox, Drizzle, Composio, Next.js, or React.

## Consequences

Positive:

- Prevents app route code from becoming the runtime.
- Keeps provider SDKs behind the owning packages.
- Allows package-level tests before UI work.
- Makes the five-subagent workflow model testable.
- Keeps Manus-style resume as a first-class runtime requirement.

Negative:

- Slower than building a quick chat demo.
- Requires multiple package phases before visible workflow UI returns.
- Requires discipline to avoid shortcutting through `apps/app`.

## Alternatives Considered

### Build the app UI first

Rejected. The app would invent temporary route-local workflow objects and create the same coupling that made the old project dirty.

### Import the flow runtime pack implementation directly

Rejected. The pack is useful research, but it mixes YAML parsing, Inngest, and provider/runtime code inside one implementation.

### Put Inngest execution inside `@repo/flow`

Rejected. `@repo/flow` is the language/compiler contract package. Provider runtime belongs in an adapter layer.

### Let AI SDK main chat orchestrate everything directly

Rejected. AI SDK is the model/tool/subagent primitive layer, not the durable workflow source of truth.

## Evidence

- `packages/flow/src/lexer/index.ts`: custom lexer exists.
- `packages/flow/src/parser/index.ts`: CST parser exists.
- `packages/flow/src/compiler/index.ts`: compiler schemas exist, implementation missing.
- `packages/flow/src/runtime/index.ts`: runtime adapter contracts exist, provider adapter missing.
- `packages/flow/src/events/index.ts`: ECP/TaskReport/reflection contracts exist.
- `packages/ai/src/tools/connectors.ts`: connector bridge has permission/risk/approval policy.
- `packages/connectors/src/contracts.ts`: Composio/direct/mock connector boundary exists.
- `packages/sandbox/src/contracts.ts`: provider-neutral sandbox boundary exists.
- `packages/database/src/schema/sessions.ts`: resume hints exist but not workflow-native persistence.
- `apps/app/README.md`: active app is a reset dashboard shell and workflow module is not reintroduced yet.
- `https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent`: AI SDK supports multi-step tool agents through `ToolLoopAgent`.
- `https://ai-sdk.dev/docs/agents/subagents`: AI SDK supports parent-to-subagent delegation.
- `https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`: tools use `inputSchema`, optional `execute`, approval gates, and `stopWhen`.
- `https://www.inngest.com/docs/learn/inngest-steps`: durable steps persist completed output and retry failed step code.
- `https://www.inngest.com/docs/features/inngest-functions/steps-workflows/wait-for-event`: event waits support human-in-the-loop and external callbacks.
- `https://www.inngest.com/docs/guides/concurrency`: keyed/scoped concurrency supports multi-tenant runtime limits.
- `https://vercel.com/docs/vercel-sandbox/sdk-reference`: Vercel Sandbox is the correct provider for untrusted code execution through `@repo/sandbox`.
- `https://docs.composio.dev/docs/how-composio-works`: Composio sessions scope user accounts, tools, auth, and execution state.

## Impacted Files And Packages

- `packages/flow/**`
- `packages/database/**`
- `packages/ai/**`
- `packages/connectors/**`
- `packages/sandbox/**`
- future runtime adapter files
- `apps/app/app/api/workflows/**`
- `apps/app/app/api/runs/**`
- future `apps/app/app/(authenticated)/workflows/**`

## Validation Checklist

- [ ] `@repo/flow` compiles `.flow` source to a serializable execution plan without provider imports.
- [ ] `@repo/database` has workflow-native tables and migrations.
- [ ] Mock runtime can run a compiled plan and emit deterministic events.
- [ ] Inngest adapter maps compiled tasks to durable steps and waits.
- [ ] `@repo/ai` worker router scopes tools and models by task/worker policy.
- [ ] Tool calls enforce approval, idempotency, audit, and billing before side effects.
- [ ] Sandbox tasks require explicit timeout, IO, env, and network policy.
- [ ] Run events support cursor replay.
- [ ] Browser refresh/tab close does not cancel a run.
- [ ] Explicit Stop/Cancel emits a durable cancellation event.
- [ ] `apps/app` renders workflow runs from persisted state/events, not in-memory route state.
