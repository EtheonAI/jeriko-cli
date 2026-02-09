"""
Tool execution router — dispatches tool calls via SandboxRuntime abstraction.

Every tool the agent can call gets routed here. Aligned with Manus tool surface:
- File operations (read, write, str_replace, find_in_content, find_by_name)
- Shell sessions (exec, view, wait, write_to_process, kill)
- Code execution
- Browser interactive (navigate, view, click, input, scroll, key, select, console, screenshot, restart)
- Web search (Serper + browser-use fallback)
- Deployment (expose port, apply deployment)
- Image generation (Gemini)
- User communication (WebSocket via gateway)
- Composio tools (app_* prefix)
- Device tools (device_* prefix)
- Recurring tasks (Inngest)
- Outcome tracking (Composio analytics)

Phase B (ADR-003): All sandbox-touching tool functions now call ctx.runtime.*
instead of raw E2B SDK + asyncio.to_thread. Zero behaviour change.
"""

import asyncio
import json
from dataclasses import dataclass

import httpx
import structlog

from .config import settings
from .runtime import SandboxRuntime
from .tools.browser import browser_navigate, browser_web_search
from .tools.image_gen import nano_banana_generate

logger = structlog.get_logger()

# Reusable httpx client — for non-sandbox services only (gateway, connector, device, task)
_http_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            timeout=60.0,
            verify=settings.environment != "development",
        )
    return _http_client


async def close_http_client() -> None:
    """Close the shared HTTP client. Call from app shutdown."""
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None
        logger.info("http_client_closed")


@dataclass
class ExecutionContext:
    """Context passed to every tool execution — includes SandboxRuntime."""

    user_id: str
    session_id: str
    runtime: SandboxRuntime | None = None
    sandbox_id: str | None = None
    neko_url: str | None = None


# === Dangerous device commands that always require approval ===
ALWAYS_REQUIRE_APPROVAL = [
    "rm -rf",
    "format",
    "shutdown",
    "reboot",
    "kill",
    "chmod 777",
    "dd if=",
    "mkfs",
    "fdisk",
    "sudo rm",
    "sudo shutdown",
]

# All interactive browser tool names
BROWSER_INTERACTIVE_TOOLS = {
    "browser_view",
    "browser_restart",
    "browser_click",
    "browser_input",
    "browser_move_mouse",
    "browser_press_key",
    "browser_select_option",
    "browser_scroll_up",
    "browser_scroll_down",
    "browser_console_exec",
    "browser_console_view",
    "browser_screenshot",
}


