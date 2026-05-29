# `.flow` End-to-End Runtime Architecture

Date: 2026-05-27

Status: target architecture and readiness gate. This is not fully implemented yet.

## Readiness Verdict

The architecture is achievable and viable, but the current repo is not 100% wired.

Current state:

- `@repo/flow` is a source-language foundation: lexer, CST parser, contracts, runtime/event schemas.
- The app cannot yet take a prompt, create a validated `.flow`, persist it, compile it, execute it, and resume after refresh.
- The next build must stay package-by-package. Jumping straight into `apps/app` would recreate the old Manus-clone coupling.

## Product Model

`.flow` is the authoring and instruction layer.

Internal runtime layers remain compiler/runtime structures:

```text
.flow source
-> tokens
-> CST
-> AST
-> schema validation
-> symbol table
-> semantic graph / ASG
-> DAG slices
-> CFG + event graph + state machine
-> durable runtime execution
-> events, artifacts, approvals, task reports, issue cards, reflection packets
-> resumable UI
```

Normal users should think in terms of:

- goal;
- workflow;
- tasks;
- workers/subagents;
- tools;
- permissions;
- approvals;
- artifacts;
- events;
- failure behavior;
- improvement/reflection.

They should not need to think in raw DAG edges, AST JSON, CFG nodes, Inngest step IDs, or database event cursors.

## End-To-End Sequence

### 1. User Prompt

The user writes:

```text
Build me a workflow with five subagents:
research, writing, image generation, coding/sandbox validation, and verification.
Ask before publishing. Run every weekday. Continue if research partially fails.
```

`apps/app` should create a workflow draft session and call a server route owned by the product app.

### 2. Flow Architect Agent

The app calls `@repo/ai` to run a flow architect agent.

Rules:

- Use AI SDK structured output for the generation envelope.
- The generated artifact is still `.flow` source, not direct AST/runtime JSON.
- The model can also propose support files such as `brand.md`, `instructions/researcher.md`, or `scripts/validate_posts.py`.

Target output shape:

```ts
type FlowDraftGeneration = {
  flowSource: string;
  files: Array<{ path: string; content: string; kind: string }>;
  summary: string;
  assumptions: string[];
};
```

### 3. Draft Persistence

`@repo/database` stores the untrusted draft:

- workflow identity;
- workflow version;
- `.flow` source;
- support files;
- diagnostics;
- draft status.

The runtime must not execute a model-generated `.flow` until compiler and semantic validation pass.

### 4. Parse And Compile

`@repo/flow` owns this provider-neutral pipeline:

```text
lexFlowSource
-> parseFlowCst
-> normalizeFlowAst
-> buildFlowSymbolTable
-> validateFlowSemantics
-> compileFlowExecutionPlan
```

Current implementation stops at CST. The next implementation phase must start with AST normalization.

### 5. Semantic Resolution

Semantic validation resolves:

- task IDs and dependencies;
- imports and file paths;
- artifact producers and consumers;
- workers and worker policies;
- tool manifests;
- connector account requirements;
- sandbox IO and network policy;
- permissions;
- approvals;
- events and waits;
- budgets and rate limits;
- retry/failure paths;
- reflection/reporting policy.

Nothing external should execute during this phase.

### 6. Activation

When validation passes, the app can activate a workflow version:

- mark version `validated` or `active`;
- persist compiled plan;
- materialize `workflow_triggers` rows;
- compute trigger dedupe/concurrency keys;
- store source hash.

### 7. Runtime Request

Schedules, manual starts, app events, connector events, and workflow events all become run requests:

```text
workflow.scheduler.tick or workflow.event_router
-> workflow.run.requested
-> workflow.run
```

The runtime loads the compiled execution plan by `workflowVersionId`.

### 8. Task Execution

The generic executor interprets plan nodes:

| `.flow` task      | Runtime action                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `ai_task`         | Call `@repo/ai` worker router; produce TaskReport/ECP.                                                                                 |
| `tool_call`       | Resolve platform tool manifest from `@repo/ai/tools`; enforce approval/idempotency/audit; delegate to `@repo/connectors` where needed. |
| `sandbox_command` | Use `@repo/sandbox` adapter; persist command results and file artifacts.                                                               |
| `human_review`    | Persist approval request; wait for approval event/signal.                                                                              |
| `wait_for_event`  | Wait for an EventContextPacket matching compiled rules.                                                                                |
| `subflow`         | Request another workflow run only after invocation semantics exist.                                                                    |

