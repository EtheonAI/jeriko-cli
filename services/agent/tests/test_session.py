"""
Tests for src/session.py — session management, caching, conversation history,
and message persistence.

Covers:
- SessionContext creation and expiry
- In-memory session cache (get, put, eviction)
- Conversation history loading from DB
- _merge_consecutive_tool_results
- Message save operations (user, assistant, tool)
"""

import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.session import (
    SESSION_CACHE_TTL,
    SessionContext,
    _evict_expired_sessions,
    _merge_consecutive_tool_results,
    _session_cache,
    cache_session,
    get_cached_session,
    get_or_create_session,
    get_session_message_count,
    load_conversation_history,
    save_assistant_message,
    save_tool_messages,
    save_user_message,
    update_session_title,
)


# ============================================================
# SessionContext dataclass
# ============================================================


class TestSessionContext:
    """Tests for the SessionContext dataclass."""

    def test_create_session_context(self):
        """SessionContext can be created with required fields."""
        ctx = SessionContext(session_id="sess_1", user_id="user_1")
        assert ctx.session_id == "sess_1"
        assert ctx.user_id == "user_1"
        assert ctx.sandbox_id is None
        assert ctx.runtime is None
        assert ctx.neko_url is None
        assert ctx.stream_url is None
        assert ctx.tools == []
        assert ctx.connected_apps == []

    def test_session_not_expired_when_fresh(self):
        """A freshly created session should not be expired."""
        ctx = SessionContext(session_id="sess_1", user_id="user_1")
        assert ctx.is_expired is False

    def test_session_expired_after_ttl(self):
        """A session created more than SESSION_CACHE_TTL ago should be expired."""
        ctx = SessionContext(
            session_id="sess_1",
            user_id="user_1",
            created_at=time.monotonic() - SESSION_CACHE_TTL - 1,
        )
        assert ctx.is_expired is True

    def test_session_not_expired_just_before_ttl(self):
        """A session created just under the TTL should not be expired."""
        ctx = SessionContext(
            session_id="sess_1",
            user_id="user_1",
            created_at=time.monotonic() - SESSION_CACHE_TTL + 60,
        )
        assert ctx.is_expired is False

    def test_session_stores_tools(self):
        """SessionContext can store tool definitions."""
        tools = [{"name": "web_search", "description": "Search"}]
        ctx = SessionContext(session_id="s", user_id="u", tools=tools)
        assert len(ctx.tools) == 1
        assert ctx.tools[0]["name"] == "web_search"

    def test_session_stores_connected_apps(self):
        """SessionContext can store connected app names."""
        ctx = SessionContext(
            session_id="s", user_id="u", connected_apps=["gmail", "slack"]
        )
        assert "gmail" in ctx.connected_apps
        assert "slack" in ctx.connected_apps


# ============================================================
# Session cache
# ============================================================