async def execute_tool(name: str, tool_input: dict, ctx: ExecutionContext) -> dict:
    """
    Route tool execution to the appropriate handler.
    Returns a dict result that gets serialized as the tool_result content.
    """
    logger.info("tool_execute", tool=name, user_id=ctx.user_id, session_id=ctx.session_id)

    # ── File operations → SandboxRuntime ──
    if name in ("file_read", "file_write", "file_str_replace", "file_find_in_content", "file_find_by_name"):
        return await _file_operation(name, tool_input, ctx)

    # ── Shell session operations → SandboxRuntime ──
    if name in ("shell_exec", "shell_view", "shell_wait", "shell_write_to_process", "shell_kill_process"):
        return await _shell_operation(name, tool_input, ctx)

    # ── Code execution → SandboxRuntime ──
    if name == "code_execute":
        return await _code_execute(tool_input, ctx)

    # ── Web search → Serper + browser fallback ──
    if name == "web_search":
        return await browser_web_search(
            ctx.sandbox_id,
            tool_input.get("query", ""),
            tool_input.get("num_results", 5),
            tool_input.get("date_range"),
        )

    # ── Browser navigate → SandboxRuntime with HTTP fallback ──
    if name == "browser_navigate":
        if ctx.runtime:
            return await _browser_navigate(tool_input, ctx)
        return await browser_navigate(ctx.sandbox_id, tool_input.get("url", ""))

    # ── Browser interactive tools → SandboxRuntime ──
    if name in BROWSER_INTERACTIVE_TOOLS:
        return await _browser_interactive(name, tool_input, ctx)

    # ── Deployment → SandboxRuntime port exposure ──
    if name == "deploy_expose_port":
        return await _expose_port(tool_input.get("port", 3000), ctx)
    if name == "deploy_apply_deployment":
        return await _apply_deployment(tool_input, ctx)

    # ── Image generation → Gemini in sandbox ──
    if name == "generate_image":
        return await nano_banana_generate(
            ctx.sandbox_id, tool_input["prompt"], tool_input.get("filename", "generated_image.png")
        )

    # ── Planning → echo back plan data (no sandbox needed) ──
    if name == "show_plan":
        return {
            "title": tool_input.get("title", "Plan"),
            "todos": tool_input.get("todos", []),
        }

    # ── User communication → WebSocket via gateway ──
    if name in ("message_notify_user", "message_ask_user"):
        return await send_to_user(ctx.user_id, ctx.session_id, name, tool_input)

    # ── Composio tools (prefixed with app_) ──
    if name.startswith("app_"):
        return await composio_execute(ctx.user_id, name, tool_input)

    # ── Device tools (prefixed with device_) ──
    if name.startswith("device_"):
        return await device_execute(ctx.user_id, name, tool_input)

    # ── Employee mode: recurring tasks ──
    if name == "schedule_recurring_task":
        return await create_recurring_task(ctx.user_id, ctx.session_id, tool_input)

    # ── Outcome tracking ──
    if name == "check_outcomes":
        return await execute_check_outcomes(ctx.user_id, tool_input)

    return {"error": f"Unknown tool: {name}"}


# ============================================================
# File Operations — via SandboxRuntime
# ============================================================


async def _file_operation(operation: str, params: dict, ctx: ExecutionContext) -> dict:
    """Execute file operations via SandboxRuntime."""
    if not ctx.runtime:
        return {"error": "No sandbox available. A sandbox is required for file operations."}

    runtime = ctx.runtime

    try:
        if operation == "file_read":
            file_path = params.get("file") or params.get("path", "")
            content = await runtime.file_read(file_path)

            # Apply line range if requested
            if ("start_line" in params or "end_line" in params) and content:
                lines = content.split("\n")
                start = params.get("start_line", 0)
                end = params.get("end_line", len(lines))
                content = "\n".join(lines[start:end])

            return {"content": content, "path": file_path}

        elif operation == "file_write":
            file_path = params.get("file") or params.get("path", "")
            content = params.get("content", "")

            # Handle append mode
            if params.get("append"):
                try:
                    existing = await runtime.file_read(file_path)
                    if params.get("leading_newline"):
                        content = "\n" + content
                    content = existing + content
                except Exception:
                    pass  # File doesn't exist — just write
            else:
                if params.get("leading_newline"):
                    content = "\n" + content

            if params.get("trailing_newline") and not content.endswith("\n"):
                content += "\n"

            await runtime.file_write(file_path, content)
            return {"success": True, "path": file_path}

        elif operation == "file_str_replace":
            file_path = params.get("file") or params.get("path", "")
            content = await runtime.file_read(file_path)

            old_str = params.get("old_str", "")
            new_str = params.get("new_str", "")

            if old_str not in content:
                return {"error": f"String not found in file: {old_str[:100]}"}

            new_content = content.replace(old_str, new_str, 1)
            await runtime.file_write(file_path, new_content)
            return {"success": True, "path": file_path}

        elif operation == "file_find_in_content":
            file_path = params.get("file") or params.get("path", "")
            regex = params.get("regex", "")

            result = await runtime.command_run(
                f'grep -n -E "{regex}" "{file_path}" 2>&1 | head -50',
                timeout=10,
            )
            stdout = result.stdout
            matches = []
            for line in stdout.strip().split("\n"):
                if line and ":" in line:
                    parts = line.split(":", 1)
                    matches.append({
                        "line": int(parts[0]) if parts[0].isdigit() else 0,
                        "content": parts[1] if len(parts) > 1 else "",
                    })
            return {"file": file_path, "regex": regex, "matches": matches, "count": len(matches)}

        elif operation == "file_find_by_name":
            path = params.get("path", "/home/user")
            glob_pattern = params.get("glob", "*")

            result = await runtime.command_run(
                f'find "{path}" -name "{glob_pattern}" -type f 2>/dev/null | head -50',
                timeout=10,
            )
            stdout = result.stdout
            files = [f.strip() for f in stdout.strip().split("\n") if f.strip()]
            return {"path": path, "glob": glob_pattern, "files": files, "count": len(files)}

    except Exception as e:
        logger.error("file_operation_error", operation=operation, error=str(e))
        return {"error": f"File operation failed: {str(e)}"}

    return {"error": f"Unknown file operation: {operation}"}


