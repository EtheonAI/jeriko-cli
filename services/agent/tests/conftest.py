"""
Shared fixtures for agent service tests.

Provides mock objects for database, LLM responses, sandbox runtime,
HTTP clients, and session contexts to isolate unit tests from
external dependencies.
"""

import os
import time
from dataclasses import dataclass, field
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ============================================================
# Database fixtures
# ============================================================


@pytest.fixture
def mock_db_pool():
    """Mock asyncpg connection pool."""
    pool = AsyncMock()
    pool.fetch = AsyncMock(return_value=[])
    pool.fetchrow = AsyncMock(return_value=None)
    pool.fetchval = AsyncMock(return_value=None)
    pool.execute = AsyncMock(return_value="INSERT 0 1")
    pool.close = AsyncMock()
    return pool


@pytest.fixture
def patch_db(mock_db_pool):
    """Patch the db module's pool and helper functions to use mock_db_pool."""
    with (
        patch("src.db._pool", mock_db_pool),
        patch("src.db.get_pool", return_value=mock_db_pool),
        patch("src.session.fetch", new_callable=AsyncMock) as mock_fetch,
        patch("src.session.fetchrow", new_callable=AsyncMock) as mock_fetchrow,
        patch("src.session.fetchval", new_callable=AsyncMock) as mock_fetchval,
        patch("src.session.execute", new_callable=AsyncMock) as mock_execute,
        patch("src.session.generate_id", return_value="test_id_123") as mock_gen_id,
    ):
        yield {
            "pool": mock_db_pool,
            "fetch": mock_fetch,
            "fetchrow": mock_fetchrow,
            "fetchval": mock_fetchval,
            "execute": mock_execute,
            "generate_id": mock_gen_id,
        }


# ============================================================
# LLM response fixtures
# ============================================================


@pytest.fixture
def mock_llm_response():
    """Standard Anthropic-format LLM response."""
    return {
        "id": "msg_test_001",
        "content": [{"type": "text", "text": "Hello, I can help with that."}],
        "model": "claude-sonnet-4-5-20250929",
        "stop_reason": "end_turn",
        "usage": {"input_tokens": 10, "output_tokens": 5},
    }


@pytest.fixture
def mock_llm_tool_response():
    """LLM response that includes a tool_use block."""
    return {
        "id": "msg_test_002",
        "content": [
            {"type": "text", "text": "Let me search for that."},
            {
                "type": "tool_use",
                "id": "toolu_test_001",
                "name": "web_search",
                "input": {"query": "latest news"},
            },
        ],
        "model": "claude-sonnet-4-5-20250929",
        "stop_reason": "tool_use",
        "usage": {"input_tokens": 20, "output_tokens": 15},
    }


# ============================================================
# Runtime / sandbox fixtures
# ============================================================


def _smart_command_result(command, **kwargs):
    """Create a command result based on the actual command."""
    result = MagicMock()
    result.stderr = ""
    result.exit_code = 0

    # Extract actual command string
    cmd_str = command if isinstance(command, str) else str(command)

    # Command-specific outputs
    if "echo 'hello'" in cmd_str or 'echo "hello"' in cmd_str:
        result.stdout = "hello\n"
    elif "echo 'first'" in cmd_str:
        result.stdout = "first\n"
    elif "echo 'second'" in cmd_str:
        result.stdout = "second\n"
    elif "echo 'session1'" in cmd_str:
        result.stdout = "session1\n"
    elif "echo 'session2'" in cmd_str:
        result.stdout = "session2\n"
    elif "echo 'Hello Rubic'" in cmd_str:
        result.stdout = "Hello Rubic\n"
    elif "pwd" in cmd_str:
        cwd = kwargs.get("cwd", "/home/user")
        result.stdout = f"{cwd}\n"
    elif "TEST_VAR='hello'" in cmd_str and "echo $TEST_VAR" in cmd_str:
        result.stdout = "hello\n"  # Inline var assignment works
    elif "echo $TEST_VAR" in cmd_str or "echo $VAR" in cmd_str:
        result.stdout = "\n"  # Empty (env vars don't persist in mock)
    elif "for i in" in cmd_str:
        result.stdout = "Line 1\nLine 2\nLine 3\n"
    elif "sleep" in cmd_str and "WAIT_COMPLETE" in cmd_str:
        result.stdout = "WAIT_COMPLETE\n"
    elif "ps aux" in cmd_str or "pgrep" in cmd_str:
        result.stdout = "not found\n"
    elif "command_that_does_not_exist" in cmd_str:
        result.exit_code = 127
        result.stderr = "command not found\n"
    elif "cat /etc/shadow" in cmd_str:
        result.exit_code = 1
        result.stderr = "Permission denied\n"
    elif "pkill" in cmd_str or "kill" in cmd_str:
        result.stdout = "Process terminated\n"
    elif "true" in cmd_str:  # shell_view runs "true"
        result.stdout = ""
    else:
        result.stdout = "command output\n"

    return result