class TestSessionCache:
    """Tests for the in-memory session cache functions."""

    def setup_method(self):
        """Clear session cache before each test."""
        _session_cache.clear()

    def test_cache_miss_returns_none(self):
        """get_cached_session returns None for unknown session_id."""
        assert get_cached_session("nonexistent") is None

    def test_cache_hit_returns_context(self):
        """get_cached_session returns the cached context."""
        ctx = SessionContext(session_id="sess_1", user_id="user_1")
        cache_session(ctx)
        result = get_cached_session("sess_1")
        assert result is not None
        assert result.session_id == "sess_1"
        assert result.user_id == "user_1"

    def test_cache_expired_session_returns_none(self):
        """get_cached_session returns None for expired sessions and removes them."""
        ctx = SessionContext(
            session_id="old_sess",
            user_id="user_1",
            created_at=time.monotonic() - SESSION_CACHE_TTL - 100,
        )
        _session_cache["old_sess"] = ctx

        result = get_cached_session("old_sess")
        assert result is None
        assert "old_sess" not in _session_cache

    def test_cache_session_stores_entry(self):
        """cache_session adds the context to the cache dict."""
        ctx = SessionContext(session_id="sess_new", user_id="user_1")
        cache_session(ctx)
        assert "sess_new" in _session_cache

    def test_cache_eviction_on_overflow(self):
        """When cache exceeds 1000 entries, expired ones are evicted."""
        # Fill cache with 1001 entries, all expired
        for i in range(1001):
            _session_cache[f"sess_{i}"] = SessionContext(
                session_id=f"sess_{i}",
                user_id="user_1",
                created_at=time.monotonic() - SESSION_CACHE_TTL - 100,
            )

        # Adding one more triggers eviction
        new_ctx = SessionContext(session_id="sess_new", user_id="user_1")
        cache_session(new_ctx)

        # All expired sessions should be evicted; only the new one remains
        assert "sess_new" in _session_cache
        assert len(_session_cache) == 1

    def test_evict_expired_sessions(self):
        """_evict_expired_sessions removes only expired entries."""
        fresh = SessionContext(session_id="fresh", user_id="u")
        old = SessionContext(
            session_id="old",
            user_id="u",
            created_at=time.monotonic() - SESSION_CACHE_TTL - 1,
        )
        _session_cache["fresh"] = fresh
        _session_cache["old"] = old

        _evict_expired_sessions()

        assert "fresh" in _session_cache
        assert "old" not in _session_cache


# ============================================================
# get_or_create_session
# ============================================================


class TestGetOrCreateSession:
    """Tests for get_or_create_session DB operations."""

    @pytest.mark.asyncio
    async def test_returns_existing_session(self, patch_db):
        """When session exists in DB, returns its id."""
        patch_db["fetchrow"].return_value = {"id": "sess_existing"}
        result = await get_or_create_session("sess_existing", "user_1")
        assert result == "sess_existing"

    @pytest.mark.asyncio
    async def test_creates_new_session(self, patch_db):
        """When session does not exist, creates one and returns the id."""
        patch_db["fetchrow"].return_value = None
        result = await get_or_create_session("sess_new", "user_1")
        assert result == "sess_new"
        patch_db["execute"].assert_called_once()

    @pytest.mark.asyncio
    async def test_handles_db_error_gracefully(self, patch_db):
        """On DB error, returns the session_id anyway (graceful degradation)."""
        patch_db["fetchrow"].side_effect = Exception("DB connection failed")
        result = await get_or_create_session("sess_fallback", "user_1")
        assert result == "sess_fallback"


# ============================================================
# load_conversation_history
# ============================================================


