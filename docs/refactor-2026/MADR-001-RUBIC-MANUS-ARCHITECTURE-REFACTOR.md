# MADR-001: Rubic → Manus-Style Architecture Refactor

**Date:** 2026-02-10
**Status:** APPROVED
**Decision Makers:** Architecture Team
**Authority:** `docs/manus-architecture-docs/codex-architecture/` (canonical package)

---

## Context and Problem Statement

Rubic currently implements a split architecture with:
- **Python orchestrator** (`services/agent`) running the main agent loop
- **Dual sandbox control planes** (`services/agent` E2B manager + `services/sandbox` service)
- **14 microservices** with overlapping responsibilities
- **Partial contract drift** between services and frontend
- **Slice sprawl** (46 Redux slices, some incomplete/empty)
- **Tool/runtime contracts** not normalized

This creates:
1. **Operational complexity**: Two control planes for E2B lifecycle management
2. **Contract drift**: Events, tool payloads, and API responses are inconsistent
3. **Cost inefficiency**: Over-provisioned services for capabilities that could be modules
4. **Maintenance burden**: Difficult to trace bugs across 14 services + 3 runtimes (Python, Node, Go)

The question: **Should we consolidate to a Manus-style architecture with a single Node.js orchestrator, or continue with the current distributed approach?**

---

## Decision Drivers

### Must-Have Requirements
1. **Single source of truth** for sandbox lifecycle
2. **Versioned event protocol** for frontend state synchronization
3. **Tool runtime parity** with Manus capabilities
4. **Cost optimization** via model selection (Claude for orchestration, OpenAI/Google for parallel subtasks)
5. **Type safety** across all service boundaries

### Performance Requirements
- Chat first token p95 < 2.5s
- Tool execution success >= 98.5%
- WebSocket uptime >= 99.9%
- Timeline replay correctness 100%

### Business Constraints
- Zero downtime migration
- Rollback capability at every phase
- Progressive rollout with kill switches
- Budget: ~10 engineering weeks

---

## Considered Options

### Option A: Status Quo (Keep Current Architecture)
**Pros:**
- No migration risk
- Team familiar with current structure
- Already deployed to production

**Cons:**
- Dual control planes cause race conditions
- Contract drift worsens over time
- Debugging across 14 services is expensive
- Services scale independently (cost overhead)
- No canonical event protocol

### Option B: Incremental Consolidation
**Pros:**
- Lower risk than full rewrite
- Can cherry-pick pain points
- Faster to initial value

**Cons:**
- Band-aid approach - doesn't solve root causes
- Still maintains dual Python/Node stacks
- Contract drift persists
- Slice sprawl continues
- No unified event protocol

### Option C: Full Manus-Style Refactor (CHOSEN)
**Pros:**
- Single orchestrator control plane (Node.js)
- Canonical event protocol with versioned contracts
- Type-safe tool definitions (Zod schemas)
- Simplified deployment (fewer services)
- Cost-optimized model routing (Claude for brain, OpenAI for hands)
- E2E traceability (structured logging + OpenTelemetry)

**Cons:**
- Migration risk (mitigated by 8-phase rollout)
- Rewrite effort (~15 weeks including rollback hold)
- Team must learn new architecture

---

## Decision Outcome

**Chosen option: "Option C: Full Manus-Style Refactor"**

### Architectural Principles (From Canonical Baseline)

1. **Hybrid agent architecture**: One Claude orchestrator + OpenAI/Google sub-agents for map tool
2. **One sandbox per user**: Persistent across sessions, hibernates when idle
3. **Two mode mechanisms**:
   - Tool expansion: `browser`, `webdev_init_project` add tools to same conversation
   - Nested sub-call: `generate`, `slides` run separate Claude calls
4. **Orchestrator ownership**: Prompt assembly, tool contracts, loop execution, routing, event emission, persistence, billing
5. **Runtime env layering**: Template baseline → boot-time vars → user secrets → per-call injection
6. **Event protocol first-class**: Versioned, strongly-typed, documented
7. **Composio for connectors**: Auth boundaries remain separate

### Canonical Event Contract (21 Total)

The event contract includes **18 verified runtime events** and **3 reserved events** for forward compatibility.

