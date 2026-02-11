# Phase 07 - Corrected Baseline (User-Approved)

Date: 2026-02-10

This file captures the baseline architecture constraints to use for Rubic refactor execution.
When any older document conflicts with this file, this file wins for implementation planning.

## Non-negotiable constraints

1. Single primary agent model loop
- One main orchestrator loop model (Claude-class) handles planning + tool decisions + response composition.
- No planner/executor split across two separate LLMs as default architecture.

2. Sandbox policy
- Default policy target: one sandbox per user, reused across sessions.
- Parallel fanout sandboxes are exception-path only (map/parallel subtasks).

3. Tools are execution functions, not independent agents
- Tools execute deterministic operations.
- Tool results are fed back into the same orchestrator LLM loop.

4. Orchestrator responsibility
- Prompt assembly
- Tool schema assembly
- LLM call/stream management
- Tool routing
- Event streaming to UI
- Persistence and billing hooks

5. State and eventing
- Real-time event protocol is first-class (tool lifecycle, messages, plan updates, errors).
- Timeline/event persistence model is core, not optional.

6. Connector strategy
- Composio is the connector provider for external app tooling.

7. Build discipline
- No architecture drift into unnecessary multi-sandbox/multi-model complexity unless proven required by measurable gains.

## Design implications for Rubic

- Collapse duplicate sandbox lifecycle paths into one authoritative orchestrator contract.
- Keep sandbox service either as infra adapter only or remove overlapping control.
- Introduce explicit policy gates for fanout sandbox creation.
- Make shell/file/browser tool contracts deterministic and test-backed.
