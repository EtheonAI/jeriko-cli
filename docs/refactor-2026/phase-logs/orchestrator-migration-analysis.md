# Orchestrator Migration Analysis

**Date:** 2026-02-11
**Lead:** LEAD-ORCHESTRATOR
**Status:** ⚠️ BLOCKED - Awaiting Direction

## Executive Summary

The orchestrator service exists but is **NOT production-ready** for migration. It's a scaffold with routing infrastructure but lacks core functionality needed to replace the agent service.

## Current Architecture

### Working (Legacy Path)
```
apps/app/api/chat/route.ts
  ↓
packages/ai/lib/rubic-provider.ts
  ↓ POST /v1/complete
services/agent (Python, port 8000)
  ↓ Direct E2B SDK
  ↓ Tool execution (32 tools)
  ↓ SSE streaming
  ↓ LLM integration (Anthropic/OpenAI/Google)
```

**Status:** ✅ Fully functional, production-ready

### Partial (Orchestrator Path)
```
services/orchestrator (TypeScript, port 4014)
  ✅ /v1/sessions (CRUD)
  ✅ /v1/sessions/:id/messages (accept message)
  ✅ /v1/sessions/:id/events (return events)
  ⚠️  runAgentLoop() - returns stub text
  ⚠️  executeTool() - returns stub result
  ❌ No SSE streaming
  ❌ No LLM provider integration
  ❌ No sandbox service integration
  ❌ No DB persistence (in-memory Map)
```

**Status:** ⚠️ Skeleton only, not functional

## Gap Analysis

### What Orchestrator Has
✅ Fastify service framework
✅ Session management routes
✅ Message handling routes
✅ Event history routes
✅ Tool registry (12 entrance tools)
✅ Tool executor (routing logic)
✅ Context compactor
✅ Prompt builder
✅ TypeScript + Zod validation

### What Orchestrator Needs
❌ **LLM Integration** - No Anthropic/OpenAI/Google SDK calls
❌ **Tool Execution** - Stub returns, no real tool logic
❌ **SSE Streaming** - Only returns JSON events array
❌ **Sandbox Service Integration** - No E2B runtime calls
❌ **Connector Service Integration** - No Composio tools
❌ **Database Persistence** - Uses in-memory Map
❌ **File Service Integration** - No S3 operations
❌ **Browser/Terminal Streaming** - No WebRTC forwarding
❌ **Planning System** - Stub plan phases
❌ **Error Handling** - Basic only
❌ **Rate Limiting** - Not implemented
❌ **Caching** - Not implemented

## Migration Options

### Option A: Shadow Mode (LOW RISK) ⭐ RECOMMENDED
**Approach:** Orchestrator calls run in parallel with agent service, results logged for comparison.

**Implementation:**
1. Add shadow routing in chat route
2. Call both agent service AND orchestrator
3. Return agent service response (legacy)
4. Log orchestrator response for comparison
5. Create metrics dashboard for parity tracking

**Pros:**
- Zero user impact
- Validates orchestrator incrementally
- Easy rollback (just disable shadow calls)
- Clear gap visibility

**Cons:**
- 2x backend calls (cost)
- Requires logging infrastructure
- Orchestrator still incomplete

**Timeline:** 2-3 days implementation

---

### Option B: Minimal Viable Orchestrator (MEDIUM RISK)
**Approach:** Implement minimal streaming in orchestrator that proxies to agent service internally.

**Implementation:**
1. Add LLM provider integration to orchestrator
2. Add SSE streaming to /v1/sessions/:id/messages
3. Keep tool execution in agent service (proxy)
4. Feature flag for alpha testing only
5. Document as "work in progress"

**Pros:**
- Validates orchestrator architecture
- Incremental tool migration
- Feature flag safety net

**Cons:**
- Still depends on agent service
- Doesn't reduce technical debt
- Orchestrator becomes another proxy layer

**Timeline:** 1 week implementation

---

### Option C: Complete Orchestrator First (HIGH RISK)
**Approach:** Finish building orchestrator to feature parity before migration.

**Implementation:**
1. Implement all 32 tools in orchestrator
2. Add sandbox service integration
3. Add SSE streaming infrastructure
4. Add DB persistence layer
5. Add browser/terminal streaming
6. Comprehensive testing
7. Then migrate frontend

**Pros:**
- Clean architecture
- Full ownership of orchestrator logic
- No dependencies on legacy agent service

**Cons:**
- 2-3 weeks effort minimum
- High risk of regression
- Delays other priorities

