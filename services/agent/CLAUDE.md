# services/agent — Testing Rules

## What This Is
Python FastAPI agent service: ~5100 lines, 21 files, 32 core tools, Manus-aligned architecture. The brain of Rubic.

## Framework
- **pytest 8.x** + pytest-asyncio 0.24.x
- Config: `pyproject.toml [tool.pytest.ini_options]`
- `asyncio_mode = "auto"` — all async tests auto-detected
- Test dir: `tests/`

## Commands
```bash
python -m pytest                              # All tests
python -m pytest tests/test_tool_executor.py  # Single file
python -m pytest -x                           # Stop on first failure
python -m pytest -v                           # Verbose
python -m pytest -s                           # Show print output
python -m pytest --cov=src --cov-report=html  # Coverage
```

## Test Structure
```
tests/
  conftest.py              # Shared fixtures (mock_db, mock_sandbox, mock_anthropic, mock_session)
  test_agent_loop.py       # Agent loop iteration, stop conditions, show_plan trigger
  test_tool_executor.py    # All 32 tools accept valid input, reject invalid input
  test_completion.py       # SSE protocol compliance, error responses, auth
  test_session.py          # Session CRUD, conversation history loading
  test_tools_browser.py    # Browser actions with sandbox mock
  test_tools_shell.py      # Shell sessions, exec, timeout
  test_runtime.py          # SandboxRuntime protocol, DirectSdkRuntime
  test_system_prompt.py    # System prompt generation, section assembly
```

## Critical Test Rules

### Agent Loop (P0)
1. Must stop after max_iterations (never infinite loop)
2. Must stop on `end_turn` stop_reason
3. Must call `show_plan` for complex multi-tool tasks
4. Must merge consecutive same-role messages (Anthropic API forbids them)
5. `_merge_consecutive_tool_results()` must handle text + tool_result blocks

### Tool Executor (P0)
1. Every tool must accept valid input without error (parameterized test)
2. file_write must reject dangerous paths (/etc/passwd, /usr/bin, etc.)
3. shell_exec must handle timeouts gracefully
4. Browser tools must include screenshot in response (auto-screenshot)
5. Dynamic tools (Composio, device) must register and execute correctly

### SSE Protocol (P0)
1. Response must contain `start`, at least one content/tool event, `finish`
2. Missing session_id → 400
3. Provider errors → SSE error event (not HTTP 500)
4. Quota exceeded → specific error type for client-side fallback detection

### Runtime Protocol
1. `DirectSdkRuntime` wraps raw E2B SDK calls
2. Tool functions call `ctx.runtime.*` (never `asyncio.to_thread` directly)
3. Test with `FakeSandboxRuntime` for isolation

## Gotchas
- Agent service saves DISABLED (persistence.py lines 563-565, 674-677) — only route.ts saves
- `load_conversation_history()` reads `parts` column → text-only for history (tool reconstruction causes Anthropic multi-iteration tool_use/tool_result ordering errors)
- E2B_API_KEY must be in `.env`
- Browser controller runs on port 9821 inside sandbox
- Playwright install: `pip install playwright && playwright install chromium && playwright install-deps chromium`