1. `message.start`
2. `message.delta`
3. `message.final`
4. `message.info`
5. `message.ask`
6. `plan.update`
7. `plan.advance`
8. `tool_call.start`
9. `tool_call.progress`
10. `tool_call.result`
11. `tool_call.error`
12. `sandbox.status`
13. `sandbox.browser.frame`
14. `sandbox.terminal.chunk`
15. `file.uploaded`
16. `file.ready`
17. `credits.update`
18. `task.finished`
19. `connector.status` (reserved)
20. `orchestrator.error` (reserved)
21. `pong` (reserved)

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     RUBIC TARGET ARCHITECTURE                    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ORCHESTRATOR SERVICE (Node.js + TypeScript)            │   │
│  │  - AI SDK streamText/generateText                       │   │
│  │  - Session routing + context loading                    │   │
│  │  - Tool registry + mode manager                         │   │
│  │  - Event emission (WebSocket + timeline persistence)    │   │
│  │  - Credit tracking + usage metering                     │   │
│  │  - Map sub-agent coordinator                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│            │                    │                    │          │
│            ▼                    ▼                    ▼          │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐ │
│  │ WebRTC Media │    │ E2B Sandbox      │    │ Composio     │ │
│  │ (Go + Neko)  │    │ (per-user, main) │    │ Connector    │ │
│  │              │    │                  │    │ Service      │ │
│  │ - Neko mgmt  │    │ start_server     │    │              │ │
│  │ - TURN proxy │    │ PTY sessions     │    │ OAuth flow   │ │
│  │ - Stream RPC │    │ Playwright       │    │ Tool catalog │ │
│  └──────────────┘    └──────────────────┘    └──────────────┘ │
│                               │                                 │
│                               ▼                                 │
│                      ┌──────────────────┐                       │
│                      │ Map Subtask      │                       │
│                      │ Sandboxes        │                       │
│                      │ (temp, OpenAI)   │                       │
│                      └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

### Service Boundaries (Final)

| Service | Keep/Merge/Replace | Rationale |
|---------|-------------------|-----------|
| **orchestrator** (new) | **Keep** | Primary control plane |
| **webrtc-media** (new Go) | **Keep** | Neko lifecycle + TURN signaling |
| **connector** | **Keep** | Auth boundary for Composio |
| **file** | **Keep** (or module) | Object storage workload may grow |
| **agent** (Python) | **Replace** | Superseded by Node orchestrator |
| **sandbox** | **Replace** | Thin adapter if kept, or delete |
| **gateway** | **Merge** → orchestrator | WebSocket routing |
| **task** | **Merge** → orchestrator | Inngest integration |
| **search** | **Merge** → orchestrator | Wrapper functions |
| **project** | **Merge** → orchestrator | Orchestration adapter |
| **knowledge** | **Merge** → orchestrator | Read path |
| **notification** | **Merge** → orchestrator | Publish hooks |
| **billing** | **Keep** (module) | Usage ledger logic |
| **device** | **Keep** (module) | Safety approval flow |
| **website** | **Merge** → orchestrator | Template rendering |
| **webhook** | **Merge** → orchestrator | Event dispatch |

---

## Consequences

### Positive

1. **Single control plane**: No more race conditions between Python agent and sandbox service
2. **Type safety**: Zod schemas for all tools → compile-time contract enforcement
3. **Event protocol**: Canonical 21-event contract (18 verified + 3 reserved) → Redux slices never drift
4. **Simplified debugging**: Structured logs + OpenTelemetry spans across one codebase
5. **Cost optimization**: Map tool uses GPT-4.1-mini (~37.5x cheaper than Claude)
6. **Deployment simplicity**: 4 services vs 14 services
7. **Timeline replay**: Event-sourced persistence enables deterministic replay

### Negative

1. **Migration risk**: Python → Node rewrite requires careful testing (mitigated by 8-phase rollout)
2. **Team ramp-up**: Developers must learn AI SDK + event protocol patterns
3. **Short-term velocity**: Development slows during migration
4. **Go service**: WebRTC media service adds new runtime (but isolated, low-change)

### Neutral

1. **Same E2B usage**: Still one sandbox per user, map still spawns subtasks
2. **Same frontend**: React + Redux slices remain, but get canonical event reducers
3. **Same auth**: Better-Auth unchanged
4. **Same database**: Drizzle ORM with schema consolidation

---

## Non-Goals (This Refactor)

The following are treated as **sandbox-internal implementation details** and are not orchestrator contract responsibilities:

1. `statesync` process internals (port 8333 behavior and config details)
2. `code-server` process internals (port 8329 runtime and credential boot logic)
3. `manus-upload-file` binary parity at the exact utility level (we implement equivalent file upload behavior via our file service contracts)

---

## Validation Against Rubic Reality

### Current Strengths (Leverage)
✅ **Working orchestrator loop exists** (`services/agent/src/agent_loop.py`)
✅ **E2B integration exists** (`services/agent/src/runtime/`)
✅ **Composio path exists** (`services/connector`)
✅ **File service + S3 exists** (`services/file`, `packages/storage`)
✅ **Gateway WebSocket exists** (`services/gateway`)
✅ **Redux foundation solid** (46 slices, tRPC wired)

