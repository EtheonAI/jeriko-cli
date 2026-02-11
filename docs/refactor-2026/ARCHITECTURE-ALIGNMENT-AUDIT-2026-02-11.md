# Architecture Alignment Audit (2026-02-11)

Status: NOT 100% ALIGNED  
Scope: Compare implemented code + phase outputs vs canonical Manus architecture guide (`10`, `15`, `17`, `18`)

## Executive Verdict

The repository has meaningful progress from phases 1-9, but the current implementation is not yet fully aligned with the canonical architecture.  
Critical gaps remain in orchestrator runtime, endpoint surface, and event protocol unification.

## Canonical Alignment Matrix

1. Orchestrator API surface (`/v1/sessions`, `/v1/sessions/:id`, `/v1/sessions/:id/messages`)
- Status: FAIL
- Evidence: `services/orchestrator/src/index.ts:37` only registers health routes; no session/message routes exist.
- Evidence: `services/orchestrator/src/routes/health.ts:4` only has `/health`, `/health/ready`, `/health/live`.

2. Claude-driven agent loop with tool-execution round-trips
- Status: FAIL
- Evidence: `services/orchestrator/src/lib/agent-loop.ts:12` returns static metadata object; no model call, no tool loop execution.

3. Entrance tool model parity (12 entrance tools + action/mode variants)
- Status: PARTIAL
- Evidence (good): contracts include comprehensive tool schemas in `packages/contracts/src/tools/*.zod.ts`.
- Evidence (gap): orchestrator registry constructor only registers `plan` and `schedule` in `services/orchestrator/src/lib/tool-registry.ts:50`.

4. Canonical event protocol consistency
- Status: FAIL
- Evidence: `packages/contracts/src/events/event-types.ts:222` sets `total: 19` (16 active + 3 reserved), not canonical `21` (`18 verified + 3 reserved`).
- Evidence: frontend WS contract uses a different namespace (`task:*`, `session:*`, `message:new`) in `apps/app/lib/store/middleware/websocket.middleware.ts:38`.

5. WebSocket event names aligned to canonical docs
- Status: FAIL
- Evidence: canonical names in guide include `message.start`, `message.chunk`, `tool_call.start`, `plan.update`, etc.
- Evidence: app middleware currently processes different names in `apps/app/lib/store/middleware/websocket.middleware.ts:38`.

6. Phase 5 WebRTC media service implementation integrity
- Status: FAIL (artifact mismatch)
- Evidence: phase log claims `services/webrtc-media` exists (`docs/refactor-2026/phase-logs/phase-5.log:47`), but directory is absent in current repo.
- Evidence: phase log claims `services/orchestrator/src/routes/media.ts` exists (`docs/refactor-2026/phase-logs/phase-5.log:95`), but file is absent.
- Note: Next API proxy routes do exist:
  - `apps/app/app/api/sandbox/[id]/browser/stream/route.ts`
  - `apps/app/app/api/sandbox/[id]/terminal/stream/route.ts`

7. Sandbox service capabilities
- Status: PASS (core)
- Evidence: sandbox has lifecycle, execution limits, file ops, browser action allowlist in `services/sandbox/src/index.ts`.

8. File domain correctness (phase 7)
- Status: PASS
- Evidence: tests pass (`71/71`) in `services/file`.

9. Billing domain correctness (phase 7)
- Status: PASS
- Evidence: tests pass (`24/24`) in `services/billing`.

10. Phase logging completeness
- Status: PASS
- Evidence: phase logs exist for 0-9 and added summaries/verification docs under `docs/refactor-2026/phase-logs/`.

## High-Risk Contradictions to Resolve Before Declaring Completion

1. Event-contract split:
- Contracts package and frontend middleware are not speaking the same canonical protocol.

2. Orchestrator runtime split:
- Contract/test scaffolding exists, but production orchestrator entrypoint is still health-only.

3. Phase-claim vs repository-state drift:
- Phase 5 log claims delivered artifacts that are not present on `main`.

## Mandatory Fix Order (No Drift)

1. Build orchestrator HTTP routes first:
- Add `POST /v1/sessions`
- Add `GET /v1/sessions/:id`
- Add `POST /v1/sessions/:id/messages`
- Wire to actual session/timeline persistence and agent loop entrypoint.

2. Replace stub loop with real loop:
- Implement model call + tool routing loop in `services/orchestrator/src/lib/agent-loop.ts`.
- Integrate prompt builder, context compaction, and tool executor.

3. Unify event protocol:
- Define single canonical schema (21 events) in contracts.
- Add adapter layer so frontend middleware consumes canonical event names.
- Remove duplicate divergent event namespaces.

4. Reconcile phase 5 deliverables:
- Either restore committed `services/webrtc-media` + orchestrator media routes from source branch, or correct phase logs to match actual state.

5. Re-run phase verification gate:
- Re-run targeted tests + integration tests.
- Update phase logs with real commit SHAs and test output.

## Current Readiness

Do not mark architecture as 100% complete yet.  
Current state is "partially aligned, not production-parity with canonical architecture".