# ============================================================
# Shell Operations — via SandboxRuntime
# ============================================================


async def _shell_operation(operation: str, params: dict, ctx: ExecutionContext) -> dict:
    """Execute shell operations via SandboxRuntime."""
    if not ctx.runtime:
        return {"error": "No sandbox available. A sandbox is required for shell operations."}

    runtime = ctx.runtime

    try:
        if operation == "shell_exec":
            exec_dir = params.get("exec_dir", "/home/user")
            command = params.get("command", "")

            result = await runtime.command_run(command, cwd=exec_dir, timeout=30)
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.exit_code,
            }

        elif operation == "shell_view":
            # View current state — run a no-op
            result = await runtime.command_run("true", timeout=5)
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.exit_code,
            }

        elif operation == "shell_wait":
            seconds = min(params.get("seconds", 10), 300)
            result = await runtime.command_run(
                f"sleep {seconds} && echo WAIT_COMPLETE",
                timeout=seconds + 5,
            )
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.exit_code,
            }

        elif operation == "shell_write_to_process":
            input_text = params.get("input", "")
            press_enter = params.get("press_enter", True)
            if press_enter:
                input_text += "\n"

            session_id = params.get("id", "default")
            result = await runtime.command_run(
                f'echo "{input_text}" > /proc/$(pgrep -f "session_{session_id}" | head -1)/fd/0 2>/dev/null || echo "No active process"',
                timeout=5,
            )
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.exit_code,
            }

        elif operation == "shell_kill_process":
            session_id = params.get("id", "default")
            result = await runtime.command_run(
                f'pkill -f "session_{session_id}" 2>/dev/null; echo "Process terminated"',
                timeout=5,
            )
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.exit_code,
            }

    except Exception as e:
        logger.error("shell_operation_error", operation=operation, error=str(e))
        return {"error": f"Shell operation failed: {str(e)}"}

    return {"error": f"Unknown shell operation: {operation}"}


# ============================================================
# Code Execution — via SandboxRuntime
# ============================================================


async def _code_execute(params: dict, ctx: ExecutionContext) -> dict:
    """Execute code in the sandbox via SandboxRuntime."""
    if not ctx.runtime:
        return {"error": "No sandbox available. A sandbox is required for code execution."}

    runtime = ctx.runtime
    code = params.get("code", "")
    language = params.get("language", "python")
    timeout = params.get("timeout", 30)

    try:
        if language == "python" and runtime.has_code_interpreter:
            result = await runtime.code_run(code, language=language, timeout=timeout)
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "results": result.results,
                "error": result.error,
            }
        else:
            result = await runtime.code_run(code, language=language, timeout=timeout)
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.exit_code,
            }

    except Exception as e:
        logger.error("code_execute_error", error=str(e))
        return {"error": f"Code execution failed: {str(e)}"}


# ============================================================
# Browser Operations — via SandboxRuntime (DesktopSandbox)
# ============================================================