**Timeline:** 2-3 weeks development + 1 week testing

---

### Option D: Defer Migration (ZERO RISK) ⭐ PRAGMATIC
**Approach:** Document current state, focus on other priorities, revisit when orchestrator is ready.

**Implementation:**
1. Document findings in this analysis
2. Create orchestrator completion roadmap
3. Tag as "future work"
4. Continue using agent service
5. Prioritize other technical debt

**Pros:**
- No wasted effort on incomplete system
- Focus on user-facing features
- Agent service works fine

**Cons:**
- Technical debt remains
- Orchestrator sits unused

**Timeline:** None (documentation only)

---

## Recommendation

### Primary: **Option A (Shadow Mode)**
If the goal is to validate orchestrator architecture while maintaining stability, shadow mode is ideal. It provides:
- Real-world validation
- Zero user risk
- Clear gap visibility
- Incremental progress

### Alternative: **Option D (Defer)**
If orchestrator was created prematurely and other priorities exist, deferral is pragmatic. Agent service works well, and rushing an incomplete migration adds risk without clear benefit.

### NOT Recommended: **Option C (Complete First)**
The effort required (2-3 weeks) should only be invested if there's a compelling reason to replace the working agent service. Current state doesn't justify the cost.

## Effort Estimates

### Shadow Mode (Option A)
- Worker-orch-1: 1 day - Add shadow routing to RubicAI provider
- Worker-orch-2: 1 day - Add shadow calls to chat route
- Testing: 0.5 days
- Metrics dashboard: 0.5 days
- **Total: 3 days**

### Minimal Orchestrator (Option B)
- LLM integration: 2 days
- SSE streaming: 1 day
- Tool proxying: 1 day
- Testing: 1 day
- **Total: 5 days**

### Complete Orchestrator (Option C)
- Tool implementation: 8 days (32 tools × 0.25 day)
- Sandbox integration: 2 days
- SSE infrastructure: 2 days
- DB persistence: 1 day
- Browser/terminal: 2 days
- Testing: 3 days
- **Total: 18 days (3.5 weeks)**

## Files Analyzed

### Frontend
- `apps/app/app/api/chat/route.ts` - Main chat endpoint
- `apps/app/lib/chat/agent-proxy.ts` - SSE transformation
- `packages/ai/lib/rubic-provider.ts` - Provider client

### Orchestrator Service
- `services/orchestrator/src/index.ts` - Main server
- `services/orchestrator/src/routes/sessions.ts` - Session endpoints
- `services/orchestrator/src/lib/agent-loop.ts` - Loop logic (stub)
- `services/orchestrator/src/lib/tool-executor.ts` - Tool execution (stub)
- `services/orchestrator/src/lib/tool-registry.ts` - Tool definitions

### Agent Service (Legacy)
- `services/agent/src/routes/completion.py` - LLM integration
- `services/agent/src/agent_loop.py` - Real tool loop
- `services/agent/src/tool_executor.py` - Real tool execution
- `services/agent/src/e2b_manager.py` - Sandbox management

## Worker Status

### worker-orch-1
- **Assigned:** RubicAI provider orchestrator integration
- **Status:** Paused pending direction
- **Log:** docs/refactor-2026/phase-logs/worker-orch-1.log

### worker-orch-2
- **Assigned:** Chat route orchestrator integration
- **Status:** Waiting for worker-orch-1
- **Log:** docs/refactor-2026/phase-logs/worker-orch-2.log

## Next Steps

**Awaiting user decision on migration strategy:**

1. **If Shadow Mode (A):** Resume worker assignments for shadow routing
2. **If Minimal Orchestrator (B):** Assign LLM integration and streaming work
3. **If Complete First (C):** Create detailed orchestrator completion roadmap
4. **If Defer (D):** Archive this analysis and close task

## Questions for User

1. **What problem does orchestrator solve** that agent service doesn't?
2. **Is there a deadline** for orchestrator completion?
3. **What is the priority** relative to other work?
4. **Is shadow mode acceptable** for validation?
5. **Should we defer** and focus elsewhere?

---

**Logs:**
- Lead orchestrator: `docs/refactor-2026/phase-logs/lead-orchestrator.log`
- Worker 1: `docs/refactor-2026/phase-logs/worker-orch-1.log`
- Worker 2: `docs/refactor-2026/phase-logs/worker-orch-2.log`
- Checklist: `docs/refactor-2026/phase-logs/orchestrator-migration-checklist.md`
