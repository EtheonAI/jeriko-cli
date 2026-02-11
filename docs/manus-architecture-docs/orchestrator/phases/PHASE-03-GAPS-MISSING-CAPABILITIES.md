# Phase 03 - Gaps, Missing Features, and Bloat Diagnosis

## 1) High-severity architecture gaps

### 1.1 Dual sandbox control planes
- Agent loop uses direct SDK (`services/agent/src/e2b_manager.py`).
- Separate sandbox service also creates/manages E2B (`services/sandbox/src/index.ts`).
Risk:
- duplicate lifecycle logic,
- split ownership,
- mismatched behavior and telemetry.

### 1.2 Template selection logic exists but not actually applied in agent path
- `select_template()` exists in `e2b_manager.py` but create path currently defaults desktop flow (`use_desktop=True`), not per-request tool policy.
Risk:
- unnecessary heavy sandboxes,
- cost and latency inefficiency.

### 1.3 File/S3 contract mismatch in agent helper
- `s3_sync.py` assumes binary body on `/files/{id}/download`.
- file service endpoint returns presigned URL metadata path.
Risk:
- broken download/upload loops,
- unreliable artifact exchange.

### 1.4 Tool semantics drift from Manus-like persistent PTY expectations
- shell tools are currently mostly stateless command runs under runtime wrapper.
Risk:
- reduced fidelity for long-running interactive workflows.

## 2) Medium-severity product gaps

### 2.1 State surface is broad but unevenly powered
- 47 slices registered, but at least one effectively empty (`meeting`), and several appear scaffold-heavy.
Risk:
- maintenance overhead,
- cognitive load,
- harder correctness guarantees.

### 2.2 Event taxonomy partially aligned but not unified across backend/frontend
- SSE typed events from agent and websocket events in gateway/frontend are useful, but no single canonical event contract file shared across services.

### 2.3 Missing hard boundaries for planner vs executor model policy
- Claude planning path is present, but there is no formal planner/executor contract layer documented as stable ABI.

## 3) Do I agree that the app is bloated?
Yes, partially.

Reason:
- You have many capabilities, but too many parallel implementations and weakly unified contracts.
- The issue is not “too many services” by itself; the issue is duplicated responsibility and inconsistent interface boundaries.

## 4) Should you delete everything and copy Manus exactly?
No.

Reason:
- Manus internals are proprietary and not fully verifiable.
- Blind copying will import assumptions and likely regressions.
- Better strategy: adopt proven architectural patterns and collapse your duplicate control planes.

## 5) What is truly missing vs Manus-style target
- Single authoritative orchestrator contract.
- Deterministic sandbox allocation policy (template + concurrency + env projection).
- Unified tool state machine and event schema.
- Verified artifact pipeline (sandbox <-> file service <-> S3) with strict contract tests.
- Reduction of placeholder slices and dead state pathways.