async def _browser_navigate(params: dict, ctx: ExecutionContext) -> dict:
    """Navigate to a URL using SandboxRuntime."""
    runtime = ctx.runtime
    url = params.get("url", "")

    if not runtime:
        return {"error": "No sandbox available."}

    try:
        if runtime.is_desktop:
            # Use desktop open for URL navigation
            await runtime.desktop_open(url)
            await asyncio.sleep(3)  # Wait for page load

            # Take screenshot
            screenshot_bytes = await runtime.desktop_screenshot()
            import base64
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode() if screenshot_bytes else ""

            return {
                "screenshot": screenshot_b64,
                "url": url,
                "title": "",
                "message": f"Navigated to {url}",
            }
        else:
            # Non-desktop sandbox — use Chromium via shell
            result = await runtime.command_run(
                f'chromium-browser --headless --disable-gpu --dump-dom "{url}" 2>/dev/null | head -200',
                timeout=15,
            )
            return {
                "content": result.stdout[:5000] if result.stdout else "",
                "url": url,
                "title": "",
                "message": f"Fetched content from {url}",
            }

    except Exception as e:
        logger.error("browser_navigate_error", url=url, error=str(e))
        # Fall back to HTTP fetch
        return await browser_navigate(ctx.sandbox_id, url)


async def _browser_interactive(name: str, params: dict, ctx: ExecutionContext) -> dict:
    """Execute interactive browser actions via SandboxRuntime."""
    runtime = ctx.runtime

    if not runtime:
        return {"error": "No sandbox available for browser operations."}

    if not runtime.is_desktop:
        return {"error": "Interactive browser requires a Desktop sandbox."}

    try:
        action = name.replace("browser_", "")

        if action == "click":
            x = params.get("coordinate_x", params.get("x", 640))
            y = params.get("coordinate_y", params.get("y", 360))
            await runtime.desktop_left_click(x=x, y=y)
            await asyncio.sleep(1)

        elif action == "input":
            x = params.get("coordinate_x", params.get("x", 640))
            y = params.get("coordinate_y", params.get("y", 360))
            text = params.get("text", "")
            # Click to focus, then type
            await runtime.desktop_left_click(x=x, y=y)
            await asyncio.sleep(0.5)
            await runtime.desktop_write(text)
            if params.get("press_enter"):
                await runtime.desktop_press("Enter")
            await asyncio.sleep(1)

        elif action == "move_mouse":
            x = params.get("coordinate_x", params.get("x", 640))
            y = params.get("coordinate_y", params.get("y", 360))
            await runtime.desktop_move_mouse(x=x, y=y)

        elif action in ("press_key", "key_press"):
            key = params.get("key", "")
            if key:
                await runtime.desktop_press(key)
            await asyncio.sleep(0.5)

        elif action == "select_option":
            x = params.get("coordinate_x", params.get("x", 640))
            y = params.get("coordinate_y", params.get("y", 360))
            await runtime.desktop_left_click(x=x, y=y)
            await asyncio.sleep(0.5)
            # Select the option by index offset
            option_index = params.get("option", 0)
            for _ in range(option_index):
                await runtime.desktop_press("ArrowDown")
                await asyncio.sleep(0.1)
            await runtime.desktop_press("Enter")
            await asyncio.sleep(0.5)

        elif action in ("scroll_up", "scroll"):
            direction = params.get("direction", "up")
            amount = params.get("amount", 3)
            x = params.get("coordinate_x", 640)
            y = params.get("coordinate_y", 360)
            scroll_y = -amount if direction == "up" else amount
            await runtime.desktop_scroll(x=x, y=y, scroll_x=0, scroll_y=scroll_y)
            await asyncio.sleep(0.5)

        elif action == "scroll_down":
            amount = params.get("amount", 3)
            x = params.get("coordinate_x", 640)
            y = params.get("coordinate_y", 360)
            await runtime.desktop_scroll(x=x, y=y, scroll_x=0, scroll_y=amount)
            await asyncio.sleep(0.5)

        elif action == "console_exec":
            js_code = params.get("code", params.get("javascript", ""))
            # Execute via xdotool + Chromium DevTools
            result = await runtime.command_run(
                f'chromium-browser --headless --disable-gpu --remote-debugging-port=9222 2>/dev/null &'
                f' sleep 1 && curl -s http://localhost:9222/json/version | head -5',
                timeout=10,
            )
            return {
                "stdout": result.stdout,
                "message": "Console execution via DevTools is limited in desktop mode.",
            }

        elif action == "console_view":
            return {"message": "Console view not available in desktop mode."}

        elif action in ("view", "screenshot"):
            pass  # Just take a screenshot below

        elif action == "restart":
            url = params.get("url", "")
            if url:
                await runtime.desktop_open(url)
                await asyncio.sleep(3)

        else:
            return {"error": f"Unknown browser action: {action}"}

        # Take screenshot after every browser action
        screenshot_bytes = await runtime.desktop_screenshot()
        import base64
        screenshot_b64 = base64.b64encode(screenshot_bytes).decode() if screenshot_bytes else ""

        return {
            "screenshot": screenshot_b64,
            "url": "",
            "title": "",
        }

    except Exception as e:
        logger.error("browser_interactive_error", action=name, error=str(e))
        return {"error": f"Browser action failed: {str(e)}"}


