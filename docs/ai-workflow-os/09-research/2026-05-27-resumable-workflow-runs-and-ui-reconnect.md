# Resumable Workflow Runs And UI Reconnect Research

Date: 2026-05-27

Status: accepted as a core platform requirement; not implemented end to end in current reset app

## Question

Can the platform behave like Manus when a user refreshes the app or closes the tab, so the work continues and the user can return to the same live run?

## Current Local Verdict

No, not yet.

The current repo has contracts and database hints that point toward resumability, but the active `apps/app` reset shell does not implement a workflow/chat execution surface, run subscription endpoint, durable executor wiring, or reconnect/replay UI.

## Local Code Evidence

| File                                                                           | Evidence                                                                         | Meaning                                                                             |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/database/src/schema/sessions.ts:18`                                  | `activeStreamId` exists on `agent_sessions`.                                     | Prior schema anticipated resumable stream tracking. It is not sufficient by itself. |
| `packages/database/src/schema/sessions.ts:40`                                  | `messages.parts` stores full AI SDK UIMessage parts.                             | Rich replay of messages/tool parts is possible if routes persist them correctly.    |
| `packages/flow/src/runtime/index.ts:161`                                       | `FlowRuntime` exposes `start`, `resume`, and `cancel`.                           | The provider-neutral flow contract knows about resume/cancel.                       |
| `packages/flow/src/runtime/index.ts:173`                                       | `FlowRuntimeAdapter` exposes `resumeWithContext`.                                | Runtime adapters can resume from normalized events/context packets.                 |
| `apps/app/README.md:37`                                                        | Reset shell says not to reintroduce chat/workflow/artifact/sandbox surfaces yet. | There is no active workflow UI module to reconnect today.                           |
| `apps/app/app/(authenticated)/_components/dashboard/dashboard-overview.tsx:26` | Dashboard says `No workflows yet`.                                               | The workflow module is not enabled.                                                 |

## Official Docs Checked

| Source                                                                                        | Type                  | Checked Date | Relevant Claim                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------- | --------------------- | -----------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams`                                    | Official AI SDK docs  |   2026-05-27 | `useChat` has a `resume` option and requires persistence for messages and active streams, Redis-backed stream storage, a POST stream creation endpoint, and a GET resume endpoint.                       |
| `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams`                                    | Official AI SDK docs  |   2026-05-27 | Important caveat: stream resumption is not compatible with abort behavior; refresh/close triggers an abort signal that can break AI SDK stream resumption if generation is tied directly to the request. |
| `https://www.inngest.com/docs/learn/how-functions-are-executed`                               | Official Inngest docs |   2026-05-27 | Durable execution persists state outside the function context, resumes from failure/interruption, retries steps, and does not re-execute completed steps.                                                |
| `https://vercel.com/docs/workflow`                                                            | Official Vercel docs  |   2026-05-27 | Vercel Workflow is a managed durable platform for functions that pause, resume, maintain state, survive deployments/crashes, and persist event logs.                                                     |
| `docs/ai-workflow-os/09-research/2026-05-27-vercel-workflow-vs-inngest-runtime-comparison.md` | Repo research         |   2026-05-27 | Inngest remains the preferred MVP runtime for dynamic `.flow`; Vercel Workflow stays a tracked evaluation path.                                                                                          |

## Architecture Finding

There are two separate problems. They must not be merged.

### 1. Durable execution

The run must continue when the browser connection disappears.

For AI Workflow OS, long-running work cannot live only inside an `app/api/chat` request handler. The workflow run must be represented by a durable `runId`, persisted run state, persisted events, persisted artifacts, and a runtime adapter such as Inngest or Vercel Workflow.

Browser refresh, tab close, network loss, and mobile sleep should only detach the UI subscriber. They must not cancel the run.

### 2. Resumable UI

When the user returns, the app should:

1. authenticate the user;
2. load the run snapshot by `runId`;
3. load persisted messages, artifacts, approvals, task reports, and issue cards;
4. reconnect to live events from the last acknowledged cursor;
5. replay missed events before subscribing to new events.

AI SDK resumable streams can help with chat stream continuity, but it is not the whole solution for an autonomous workflow OS. The product needs durable run state plus event replay even when no chat stream is active.

## Critical Rule

Closing the tab is not a cancellation.

Only an explicit user Stop/Cancel action may create a durable cancellation event.

That event must flow through the runtime, for example:

```text
POST /api/runs/:runId/cancel
-> workflow.run.cancel.requested
-> runtime cancel check
-> run status: cancelling/cancelled
-> final event persisted
-> UI receives cancellation event on reconnect or live stream
```

## Required Product Contracts

Minimum future contracts:

- `workflow_runs`
- `run_events`
- `task_events`
- `messages`
- `artifacts`
- `active_stream_id`
- run cursor / event sequence
- durable cancellation request
- explicit resume policy
- explicit stream expiration policy

Minimum future endpoints:

- `POST /api/runs`
- `GET /api/runs/:runId`
- `GET /api/runs/:runId/events?cursor=...`
- `POST /api/runs/:runId/cancel`

Optional chat-specific endpoint if AI SDK `useChat({ resume: true })` is used:

- `GET /api/chat/:chatId/stream`

## Implementation Implications

- `@repo/flow` owns provider-neutral resume/cancel contracts, not the provider implementation.
- `@repo/database` must own workflow-native run/event/artifact tables later; current `agent_sessions.activeStreamId` is only legacy evidence.
- `@repo/ai` owns AI SDK message/stream helpers and platform tool policy, but not durable run persistence.
- `apps/app` owns the route-local UI that reconnects by `runId` and renders snapshots/events.
- Runtime provider adapters own Inngest/Vercel Workflow integration behind `@repo/flow` contracts.

## Test Requirements

The feature is not complete until tests prove:

- start a run, close the UI connection, and the run continues;
- refresh during an active run and the UI receives a replayed snapshot plus live events;
- missed events replay exactly once by cursor;
- browser unload does not emit `workflow.run.cancel.requested`;
- explicit Stop emits cancellation and the runtime observes it;
- a completed run renders from persisted state without an active stream;
- an expired active stream still allows snapshot/history rendering;
- unauthorized users cannot resume another user's run.

## Conclusion

Manus-style resume is achievable and required, but it is not currently implemented in the reset app.

The correct platform architecture is:

```text
durable run state + persisted events + resumable UI stream
```

not:

```text
one in-memory chat request stream
```