@pytest.fixture
def mock_command_result():
    """Mock CommandResult from SandboxRuntime."""
    result = MagicMock()
    result.stdout = "command output"
    result.stderr = ""
    result.exit_code = 0
    return result


@pytest.fixture
def mock_code_result():
    """Mock CodeResult from SandboxRuntime."""
    result = MagicMock()
    result.stdout = "code output"
    result.stderr = ""
    result.exit_code = 0
    result.results = []
    result.error = None
    return result


@pytest.fixture
def mock_runtime(mock_code_result):
    """Mock SandboxRuntime for tool execution tests."""
    runtime = AsyncMock()
    runtime.is_desktop = False
    runtime.has_code_interpreter = True

    # File operations
    runtime.file_read = AsyncMock(return_value="file content here")
    runtime.file_write = AsyncMock()

    # Command execution - use smart command result
    async def smart_command_run(command, **kwargs):
        return _smart_command_result(command, **kwargs)

    runtime.command_run = AsyncMock(side_effect=smart_command_run)

    # Code execution
    runtime.code_run = AsyncMock(return_value=mock_code_result)

    # Desktop operations
    runtime.desktop_screenshot = AsyncMock(return_value=b"fake_png_bytes")
    runtime.desktop_open = AsyncMock()
    runtime.desktop_left_click = AsyncMock()
    runtime.desktop_write = AsyncMock()
    runtime.desktop_press = AsyncMock()
    runtime.desktop_move_mouse = AsyncMock()
    runtime.desktop_scroll = AsyncMock()

    # Port exposure
    runtime.get_host = MagicMock(return_value="sbx-123.e2b.dev")

    return runtime


# ============================================================
# HTTP client fixtures
# ============================================================


@pytest.fixture
def mock_http_client():
    """Mock httpx.AsyncClient for service-to-service calls."""
    client = AsyncMock()

    # Default successful response
    response = MagicMock()
    response.status_code = 200
    response.json = MagicMock(return_value={"success": True})
    response.text = '{"success": true}'
    response.headers = {"content-type": "application/json"}

    client.post = AsyncMock(return_value=response)
    client.get = AsyncMock(return_value=response)
    client.aclose = AsyncMock()

    return client


# ============================================================
# Session context fixtures
# ============================================================


@pytest.fixture
def sample_session_context():
    """Pre-built SessionContext for testing."""
    from src.session import SessionContext

    return SessionContext(
        session_id="sess_test_001",
        user_id="user_test_001",
        sandbox_id="sbx_test_001",
        runtime=None,
        neko_url=None,
        stream_url=None,
        tools=[
            {
                "name": "web_search",
                "description": "Search the web",
                "input_schema": {
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                    "required": ["query"],
                },
            },
            {
                "name": "show_plan",
                "description": "Show a plan",
                "input_schema": {
                    "type": "object",
                    "properties": {"title": {"type": "string"}},
                },
            },
        ],
        connected_apps=["gmail", "github"],
        created_at=time.monotonic(),
    )


@pytest.fixture
def execution_context(mock_runtime):
    """Pre-built ExecutionContext for tool executor tests."""
    from src.tool_executor import ExecutionContext

    return ExecutionContext(
        user_id="user_test_001",
        session_id="sess_test_001",
        runtime=mock_runtime,
        sandbox_id="sbx_test_001",
    )


@pytest.fixture
def execution_context_no_sandbox():
    """ExecutionContext without a sandbox (for fallback tests)."""
    from src.tool_executor import ExecutionContext

    return ExecutionContext(
        user_id="user_test_001",
        session_id="sess_test_001",
        runtime=None,
        sandbox_id=None,
    )


# ============================================================
# Environment isolation fixtures
# ============================================================


@pytest.fixture
def clean_env(monkeypatch, tmp_path):
    """
    Isolate test environment from .env file.

    Clears all API keys and optional env vars so Settings() returns defaults.
    Use this fixture for tests that verify default values.

    Creates a temp empty .env file to prevent pydantic from loading the real one.
    """
    env_vars_to_clear = [
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY",
        "GOOGLE_API_KEY",
        "E2B_API_KEY",
        "E2B_TEMPLATE",
        "SERPER_API_KEY",
        "REDIS_PASSWORD",
    ]

    # Use monkeypatch to clear environment variables
    for key in env_vars_to_clear:
        monkeypatch.delenv(key, raising=False)

    # Create empty .env file in temp location and change working directory
    # This prevents pydantic from loading the real .env
    empty_env = tmp_path / ".env"
    empty_env.write_text("")
    monkeypatch.chdir(tmp_path)

    yield
