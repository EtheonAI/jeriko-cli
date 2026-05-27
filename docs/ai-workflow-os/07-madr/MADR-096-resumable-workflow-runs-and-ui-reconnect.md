# MADR-096: Require Durable Runs And Resumable UI Reconnect

Status: Accepted

Date: 2026-05-27

Packages/apps: `@repo/flow`, `@repo/database`, `@repo/ai`, `apps/app`, future runtime adapter

## Context

The product must match a key Manus behavior: if the user refreshes the app, closes the tab, loses network, or returns later, an active agent/workflow run must continue and the UI must be able to reconnect.

The current reset app does not implement this end to end. It only has pieces:

- `packages/database/src/schema/sessions.ts` has `activeStreamId`;
- `packages/database/src/schema/sessions.ts` persists `messages.parts`;
- `packages/flow/src/runtime/index.ts` defines `resume` and `resumeWithContext` contracts;
- `apps/app` is currently a reset dashboard shell with no workflow module enabled.

Official docs also confirm the split:

- AI SDK v6 supports resumable chat streams, but requires app-owned persistence and warns that abort behavior conflicts with stream resumption.
- Inngest and Vercel Workflow both provide durable execution concepts where server-side work survives failures, pauses, and restarts.

## Decision

All workflow/agent execution must be modeled as a durable run, separate from the browser stream.

The platform must implement two layers:

1. Durable execution: a `runId`-backed workflow run continues server-side through the selected runtime adapter, with persisted state/events/artifacts.
2. Resumable UI: the app loads a run snapshot and reconnects to live events by `runId` and cursor.

Browser refresh or tab close must only detach the UI stream. It must not cancel the run.

Only an explicit Stop/Cancel command may emit a durable cancellation event.

## Required Runtime Shape

```text
POST /api/runs
-> create workflow_run
-> request durable execution
-> persist run_events/task_events/artifacts/messages
-> return runId

GET /api/runs/:runId/events?cursor=...
-> auth check
-> replay events after cursor
-> subscribe to live events

POST /api/runs/:runId/cancel
-> auth check
-> persist workflow.run.cancel.requested
-> runtime observes cancellation
-> persist final cancellation state
```

## Consequences

Positive:

- Refresh/close no longer loses active work.
- The timeline, artifact panel, approvals, and chat can all render from the same persisted event log.
- Runtime cancellation becomes auditable and distinct from transport disconnect.
- The app can recover from expired UI streams by loading durable state.

Negative:

- Requires workflow-native tables and event cursor discipline.
- Requires route tests for reconnect/replay/cancel behavior.
- AI SDK direct `resume: true` is not enough for the full platform and must be used carefully because abort and resume conflict.

## Alternatives Considered

- Keep long-running model/workflow execution inside an app route stream.
  - Rejected. Browser close/refresh can abort the request and lose work.
- Rely only on AI SDK resumable chat streams.
  - Rejected as insufficient. It helps chat transport but does not replace durable workflow runs, artifacts, task events, approvals, and runtime cancellation.
- Treat browser close as user cancellation.
  - Rejected. This breaks Manus parity and is unsafe for long-running scheduled/autonomous workflows.
- WebSocket-first runtime.
  - Deferred. SSE plus replay is enough for one-way run updates; WebSockets can be added only if bidirectional live collaboration requires it.

## Evidence

- `packages/database/src/schema/sessions.ts:18`: legacy `activeStreamId` field.
- `packages/database/src/schema/sessions.ts:40`: persisted AI SDK `messages.parts`.
- `packages/flow/src/runtime/index.ts:161`: `FlowRuntime.resume`.
- `packages/flow/src/runtime/index.ts:173`: `FlowRuntimeAdapter.resumeWithContext`.
- `apps/app/README.md:37`: current reset shell does not reintroduce workflow/chat surfaces yet.
- `apps/app/app/(authenticated)/_components/dashboard/dashboard-overview.tsx:26`: dashboard says no workflows yet.
- `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams`: resume requires persisted messages/active streams, Redis stream storage, POST and GET endpoints; abort and resume conflict.
- `https://www.inngest.com/docs/learn/how-functions-are-executed`: durable execution persists state outside the function context and resumes work across failures.
- `https://vercel.com/docs/workflow`: Vercel Workflow persists state/event logs and supports pause/resume/durability.
- [`2026-05-27-resumable-workflow-runs-and-ui-reconnect.md`](../09-research/2026-05-27-resumable-workflow-runs-and-ui-reconnect.md)

## Impacted Files

Future implementation areas:

- `packages/flow/src/runtime/*`
- `packages/flow/src/events/*`
- `packages/database/src/schema/*`
- `packages/ai/src/server/*`
- `apps/app/app/(authenticated)/workflows/*`
- `apps/app/app/api/runs/*`
- future runtime adapter package/module

## Validation Checklist

- [x] Current local code evidence checked.
- [x] AI SDK official resume-stream docs checked.
- [x] Inngest durable execution docs checked.
- [x] Vercel Workflow docs checked.
- [x] Current status documented as not implemented end to end.
- [ ] Add workflow-native run/event/artifact schema.
- [ ] Add run snapshot endpoint.
- [ ] Add run event SSE endpoint with cursor replay.
- [ ] Add durable cancellation endpoint.
- [ ] Add app-local reconnect UI.
- [ ] Add tests for refresh/close/reconnect/replay/cancel.
