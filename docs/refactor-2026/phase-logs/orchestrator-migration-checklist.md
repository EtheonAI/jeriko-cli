# Orchestrator Migration Checklist

**Lead:** LEAD-ORCHESTRATOR
**Workers:** worker-orch-1, worker-orch-2
**Goal:** Migrate app flow from legacy AGENT_SERVICE_URL to orchestrator+sandbox flow
**Started:** 2026-02-11

## Architecture Overview

### Current (Legacy)
```
Frontend → RubicAI Provider → AGENT_SERVICE_URL:8000 → Agent Service (Python)
                                                      → Direct E2B SDK
                                                      → Tool execution
```

### Target (New)
```
Frontend → RubicAI Provider → ORCHESTRATOR_SERVICE_URL:4014 → Orchestrator Service
                                                            → Sandbox Service :4012 → E2B
                                                            → Tool execution
```

## Phase 1: RubicAI Provider Updates (worker-orch-1)

### Files Modified
- [ ] `packages/ai/lib/rubic-provider.ts`

### Changes Required
- [ ] Add `ORCHESTRATOR_SERVICE_URL` configuration option
- [ ] Add `createSession(userId, title, mode)` method
- [ ] Add `sendMessage(sessionId, message, options)` method
- [ ] Add `getSessionEvents(sessionId)` method
- [ ] Add feature flag for orchestrator vs legacy routing
- [ ] Keep backward compatibility with existing `stream()` and `complete()` methods
- [ ] Update JSDoc with new methods
- [ ] Export new methods from package

### Test Verification
- [ ] TypeScript compilation passes
- [ ] Can create session via orchestrator
- [ ] Can send message and receive events
- [ ] Legacy methods still work
- [ ] Feature flag toggles correctly

## Phase 2: Chat Route Updates (worker-orch-2)

### Files Modified
- [ ] `apps/app/app/api/chat/route.ts`
- [ ] `apps/app/lib/chat/agent-proxy.ts`

### Changes Required (route.ts)
- [ ] Check for orchestrator feature flag
- [ ] If enabled, create session via `rubic.createSession()`
- [ ] Send message via `rubic.sendMessage()` instead of `rubic.stream()`
- [ ] Handle orchestrator event stream format
- [ ] Keep legacy fallback path
- [ ] Maintain session persistence to DB
- [ ] Maintain auto-titling

### Changes Required (agent-proxy.ts)
- [ ] Add `createOrchestratorProxyStream()` function
- [ ] Map orchestrator events to AI SDK v6 format:
  - [ ] `message.chunk` → `text-delta`
  - [ ] `message.complete` → `text-end`
  - [ ] `tool_call.start` → `tool-input-start`
  - [ ] `tool_call.result` → `tool-output-available`
  - [ ] `plan.update` → preserve for planner
  - [ ] `session.created` → skip (internal)
- [ ] Keep existing `createAgentProxySseStream()` for legacy
- [ ] Add event type detection and routing

### Test Verification
- [ ] Chat POST creates orchestrator session
- [ ] Messages stream correctly
- [ ] Tool calls render in UI
- [ ] Planner shows plan updates
- [ ] Messages persist to DB
- [ ] Session auto-titles
- [ ] Browser/terminal streaming works
- [ ] Legacy path still works when flag disabled

## Phase 3: Environment Configuration

### Files Modified
- [ ] `apps/app/.env.example`
- [ ] `services/orchestrator/.env.example`

### Environment Variables
- [ ] `ORCHESTRATOR_SERVICE_URL` (default: http://localhost:4014)
- [ ] `SANDBOX_SERVICE_URL` (default: http://localhost:4012)
- [ ] `USE_ORCHESTRATOR` (default: false)
- [ ] Document in README

## Phase 4: Integration Testing

### Manual Test Cases
- [ ] Create new chat session
- [ ] Send simple text message
- [ ] Send message requiring tool use (e.g., "search for TypeScript docs")
- [ ] Verify planner shows plan
- [ ] Verify tool calls render
- [ ] Verify browser view works
- [ ] Verify terminal view works
- [ ] Test session persistence (refresh page)
- [ ] Test resumable streams (disconnect/reconnect)
- [ ] Test fallback to legacy when orchestrator down

### Automated Tests (if applicable)
- [ ] Unit tests for RubicAI provider
- [ ] Integration tests for chat route
- [ ] E2E tests for full flow

## Phase 5: Documentation

### Documentation Updates
- [ ] Update MEMORY.md with new architecture
- [ ] Document orchestrator event schema
- [ ] Add migration guide for developers
- [ ] Update service README files

## Phase 6: Deployment Checklist

### Pre-Deployment
- [ ] All tests pass
- [ ] TypeScript compilation clean
- [ ] ESLint passes
- [ ] No console errors in dev
- [ ] Feature flag tested both ways

### Deployment Steps
- [ ] Deploy orchestrator service first
- [ ] Deploy frontend with flag disabled
- [ ] Test legacy path in production
- [ ] Enable flag for canary users (10%)
- [ ] Monitor error rates
- [ ] Gradually increase to 100%
- [ ] Remove legacy code after 2 weeks stable

## Files Changed Summary

### Frontend
- `apps/app/app/api/chat/route.ts` - Orchestrator routing
- `apps/app/lib/chat/agent-proxy.ts` - Event mapping
- `apps/app/.env.example` - New env vars

### Packages
- `packages/ai/lib/rubic-provider.ts` - Orchestrator methods

### Services
- `services/orchestrator/src/routes/sessions.ts` - Session endpoints (already exists)

## Rollback Plan

If issues arise:
1. Set `USE_ORCHESTRATOR=false` in environment
2. Restart app service
3. Traffic reverts to legacy agent service
4. No data loss (DB schema unchanged)

## Success Criteria

✅ Migration complete when:
- [ ] All checklist items complete
- [ ] Zero TypeScript errors
- [ ] All tests pass
- [ ] Manual test cases verified
- [ ] Documentation updated
- [ ] Workers logged all changes
- [ ] Lead verified implementation
- [ ] Feature flag works both ways
- [ ] Production deployment successful

---

**Notes:**
- This is a non-breaking migration with feature flag
- Legacy path remains functional
- No database schema changes required
- Backward compatible API design