# ============================================================
# Deployment — via SandboxRuntime
# ============================================================


async def _expose_port(port: int, ctx: ExecutionContext) -> dict:
    """Expose a sandbox port to a public URL via SandboxRuntime."""
    if not ctx.runtime:
        return {"error": "No sandbox available for port exposure."}

    try:
        host = ctx.runtime.get_host(port)
        url = f"https://{host}" if host else ""
        return {
            "url": url,
            "port": port,
            "message": f"Service is temporarily accessible at {url}",
        }
    except Exception as e:
        return {"error": f"Failed to expose port: {str(e)}"}


async def _apply_deployment(params: dict, ctx: ExecutionContext) -> dict:
    """Deploy a website/app from the sandbox."""
    if not ctx.runtime:
        return {"error": "No sandbox available for deployment."}

    deploy_type = params.get("type", "static")
    local_dir = params.get("local_dir", "/home/user/project")

    # Try common ports
    for port in (3000, 8080, 5000):
        result = await _expose_port(port, ctx)
        if "error" not in result and result.get("url"):
            return {
                "deployed": True,
                "type": deploy_type,
                "url": result["url"],
                "local_dir": local_dir,
                "message": f"App deployed. Accessible at: {result['url']}",
            }

    return {"error": "Could not find a running service to expose."}


# ============================================================
# User Communication (WebSocket via Gateway)
# ============================================================


async def send_to_user(
    user_id: str, session_id: str, event_type: str, data: dict
) -> dict:
    """Send a message to the user via the gateway WebSocket."""
    client = get_http_client()
    try:
        resp = await client.post(
            f"{settings.gateway_url}/publish",
            json={
                "channel": f"session:{session_id}",
                "event": event_type,
                "data": {
                    "userId": user_id,
                    "sessionId": session_id,
                    "text": data.get("text", data.get("message", "")),
                    "attachments": data.get("attachments"),
                    "suggest_user_takeover": data.get("suggest_user_takeover"),
                    **{k: v for k, v in data.items() if k not in ("text", "message", "attachments", "suggest_user_takeover")},
                },
            },
            timeout=5.0,
        )

        if resp.status_code >= 400:
            logger.warning("gateway_publish_failed", status=resp.status_code)
            return {"sent": False, "reason": f"Gateway error: {resp.status_code}"}

        return {"sent": True}

    except Exception as e:
        logger.warning("gateway_publish_error", error=str(e))
        return {"sent": False, "reason": str(e)}