### 9. Multi-Subagent Routing

`.flow` should eventually express workers like this:

```flow
workers: researcher: type: ai;
capabilities: [research, cite_sources];
model_policy: balanced;
allowed_tools: [web.search, web.read];

writer: type: ai;
capabilities: [write_content, brand_voice];
model_policy: quality;

image_worker: type: image;
capabilities: [image_prompt, image_generation];

code_worker: type: code;
capabilities: [write_typescript, write_python, debug_script];
allowed_tools: [sandbox.node, sandbox.python];

verifier: type: verifier;
capabilities: [schema_check, policy_check, factual_check];
```

The compiler resolves each task to either:

- a fixed `worker`;
- a `worker_policy` that the runtime router scores;
- a system worker for non-AI tasks.

The AI SDK layer receives only the scoped tools for that task. This prevents a research worker from receiving publish/delete/payment tools and prevents a writing task from seeing sandbox credentials unnecessarily.

### 10. Events And Reports

Every meaningful execution result becomes persisted event data:

- `run_events`;
- `task_events`;
- EventContextPacket;
- TaskReport;
- artifacts;
- issue cards;
- approval records;
- tool calls;
- sandbox command records;
- usage events.

Subagents report back through ECP/TaskReport, not through ad hoc direct chat state.

### 11. Resume And Reconnect

Browser refresh, close, network drop, or tab sleep must only detach the UI.

Required behavior:

```text
GET /api/runs/:runId
-> load snapshot: run, tasks, events, artifacts, approvals, messages

GET /api/runs/:runId/events?cursor=...
-> replay missed events
-> subscribe to live events

POST /api/runs/:runId/cancel
-> durable cancellation event
```

AI SDK resumable chat streams can help active chat transport, but the workflow run source of truth must be database events and durable runtime state.

## Package Boundaries

| Concern                                                    | Owner                                                | Current readiness                                                       |
| ---------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `.flow` source, lexer, CST, AST, compiler contracts        | `@repo/flow`                                         | Partial: lexer/CST/contracts done; compiler missing.                    |
| AI SDK primitives, workers, subagents, media, model policy | `@repo/ai`                                           | Partial: primitives exist; flow worker router missing.                  |
| Platform tool policy and AI SDK tool adapters              | `@repo/ai/tools`                                     | Partial: connector bridge exists; registry/runtime consumption missing. |
| Composio/direct provider integration                       | `@repo/connectors`                                   | Partial: contracts/adapters exist; workflow persistence missing.        |
| Vercel Sandbox provider implementation                     | `@repo/sandbox`                                      | Partial: adapter boundary exists; workflow task runner missing.         |
| Workflow persistence                                       | `@repo/database`                                     | Missing: workflow-native schema not implemented.                        |
| Durable runtime provider                                   | app/server adapter or future `@repo/runtime-inngest` | Missing.                                                                |
| Product workflow UI/API                                    | `apps/app`                                           | Missing; reset dashboard shell only.                                    |

## Static Inngest Inventory

Do not create one Inngest function per user workflow.

Target static functions:

- `workflow.scheduler.tick`
- `workflow.event_router`
- `workflow.run`
- `workflow.approval.resume`
- `workflow.worker.callback`
- `workflow.reflection`
- `notification.dispatch`
- `usage.rollup`
- `watchdog.stuck_runs`
- `cleanup.old_runs`

The dynamic part is data:

- `workflow_versions`;
- `workflow_triggers`;
- compiled execution plans;
- event match rules;
- worker/tool manifests;
- run state.

## Required Database Objects

Minimum workflow-native tables:

- `workflows`
- `workflow_versions`
- `workflow_files`
- `workflow_triggers`
- `workflow_runs`
- `workflow_run_steps`
- `workflow_events`
- `task_reports`
- `issue_cards`
- `approval_requests`
- `artifacts`
- `tool_calls`
- `sandbox_sessions`
- `usage_events`
- `credit_ledger`

`agent_sessions.activeStreamId` and `messages.parts` can support chat replay, but they are not enough for workflow resume.

## Build Gate

The app rebuild can start only after these gates are green:

- `@repo/flow` can compile valid `.flow` into an execution plan.
- `@repo/database` has workflow version/run/event tables.
- A mock runtime can execute at least `ai_task`, `tool_call`, `sandbox_command`, `human_review`, and `wait_for_event` without provider side effects.
- Run events can be replayed by cursor.
- Explicit cancellation is separate from browser disconnect.
