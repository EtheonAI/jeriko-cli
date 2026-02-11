# Rubic → Manus-Style Architecture Refactor (2026)

**Status:** ✅ Approved (Canonical)
**Date:** 2026-02-10
**Duration:** 15 weeks (8 phases + 14-day rollback hold)
**Team:** 2-3 engineers

---

## Quick Start

**If you're new to this refactor, start here:**

1. **Executive Summary** (`EXECUTIVE-SUMMARY.md`) — 5 min read
   - Problem statement, solution overview, timeline
   - Expected outcomes, risk management
   - Resource requirements, approval process

2. **MADR-001** (`MADR-001-RUBIC-MANUS-ARCHITECTURE-REFACTOR.md`) — 15 min read
   - Architecture Decision Record (canonical)
   - Context, decision drivers, options considered
   - Decision outcome, consequences, validation

3. **Implementation Roadmap** (`IMPLEMENTATION-ROADMAP.md`) — 30 min read
   - Day-by-day breakdown of all 8 phases
   - Every task, test, deliverable documented
   - Exit criteria, rollback procedures

4. **Testing Strategy** (`TESTING-STRATEGY.md`) — 20 min read
   - Complete test pyramid (455 tests)
   - Golden suite, contract tests, E2E tests
   - Coverage targets, pass criteria

---

## Document Index

### Core Documents (Must Read)

| Document | Purpose | Audience | Read Time |
|----------|---------|----------|-----------|
| **EXECUTIVE-SUMMARY.md** | High-level overview | Leadership, stakeholders | 5 min |
| **MADR-001** | Architecture decision record | Tech leads, architects | 15 min |
| **IMPLEMENTATION-ROADMAP.md** | Detailed execution plan | Engineers, PMs | 30 min |
| **TESTING-STRATEGY.md** | Comprehensive test coverage | QA, engineers | 20 min |

### Reference Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| `../manus-architecture-docs/codex-architecture/` | Canonical architecture package | All |
| `../manus-architecture-docs/guide/10-CONTRADICTION-REGISTER-AND-CANONICAL-DECISIONS.md` | Part 10: Authority on all conflicts | All |
| `../manus-architecture-docs/guide/09-CORRECTED-AGENT-ARCHITECTURE.md` | Part 9: Hybrid agent model | All |

---

## Architecture Overview

### Current State (Before)

```
┌──────────────────────────────────────────────────────────────────┐
│  RUBIC CURRENT (14 SERVICES, DUAL CONTROL PLANES)                │
│                                                                   │
│  Python Agent ──┐                                                │
│  (services/agent)│  ┌─→ E2B Sandbox Manager                      │
│                  ├──┤                                             │
│  Sandbox Service─┘  └─→ Dual control → race conditions          │
│  (services/sandbox)                                               │
│                                                                   │
│  + 12 more services (gateway, task, search, project, etc.)       │
└──────────────────────────────────────────────────────────────────┘

Problems:
❌ Dual sandbox control (race conditions)
❌ Contract drift (events ≠ DB ≠ tools)
❌ Service sprawl (14 services)
❌ Slice sprawl (46 Redux slices, some empty)
❌ No comprehensive testing (45% coverage)
```

### Target State (After)

```
┌──────────────────────────────────────────────────────────────────┐
│  RUBIC TARGET (4 SERVICES, SINGLE CONTROL PLANE)                 │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐      │
│  │  ORCHESTRATOR (Node.js + TypeScript + AI SDK)          │      │
│  │  - Single control plane                                │      │
│  │  - Canonical event protocol (18 verified + 3 reserved) │      │
│  │  - Type-safe tool contracts (Zod schemas)              │      │
│  │  - Hybrid agent: Claude (brain) + OpenAI (hands)       │      │
│  └────────────────────────────────────────────────────────┘      │
│            │                    │                    │            │
│            ▼                    ▼                    ▼            │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │ WebRTC Media │    │ E2B Sandbox      │    │ Composio     │  │
│  │ (Go + Neko)  │    │ (per-user, main) │    │ Connector    │  │
│  └──────────────┘    └──────────────────┘    └──────────────┘  │
└──────────────────────────────────────────────────────────────────┘

Benefits:
✅ Single control plane (no races)
✅ Canonical contracts (no drift)
✅ 4 services (71% reduction)
✅ Clean slices (30% size reduction)
✅ 82% test coverage (up from 45%)
```

---

## Migration Strategy

### 8-Phase Progressive Rollout

