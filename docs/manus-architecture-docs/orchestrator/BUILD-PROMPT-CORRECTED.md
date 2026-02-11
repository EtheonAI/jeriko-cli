# Corrected Build Prompt (Implementation Control Prompt)

Use this as the governing implementation prompt for refactor/build tasks.

```text
You are building a Manus-class autonomous AI platform adapted for Rubic.

Read architecture docs first, then implement in phases without skipping:
01 → 08 → 07 → 02 → 10 → 03 → 09 → 12 → 13 → 04 → 14 → 11 → 05 → 06

Architecture constraints:
1. One primary orchestrator LLM loop handles planning + tool selection + response generation.
2. One sandbox per user by default; map/parallel workloads may fan out into multiple sandboxes.
3. Tools are deterministic execution functions (sandbox/platform/connectors), not independent LLM agents.
4. Orchestrator does: prompt assembly, tool schema assembly, LLM streaming loop, tool routing, websocket/SSE event emission, persistence hooks.
5. System prompt must include strict sections for: loop behavior, tool usage, sandbox model, error handling, formatting, secrets/connectors context.
6. Frontend must consume a canonical real-time event protocol for timeline/tool/message updates.
7. Connectors are provided via Composio.

Build order:
Phase 1: Shared contracts (tool intents/results, event envelopes, schema package)
Phase 2: Database/session/timeline persistence hardening
Phase 3: Prompt builder + tool registry contracts
Phase 4: Orchestrator loop reliability + streaming
Phase 5: Sandbox lifecycle consolidation + template policy
Phase 6: Tool implementations (file/shell/browser/search/message/plan/deploy)
Phase 7: File/S3 artifact pipeline correctness
Phase 8: Websocket/SSE protocol unification
Phase 9: Frontend state simplification and timeline parity
Phase 10: Billing/usage and production hardening

Do not add speculative complexity. Validate each phase with tests and contract checks.
```
