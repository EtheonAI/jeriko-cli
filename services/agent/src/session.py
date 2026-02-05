"""
Session context management for the agent service.

Handles:
- Loading conversation history from the messages table
- Saving new messages (user + assistant + tool) after agent_loop
- Caching tools and sandbox per session in memory
- Creating/retrieving agent sessions
"""

import json
import time
from dataclasses import dataclass, field

import structlog

from .db import execute, fetch, fetchrow, fetchval, generate_id

logger = structlog.get_logger()

# In-memory session cache — tools/sandbox don't change during a session
_session_cache: dict[str, "SessionContext"] = {}
SESSION_CACHE_TTL = 3600  # 1 hour


@dataclass
class SessionContext:
    """Cached session state. Created once per session, reused across turns."""

    session_id: str
    user_id: str
    sandbox_id: str | None = None
    tools: list[dict] = field(default_factory=list)
    connected_apps: list[str] = field(default_factory=list)
    created_at: float = field(default_factory=time.monotonic)

    @property
    def is_expired(self) -> bool:
        return (time.monotonic() - self.created_at) > SESSION_CACHE_TTL


def get_cached_session(session_id: str) -> SessionContext | None:
    """Get cached session context if it exists and isn't expired."""
    ctx = _session_cache.get(session_id)
    if ctx and not ctx.is_expired:
        return ctx
    if ctx and ctx.is_expired:
        del _session_cache[session_id]
    return None


def cache_session(ctx: SessionContext) -> None:
    """Cache a session context for reuse."""
    _session_cache[ctx.session_id] = ctx
    # Evict old entries if cache grows too large
    if len(_session_cache) > 1000:
        _evict_expired_sessions()


def _evict_expired_sessions() -> None:
    """Remove expired sessions from cache."""
    expired = [k for k, v in _session_cache.items() if v.is_expired]
    for k in expired:
        del _session_cache[k]


# ============================================================
# Session CRUD
# ============================================================


async def get_or_create_session(session_id: str, user_id: str) -> str:
    """
    Ensure an agent_session row exists in the DB.
    Returns the session_id (same as input if it already exists).
    """
    try:
        existing = await fetchrow(
            'SELECT id FROM agent_sessions WHERE id = $1',
            session_id,
        )
        if existing:
            return existing["id"]

        # Create new session
        await execute(
            """INSERT INTO agent_sessions (id, user_id, status)
               VALUES ($1, $2, 'active')
               ON CONFLICT (id) DO NOTHING""",
            session_id,
            user_id,
        )
        logger.info("session_created", session_id=session_id, user_id=user_id)
        return session_id

    except Exception as e:
        logger.warning("session_create_error", error=str(e))
        return session_id  # Continue without DB — session_id still works for in-memory


# ============================================================
# Conversation History
# ============================================================


async def load_conversation_history(session_id: str, limit: int = 50) -> list[dict]:
    """
    Load conversation history from the messages table.
    Returns messages in Anthropic format: [{"role": "user/assistant", "content": "..."}]

    Loads the most recent `limit` messages to keep context window manageable.
    """
    try:
        rows = await fetch(
            """SELECT role, content, metadata
               FROM messages
               WHERE session_id = $1
               ORDER BY created_at ASC
               LIMIT $2""",
            session_id,
            limit,
        )

        messages = []
        for row in rows:
            role = row["role"]
            content = row["content"]
            metadata = row["metadata"]

            # Map DB roles to Anthropic roles
            if role == "tool":
                # Tool results are stored as user messages with tool_result content
                # Reconstruct the tool_result format
                tool_call_id = metadata.get("toolCallId", "") if metadata else ""
                is_error = metadata.get("isError", False) if metadata else False
                messages.append({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": tool_call_id,
                        "content": content,
                        "is_error": is_error,
                    }],
                })
            elif role == "assistant":
                # Check if assistant message has tool_use blocks in metadata
                tool_blocks = metadata.get("toolBlocks", []) if metadata else []
                if tool_blocks:
                    # Reconstruct mixed text + tool_use content
                    blocks = []
                    if content:
                        blocks.append({"type": "text", "text": content})
                    blocks.extend(tool_blocks)
                    messages.append({"role": "assistant", "content": blocks})
                else:
                    messages.append({"role": "assistant", "content": content})
            elif role in ("user", "system"):
                messages.append({"role": role, "content": content})

        # Merge consecutive user messages (tool results) into single messages
        merged = _merge_consecutive_tool_results(messages)

        logger.info(
            "history_loaded",
            session_id=session_id,
            raw_count=len(rows),
            merged_count=len(merged),
        )
        return merged

    except Exception as e:
        logger.warning("history_load_error", session_id=session_id, error=str(e))
        return []


