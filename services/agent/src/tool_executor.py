"""
Tool execution router — dispatches tool calls to the appropriate service.

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
"""

import json
from dataclasses import dataclass

import httpx
import structlog

from .config import settings
from .tools.browser import browser_web_search
from .tools.browser_interactive import browser_action
from .tools.image_gen import nano_banana_generate

logger = structlog.get_logger()

# Reusable httpx client — created once, used across tool calls
_http_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=60.0)
    return _http_client


@dataclass
class ExecutionContext:
    """Context passed to every tool execution."""

    user_id: str
    session_id: str
    sandbox_id: str | None = None


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
    "browser_navigate",
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

    # ── File operations → sandbox service ──
    if name in ("file_read", "file_write", "file_str_replace", "file_find_in_content", "file_find_by_name"):
        return await sandbox_file_operation(ctx.sandbox_id, name, tool_input)

    # ── Shell session operations → sandbox service ──
    if name in ("shell_exec", "shell_view", "shell_wait", "shell_write_to_process", "shell_kill_process"):
        return await sandbox_shell_operation(ctx.sandbox_id, name, tool_input)

    # ── Code execution → sandbox service ──
    if name == "code_execute":
        return await sandbox_code_execute(ctx.sandbox_id, tool_input)

    # ── Web search → Serper + browser fallback ──
    if name == "web_search":
        return await browser_web_search(
            ctx.sandbox_id,
            tool_input.get("query", ""),
            tool_input.get("num_results", 5),
            tool_input.get("date_range"),
        )

    # ── Browser interactive tools → persistent browser controller in sandbox ──
    if name in BROWSER_INTERACTIVE_TOOLS:
        action = name.replace("browser_", "")
        return await browser_action(ctx.sandbox_id, action, tool_input)

    # ── Deployment → sandbox port exposure or production deploy ──
    if name == "deploy_expose_port":
        return await sandbox_expose_port(ctx.sandbox_id, tool_input["port"])
    if name == "deploy_apply_deployment":
        return await sandbox_apply_deployment(
            ctx.sandbox_id, ctx.user_id,
            tool_input["type"], tool_input["local_dir"],
        )

    # ── Image generation → Gemini in sandbox ──
    if name == "generate_image":
        return await nano_banana_generate(
            ctx.sandbox_id, tool_input["prompt"], tool_input.get("filename", "generated_image.png")
        )

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
# File Operations (read, write, str_replace, find_in_content, find_by_name)
# ============================================================