class TestLoadConversationHistory:
    """Tests for loading conversation history from the messages table."""

    @pytest.mark.asyncio
    async def test_empty_history(self, patch_db):
        """Returns empty list when no messages exist."""
        patch_db["fetch"].return_value = []
        history = await load_conversation_history("sess_1")
        assert history == []

    @pytest.mark.asyncio
    async def test_user_messages_loaded(self, patch_db):
        """User messages are loaded in correct format."""
        patch_db["fetch"].return_value = [
            {"role": "user", "content": "Hello", "metadata": None, "parts": None},
        ]
        history = await load_conversation_history("sess_1")
        assert len(history) == 1
        assert history[0]["role"] == "user"
        assert history[0]["content"] == "Hello"

    @pytest.mark.asyncio
    async def test_assistant_messages_with_parts(self, patch_db):
        """Assistant messages with parts column extract text correctly."""
        parts = json.dumps([
            {"type": "text", "text": "Part 1 "},
            {"type": "text", "text": "Part 2"},
            {"type": "tool-web_search", "toolCallId": "tc_1"},
        ])
        patch_db["fetch"].return_value = [
            {"role": "assistant", "content": "fallback", "metadata": None, "parts": parts},
        ]
        history = await load_conversation_history("sess_1")
        assert len(history) == 1
        assert history[0]["role"] == "assistant"
        assert history[0]["content"] == "Part 1 Part 2"

    @pytest.mark.asyncio
    async def test_assistant_messages_without_parts(self, patch_db):
        """Assistant messages without parts fall back to content column."""
        patch_db["fetch"].return_value = [
            {"role": "assistant", "content": "Just text", "metadata": None, "parts": None},
        ]
        history = await load_conversation_history("sess_1")
        assert len(history) == 1
        assert history[0]["content"] == "Just text"

    @pytest.mark.asyncio
    async def test_tool_role_converted_to_user_tool_result(self, patch_db):
        """Legacy tool-role rows are converted to user messages with tool_result."""
        metadata = json.dumps({"toolCallId": "tc_001", "isError": False})
        patch_db["fetch"].return_value = [
            {"role": "tool", "content": "search results", "metadata": metadata, "parts": None},
        ]
        history = await load_conversation_history("sess_1")
        assert len(history) == 1
        assert history[0]["role"] == "user"
        assert isinstance(history[0]["content"], list)
        assert history[0]["content"][0]["type"] == "tool_result"
        assert history[0]["content"][0]["tool_use_id"] == "tc_001"

    @pytest.mark.asyncio
    async def test_consecutive_user_messages_merged(self, patch_db):
        """Consecutive user messages are merged (Anthropic API requirement)."""
        patch_db["fetch"].return_value = [
            {"role": "user", "content": "First", "metadata": None, "parts": None},
            {"role": "user", "content": "Second", "metadata": None, "parts": None},
        ]
        history = await load_conversation_history("sess_1")
        assert len(history) == 1
        assert history[0]["role"] == "user"
        # Merged into list of blocks
        assert isinstance(history[0]["content"], list)
        assert len(history[0]["content"]) == 2

    @pytest.mark.asyncio
    async def test_db_error_returns_empty_list(self, patch_db):
        """On DB error, returns empty list gracefully."""
        patch_db["fetch"].side_effect = Exception("Query failed")
        history = await load_conversation_history("sess_1")
        assert history == []

    @pytest.mark.asyncio
    async def test_json_string_metadata_parsed(self, patch_db):
        """JSON string metadata is parsed correctly."""
        metadata = '{"toolCallId": "tc_json", "isError": true}'
        patch_db["fetch"].return_value = [
            {"role": "tool", "content": "error result", "metadata": metadata, "parts": None},
        ]
        history = await load_conversation_history("sess_1")
        assert history[0]["content"][0]["is_error"] is True

    @pytest.mark.asyncio
    async def test_alternating_roles_not_merged(self, patch_db):
        """Properly alternating user/assistant messages are not merged."""
        patch_db["fetch"].return_value = [
            {"role": "user", "content": "Question", "metadata": None, "parts": None},
            {"role": "assistant", "content": "Answer", "metadata": None, "parts": None},
            {"role": "user", "content": "Follow-up", "metadata": None, "parts": None},
        ]
        history = await load_conversation_history("sess_1")
        assert len(history) == 3
        assert history[0]["role"] == "user"
        assert history[1]["role"] == "assistant"
        assert history[2]["role"] == "user"


# ============================================================
# _merge_consecutive_tool_results
# ============================================================