```
Phase 0: Freeze/Baseline         ████ (3 days)
Phase 1: Contracts               ████████ (1 week)
Phase 2: Orchestrator Bootstrap  ████████████████ (2 weeks)
Phase 3: Sandbox Consolidation   ████████ (1 week)
Phase 4: Tool Runtime Parity     ████████████████ (2 weeks)
Phase 5: Media Path Hardening    ████████ (1 week)
Phase 6: Frontend Consolidation  ████████████████ (2 weeks)
Phase 7: File/Billing            ████████ (1 week)
Phase 8: Cutover                 ████████ (1 week)
                                 ─────────────────────
                                 Total: 15 weeks
```

### Traffic Shift Plan

```
Week 1-7:   Python Agent (100%)  ████████████████████
Week 7:     Shadow Mode (5%)     █
Week 8:     5% Node Orchestrator █
Week 9:     25% Node Orchestrator ████
Week 10:    50% Node Orchestrator ████████
Week 10:    100% Node Orchestrator ████████████████████
```

**Rollback:** Instant via feature flag (`ORCHESTRATOR_VERSION=python|node`)

---

## Success Metrics

### Performance

| Metric | Baseline | Target | Status |
|--------|----------|--------|--------|
| First token p95 | 3.1s | < 2.5s | 🎯 |
| Tool success rate | 96.2% | >= 98.5% | 🎯 |
| WS uptime | 99.7% | >= 99.9% | 🎯 |

### Operations

| Metric | Before | After | Status |
|--------|--------|-------|--------|
| Service count | 14 | 4 | 🎯 |
| Deployment time | 25 min | 8 min | 🎯 |
| MTTR | 45 min | 18 min | 🎯 |

### Quality

| Metric | Before | After | Status |
|--------|--------|-------|--------|
| Test coverage | 45% | 82% | 🎯 |
| Contract drift | 3-4/mo | 0 | 🎯 |
| Bug escape rate | Baseline | -50% | 🎯 |

---

## Risk Management

### Automatic Rollback Gates

**System automatically rolls back to Python agent if:**
1. Tool error rate > 2x baseline
2. WS reconnect failures > 5%
3. Timeline event gap rate > 0.2%
4. Credits miscalculation > 0

**Rollback time:** ~60 seconds

### Contingency Plans

| Risk | Mitigation |
|------|------------|
| Regression | Golden suite (20+ prod sessions) validates parity |
| Race conditions | Single control plane eliminates dual-sandbox issues |
| WS instability | Reconnect policy + circuit breaker |
| Cost explosion | Hard limits + quota monitoring |

---

## Key Decisions

From **MADR-001**:

### Decision 1: Single Node.js Orchestrator
**Chosen:** Replace Python agent with Node.js orchestrator
**Why:** Type safety (TypeScript + Zod), single codebase, faster debugging
**Alternative rejected:** Keep both Python + Node (maintenance burden)

### Decision 2: Hybrid Agent Architecture
**Chosen:** Claude for orchestration, OpenAI for parallel subtasks (map tool)
**Why:** Cost optimization (GPT-4.1-mini is ~37.5x cheaper than Claude for map subtasks)
**Alternative rejected:** All-Claude (too expensive for parallel processing)

### Decision 3: Canonical Event Protocol
**Chosen:** 21-event contract (18 verified + 3 reserved), versioned, Zod-validated
**Why:** Eliminates contract drift, enables Redux slice parity
**Alternative rejected:** Ad-hoc events per feature (causes drift)

### Decision 4: Service Consolidation
**Chosen:** 14 services → 4 services (orchestrator, webrtc, connector, file)
**Why:** Reduced operational complexity, faster deployments
**Alternative rejected:** Keep all 14 (high maintenance burden)

### Decision 5: Progressive Rollout
**Chosen:** 8-phase migration with 5% → 25% → 50% → 100% traffic shift
**Why:** Validates each phase before proceeding, enables rollback
**Alternative rejected:** Big-bang cutover (too risky)

---

## Testing Approach

### Test Pyramid (455 Tests)

```
                    ▲
                   /E2E\           30 tests (critical flows)
                  /─────\
                 /Contract\        209 tests (API/events/tools)
                /─────────\
               /Integration\       68 tests (service boundaries)
              /─────────────\
             /   Unit Tests  \     113 tests (functions/reducers)
            /─────────────────\
           + Golden Suite (20)  Prod session replays
```

### Coverage Targets

- **Line coverage:** 82% (target: 80%) ✅
- **Branch coverage:** 78% (target: 75%) ✅
- **Critical path coverage:** 100% ✅

### Golden Suite

**Purpose:** Regression testing with real production sessions

**Process:**
1. Capture 20+ prod sessions (user message → tool calls → final response)
2. Replay on Python agent (baseline) → record expected output
3. Replay on Node orchestrator (new) → assert parity

**Pass criteria:** 95%+ sessions produce equivalent results

---

## Timeline

### Key Milestones

