# Tool Contracts and Orchestrator Loop

## Main loop contract
1. Build system prompt + history + active tools.
2. Call orchestrator model.
3. For each tool call:
- persist tool call row,
- emit `tool_call.start`,
- execute via router,
- emit result/error,
- append tool result to model context.
4. End when model emits terminal result.

## System prompt assembly contract
1. Base instructions (`agent_loop`, formatting, tool policy, error handling).
2. Sandbox environment description and utility commands.
3. Secret variable names available for runtime (values never embedded in prompt text).
4. Skill instruction blocks (loaded by relevance).
5. Connector/MCP capability blocks (user-enabled only).
6. Related knowledge blocks (persistent cross-session facts).
7. Mode-specific sections (browser/webdev/generate/slides).
8. Compacted history section when conversation exceeds context budget.

## Tool categories
1. Local orchestrator tools: `plan`, `message`, `search`, `schedule`, `map` coordinator.
2. Sandbox runtime tools: `shell`, `file`, `browser`, `match`, `expose`.
3. Connector tools: dynamic Composio tools gated by auth/scopes.
4. Mode tools: `generate`, `slides`, `webdev_init_project`.

## Mode handling
- Expansion mode: add tool groups and continue same conversation.
- Nested mode: run isolated model sub-call and return output to parent loop.
- Map mode: spawn subtask sandboxes and aggregate structured outputs.

## Skill system contract
1. Skills are loaded from registered skill packages with structured metadata.
2. Progressive disclosure: brief metadata -> selected SKILL.md -> required references.
3. Skill loading must be deterministic and logged in timeline diagnostics.
4. Skill instructions are appended to system prompt before loop execution.

## Context management contract
1. Track token budget per iteration.
2. Compact old history into structured summaries before hitting hard limits.
3. Preserve recent user turns, plan state, and unresolved tool context uncompressed.
4. Mark compacted blocks explicitly so the model can request rehydration when needed.

## Tool result envelope
Every tool returns:
- `toolCallId`
- `status` (`completed|failed|cancelled|timeout`)
- `output` (typed)
- `error` (typed, optional)
- `timingMs`
- `usage` (optional model/tool usage)

## Map aggregation contract
1. `map` requires a single shared output schema for all subtasks.
2. Each subtask returns a schema-valid structured result or a typed error.
3. Aggregator returns ordered results with explicit per-subtask status.
4. Failed subtasks are included; never silently dropped.
5. File outputs are promoted to shared storage and rewritten as stable references.

## Error policy
1. Deterministic retry classes (`transient`, `validation`, `auth`, `fatal`).
2. Max retry budget per tool call.
3. Fatal errors propagate to timeline + user-facing message tool.
4. Timeout always emits terminal tool status.
