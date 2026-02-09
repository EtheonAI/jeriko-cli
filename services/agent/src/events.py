"""
Canonical SSE event types and helpers for the agent service.

Every event emitted from the agent → frontend follows this schema.
Events are typed strings with structured payloads, ensuring the frontend
SSE processor (sse-processor.ts) can handle them deterministically.

Correlation fields on every event:
  - conversation_id (session_id)
  - message_id (optional, set when within an LLM turn)
  - tool_call_id (optional, set when within a tool execution)
  - sandbox_id (optional, set once sandbox is acquired)
  - timestamp (ISO 8601)
"""

import json
import time
from typing import Any


# ============================================================
# Session lifecycle events
# ============================================================

SESSION_CREATED = "session_created"
SESSION_RECONNECTED = "session_reconnected"
SESSION_EXPIRED = "session_expired"
SESSION_TERMINATED = "session_terminated"

# ============================================================
# Sandbox events
# ============================================================

SANDBOX_INFO = "sandbox_info"
NEKO_READY = "neko_ready"

# ============================================================
# Tool execution events
# ============================================================

TOOL_CALL_STARTED = "tool_call_started"
TOOL_STREAM_CHUNK = "tool_stream_chunk"
TOOL_CALL_COMPLETED = "tool_call_completed"
TOOL_CALL_FAILED = "tool_call_failed"

# ============================================================
# File events (emitted alongside tool results for canvas)
# ============================================================

FILE_CREATED = "file_created"
FILE_UPDATED = "file_updated"
FILE_READ = "file_read"

# ============================================================
# Browser events
# ============================================================

BROWSER_FRAME = "browser_frame"
BROWSER_STATE = "browser_state"

# ============================================================
# LLM content events (existing — kept for completeness)
# ============================================================

CONTENT = "content"
REASONING = "reasoning"
REASONING_END = "reasoning_end"
SOURCE_URL = "source_url"
USAGE = "usage"
ERROR = "error"
WARNING = "warning"


# ============================================================
# SSE Helpers
# ============================================================


def sse_event(event_type: str, data: dict[str, Any] | None = None, **kwargs: Any) -> str:
    """
    Format a typed SSE event string.

    Usage:
        yield sse_event(SANDBOX_INFO, sandboxId="sbx_123", nekoUrl="https://...")
        yield sse_event(TOOL_CALL_STARTED, toolCallId="tc_1", tool="shell_exec", input={...})
    """
    payload: dict[str, Any] = {"type": event_type}
    if data:
        payload.update(data)
    payload.update(kwargs)

    # Always include timestamp
    if "timestamp" not in payload:
        payload["timestamp"] = time.time()

    return f"data: {json.dumps(payload)}\n\n"


def sse_done() -> str:
    """Emit the stream termination sentinel."""
    return "data: [DONE]\n\n"


# ============================================================
# Typed event constructors (for IDE autocomplete + validation)
# ============================================================


def session_created_event(
    session_id: str,
    sandbox_id: str,
    neko_url: str | None = None,
) -> str:
    """Emitted once when a new sandbox is created for a session."""
    data: dict[str, Any] = {
        "sessionId": session_id,
        "sandboxId": sandbox_id,
    }
    if neko_url:
        data["nekoUrl"] = neko_url
    return sse_event(SESSION_CREATED, data)


def session_reconnected_event(session_id: str, sandbox_id: str) -> str:
    """Emitted when reconnecting to an existing sandbox."""
    return sse_event(SESSION_RECONNECTED, sessionId=session_id, sandboxId=sandbox_id)


def sandbox_info_event(
    sandbox_id: str,
    neko_url: str | None = None,
    stream_url: str | None = None,
) -> str:
    """Emitted to provide sandbox connection info to the frontend."""
    data: dict[str, Any] = {"sandboxId": sandbox_id}
    if neko_url:
        data["nekoUrl"] = neko_url
    if stream_url:
        data["streamUrl"] = stream_url
    return sse_event(SANDBOX_INFO, data)


def neko_ready_event(sandbox_id: str, neko_url: str) -> str:
    """Emitted when the Neko WebRTC server inside the sandbox is ready."""
    return sse_event(NEKO_READY, sandboxId=sandbox_id, nekoUrl=neko_url)


def tool_started_event(tool_call_id: str, tool_name: str, tool_input: Any) -> str:
    """Emitted before tool execution begins."""
    return sse_event(
        TOOL_CALL_STARTED,
        toolCallId=tool_call_id,
        tool=tool_name,
        input=tool_input,
    )


def tool_stream_chunk_event(tool_call_id: str, chunk: str, stream: str = "stdout") -> str:
    """Emitted for real-time streaming output from shell/code tools."""
    return sse_event(
        TOOL_STREAM_CHUNK,
        toolCallId=tool_call_id,
        chunk=chunk,
        stream=stream,
    )


def tool_completed_event(
    tool_call_id: str,
    tool_name: str,
    result: Any,
    success: bool = True,
) -> str:
    """Emitted when a tool finishes executing."""
    return sse_event(
        TOOL_CALL_COMPLETED,
        toolCallId=tool_call_id,
        tool=tool_name,
        success=success,
        result=result,
    )


def tool_failed_event(tool_call_id: str, tool_name: str, error: str) -> str:
    """Emitted when a tool execution fails."""
    return sse_event(
        TOOL_CALL_FAILED,
        toolCallId=tool_call_id,
        tool=tool_name,
        success=False,
        error=error,
    )


def browser_frame_event(
    screenshot: str,
    url: str = "",
    title: str = "",
) -> str:
    """Emitted after every browser action that produces a screenshot."""
    return sse_event(
        BROWSER_FRAME,
        screenshot=screenshot,
        url=url,
        title=title,
    )


def file_event(
    event_type: str,
    path: str,
    content: str | None = None,
) -> str:
    """Emitted for file create/update/read operations."""
    data: dict[str, Any] = {"path": path}
    if content is not None:
        # Truncate large content for the SSE event (full content is in tool_result)
        data["contentPreview"] = content[:500] if len(content) > 500 else content
    return sse_event(event_type, data)