# ============================================================
# Composio Tools (Connected Apps)
# ============================================================


async def composio_execute(user_id: str, tool_name: str, tool_input: dict) -> dict:
    """Execute a Composio tool via the connector service."""
    client = get_http_client()
    try:
        resp = await client.post(
            f"{settings.connector_service_url}/tools/execute",
            json={
                "toolName": tool_name,
                "arguments": tool_input,
            },
            headers={"x-user-id": user_id},
            timeout=30.0,
        )

        if resp.status_code != 200:
            data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            return {"error": data.get("error", f"Connector service error: {resp.status_code}")}

        return resp.json()

    except Exception as e:
        return {"error": f"Composio tool execution failed: {str(e)}"}


async def fetch_composio_tools(user_id: str) -> list[dict]:
    """Fetch available Composio tools for the user (called once per session)."""
    client = get_http_client()
    try:
        resp = await client.get(
            f"{settings.connector_service_url}/users/{user_id}/tools",
            timeout=10.0,
        )
        if resp.status_code != 200:
            return []

        data = resp.json()
        tools = []
        for t in data.get("tools", []):
            tools.append({
                "name": f"app_{t.get('app_name', 'unknown')}_{t.get('action', 'unknown')}",
                "description": t.get("description", ""),
                "input_schema": t.get("parameters", {"type": "object", "properties": {}}),
            })
        return tools

    except Exception as e:
        logger.warning("composio_tools_fetch_error", error=str(e))
        return []