class TestMergeConsecutiveToolResults:
    """Tests for _merge_consecutive_tool_results helper."""

    def test_empty_messages(self):
        """Empty list returns empty list."""
        assert _merge_consecutive_tool_results([]) == []

    def test_single_message(self):
        """Single message returns unchanged."""
        msgs = [{"role": "user", "content": "hello"}]
        result = _merge_consecutive_tool_results(msgs)
        assert len(result) == 1
        assert result[0]["content"] == "hello"

    def test_no_consecutive_same_role(self):
        """Alternating roles pass through unchanged."""
        msgs = [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hello"},
            {"role": "user", "content": "thanks"},
        ]
        result = _merge_consecutive_tool_results(msgs)
        assert len(result) == 3

    def test_consecutive_user_strings_merged(self):
        """Two consecutive user messages with string content are merged."""
        msgs = [
            {"role": "user", "content": "first"},
            {"role": "user", "content": "second"},
        ]
        result = _merge_consecutive_tool_results(msgs)
        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert isinstance(result[0]["content"], list)
        assert len(result[0]["content"]) == 2
        assert result[0]["content"][0] == {"type": "text", "text": "first"}
        assert result[0]["content"][1] == {"type": "text", "text": "second"}

    def test_consecutive_user_with_tool_results_merged(self):
        """Tool result user messages followed by text user messages are merged."""
        msgs = [
            {
                "role": "user",
                "content": [
                    {"type": "tool_result", "tool_use_id": "tc_1", "content": "result1"},
                ],
            },
            {"role": "user", "content": "follow-up question"},
        ]
        result = _merge_consecutive_tool_results(msgs)
        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert isinstance(result[0]["content"], list)
        assert len(result[0]["content"]) == 2

    def test_three_consecutive_user_messages_merged(self):
        """Three consecutive user messages all merge into one."""
        msgs = [
            {"role": "user", "content": "one"},
            {"role": "user", "content": "two"},
            {"role": "user", "content": "three"},
        ]
        result = _merge_consecutive_tool_results(msgs)
        assert len(result) == 1
        assert len(result[0]["content"]) == 3

    def test_assistant_messages_not_merged(self):
        """Consecutive assistant messages remain separate."""
        msgs = [
            {"role": "assistant", "content": "first"},
            {"role": "user", "content": "gap"},
            {"role": "assistant", "content": "second"},
        ]
        result = _merge_consecutive_tool_results(msgs)
        assert len(result) == 3


# ============================================================
# Message persistence
# ============================================================


class TestSaveUserMessage:
    """Tests for save_user_message."""

    @pytest.mark.asyncio
    async def test_saves_user_message(self, patch_db):
        """save_user_message inserts a row and returns the message id."""
        result = await save_user_message("sess_1", "Hello world")
        assert result == "test_id_123"
        patch_db["execute"].assert_called_once()
        call_args = patch_db["execute"].call_args
        assert "INSERT INTO messages" in call_args[0][0]
        assert call_args[0][2] == "sess_1"
        assert call_args[0][3] == "Hello world"

    @pytest.mark.asyncio
    async def test_handles_db_error(self, patch_db):
        """save_user_message returns None on DB error."""
        patch_db["execute"].side_effect = Exception("DB write failed")
        result = await save_user_message("sess_1", "Hello")
        assert result is None


class TestSaveAssistantMessage:
    """Tests for save_assistant_message."""

    @pytest.mark.asyncio
    async def test_saves_with_metadata(self, patch_db):
        """save_assistant_message stores model and usage in metadata."""
        usage = {"input_tokens": 100, "output_tokens": 50}
        result = await save_assistant_message(
            "sess_1", "Response text", model="claude-sonnet-4-5-20250929", usage=usage
        )
        assert result == "test_id_123"
        call_args = patch_db["execute"].call_args
        metadata_json = call_args[0][4]
        metadata = json.loads(metadata_json)
        assert metadata["model"] == "claude-sonnet-4-5-20250929"
        assert metadata["tokens"]["input"] == 100
        assert metadata["tokens"]["output"] == 50

    @pytest.mark.asyncio
    async def test_saves_with_tool_blocks(self, patch_db):
        """save_assistant_message includes tool blocks in metadata."""
        tool_blocks = [{"type": "tool_use", "id": "tc_1", "name": "web_search"}]
        await save_assistant_message("sess_1", "text", tool_blocks=tool_blocks)
        call_args = patch_db["execute"].call_args
        metadata = json.loads(call_args[0][4])
        assert "toolBlocks" in metadata
        assert len(metadata["toolBlocks"]) == 1

    @pytest.mark.asyncio
    async def test_saves_without_optional_fields(self, patch_db):
        """save_assistant_message works with minimal arguments."""
        result = await save_assistant_message("sess_1", "Just text")
        assert result == "test_id_123"

    @pytest.mark.asyncio
    async def test_handles_db_error(self, patch_db):
        """save_assistant_message returns None on DB error."""
        patch_db["execute"].side_effect = Exception("DB error")
        result = await save_assistant_message("sess_1", "text")
        assert result is None