async def sandbox_file_operation(sandbox_id: str | None, operation: str, params: dict) -> dict:
    """Route file operations to the sandbox service."""
    if not sandbox_id:
        return {"error": "No sandbox available. A sandbox is required for file operations."}

    client = get_http_client()
    base = settings.sandbox_service_url

    if operation == "file_read":
        file_path = params.get("file") or params.get("path", "")
        payload = {"path": file_path, "encoding": params.get("encoding", "utf-8")}
        if "start_line" in params:
            payload["startLine"] = params["start_line"]
        if "end_line" in params:
            payload["endLine"] = params["end_line"]

        resp = await client.post(f"{base}/sandboxes/{sandbox_id}/files/read", json=payload)

        if resp.status_code >= 400:
            return {"error": f"Failed to read file: {resp.text}"}

        data = resp.json()
        content = data.get("content", "")

        # Apply line range if sandbox doesn't support it natively
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
            read_resp = await client.post(
                f"{base}/sandboxes/{sandbox_id}/files/read",
                json={"path": file_path},
            )
            if read_resp.status_code == 200:
                existing = read_resp.json().get("content", "")
                if params.get("leading_newline"):
                    content = "\n" + content
                content = existing + content
            # If file doesn't exist, just write the content
        else:
            if params.get("leading_newline"):
                content = "\n" + content

        if params.get("trailing_newline") and not content.endswith("\n"):
            content += "\n"

        resp = await client.post(
            f"{base}/sandboxes/{sandbox_id}/files/write",
            json={"path": file_path, "content": content},
        )

        if resp.status_code >= 400:
            return {"error": f"Failed to write file: {resp.text}"}
        return {"success": True, "path": file_path}

    elif operation == "file_str_replace":
        file_path = params.get("file") or params.get("path", "")
        read_resp = await client.post(
            f"{base}/sandboxes/{sandbox_id}/files/read",
            json={"path": file_path},
        )
        if read_resp.status_code != 200:
            return {"error": f"Failed to read file: {read_resp.text}"}

        content = read_resp.json().get("content", "")
        old_str = params.get("old_str", "")
        new_str = params.get("new_str", "")

        if old_str not in content:
            return {"error": f"String not found in file: {old_str[:100]}"}

        new_content = content.replace(old_str, new_str, 1)
        resp = await client.post(
            f"{base}/sandboxes/{sandbox_id}/files/write",
            json={"path": file_path, "content": new_content},
        )
        if resp.status_code >= 400:
            return {"error": f"Failed to write file: {resp.text}"}
        return {"success": True, "path": file_path}

    elif operation == "file_find_in_content":
        file_path = params.get("file") or params.get("path", "")
        regex = params.get("regex", "")

        # Use grep in sandbox shell
        shell_resp = await client.post(
            f"{base}/sandboxes/{sandbox_id}/shell",
            json={
                "command": f'grep -n -E "{regex}" "{file_path}" 2>&1 | head -50',
                "timeout": 10000,
            },
            timeout=15.0,
        )
        if shell_resp.status_code >= 400:
            return {"error": f"Search failed: {shell_resp.text}"}

        data = shell_resp.json()
        stdout = data.get("stdout", "")
        matches = []
        for line in stdout.strip().split("\n"):
            if line and ":" in line:
                parts = line.split(":", 1)
                matches.append({"line": int(parts[0]) if parts[0].isdigit() else 0, "content": parts[1] if len(parts) > 1 else ""})

        return {"file": file_path, "regex": regex, "matches": matches, "count": len(matches)}

    elif operation == "file_find_by_name":
        path = params.get("path", "/home/user")
        glob_pattern = params.get("glob", "*")

        shell_resp = await client.post(
            f"{base}/sandboxes/{sandbox_id}/shell",
            json={
                "command": f'find "{path}" -name "{glob_pattern}" -type f 2>/dev/null | head -50',
                "timeout": 10000,
            },
            timeout=15.0,
        )
        if shell_resp.status_code >= 400:
            return {"error": f"Find failed: {shell_resp.text}"}

        data = shell_resp.json()
        stdout = data.get("stdout", "")
        files = [f.strip() for f in stdout.strip().split("\n") if f.strip()]
        return {"path": path, "glob": glob_pattern, "files": files, "count": len(files)}

    return {"error": f"Unknown file operation: {operation}"}


# ============================================================
# Shell Session Operations (exec, view, wait, write_to_process, kill)
# ============================================================


async def sandbox_shell_operation(sandbox_id: str | None, operation: str, params: dict) -> dict:
    """Route shell session operations to the sandbox service."""
    if not sandbox_id:
        return {"error": "No sandbox available. A sandbox is required for shell operations."}

    client = get_http_client()
    base = settings.sandbox_service_url

    if operation == "shell_exec":
        session_id = params.get("id", "default")
        exec_dir = params.get("exec_dir", "/home/user")
        command = params.get("command", "")

        # Prefix with cd to exec_dir
        full_command = f'cd "{exec_dir}" && {command}'

        resp = await client.post(
            f"{base}/sandboxes/{sandbox_id}/shell",
            json={
                "command": full_command,
                "timeout": 30000,
                "sessionId": session_id,
            },
            timeout=45.0,
        )
        if resp.status_code >= 400:
            return {"error": f"Shell execution failed: {resp.text}"}
        return resp.json()

    elif operation == "shell_view":
        session_id = params.get("id", "default")
        # View output of an existing shell session
        resp = await client.post(
            f"{base}/sandboxes/{sandbox_id}/shell",
            json={
                "command": "true",  # No-op to get current state
                "timeout": 5000,
                "sessionId": session_id,
            },
            timeout=10.0,
        )
        if resp.status_code >= 400:
            return {"error": f"Shell view failed: {resp.text}"}
        return resp.json()

    elif operation == "shell_wait":
        session_id = params.get("id", "default")
        seconds = params.get("seconds", 10)
        # Wait by sleeping then checking state
        resp = await client.post(
            f"{base}/sandboxes/{sandbox_id}/shell",
            json={
                "command": f"sleep {min(seconds, 300)} && echo WAIT_COMPLETE",
                "timeout": (min(seconds, 300) + 5) * 1000,
                "sessionId": session_id,
            },
            timeout=min(seconds, 300) + 10,
        )
        if resp.status_code >= 400:
            return {"error": f"Shell wait failed: {resp.text}"}
        return resp.json()

    elif operation == "shell_write_to_process":
        session_id = params.get("id", "default")
        input_text = params.get("input", "")
        press_enter = params.get("press_enter", True)

        # Write to stdin of running process
        if press_enter:
            input_text += "\n"

        resp = await client.post(
            f"{base}/sandboxes/{sandbox_id}/shell",
            json={
                "command": f'echo "{input_text}" > /proc/$(pgrep -f "session_{session_id}" | head -1)/fd/0 2>/dev/null || echo "No active process"',
                "timeout": 5000,
                "sessionId": session_id,
            },
            timeout=10.0,
        )
        if resp.status_code >= 400:
            return {"error": f"Shell write failed: {resp.text}"}
        return resp.json()

    elif operation == "shell_kill_process":
        session_id = params.get("id", "default")
        # Kill processes in the session
        resp = await client.post(
            f"{base}/sandboxes/{sandbox_id}/shell",
            json={
                "command": f'pkill -f "session_{session_id}" 2>/dev/null; echo "Process terminated"',
                "timeout": 5000,
            },
            timeout=10.0,
        )
        if resp.status_code >= 400:
            return {"error": f"Shell kill failed: {resp.text}"}
        return resp.json()

    return {"error": f"Unknown shell operation: {operation}"}


