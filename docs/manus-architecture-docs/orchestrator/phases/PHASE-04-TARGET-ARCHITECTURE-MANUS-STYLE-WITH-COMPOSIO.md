# Phase 04 - Target Architecture (Manus-style, adapted to Rubic + Composio)

## 1) Control-plane design

### 1.1 Single orchestrator authority
- Keep `services/agent` as the only planner/executor coordinator.
- Sandbox service becomes pure infra API or is fully internalized; do not run competing lifecycle logic.

### 1.2 Planner/executor split
- Planner model (Claude-family) produces:
  - plan updates,
  - tool intents,
  - stopping decisions.
- Executor runtime performs tool actions in sandbox/connectors/services.
- Contract:
  - strict tool intent schema,
  - strict tool result schema,
  - deterministic retries and error classes.

Implementation baseline note:
- The same primary LLM loop handles both planning and execution decisions.
- Do not implement separate default planner-model + executor-model architecture.

### 1.3 Sandbox allocation policy
- Introduce explicit policy engine:
  - `desktop` for browser-interactive tasks,
  - `code-interpreter` for compute/data tasks,
  - `base` for lightweight filesystem/shell/search.
- Default one-sandbox-per-user reuse policy.
- Optional multi-sandbox fanout for decomposed subtasks only when planner requests parallel branches (map/parallel path).

## 2) Tool execution architecture
- Canonical tool registry with categories:
  - local runtime tools (file/shell/code/browser/deploy)
  - external connector tools (Composio)
  - platform tools (search/notify/ask/schedule)
- One state machine for every tool call:
  - queued -> running -> completed|failed|cancelled
- Emit one normalized event envelope used by SSE + websocket + timeline persistence.

## 3) Storage and artifact path
- Canonical artifact contract:
  - sandbox path -> upload intent -> file service object id -> signed access URL.
- No direct ambiguity between binary stream and signed URL metadata.
- Add checksums and provenance fields for generated artifacts.

## 4) Frontend state architecture
- Keep only slices with real behavior.
- Move low-value or dead slices behind feature flags or delete.
- Generate typed event reducers from shared schema to avoid drift.

## 5) Composio-first connector strategy
- Keep Composio as connector provider.
- Add connector capability descriptors and auth-health checks at orchestration time.
- Do not expose tools to planner unless connection and scope are valid.