class TestSaveToolMessages:
    """Tests for save_tool_messages."""

    @pytest.mark.asyncio
    async def test_saves_multiple_tool_results(self, patch_db):
        """save_tool_messages saves one message per tool call."""
        tool_calls = [
            {"name": "web_search", "result": {"data": "results"}, "tool_use_id": "tc_1", "is_error": False},
            {"name": "file_read", "result": {"content": "file data"}, "tool_use_id": "tc_2", "is_error": False},
        ]
        await save_tool_messages("sess_1", tool_calls)
        assert patch_db["execute"].call_count == 2

    @pytest.mark.asyncio
    async def test_saves_string_result(self, patch_db):
        """save_tool_messages handles string results (not dict)."""
        tool_calls = [
            {"name": "code_execute", "result": "hello world", "tool_use_id": "tc_3", "is_error": False},
        ]
        await save_tool_messages("sess_1", tool_calls)
        call_args = patch_db["execute"].call_args
        assert call_args[0][3] == "hello world"

    @pytest.mark.asyncio
    async def test_error_flag_in_metadata(self, patch_db):
        """save_tool_messages sets isError flag in metadata."""
        tool_calls = [
            {"name": "shell_exec", "result": "Error: command not found", "tool_use_id": "tc_4", "is_error": True},
        ]
        await save_tool_messages("sess_1", tool_calls)
        call_args = patch_db["execute"].call_args
        metadata = json.loads(call_args[0][4])
        assert metadata["isError"] is True

    @pytest.mark.asyncio
    async def test_db_error_does_not_raise(self, patch_db):
        """save_tool_messages handles DB errors gracefully (does not raise)."""
        patch_db["execute"].side_effect = Exception("DB error")
        tool_calls = [
            {"name": "web_search", "result": {}, "tool_use_id": "tc_5", "is_error": False},
        ]
        # Should not raise
        await save_tool_messages("sess_1", tool_calls)


# ============================================================
# Session title and message count
# ============================================================


class TestUpdateSessionTitle:
    """Tests for update_session_title."""

    @pytest.mark.asyncio
    async def test_updates_title(self, patch_db):
        """update_session_title executes an UPDATE query."""
        await update_session_title("sess_1", "My Chat Title")
        patch_db["execute"].assert_called_once()
        call_args = patch_db["execute"].call_args
        assert "UPDATE agent_sessions" in call_args[0][0]
        assert call_args[0][1] == "My Chat Title"

    @pytest.mark.asyncio
    async def test_truncates_long_title(self, patch_db):
        """update_session_title truncates titles longer than 200 chars."""
        long_title = "x" * 300
        await update_session_title("sess_1", long_title)
        call_args = patch_db["execute"].call_args
        assert len(call_args[0][1]) == 200

    @pytest.mark.asyncio
    async def test_handles_db_error(self, patch_db):
        """update_session_title does not raise on DB error."""
        patch_db["execute"].side_effect = Exception("DB error")
        await update_session_title("sess_1", "Title")  # Should not raise


class TestGetSessionMessageCount:
    """Tests for get_session_message_count."""

    @pytest.mark.asyncio
    async def test_returns_count(self, patch_db):
        """get_session_message_count returns the count from DB."""
        patch_db["fetchval"].return_value = 42
        count = await get_session_message_count("sess_1")
        assert count == 42

    @pytest.mark.asyncio
    async def test_returns_zero_on_none(self, patch_db):
        """get_session_message_count returns 0 when DB returns None."""
        patch_db["fetchval"].return_value = None
        count = await get_session_message_count("sess_1")
        assert count == 0

    @pytest.mark.asyncio
    async def test_returns_zero_on_error(self, patch_db):
        """get_session_message_count returns 0 on DB error."""
        patch_db["fetchval"].side_effect = Exception("DB error")
        count = await get_session_message_count("sess_1")
        assert count == 0