# ============================================================
# Code Execution
# ============================================================


async def sandbox_code_execute(sandbox_id: str | None, params: dict) -> dict:
    """Execute code in the sandbox."""
    if not sandbox_id:
        return {"error": "No sandbox available. A sandbox is required for code execution."}

    client = get_http_client()
    timeout = params.get("timeout", 30)

    resp = await client.post(
        f"{settings.sandbox_service_url}/sandboxes/{sandbox_id}/execute",
        json={
            "code": params["code"],
            "language": params.get("language", "python"),
            "timeout": timeout * 1000,
        },
        timeout=max(timeout + 10, 60),
    )

    if resp.status_code >= 400:
        return {"error": f"Code execution failed: {resp.text}"}
    return resp.json()


# ============================================================
# Deployment (expose port + production deploy)
# ============================================================


async def sandbox_expose_port(sandbox_id: str | None, port: int) -> dict:
    """Expose a sandbox port to a public URL via E2B."""
    if not sandbox_id:
        return {"error": "No sandbox available for port exposure."}

    client = get_http_client()
    resp = await client.post(
        f"{settings.sandbox_service_url}/sandboxes/{sandbox_id}/expose",
        json={"port": port},
    )
    if resp.status_code >= 400:
        return {"error": f"Failed to expose port: {resp.text}"}

    data = resp.json()
    url = data.get("url", "")
    return {
        "url": url,
        "port": port,
        "message": f"Service is temporarily accessible at {url}",
    }


async def sandbox_apply_deployment(
    sandbox_id: str | None,
    user_id: str,
    deploy_type: str,
    local_dir: str,
) -> dict:
    """Deploy a website/app to production via the website service."""
    if not sandbox_id:
        return {"error": "No sandbox available for deployment."}

    client = get_http_client()

    # Step 1: Package the directory in the sandbox
    if deploy_type == "static":
        # Tar the directory and upload to file service
        tar_path = "/tmp/deploy.tar.gz"
        shell_resp = await client.post(
            f"{settings.sandbox_service_url}/sandboxes/{sandbox_id}/shell",
            json={
                "command": f'cd "{local_dir}" && tar -czf {tar_path} .',
                "timeout": 30000,
            },
            timeout=45.0,
        )
        if shell_resp.status_code >= 400:
            return {"error": f"Failed to package deployment: {shell_resp.text}"}

    # Step 2: Deploy via website service or file service
    # For now, expose via port as temporary deployment
    expose_result = await sandbox_expose_port(sandbox_id, 3000)
    if "error" in expose_result:
        # Try port 8080 as fallback
        expose_result = await sandbox_expose_port(sandbox_id, 8080)

    return {
        "deployed": True,
        "type": deploy_type,
        "url": expose_result.get("url", ""),
        "local_dir": local_dir,
        "message": (
            f"{'Static' if deploy_type == 'static' else 'Next.js'} app deployed. "
            f"Accessible at: {expose_result.get('url', 'unknown')}"
        ),
    }


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
            f"{settings.task_service_url}/tasks",
            json={
                "name": params["name"],
                "description": params["description"],
                "taskType": "agent_execution",
                "scheduleType": "recurring",
                "cronExpression": cron,
                "payload": {
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
        return {
            "created": True,
            "task_id": data.get("id", ""),
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
