# Phased Migration Plan

## Goal
Move from current split architecture to a canonical Manus-style Rubic implementation with:
- Node orchestrator as single control plane
- Go WebRTC service for Neko/session media
- Composio connector boundary retained
- One sandbox policy engine

## Phase 0 - Freeze and baseline (3 days)
1. Freeze net-new architecture changes.
2. Snapshot API/events from current prod/staging.
3. Build parity test fixtures from real sessions.

Exit criteria:
- Baseline traces captured for 20+ representative sessions.

## Phase 1 - Contracts first (1 week)
1. Create `packages/contracts` for tools/events/api DTOs.
2. Generate TS types for frontend and backend from one schema source.
3. Add compatibility tests for old vs new payload mapping.

Exit criteria:
- CI fails on contract drift.

## Phase 2 - New Node orchestrator bootstrap (2 weeks)
1. Introduce `services/orchestrator` (Node, AI SDK `streamText`).
2. Implement core loop with `maxSteps`, tool registry, timeline persistence.
3. Keep old Python `services/agent` alive behind feature flag.

Exit criteria:
- New orchestrator can run read-only shadow sessions.

## Phase 3 - Sandbox control-plane consolidation (1 week)
1. Move E2B lifecycle authority to orchestrator service.
2. Convert `services/sandbox` into thin runtime adapter or retire it.
3. Implement template decision function: `base | desktop | code-interpreter`.

Exit criteria:
- No direct sandbox lifecycle writes outside orchestrator.

## Phase 4 - Tool runtime parity (2 weeks)
1. Implement shell/file/browser/match/expose contracts identically across old/new.
2. Add map fanout path with temporary subtask sandboxes.
3. Add deterministic retries, timeout classes, cancellation tokens.

Exit criteria:
- 95%+ tool parity on golden task suite.

## Phase 5 - Media path hardening (1 week)
1. Add/standardize `services/webrtc-media` (Go RPC for Neko/session management).
2. Move browser/desktop stream routing through media service contracts.
3. Unify session->sandbox->media lookup via orchestrator.

Exit criteria:
- Stable browser/desktop stream URLs and reconnect behavior.

## Phase 6 - Frontend slice consolidation (2 weeks)
1. Keep and harden Tier-1 slices.
2. Migrate Tier-2 slices (`billing`, `devices`, `connectors`) to canonical event reducers.
3. Remove placeholder and dead slices (including legacy `biz` if still mounted).

Exit criteria:
- Store reduced, no empty production slices, all events mapped.

## Phase 7 - File and billing correctness (1 week)
1. Fix file transfer contract mismatches.
2. Enforce S3 metadata + checksum + provenance fields.
3. Add per-step/per-tool usage metering.

Exit criteria:
- Upload/download and cost tracking pass e2e and contract tests.

## Phase 8 - Cutover and retirement (1 week)
1. 5% traffic to new orchestrator.
2. 25% -> 50% -> 100% progressive rollout by cohort.
3. Retire Python agent and duplicated gateway paths after rollback window.

Exit criteria:
- SLO parity or better for 7 consecutive days.

## Deletion plan
1. Delete duplicated lifecycle code in `services/agent/src/e2b_manager.py` or `services/sandbox/src/*` based on final ownership.
2. Delete old untyped event emitters after contract adapters are removed.
3. Delete legacy slices with no runtime reads/writes over 14-day telemetry window.

## Rollback gates
1. Tool error rate > 2x baseline.
2. WS reconnect failures > 5%.
3. Timeline event gap rate > 0.2%.
4. Credits miscalculation incidents > 0.

