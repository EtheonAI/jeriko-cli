# Target Architecture (Rubic Manus-Style)

## Core model
1. Control plane: Node.js orchestrator service.
2. Runtime plane: E2B sandbox per user.
3. Parallel execution plane: temporary subtask sandboxes for `map`.
4. Media plane: Go WebRTC/Neko manager service.

## High-level flow
1. User prompt -> orchestrator session router.
2. Orchestrator loads context/history/plan.
3. Orchestrator builds toolset based on active modes.
4. Claude-class model runs agent loop.
5. Tool calls route to:
- local orchestrator tools (`plan`, `message`, `search`, `schedule`, `map` coordinator)
- sandbox runtime tools (`shell`, `file`, `browser`, `match`, `expose`)
- connector tools (Composio)
6. Events stream over websocket and persist to timeline store.
7. Attachments promoted to S3/CDN and materialized in message events.

## Mode behavior
- Expansion modes: browser + webdev tools added in-loop.
- Nested modes: generate + slides as dedicated sub-calls.
- Parallel mode: map creates sub-agents in isolated sandboxes.

## Cognitive loop model
- Implement planner/executor/verifier as functional stages in one orchestrator loop:
1. Planner stage: update plan, choose next tool/mode.
2. Executor stage: dispatch tool call to local/sandbox/connector runtime.
3. Verifier stage: classify result, decide retry/escalate/finalize.
- This stage model is inspired by `guide/2505.02024v1.pdf` research framing, but realized with the canonical Part-10 constraints.

## Data/system requirements
1. Strongly typed contracts package for tools/events/API.
2. Timeline/event-sourced persistence for replay and pagination.
3. Credits/usage metering at step and tool granularity.
4. Deterministic environment injection pipeline.

## Technology direction
- Orchestrator: TypeScript + AI SDK + Fastify/Express + Postgres + Redis.
- WebRTC service: Go + Neko orchestration + TURN-aware signaling.
- Connectors: Composio SDK and webhooks.
- Frontend: Next.js app + normalized state slices with canonical event reducers.
