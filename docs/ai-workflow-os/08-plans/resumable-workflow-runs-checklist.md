# Resumable Workflow Runs Checklist

Date: 2026-05-27

Status: required before workflow/chat rebuild

Related:

- [`MADR-096`](../07-madr/MADR-096-resumable-workflow-runs-and-ui-reconnect.md)
- [`2026-05-27-resumable-workflow-runs-and-ui-reconnect.md`](../09-research/2026-05-27-resumable-workflow-runs-and-ui-reconnect.md)
- [`resumable-runs-current-state-audit-2026-05-27.md`](../10-audit/resumable-runs-current-state-audit-2026-05-27.md)

## Non-Negotiable Rules

- [ ] Browser refresh does not cancel a run.
- [ ] Browser tab close does not cancel a run.
- [ ] Network loss does not cancel a run.
- [ ] Explicit Stop/Cancel creates a durable cancellation event.
- [ ] Run UI renders from persisted state, not in-memory component state.
- [ ] Event streams are resumable by cursor.
- [ ] A completed run is readable without any active stream.

## Data Model Gate

- [ ] `workflow_runs` table designed.
- [ ] `run_events` table designed with monotonic sequence/cursor.
- [ ] `task_events` table designed or explicitly folded into `run_events`.
- [ ] artifact table/read model designed.
- [ ] message persistence relationship to run/session decided.
- [ ] active stream ID mapping decided.
- [ ] cancellation request schema decided.
- [ ] ownership and authorization columns decided: `userId`, `orgId`, or both.
- [ ] retention/expiration policy decided for active streams and event history.

## Runtime Gate

- [ ] Start run creates durable `runId`.
- [ ] Runtime persists every state transition as an event.
- [ ] Runtime can resume from an event/context packet.
- [ ] Runtime checks cancellation at safe points.
- [ ] Runtime emits terminal `completed`, `failed`, `cancelled`, or `paused` event.
- [ ] Runtime treats UI disconnect as subscriber detach only.
- [ ] Runtime adapter remains outside `@repo/flow`.

## API Gate

- [ ] `POST /api/runs` starts a run and returns `runId`.
- [ ] `GET /api/runs/:runId` returns snapshot/read model.
- [ ] `GET /api/runs/:runId/events?cursor=...` replays missed events and subscribes live.
- [ ] `POST /api/runs/:runId/cancel` emits durable cancellation request.
- [ ] Endpoints authorize access by user/org membership.
- [ ] Endpoints never trust client-provided user IDs.
- [ ] No endpoint requires optional provider secrets during build.

## UI Gate

- [ ] Route state is keyed by `runId`.
- [ ] On mount, UI loads snapshot first.
- [ ] UI reconnects from last acknowledged cursor.
- [ ] UI dedupes replayed events by cursor/sequence.
- [ ] UI shows reconnecting/paused/cancelled/failed/completed states.
- [ ] UI exposes explicit Stop/Cancel separate from closing the browser stream.
- [ ] UI can render historical messages, tool calls, task reports, artifacts, approvals, and issue cards.

## AI SDK Gate

- [ ] Use AI SDK stream helpers for UI protocol where helpful.
- [ ] Do not treat AI SDK `resume: true` as the whole platform resume architecture.
- [ ] Account for AI SDK abort/resume conflict when direct request streams are used.
- [ ] Keep durable workflow execution outside the browser request lifecycle.
- [ ] Persist AI SDK `UIMessage.parts` for replay.

## Tests

- [ ] Start run, disconnect UI, verify run continues.
- [ ] Refresh while run is active, verify snapshot plus live events.
- [ ] Reconnect with old cursor, verify missed events replay.
- [ ] Reconnect twice, verify no duplicate visible events.
- [ ] Close/unload does not create cancellation event.
- [ ] Explicit Stop creates cancellation event and terminal state.
- [ ] Completed run loads without active stream.
- [ ] Unauthorized resume fails.
- [ ] Expired stream still allows snapshot/history view.
