# Resumable Runs Current-State Audit

Date: 2026-05-27

Scope: current ability to continue work after browser refresh/tab close and later reconnect

## Verdict

Not implemented end to end.

The repo contains partial design hooks, but the reset app has no active workflow/chat run surface, no run event subscription endpoint, no durable executor implementation, and no reconnect UI.

## Evidence

| Area         | File                                                                           | Finding                                                               | Recommendation                                                                      |
| ------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Database     | `packages/database/src/schema/sessions.ts:18`                                  | `agent_sessions.activeStreamId` exists for resumable stream tracking. | Keep as evidence only; future workflow tables should not overload chat sessions.    |
| Database     | `packages/database/src/schema/sessions.ts:40`                                  | `messages.parts` can preserve rich AI SDK message/tool parts.         | Keep for chat replay; add workflow-native event/artifact tables later.              |
| Flow runtime | `packages/flow/src/runtime/index.ts:161`                                       | `FlowRuntime` includes `resume(runId, event)` and `cancel(...)`.      | Keep and expand through runtime implementation phase.                               |
| Flow adapter | `packages/flow/src/runtime/index.ts:173`                                       | `FlowRuntimeAdapter` includes `resumeWithContext(...)`.               | Keep provider-neutral; implementation belongs in runtime adapter, not `@repo/flow`. |
| App status   | `apps/app/README.md:37`                                                        | Product workflow/chat surfaces intentionally not reintroduced yet.    | Do not claim resumability until new workflow module exists.                         |
| App UI       | `apps/app/app/(authenticated)/_components/dashboard/dashboard-overview.tsx:26` | Dashboard renders `No workflows yet`.                                 | Correct reset state; future workflow UI must reconnect by `runId`.                  |

## Missing Pieces

- `workflow_runs` table.
- `run_events` table with cursor/sequence.
- `task_events` table.
- workflow artifact records.
- active stream/run mapping.
- run snapshot read model.
- durable runtime adapter implementation.
- run SSE endpoint with cursor replay.
- explicit cancellation endpoint.
- app-local reconnect UI.
- authorization tests for run resume.
- refresh/close/reconnect integration tests.

## Risk

High for product correctness.

If this is not designed before rebuilding chat/workflow UI, the platform can regress into the old problem: active work depends on an open browser stream.

## Required Before Workflow UI Rebuild

- [ ] Accept MADR-096.
- [ ] Add the resumable-run checklist to the workflow implementation plan.
- [ ] Do not build a long-running route-local chat loop as the runtime source of truth.
- [ ] Define `runId`, event cursor, snapshot, and cancellation contracts before route UI implementation.
- [ ] Keep browser unload separate from user cancellation.
