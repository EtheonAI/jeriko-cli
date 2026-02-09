# Rubic SSE Contract & State Transitions (ADR-001)

**Version:** 1.0.0
**Status:** Finalized (Phase 0)

## 1. Core State Model

The agent runtime must transition through these states linearly. Each transition MUST emit an SSE event.

| State | Description | Transition Event |
| :--- | :--- | :--- |
| `IDLE` | No active task. | N/A |
| `SESSION_ACQUIRING` | Creating or connecting to E2B sandbox. | `session_status` |
| `SESSION_READY` | Sandbox connected and tools initialized. | `session_status` |
| `TOOL_RUNNING` | Tool call initiated by LLM. | `tool_call_started` |
| `TOOL_STREAMING` | Tool is emitting incremental output (e.g., shell stdout). | `tool_stream_chunk` |
| `TOOL_SUCCEEDED` | Tool execution completed successfully. | `tool_call_completed` |
| `TOOL_FAILED` | Tool execution crashed or returned error. | `tool_call_failed` |
| `SESSION_RECOVERING`| Attempting to reconnect after network drop. | `session_status` |
| `SESSION_TERMINATED`| Sandbox closed or TTL expired. | `session_status` |

## 2. SSE Event Schema

All events follow the standard SSE format: `event: <type>\ndata: <json_payload>\n\n`.

### 2.1. Session Events (`event: session_status`)
```json
{
  "type": "session_status",
  "status": "ready", // acquiring, ready, recovering, terminated
  "sandboxId": "e2b-sandbox-id",
  "vncUrl": "https://...", // Optional, for noVNC fallback
  "nekoUrl": "https://...", // Optional, for WebRTC stream
  "metadata": {
    "warm": true,
    "expiresAt": "2026-02-10T..."
  }
}
```

### 2.2. Tool Execution Events
#### `event: tool_call_started`
```json
{
  "callId": "call_123",
  "tool": "shell",
  "input": { "command": "ls -la" }
}
```

#### `event: tool_stream_chunk`
```json
{
  "callId": "call_123",
  "chunk": "total 12\n-rw-r--r-- ...",
  "stream": "stdout" // stdout, stderr
}
```

#### `event: tool_call_completed`
```json
{
  "callId": "call_123",
  "output": { "exit_code": 0, "stdout": "..." },
  "duration": 1.2
}
```

### 2.3. Browser Visual Events (`event: browser_state`)
```json
{
  "type": "browser_state",
  "url": "https://google.com",
  "title": "Google",
  "screenshot": "data:image/png;base64,...", // Optional, for static preview
  "isLive": true
}
```

## 3. Mandatory Correlation IDs
Every event payload MUST include:
- `conversation_id`
- `message_id`
- `sandbox_id` (once acquired)