async def fetch_user_connected_apps(user_id: str) -> list[str]:
    """Fetch list of connected app names for the user."""
    client = get_http_client()
    try:
        resp = await client.get(
            f"{settings.connector_service_url}/users/{user_id}/connections",
            timeout=10.0,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        return [c.get("app_name", "") for c in data.get("connections", [])]
    except Exception:
        return []


# ============================================================
# Device Tools
# ============================================================


async def device_execute(user_id: str, tool_name: str, tool_input: dict) -> dict:
    """Execute a command on a connected device."""
    command = tool_input.get("command", "")

    # Safety: check for dangerous commands
    for pattern in ALWAYS_REQUIRE_APPROVAL:
        if pattern in command.lower():
            return {
                "status": "approval_required",
                "message": (
                    f"This command contains '{pattern}'. "
                    "Please confirm you want to proceed."
                ),
                "command": command,
            }

    # Also require approval if explicitly requested
    if tool_input.get("require_approval", True):
        return {
            "status": "approval_required",
            "message": f"Ready to execute on device: {command}",
        }

    # Extract device_id from tool name (format: device_{id}_command)
    parts = tool_name.split("_")
    if len(parts) >= 3:
        device_id = parts[1]
    else:
        return {"error": f"Invalid device tool name: {tool_name}"}

    client = get_http_client()
    try:
        resp = await client.post(
            f"{settings.device_service_url}/devices/{device_id}/execute",
            json={"command": command},
            headers={"x-user-id": user_id},
            timeout=30.0,
        )
        if resp.status_code >= 400:
            return {"error": f"Device service error: {resp.status_code}"}
        return resp.json()
    except Exception as e:
        return {"error": f"Device execution failed: {str(e)}"}


async def fetch_user_devices(user_id: str) -> list[dict]:
    """Fetch user's connected devices (called once per session)."""
    client = get_http_client()
    try:
        resp = await client.get(
            f"{settings.device_service_url}/devices",
            headers={"x-user-id": user_id},
            timeout=10.0,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        return data.get("devices", data) if isinstance(data, dict) else data
    except Exception:
        return []


# ============================================================
# Recurring Tasks (Inngest/Task Service)
# ============================================================


async def create_recurring_task(user_id: str, session_id: str, params: dict) -> dict:
    """Create a recurring task via the task service / Inngest."""
    client = get_http_client()

    schedule_map = {
        "daily": "0 9 * * *",
        "weekly": "0 9 * * 1",
        "biweekly": "0 9 * * 1/2",
        "monthly": "0 9 1 * *",
    }

    schedule = params.get("schedule", "weekly")
    day_of_week = params.get("day_of_week")
    time_str = params.get("time", "09:00")

    cron = schedule_map.get(schedule, "0 9 * * 1")
    if day_of_week and schedule == "weekly":
        day_map = {
            "monday": 1, "tuesday": 2, "wednesday": 3, "thursday": 4,
            "friday": 5, "saturday": 6, "sunday": 0,
        }
        day_num = day_map.get(day_of_week.lower(), 1)
        hour = int(time_str.split(":")[0]) if ":" in time_str else 9
        minute = int(time_str.split(":")[1]) if ":" in time_str else 0
        cron = f"{minute} {hour} * * {day_num}"

    try:
        resp = await client.post(
            f"{settings.task_service_url}/scheduled-tasks",
            json={
                "name": params["name"],
                "description": params.get("description", ""),
                "taskType": "agent_run",
                "scheduleType": "cron",
                "cronExpression": cron,
                "timezone": "UTC",
                "payload": {
                    "prompt": params.get("description", params["name"]),
                    "skill_id": params.get("skill_id"),
                    "user_id": user_id,
                    "session_id": session_id,
                },
                "isEnabled": True,
            },
            headers={"x-user-id": user_id},
            timeout=10.0,
        )

        if resp.status_code >= 400:
            return {"error": f"Failed to create recurring task: {resp.text}"}

        data = resp.json()
        task_data = data.get("data", data)
        return {
            "created": True,
            "task_id": task_data.get("id", ""),
            "schedule": schedule,
            "cron": cron,
            "message": f"Recurring task '{params['name']}' created. It will run {schedule}.",
        }

    except Exception as e:
        return {"error": f"Failed to create recurring task: {str(e)}"}


# ============================================================
# Outcome Tracking
# ============================================================


async def execute_check_outcomes(user_id: str, params: dict) -> dict:
    """Fetch analytics via Composio and return structured outcomes."""
    source = params.get("source", "custom")

    if source == "social_media":
        platform = params.get("platform", "all")
        return await composio_execute(
            user_id,
            f"app_{platform}_get_analytics",
            {"timeframe": params.get("timeframe", "last_7_days")},
        )

    if source == "email":
        return await composio_execute(
            user_id,
            "app_gmail_get_analytics",
            {"timeframe": params.get("timeframe", "last_7_days")},
        )

    if source == "website":
        return await composio_execute(
            user_id,
            "app_google_analytics_get_report",
            {"timeframe": params.get("timeframe", "last_7_days")},
        )

    return {"message": "No analytics available for this source", "source": source}


# ============================================================
# Dynamic Tool Assembly (called once per session)
# ============================================================


async def assemble_all_tools(user_id: str, core_tools: list[dict]) -> list[dict]:
    """
    Assemble the complete tool list for a user session.
    Core tools + Composio tools + device tools.
    Called ONCE at session start, cached for the duration.
    """
    all_tools = list(core_tools)

    # Add Composio tools
    composio_tools = await fetch_composio_tools(user_id)
    all_tools.extend(composio_tools)

    # Add device tools
    devices = await fetch_user_devices(user_id)
    for device in devices:
        if device.get("status") == "online":
            all_tools.append({
                "name": f"device_{device['id']}_command",
                "description": (
                    f"Execute a command on {device.get('name', 'device')} "
                    f"({device.get('type', 'unknown')}). This is a real device — "
                    f"commands have real consequences. Always confirm destructive actions."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string"},
                        "require_approval": {"type": "boolean", "default": True},
                    },
                    "required": ["command"],
                },
            })

    return all_tools


# ============================================================
# Helpers
# ============================================================


def _shell_quote(s: str) -> str:
    """Quote a string for safe shell usage."""
    return "'" + s.replace("'", "'\\''") + "'"