def _merge_consecutive_tool_results(messages: list[dict]) -> list[dict]:
    """
    Anthropic requires all tool_results for parallel tool calls in a SINGLE user message.
    Merge consecutive user messages that contain tool_result blocks.
    """
    if not messages:
        return messages

    merged = [messages[0]]
    for msg in messages[1:]:
        prev = merged[-1]
        # If both are user messages with tool_result content, merge them
        if (
            msg["role"] == "user"
            and prev["role"] == "user"
            and isinstance(msg["content"], list)
            and isinstance(prev["content"], list)
            and all(b.get("type") == "tool_result" for b in msg["content"])
            and all(b.get("type") == "tool_result" for b in prev["content"])
        ):
            prev["content"].extend(msg["content"])
        else:
            merged.append(msg)

    return merged


# ============================================================
# Message Persistence
# ============================================================


async def save_user_message(session_id: str, content: str) -> str | None:
    """Save a user message to the database."""
    try:
        msg_id = generate_id()
        await execute(
            """INSERT INTO messages (id, session_id, role, content)
               VALUES ($1, $2, 'user', $3)""",
            msg_id,
            session_id,
            content,
        )
        return msg_id
    except Exception as e:
        logger.warning("save_user_message_error", error=str(e))
        return None


async def save_assistant_message(
    session_id: str,
    content: str,
    model: str | None = None,
    usage: dict | None = None,
    tool_blocks: list[dict] | None = None,
) -> str | None:
    """Save an assistant message to the database."""
    metadata = {}
    if model:
        metadata["model"] = model
    if usage:
        metadata["tokens"] = {
            "input": usage.get("input_tokens", 0),
            "output": usage.get("output_tokens", 0),
        }
    if tool_blocks:
        # Store tool_use blocks so we can reconstruct on reload
        metadata["toolBlocks"] = tool_blocks

    try:
        msg_id = generate_id()
        await execute(
            """INSERT INTO messages (id, session_id, role, content, metadata)
               VALUES ($1, $2, 'assistant', $3, $4)""",
            msg_id,
            session_id,
            content,
            json.dumps(metadata) if metadata else None,
        )
        return msg_id
    except Exception as e:
        logger.warning("save_assistant_message_error", error=str(e))
        return None


async def save_tool_messages(
    session_id: str,
    tool_calls: list[dict],
) -> None:
    """
    Save tool call results as 'tool' role messages.
    Each tool call gets its own message for history reconstruction.
    """
    for tc in tool_calls:
        try:
            result_str = json.dumps(tc["result"]) if isinstance(tc["result"], dict) else str(tc["result"])
            metadata = {
                "toolName": tc["name"],
                "toolCallId": tc.get("tool_use_id", ""),
                "isError": tc.get("is_error", False),
            }
            await execute(
                """INSERT INTO messages (id, session_id, role, content, metadata)
                   VALUES ($1, $2, 'tool', $3, $4)""",
                generate_id(),
                session_id,
                result_str,
                json.dumps(metadata),
            )
        except Exception as e:
            logger.warning("save_tool_message_error", tool=tc["name"], error=str(e))


async def update_session_title(session_id: str, title: str) -> None:
    """Update the session title (auto-generated from first message)."""
    try:
        await execute(
            """UPDATE agent_sessions SET title = $1, updated_at = NOW()
               WHERE id = $2 AND title IS NULL""",
            title[:200],
            session_id,
        )
    except Exception as e:
        logger.warning("session_title_update_error", error=str(e))


async def get_session_message_count(session_id: str) -> int:
    """Get the number of messages in a session."""
    try:
        count = await fetchval(
            "SELECT COUNT(*) FROM messages WHERE session_id = $1",
            session_id,
        )
        return count or 0
    except Exception:
        return 0
