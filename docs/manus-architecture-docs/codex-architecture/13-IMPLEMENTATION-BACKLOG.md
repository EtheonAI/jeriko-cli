# Implementation Backlog

## Epic A - Orchestrator core
1. Build Node orchestrator skeleton (`services/orchestrator`).
2. Implement session router and context loader.
3. Implement AI SDK loop with tool registry and max-step guard.
4. Implement mode manager (expansion vs nested sub-call).
5. Implement map sub-agent orchestration policy.

## Epic B - Tool contracts and runtime adapters
1. Define Zod schemas for all tools.
2. Build adapters: shell/file/browser/match/expose.
3. Add connector tool adapter (Composio).
4. Add plan/message/schedule/search local tools.
5. Add retry/cancel/error normalization.

## Epic C - Sandbox and media
1. Build sandbox manager with reuse policy (one per user).
2. Build temporary fanout sandboxes for map.
3. Build/standardize Go media RPC service for Neko sessions.
4. Expose stable browser/desktop stream endpoints.
5. Add health probes and lifecycle metrics.

## Epic D - Frontend state and UX
1. Implement canonical WS event middleware.
2. Complete Tier-1 slices with tested reducers/selectors.
3. Complete Tier-2 slices (`billing`, `devices`, `connectors`).
4. Remove or merge dead slices.
5. Build plan sidebar + tool call cards + timeline replay parity.

## Epic E - Data and persistence
1. Finalize tables: sessions/messages/events/tool_calls/plans/files/usage.
2. Implement segment pagination model.
3. Implement usage ledger (billing-safe, immutable entries).
4. Implement file provenance and checksum fields.
5. Add retention and archival policy.

## Epic F - Testing and rollout
1. Build golden task suite for orchestrator parity.
2. Build contract tests and schema gate in CI.
3. Build Playwright e2e suite for full core flows.
4. Run shadow traffic validation.
5. Progressive rollout and old path retirement.

## Priority order
1. Epic A
2. Epic B
3. Epic C
4. Epic E
5. Epic D
6. Epic F

## Definition of done per epic
1. Design spec merged.
2. Contract tests green.
3. Observability added.
4. E2E paths passing.
5. Runbook and rollback procedure documented.