| Date | Milestone | Deliverable |
|------|-----------|-------------|
| **Feb 13** | Phase 0 Complete | Golden suite passes on Python agent |
| **Feb 20** | Phase 1 Complete | `packages/contracts` + CI gate |
| **Mar 6** | Phase 2 Complete | Shadow mode runs on 5% traffic |
| **Mar 13** | Phase 3 Complete | Single E2B control plane |
| **Mar 27** | Phase 4 Complete | 95%+ tool parity |
| **Apr 1** | Phase 5 Complete | Stable Neko streams |
| **Apr 15** | Phase 6 Complete | Canonical Redux slices |
| **Apr 22** | Phase 7 Complete | File/billing e2e pass |
| **Apr 29** | Phase 8 Complete | 100% traffic on Node orchestrator |
| **May 13** | **Retirement** | Python agent deleted after 14-day rollback hold |

### Weekly Cadence

- **Daily:** Team standup (10am)
- **Friday:** Demo to Product/Design
- **Every other Monday:** Leadership update

---

## Team

### Roles

| Role | Responsibility | Time Commitment |
|------|---------------|-----------------|
| **Engineer #1** | Orchestrator, tools, contracts | 40 hrs/wk × 15 weeks |
| **Engineer #2** | Frontend, testing, media | 40 hrs/wk × 15 weeks |
| **Tech Lead** | Architecture, reviews, decisions | 10 hrs/wk × 15 weeks |
| **Product Owner** | Requirements, approval gates | 5 hrs/wk × 15 weeks |

### Skills Required

- TypeScript + Node.js (orchestrator)
- Python (for understanding current agent)
- React + Redux (frontend)
- AI SDK (Vercel)
- E2B SDK
- Testing (Vitest, Playwright)

---

## Resources

### Documentation

- **This folder:** Complete refactor plan
- **Codex architecture:** `../manus-architecture-docs/codex-architecture/`
- **Manus guide:** `../manus-architecture-docs/guide/`
- **Current codebase:**
  - `services/agent/` — Python agent (to be replaced)
  - `services/sandbox/` — Sandbox service (to be retired)
  - `apps/app/` — Frontend (to be updated)
  - `packages/` — Shared libraries

### Tools

- **AI SDK:** https://sdk.vercel.ai/docs
- **E2B SDK:** https://e2b.dev/docs
- **Zod:** https://zod.dev
- **Vitest:** https://vitest.dev
- **Playwright:** https://playwright.dev

---

## FAQ

**Q: Why not keep both Python and Node orchestrators?**
A: Maintenance burden doubles, contract drift perpetuates, and improvements are blocked. Single orchestrator enables type safety, simpler debugging, and faster iteration.

**Q: What if we discover issues after retirement?**
A: Python agent code stays for 14 days after 100% cutover. Rollback is instant via feature flag. Retirement/deletion only happens after that hold window.

**Q: How do we ensure zero downtime?**
A: Progressive rollout (5% → 100%) with automatic rollback gates. Shadow mode validates parity before traffic shift. Feature flag allows instant rollback.

**Q: Why 15 weeks? Can we go faster?**
A: 15 weeks includes the full implementation plan plus the mandatory 14-day rollback hold before retirement. Engineering build work is still front-loaded; we do not compress testing or rollback safety.

**Q: What's the rollback plan if Phase 8 fails?**
A: Feature flag rollback takes 60 seconds. Database supports both orchestrators. Python agent code stays for 14 days after 100% cutover. Automatic rollback gates prevent extended outages.

---

## Next Steps

### This Week (Phase 0 Kick-off)

1. **✅ Review documents** — Read EXECUTIVE-SUMMARY.md + MADR-001
2. **✅ Team meeting** — Kick-off with full team
3. **✅ Approval** — Get stakeholder sign-off
4. **⏳ Start Phase 0** — Capture production baseline (3 days)

### Phase 0 Tasks (Feb 11-13)

- [ ] Code freeze (branch protection)
- [ ] Capture 20+ production session traces
- [ ] Build golden suite replay harness
- [ ] Validate baseline metrics

### After Phase 0

- **Week 2:** Phase 1 (Contracts)
- **Weeks 3-4:** Phase 2 (Orchestrator)
- **Continue per roadmap...**

---

## Contact

**Questions?** See detailed docs above or contact:
- **Tech Lead:** [TBD]
- **Engineering Manager:** [TBD]
- **Product Owner:** [TBD]

**Slack Channel:** #rubic-refactor-2026

**Docs Location:** `docs/refactor-2026/`

---

**Status:** ✅ Approved (Canonical)
**Last Updated:** 2026-02-10
**Next Review:** After Phase 0 (Feb 13, 2026)
