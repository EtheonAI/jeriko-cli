"""
Tests for src/routes/completion.py and src/routes/health.py — the main
API endpoints of the agent service.

Uses httpx.AsyncClient with FastAPI's TestClient pattern (via ASGITransport)
for integration-level endpoint tests.

Covers:
- Health check endpoint returns 200
- Readiness check returns 200
- Missing x-user-id header on /v1/complete returns 422
- Empty request body returns 400
- Model resolution logic (aliases, defaults)
- should_plan trigger detection
- check_missing_integrations detection
- build_system_prompt structure
- filter_sandbox_tools removes sandbox-dependent tools
- filter_tools_by_skills selects correct tools
- _safe_truncate utility
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from src.routes.completion import (
    ALWAYS_INCLUDED_TOOLS,
    DEFAULT_MODEL,
    MODEL_MAP,
    PLANNING_TRIGGERS,
    SANDBOX_DEPENDENT_TOOLS,
    SKILL_TOOL_MAP,
    _safe_truncate,
    build_system_prompt,
    check_missing_integrations,
    filter_sandbox_tools,
    filter_tools_by_skills,
    resolve_model,
    should_plan,
)


# ============================================================
# Health endpoints (integration tests via TestClient)
# ============================================================


class TestHealthEndpoints:
    """Tests for /health and /ready endpoints."""

    @pytest.mark.asyncio
    async def test_health_check(self):
        """GET /health returns 200 with status ok."""
        from src.main import app

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "agent"

    @pytest.mark.asyncio
    async def test_readiness_check(self):
        """GET /ready returns 200 with status ready."""
        from src.main import app

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"


# ============================================================
# Completion endpoint validation
# ============================================================


class TestCompletionEndpoint:
    """Tests for POST /v1/complete request validation."""

    @pytest.mark.asyncio
    async def test_missing_user_id_returns_422(self):
        """Missing x-user-id header returns 422 (FastAPI validation error)."""
        from src.main import app

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/complete",
                json={"prompt": "hello"},
                # No x-user-id header
            )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_empty_request_returns_400(self):
        """Request with neither prompt nor messages returns 400."""
        from src.main import app

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/complete",
                json={},
                headers={"x-user-id": "test_user"},
            )
        # FastAPI returns 400 from the HTTPException in the route
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_valid_streaming_request_returns_sse_content_type(self):
        """Valid streaming request returns text/event-stream content type."""
        from src.main import app

        with (
            patch("src.routes.completion.setup_session_context", new_callable=AsyncMock) as mock_setup,
            patch("src.routes.completion.load_conversation_history", new_callable=AsyncMock, return_value=[]),
            patch("src.routes.completion.get_anthropic_client") as mock_get_client,
        ):
            # Mock session context
            mock_ctx = MagicMock()
            mock_ctx.tools = [{"name": "web_search"}]
            mock_ctx.connected_apps = []
            mock_ctx.runtime = None
            mock_ctx.sandbox_id = None
            mock_ctx.neko_url = None
            mock_ctx.stream_url = None
            mock_setup.return_value = mock_ctx

            # Mock the Anthropic client to avoid actual API calls
            mock_client = MagicMock()
            mock_get_client.return_value = mock_client

            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/v1/complete",
                    json={"prompt": "hello", "stream": True},
                    headers={"x-user-id": "test_user"},
                )

            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")


# ============================================================
# Model resolution
# ============================================================


class TestResolveModel:
    """Tests for the resolve_model function."""

    def test_none_returns_default(self):
        """None model name returns DEFAULT_MODEL."""
        assert resolve_model(None) == DEFAULT_MODEL

    def test_empty_string_returns_default(self):
        """Empty string returns DEFAULT_MODEL."""
        assert resolve_model("") == DEFAULT_MODEL

    def test_alias_resolved(self):
        """Known alias is resolved to full model ID."""
        assert resolve_model("fast") == "claude-haiku-4-5-20251001"
        assert resolve_model("balanced") == "claude-sonnet-4-5-20250929"
        assert resolve_model("powerful") == "claude-opus-4-5-20251101"

    def test_full_model_id_passthrough(self):
        """Full model IDs pass through unchanged."""
        assert resolve_model("claude-sonnet-4-5-20250929") == "claude-sonnet-4-5-20250929"

    def test_unknown_model_passthrough(self):
        """Unknown model names pass through (for OpenAI, etc.)."""
        assert resolve_model("gpt-4o") == "gpt-4o"

    def test_all_model_map_values_are_claude(self):
        """All MODEL_MAP values should be Claude model IDs."""
        for alias, model_id in MODEL_MAP.items():
            assert model_id.startswith("claude-"), f"MODEL_MAP['{alias}'] = '{model_id}' is not Claude"


# ============================================================
# Planning triggers
# ============================================================


class TestShouldPlan:
    """Tests for the should_plan function."""

    def test_build_triggers_plan(self):
        """Prompts containing 'build' trigger planning."""
        assert should_plan("Build a website for me") is True

    def test_create_triggers_plan(self):
        """Prompts containing 'create' trigger planning."""
        assert should_plan("Create a Python script") is True

    def test_simple_question_no_plan(self):
        """Simple questions do not trigger planning."""
        assert should_plan("What is Python?") is False

    def test_hello_no_plan(self):
        """Greetings do not trigger planning."""
        assert should_plan("Hello!") is False

    def test_case_insensitive(self):
        """Trigger detection is case-insensitive."""
        assert should_plan("DEPLOY this app") is True
        assert should_plan("Analyze the data") is True

    def test_all_triggers_recognized(self):
        """Each trigger in PLANNING_TRIGGERS is actually checked."""
        for trigger in PLANNING_TRIGGERS:
            prompt = f"Please {trigger} something for me"
            assert should_plan(prompt) is True, f"Trigger '{trigger}' was not recognized"


# ============================================================
# Missing integrations detection
# ============================================================


class TestCheckMissingIntegrations:
    """Tests for check_missing_integrations."""

    def test_no_missing_returns_none(self):
        """When all mentioned apps are connected, returns None."""
        result = check_missing_integrations(
            "Send an email via Gmail",
            connected_apps=["gmail"],
        )
        assert result is None

    def test_missing_app_detected(self):
        """Detects when a mentioned app is not connected."""
        result = check_missing_integrations(
            "Post this to Twitter",
            connected_apps=[],
        )
        assert result is not None
        assert "twitter" in result.lower()

    def test_multiple_missing_apps(self):
        """Detects multiple missing apps."""
        result = check_missing_integrations(
            "Post to Instagram and send a Slack message",
            connected_apps=[],
        )
        assert result is not None
        assert "instagram" in result.lower()
        assert "slack" in result.lower()

    def test_no_apps_mentioned(self):
        """When no apps are mentioned in the prompt, returns None."""
        result = check_missing_integrations(
            "What is the weather today?",
            connected_apps=[],
        )
        assert result is None

    def test_partial_connection(self):
        """Only the unconnected apps are flagged."""
        result = check_missing_integrations(
            "Post to Instagram and send an email",
            connected_apps=["gmail"],
        )
        assert result is not None
        assert "instagram" in result.lower()
        # gmail is connected, should not be mentioned as missing
        # (note: the suggestion mentions what IS missing, not what's connected)


# ============================================================
# System prompt builder
# ============================================================


class TestBuildSystemPrompt:
    """Tests for build_system_prompt."""

    def test_basic_prompt_structure(self):
        """System prompt contains key sections."""
        prompt = build_system_prompt()
        assert "Rubic" in prompt
        assert "<intro>" in prompt
        assert "<agent_loop>" in prompt
        assert "<planning_rules>" in prompt
        assert "<browser_rules>" in prompt
        assert "<shell_rules>" in prompt
        assert "<error_handling>" in prompt

    def test_user_name_included(self):
        """User name appears in the prompt."""
        prompt = build_system_prompt(user_name="Alice")
        assert "Alice" in prompt

    def test_connected_apps_included(self):
        """Connected apps list appears in the prompt."""
        prompt = build_system_prompt(connected_apps="gmail, github, slack")
        assert "gmail" in prompt
        assert "github" in prompt

    def test_no_connected_apps_message(self):
        """When no apps connected, prompt suggests connecting."""
        prompt = build_system_prompt(connected_apps="")
        assert "None connected" in prompt

    def test_sandbox_unavailable_section(self):
        """When sandbox is unavailable, special section is added."""
        prompt = build_system_prompt(sandbox_available=False)
        assert "<sandbox_unavailable>" in prompt
        assert "CANNOT use file" in prompt

    def test_sandbox_available_no_warning(self):
        """When sandbox is available, unavailable section is NOT present."""
        prompt = build_system_prompt(sandbox_available=True)
        assert "<sandbox_unavailable>" not in prompt


# ============================================================
# Tool filtering
# ============================================================


class TestFilterSandboxTools:
    """Tests for filter_sandbox_tools."""

    def test_removes_sandbox_dependent_tools(self):
        """Sandbox-dependent tools are removed when sandbox unavailable."""
        tools = [
            {"name": "web_search"},
            {"name": "file_read"},
            {"name": "shell_exec"},
            {"name": "show_plan"},
            {"name": "browser_click"},
        ]
        filtered = filter_sandbox_tools(tools)
        names = {t["name"] for t in filtered}
        assert "web_search" in names
        assert "show_plan" in names
        assert "file_read" not in names
        assert "shell_exec" not in names
        assert "browser_click" not in names

    def test_non_sandbox_tools_preserved(self):
        """Non-sandbox tools are all preserved."""
        tools = [
            {"name": "web_search"},
            {"name": "show_plan"},
            {"name": "message_notify_user"},
            {"name": "message_ask_user"},
            {"name": "check_outcomes"},
        ]
        filtered = filter_sandbox_tools(tools)
        assert len(filtered) == len(tools)

    def test_empty_tools(self):
        """Empty tool list returns empty list."""
        assert filter_sandbox_tools([]) == []


class TestFilterToolsBySkills:
    """Tests for filter_tools_by_skills."""

    def test_always_included_tools_present(self):
        """Always-included tools are present regardless of skill selection."""
        tools = [
            {"name": "show_plan"},
            {"name": "message_notify_user"},
            {"name": "web_search"},
            {"name": "file_read"},
        ]
        filtered = filter_tools_by_skills(tools, ["web-search"])
        names = {t["name"] for t in filtered}
        assert "show_plan" in names
        assert "message_notify_user" in names
        assert "web_search" in names
        assert "file_read" not in names

    def test_skill_maps_to_correct_tools(self):
        """web-search skill includes web_search tool."""
        tools = [{"name": "web_search"}, {"name": "file_read"}, {"name": "show_plan"}]
        filtered = filter_tools_by_skills(tools, ["web-search"])
        names = {t["name"] for t in filtered}
        assert "web_search" in names
        assert "file_read" not in names

    def test_multiple_skills(self):
        """Multiple skills combine their tool sets."""
        tools = [
            {"name": "web_search"},
            {"name": "code_execute"},
            {"name": "file_read"},
            {"name": "generate_image"},
            {"name": "show_plan"},
        ]
        filtered = filter_tools_by_skills(tools, ["web-search", "image-generation"])
        names = {t["name"] for t in filtered}
        assert "web_search" in names
        assert "generate_image" in names
        assert "show_plan" in names
        # code_execute is only in code-interpreter skill, not selected
        assert "code_execute" not in names

    def test_unknown_skill_no_extra_tools(self):
        """Unknown skill IDs don't add any tools."""
        tools = [{"name": "web_search"}, {"name": "show_plan"}]
        filtered = filter_tools_by_skills(tools, ["nonexistent-skill"])
        names = {t["name"] for t in filtered}
        assert "show_plan" in names
        assert "web_search" not in names

    def test_all_skill_keys_map_to_tools(self):
        """Every key in SKILL_TOOL_MAP maps to a non-empty set."""
        for skill, tool_set in SKILL_TOOL_MAP.items():
            assert len(tool_set) > 0, f"Skill '{skill}' has empty tool set"


