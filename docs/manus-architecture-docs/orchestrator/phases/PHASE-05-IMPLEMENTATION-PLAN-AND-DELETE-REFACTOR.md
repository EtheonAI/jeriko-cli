# Phase 05 - Refactor and Build Plan (Detailed)

## Phase 1 - Contract hardening (1-2 weeks)
1. Define shared schemas:
- tool intent/result
- orchestration events
- sandbox allocation decision
- artifact transfer contract

2. Add contract tests:
- agent <-> connector
- agent <-> file
- app-api <-> agent SSE transform

3. Deliverables:
- `packages/contracts` package
- CI checks for schema compatibility

## Phase 2 - Sandbox control plane consolidation (1-2 weeks)
1. Choose single authority (recommended: agent).
2. Remove duplicate create/connect logic from competing paths or gate behind one adapter.
3. Implement deterministic template selection from requested tool set.
4. Add explicit policy for multi-sandbox fanout and merge.

## Phase 3 - Tool runtime reliability (2 weeks)
1. Rebuild shell sessions as true persistent PTY abstraction.
2. Normalize browser actions with stable response payloads.
3. Add idempotency keys for side-effecting tools.
4. Add per-tool timeout/retry/circuit-breaker policy.

## Phase 4 - File/S3 pipeline correctness (1 week)
1. Fix `s3_sync.py` download/upload contract to honor file service API semantics.
2. Add e2e tests for:
- upload from sandbox
- retrieve by file id
- signed URL lifecycle
3. Add background cleanup policy for orphaned S3 keys.

## Phase 5 - Redux and frontend simplification (1-2 weeks)
1. Inventory all 47 slices by runtime usage.
2. Remove/merge empty or scaffold-only slices.
3. Route all timeline/tool UI updates through canonical event envelope.
4. Add regression tests for chat stream + timeline + tool cards.

## Phase 6 - Manus-style UX parity features (2-3 weeks)
1. Stronger plan visualization and phase progression.
2. Better live sandbox visibility (browser + terminal + file updates).
3. Better takeover/approval UX for sensitive operations.
4. Better session resume and replay reliability.

## Phase 7 - Production hardening (ongoing)
1. Cost metering by model/tool/sandbox-template.
2. SLOs for latency and tool success.
3. Security reviews for sandbox exposure and connector scopes.
4. Load tests for websocket and stream fanout.

## Delete/keep guidance
- Delete:
  - duplicate lifecycle paths,
  - dead frontend slices,
  - undocumented legacy shims.
- Keep:
  - core orchestrator loop,
  - Composio integration path,
  - E2B template assets,
  - typed SSE transformation pipeline.

## Success criteria
- Single orchestrator truth path.
- Deterministic sandbox policy with measured cost/latency win.
- >99% tool event consistency across backend/frontend.
- Clear reduction in store complexity and bug volume.