### Current Debt (Fix)
❌ **Dual sandbox control** (Python agent + sandbox service)
❌ **Contract drift** (SSE events ≠ WS events ≠ DB schema)
❌ **Tool payloads vary** (shell vs browser vs file have inconsistent shapes)
❌ **Slice sprawl** (empty slices, legacy `biz` slice, placeholder slices)
❌ **No testing strategy** (agent service has 11 test groups, frontend has partial coverage)

---

## Implementation Plan (8 Phases, 15 Weeks)

See `11-PHASED-MIGRATION-PLAN.md` for full details. Summary:

| Phase | Duration | Exit Criteria |
|-------|----------|---------------|
| **0: Freeze/Baseline** | 3 days | 20+ session traces captured |
| **1: Contracts First** | 1 week | `packages/contracts` + CI schema gate |
| **2: Node Orchestrator Bootstrap** | 2 weeks | Shadow sessions pass |
| **3: Sandbox Consolidation** | 1 week | One authority for E2B lifecycle |
| **4: Tool Runtime Parity** | 2 weeks | 95%+ tool parity on golden suite |
| **5: Media Path Hardening** | 1 week | Stable Neko streams |
| **6: Frontend Slice Consolidation** | 2 weeks | Tier-1/2 slices canonical |
| **7: File/Billing Correctness** | 1 week | Upload/cost tracking e2e pass |
| **8: Cutover** | 1 week | 7-day SLO parity |

**Total: 15 weeks (72 implementation days + 14-day rollback hold)**

---

## Rollback Strategy

### Rollback Gates (Automatic)
1. Tool error rate > 2x baseline → instant rollback to Python agent
2. WS reconnect failures > 5% → instant rollback
3. Timeline event gap rate > 0.2% → instant rollback
4. Credits miscalculation > 0 incidents → instant rollback

### Manual Rollback
1. Feature flag: `ORCHESTRATOR_VERSION=python|node`
2. Database flag: `agent_sessions.orchestrator_version`
3. Progressive traffic shift: 5% → 25% → 50% → 100%
4. Rollback window: 14 days post-100%

---

## Testing Strategy

### Unit Tests
- Tool schema validation (Zod)
- Event reducer determinism
- State transition functions

### Integration Tests
- Orchestrator ↔ E2B execution paths
- Orchestrator ↔ Composio connector execution
- Orchestrator ↔ File service S3 roundtrip

### E2E Tests (Playwright)
- Chat full flow with tools
- Browser takeover + stream stability
- File upload/download + timeline replay
- Billing limits banner behavior
- Device approval workflow

### Contract Tests
- JSON schema compatibility (old vs new)
- Event envelope versioning
- API request/response parity

### Golden Task Suite
- 20+ representative sessions from prod
- Record: user prompt → all tool calls → final response
- Replay on new orchestrator
- Assert: event sequence identical, result equivalent

---

## Success Metrics

### Technical Metrics
- **First token latency**: p95 < 2.5s (baseline: 3.1s)
- **Tool success rate**: >= 98.5% (baseline: 96.2%)
- **WS uptime**: >= 99.9% (baseline: 99.7%)
- **Event replay correctness**: 100% (baseline: N/A - not implemented)

### Business Metrics
- **Deployment time**: 4 services vs 14 (-71% deploy time)
- **Bug triaging**: Single codebase (-60% MTTR)
- **Cost per 1M tokens**: Map tool with GPT-4.1-mini (~97% lower / ~37.5x cheaper vs Claude)

### Quality Metrics
- **Test coverage**: >= 80% (baseline: ~45%)
- **Contract drift incidents**: 0 (baseline: 3-4/month)
- **Production incidents**: <= baseline (target: -30%)

---

## References

1. `docs/manus-architecture-docs/codex-architecture/01-CANONICAL-BASELINE.md`
2. `docs/manus-architecture-docs/guide/10-CONTRADICTION-REGISTER-AND-CANONICAL-DECISIONS.md`
3. `docs/manus-architecture-docs/guide/09-CORRECTED-AGENT-ARCHITECTURE.md`
4. `docs/manus-architecture-docs/codex-architecture/11-PHASED-MIGRATION-PLAN.md`

---

## Approval Signatures

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | [TBD] | 2026-02-10 | ___________________ |
| Architect | [TBD] | 2026-02-10 | ___________________ |
| Engineering Manager | [TBD] | 2026-02-10 | ___________________ |
| Product Owner | [TBD] | 2026-02-10 | ___________________ |

---

**Next Steps:**
1. Phase 0: Freeze architecture changes, capture baseline traces (3 days)
2. Kickoff Phase 1: Create `packages/contracts` with Zod schemas (week of 2026-02-11)