# ============================================================
# _safe_truncate utility
# ============================================================


class TestSafeTruncate:
    """Tests for the _safe_truncate helper."""

    def test_short_string_unchanged(self):
        """Short strings are not truncated."""
        assert _safe_truncate("hello", max_len=500) == "hello"

    def test_long_string_truncated(self):
        """Long strings are truncated with ellipsis."""
        long_str = "x" * 1000
        result = _safe_truncate(long_str, max_len=100)
        assert len(result) == 103  # 100 + "..."
        assert result.endswith("...")

    def test_dict_with_long_value_truncated(self):
        """Dict values that are long strings are truncated."""
        data = {"key": "x" * 1000, "short": "ok"}
        result = _safe_truncate(data, max_len=100)
        assert result["short"] == "ok"
        assert len(result["key"]) == 103
        assert result["key"].endswith("...")

    def test_dict_with_short_values_unchanged(self):
        """Dict values that are short are not modified."""
        data = {"a": "hello", "b": 42}
        result = _safe_truncate(data, max_len=500)
        assert result == data

    def test_non_string_passthrough(self):
        """Non-string, non-dict values pass through."""
        assert _safe_truncate(42) == 42
        assert _safe_truncate([1, 2, 3]) == [1, 2, 3]
        assert _safe_truncate(None) is None

    def test_default_max_len(self):
        """Default max_len is 500."""
        short = "x" * 499
        result = _safe_truncate(short)
        assert result == short

        long = "x" * 501
        result = _safe_truncate(long)
        assert result.endswith("...")


# ============================================================
# Error handling format
# ============================================================


class TestErrorFormat:
    """Tests for error response formatting from the main app."""

    @pytest.mark.asyncio
    async def test_global_exception_handler_format(self):
        """Global exception handler returns consistent error format."""
        from src.main import app

        # Add a route that always raises (for testing)
        from fastapi import APIRouter
        test_router = APIRouter()

        @test_router.get("/test-error")
        async def raise_error():
            raise ValueError("test error")

        app.include_router(test_router)

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test-error")

        assert response.status_code == 500
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "INTERNAL_ERROR"
        assert "meta" in data
