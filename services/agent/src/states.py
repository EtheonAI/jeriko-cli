"""
Agent session state machine.

Defines the valid states and transitions for an agent session's
sandbox lifecycle. Used by the E2B manager and completion route
to ensure consistent state handling.

State diagram:
    IDLE
      |
      v
    SESSION_ACQUIRING -----> SESSION_FAILED (terminal if no retry)
      |
      v
    SESSION_READY <--------- SESSION_RECOVERING
      |     ^                     ^
      v     |                     |
    TOOL_RUNNING ---------> (on sandbox error)
      |
      v
    TOOL_STREAMING (optional, for shell/code with live output)
      |
      v
    TOOL_SUCCEEDED / TOOL_FAILED
      |
      v
    SESSION_READY (loop back for next tool)
      |
      v
    SESSION_TERMINATED (cleanup)
"""

from enum import StrEnum


class SessionState(StrEnum):
    """Session lifecycle states."""

    IDLE = "idle"
    SESSION_ACQUIRING = "session_acquiring"
    SESSION_READY = "session_ready"
    SESSION_FAILED = "session_failed"
    SESSION_RECOVERING = "session_recovering"
    SESSION_TERMINATED = "session_terminated"


class ToolState(StrEnum):
    """Tool execution states within a session."""

    IDLE = "idle"
    RUNNING = "running"
    STREAMING = "streaming"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


# Valid state transitions
SESSION_TRANSITIONS: dict[SessionState, set[SessionState]] = {
    SessionState.IDLE: {SessionState.SESSION_ACQUIRING},
    SessionState.SESSION_ACQUIRING: {
        SessionState.SESSION_READY,
        SessionState.SESSION_FAILED,
    },
    SessionState.SESSION_READY: {
        SessionState.SESSION_TERMINATED,
        SessionState.SESSION_RECOVERING,
    },
    SessionState.SESSION_FAILED: {
        SessionState.SESSION_ACQUIRING,  # retry
        SessionState.SESSION_TERMINATED,
    },
    SessionState.SESSION_RECOVERING: {
        SessionState.SESSION_READY,
        SessionState.SESSION_TERMINATED,
    },
    SessionState.SESSION_TERMINATED: set(),  # terminal state
}

TOOL_TRANSITIONS: dict[ToolState, set[ToolState]] = {
    ToolState.IDLE: {ToolState.RUNNING},
    ToolState.RUNNING: {ToolState.STREAMING, ToolState.SUCCEEDED, ToolState.FAILED},
    ToolState.STREAMING: {ToolState.SUCCEEDED, ToolState.FAILED},
    ToolState.SUCCEEDED: {ToolState.IDLE},
    ToolState.FAILED: {ToolState.IDLE},
}


def can_transition(current: SessionState, target: SessionState) -> bool:
    """Check if a session state transition is valid."""
    return target in SESSION_TRANSITIONS.get(current, set())


def can_tool_transition(current: ToolState, target: ToolState) -> bool:
    """Check if a tool state transition is valid."""
    return target in TOOL_TRANSITIONS.get(current, set())
