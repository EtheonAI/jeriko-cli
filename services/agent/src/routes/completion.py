"""
POST /v1/complete — Main entry point for the agent service.

Flow:
1. Check session cache → if cached, reuse tools/sandbox/connected_apps
2. If not cached: load user context in parallel (connected apps, devices)
3. Proactive check: detect unconnected apps user might need
4. Get or create sandbox for session
5. Build system prompt (stable, cacheable — includes memory + connected apps)
6. Assemble tools ONCE (core + Composio + device), cache per session
7. Load conversation history from DB if session_id provided
8. Check should_plan() → inject planning rules if multi-step
9. Run agent_loop() with streaming → SSE to client
10. Stream tool activity to client (tool_start, tool_result → SSE events)
11. Save messages to DB
12. Deduct credits → billing service
13. Log telemetry
"""

import asyncio
import copy
import json
from typing import Any, AsyncGenerator

import httpx
import structlog
from anthropic import AsyncAnthropic
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel

from ..agent_loop import agent_loop, prepare_messages_with_cache, prepare_tools_with_cache
from ..billing import calculate_credits, deduct_credits, log_telemetry
from ..config import settings
from ..session import (
    SessionContext,
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
from ..tool_executor import (
    ExecutionContext,
    assemble_all_tools,
    execute_tool,
    fetch_user_connected_apps,
)
from ..tools_definitions import CORE_TOOLS

logger = structlog.get_logger()
router = APIRouter(tags=["Completion"])


# ============================================================
# Request / Response Models
# ============================================================


class CompletionRequest(BaseModel):
    """Request for AI completion."""

    prompt: str | None = None
    messages: list[dict] | None = None
    model: str | None = None  # None = auto-route to sonnet
    max_tokens: int = 4096
    temperature: float = 0.7
    system_prompt: str | None = None
    stream: bool = True
    session_id: str | None = None
    skill_ids: list[str] | None = None
    target_device_id: str | None = None


class CompletionResponse(BaseModel):
    """Response from AI completion."""

    content: str
    model: str
    usage: dict
    tool_calls: list[dict] | None = None
    iterations: int = 1


# ============================================================
# LLM Clients (lazy init)
# ============================================================

_anthropic_client: AsyncAnthropic | None = None
_openai_client: AsyncOpenAI | None = None


def get_anthropic_client() -> AsyncAnthropic:
    global _anthropic_client
    if _anthropic_client is None:
        if not settings.anthropic_api_key:
            raise HTTPException(status_code=500, detail="Anthropic API key not configured")
        _anthropic_client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _anthropic_client


def get_openai_client() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        if not settings.openai_api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        _openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _openai_client


# ============================================================
# Model Routing
# ============================================================

MODEL_MAP = {
    "claude-3-5-sonnet": "claude-sonnet-4-20250514",
    "claude-sonnet": "claude-sonnet-4-5-20250929",
    "claude-haiku": "claude-haiku-4-5-20251001",
    "claude-opus": "claude-opus-4-5-20251101",
    "fast": "claude-haiku-4-5-20251001",
    "balanced": "claude-sonnet-4-5-20250929",
    "powerful": "claude-opus-4-5-20251101",
}

DEFAULT_MODEL = "claude-sonnet-4-5-20250929"


def resolve_model(model_name: str | None) -> str:
    if not model_name:
        return DEFAULT_MODEL
    return MODEL_MAP.get(model_name, model_name)


# ============================================================
# System Prompt Builder
# ============================================================

PLANNING_TRIGGERS = [
    "build", "create", "develop", "implement", "set up", "design",
    "write a report", "research and", "analyze", "multiple steps",
    "full-stack", "website", "application", "deploy",
]

PLATFORM_KEYWORDS = {
    "twitter": ["twitter", "tweet", "x.com"],
    "instagram": ["instagram", "ig", "insta"],
    "facebook": ["facebook", "fb"],
    "linkedin": ["linkedin"],
    "github": ["github", "repo", "repository"],
    "slack": ["slack", "channel"],
    "gmail": ["email", "gmail", "mail"],
    "google_drive": ["google drive", "gdrive", "docs"],
    "notion": ["notion"],
    "figma": ["figma", "design file"],
}


# Tools that require a sandbox to execute
SANDBOX_DEPENDENT_TOOLS = {
    "file_read", "file_write", "file_str_replace", "file_find_in_content", "file_find_by_name",
    "shell_exec", "shell_view", "shell_wait", "shell_write_to_process", "shell_kill_process",
    "code_execute",
    # browser_navigate has HTTP fallback, web_search has DuckDuckGo fallback — NOT sandbox-dependent
    "browser_view", "browser_restart", "browser_click", "browser_input",
    "browser_move_mouse", "browser_press_key", "browser_select_option", "browser_scroll_up",
    "browser_scroll_down", "browser_console_exec", "browser_console_view", "browser_screenshot",
    "deploy_expose_port", "deploy_apply_deployment",
    "generate_image",
}


def filter_sandbox_tools(tools: list[dict]) -> list[dict]:
    """Remove tools that require a sandbox when sandbox is unavailable."""
    return [t for t in tools if t["name"] not in SANDBOX_DEPENDENT_TOOLS]


def should_plan(prompt: str) -> bool:
    prompt_lower = prompt.lower()
    return any(trigger in prompt_lower for trigger in PLANNING_TRIGGERS)


def check_missing_integrations(prompt: str, connected_apps: list[str]) -> str | None:
    prompt_lower = prompt.lower()
    suggestions = []
    for app, keywords in PLATFORM_KEYWORDS.items():
        if any(kw in prompt_lower for kw in keywords):
            if app not in connected_apps:
                suggestions.append(app)
    if suggestions:
        apps_str = ", ".join(suggestions)
        plural = len(suggestions) > 1
        return (
            f"I notice you want to work with {apps_str}, "
            f"but {'they are' if plural else 'it is'} not connected yet. "
            f"Would you like to connect {'them' if plural else 'it'} now? "
            f"Go to Settings → Applications to connect."
        )
    return None


def build_system_prompt(
    user_name: str = "",
    user_memory: str = "",
    connected_apps: str = "",
    sandbox_available: bool = True,
) -> str:
    prompt = f"""You are Rubic, an AI agent created by the Rubic team.

<intro>
You excel at the following tasks:
1. Information gathering, fact-checking, and documentation
2. Data processing, analysis, and visualization
3. Writing multi-chapter articles and in-depth research reports
4. Creating websites, applications, and tools
5. Using programming to solve various problems beyond development
6. Managing connected devices, apps, and automations
7. Generating images, deploying projects, and scheduling recurring tasks
8. Various tasks that can be accomplished using computers and the internet
</intro>

<language_settings>
- Default working language: English
- Use the language specified by user in messages as the working language when explicitly provided
- All thinking and responses must be in the working language
- Natural language arguments in tool calls must be in the working language
</language_settings>

<system_capability>
- Communicate with users through message tools
- Access a Linux sandbox environment with internet connection
- Use shell, text editor, browser, and other software
- Write and run code in Python, JavaScript, and various programming languages
- Independently install required software packages and dependencies via shell
- Deploy websites or applications and provide public access
- Suggest users to temporarily take control of the browser for sensitive operations when necessary
- Utilize various tools to complete user-assigned tasks step by step
- Generate images using AI (Gemini)
- Control connected IoT devices and smart home systems
- Execute tools from connected apps (Gmail, Slack, GitHub, etc.) via Composio
- Schedule recurring tasks for autonomous execution
</system_capability>

<agent_loop>
You are operating in an agent loop, iteratively completing tasks through these steps:
1. Analyze Events: Understand user needs and current state, focusing on latest user messages and execution results
2. Select Tools: Choose next tool call based on current state, task planning, and available tools
3. Wait for Execution: Selected tool action will be executed by sandbox environment with results returned
4. Iterate: Choose one or more tool calls per iteration, patiently repeat above steps until task completion
5. Submit Results: Send results to user via message tools, providing deliverables and related files as attachments
6. Enter Standby: When all tasks are completed, provide final results and wait for new tasks
</agent_loop>

<planning_rules>
CRITICAL: You MUST call show_plan before starting ANY task that involves using tools.
- Call show_plan FIRST to display your plan before any other tool calls
- Even simple tasks like "search and summarize" should have a plan (e.g., Search → Analyze → Summarize)
- Each plan step must have a unique id, a short label, and status (pending/in_progress/completed/cancelled)
- As you work through steps, call show_plan again with updated statuses so the user sees live progress
- Call show_plan with status="in_progress" on the current step BEFORE starting it
- Call show_plan with status="completed" on the step AFTER finishing it
- Keep plan step labels short and action-oriented (e.g., "Search the web", "Analyze results", "Write code")
- The ONLY exception: single direct questions that need no tools (e.g., "What is Python?")
- Even if the sandbox is unavailable, still create plans for multi-step responses
</planning_rules>

<todo_rules>
- Create todo.md file as checklist when handling complex multi-step tasks
- Update markers in todo.md via file_str_replace immediately after completing each item
- Rebuild todo.md when task requirements change significantly
- Must use todo.md to record and update progress for information gathering tasks
- When all steps are complete, verify todo.md completion and remove skipped items
</todo_rules>

<message_rules>
- Communicate with users via message tools for progress updates and questions
- Reply immediately to new user messages before starting other operations
- First reply must be brief, only confirming receipt without specific solutions
- Notify users with brief explanation when changing methods or strategies
- Use message_notify_user for progress updates (non-blocking)
- Use message_ask_user only for essential questions that block progress
- Provide all relevant files as attachments, as users may not have direct access to sandbox filesystem
- Must message users with results and deliverables upon task completion
</message_rules>

<file_rules>
- Use file tools for reading, writing, appending, and editing to avoid string escape issues in shell commands
- Actively save intermediate results and store different types of reference information in separate files
- When merging text files, must use append mode of file_write to concatenate content to target file
- Use file_find_by_name to locate files and file_find_in_content to search within files
</file_rules>

<info_rules>
- Information priority: connected app APIs > web search > model's internal knowledge
- Prefer web_search tool over browsing search engine pages directly
- Snippets in search results are not valid sources; must access original pages via browser
- Access multiple URLs from search results for comprehensive information or cross-validation
- Conduct searches step by step: search multiple attributes of single entity separately
</info_rules>

<browser_rules>
- Must use browser tools to access and comprehend all URLs provided by users
- Must use browser tools to access URLs from search tool results
- Actively explore valuable links for deeper information by clicking elements or navigating URLs
- Browser tools return elements in visible viewport as index[N]:<tag>text</tag> for interactive elements
- Not all interactive elements may be identified; use coordinates to interact with unlisted elements
- browser_view returns page content including text beyond viewport in extracted form
- If extracted content is complete and sufficient, no scrolling needed; otherwise scroll to view entire page
- Use message_ask_user with suggest_user_takeover="browser" for sensitive operations like login
</browser_rules>

<shell_rules>
- Avoid commands requiring confirmation; actively use -y or -f flags for automatic confirmation
- Avoid commands with excessive output; save to files when necessary
- Chain multiple commands with && operator to minimize interruptions
- Use pipe operator to pass command outputs, simplifying operations
- Use Python for complex math; never calculate mentally
- Shell sessions are identified by ID; reuse the same ID for related commands
</shell_rules>

<coding_rules>
- Must save code to files before execution; direct code input to interpreter commands is forbidden
- Write Python code for complex mathematical calculations and analysis
- Use web_search to find solutions when encountering unfamiliar problems
- For index.html referencing local resources, use deploy tools or package into zip for delivery
</coding_rules>

<deploy_rules>
- All services can be temporarily accessed externally via deploy_expose_port
- Static websites and Next.js applications support permanent deployment via deploy_apply_deployment
- Users cannot directly access sandbox network; deploy_expose_port must be used for running services
- For web services, must first test access locally via browser
- When starting services, must listen on 0.0.0.0 to ensure accessibility
- For deployable websites or applications, ask users if permanent deployment is needed
</deploy_rules>

<device_rules>
- Connected devices are available as device_{{id}}_command tools
- Always require user approval before executing commands on real devices
- Dangerous commands (rm -rf, shutdown, reboot, format) always require explicit confirmation
- Check device status before sending commands; only online devices accept commands
</device_rules>

<connected_apps_rules>
- Connected apps provide tools prefixed with app_ (e.g., app_gmail_send_email)
- If a task needs an app the user hasn't connected, tell them which one and suggest connecting it in Settings → Applications
- If the user asks about multiple platforms, check which ones are actually connected
- Proactively detect missing integrations and inform the user
</connected_apps_rules>

<error_handling>
- When errors occur, first verify tool names and arguments
- Attempt to fix issues based on error messages; if unsuccessful, try alternative methods
- When multiple approaches fail, report failure reasons to user and request assistance
- If a tool fails, explain what happened and suggest alternatives — don't just retry silently
</error_handling>

<sandbox_environment>
System Environment:
- Ubuntu 22.04 (linux/amd64), with internet access
- User: user, with sudo privileges
- Home directory: /home/user

Development Environment:
- Python 3.10+ (commands: python3, pip3)
- Node.js 20+ (commands: node, npm)
- Playwright + Chromium for browser automation
</sandbox_environment>

<user_context>
User: {user_name or "User"}
{f"Memory: {user_memory}" if user_memory else ""}
Connected Apps: {connected_apps or "None connected yet. Suggest connecting apps in Settings → Applications."}
</user_context>
"""
    if not sandbox_available:
        prompt += """
<sandbox_unavailable>
IMPORTANT: The sandbox environment is currently unavailable. You CANNOT use file, shell, browser, code execution, deployment, or image generation tools. You can still:
- Answer questions using your knowledge
- Search the web using web_search
- Create and display plans using show_plan
- Communicate with the user via message_notify_user / message_ask_user
- Execute connected app tools (app_* prefix)
- Execute device tools (device_* prefix)
If the user asks for actions requiring sandbox tools, explain that the sandbox is temporarily unavailable and offer alternatives.
</sandbox_unavailable>
"""
    return prompt


# ============================================================
# Sandbox Management
# ============================================================


async def get_or_create_sandbox(session_id: str, user_id: str) -> str | None:
    """
    Get an existing running sandbox for this user, or create a new one.
    Uses the sandbox service REST API at /users/:userId/sandboxes and /sandboxes.
    """
    # Sandbox service uses x-user-id header for auth (dev mode) and owner verification
    headers = {"x-user-id": user_id}

    try:
        async with httpx.AsyncClient() as client:
            # Check for existing running sandboxes for this user
            resp = await client.get(
                f"{settings.sandbox_service_url}/users/{user_id}/sandboxes",
                headers=headers,
                timeout=10.0,
            )
            if resp.status_code == 200:
                resp_json = resp.json()
                # Sandbox service wraps responses: {data: {...}, meta: {...}}
                inner = resp_json.get("data", resp_json) if isinstance(resp_json, dict) else resp_json
                sandbox_list = inner.get("sandboxes", []) if isinstance(inner, dict) else []
                for sb in sandbox_list:
                    if sb.get("status") in ("running", "active"):
                        logger.debug("reusing_existing_sandbox", sandbox_id=sb["id"])
                        return sb["id"]

            # No running sandbox found — create a new one
            create_resp = await client.post(
                f"{settings.sandbox_service_url}/sandboxes",
                headers=headers,
                json={
                    "userId": user_id,
                    "projectId": session_id,
                    "config": {"timeout": 3600000},
                },
                timeout=30.0,
            )
            if create_resp.status_code < 400:
                resp_json = create_resp.json()
                # Sandbox service wraps responses: {data: {id, ...}, meta: {...}}
                inner = resp_json.get("data", resp_json) if isinstance(resp_json, dict) else resp_json
                sandbox_id = inner.get("id") if isinstance(inner, dict) else None
                logger.info("sandbox_created", sandbox_id=sandbox_id, user_id=user_id)
                return sandbox_id

            logger.warning("sandbox_create_failed", status=create_resp.status_code, body=create_resp.text)
            return None
    except Exception as e:
        logger.warning("sandbox_unavailable", error=str(e))
        return None


# ============================================================
# Session Context Setup
# ============================================================


async def setup_session_context(
    session_id: str,
    user_id: str,
) -> SessionContext:
    """
    Get or create a cached session context.
    Tools, sandbox, and connected apps are loaded ONCE and cached for the session.
    This is critical for KV-cache performance — changing tools invalidates all caches.
    """
    # Check cache first
    cached = get_cached_session(session_id)
    if cached:
        logger.debug("session_cache_hit", session_id=session_id)
        return cached

    # Cache miss — load everything in parallel
    logger.debug("session_cache_miss", session_id=session_id)

    connected_apps_task = asyncio.create_task(fetch_user_connected_apps(user_id))
    sandbox_task = asyncio.create_task(get_or_create_sandbox(session_id, user_id))
    session_task = asyncio.create_task(get_or_create_session(session_id, user_id))

    connected_apps, sandbox_id, _ = await asyncio.gather(
        connected_apps_task, sandbox_task, session_task,
        return_exceptions=True,
    )

    # Handle exceptions from gather
    if isinstance(connected_apps, Exception):
        logger.warning("connected_apps_error", error=str(connected_apps))
        connected_apps = []
    if isinstance(sandbox_id, Exception):
        logger.warning("sandbox_error", error=str(sandbox_id))
        sandbox_id = None

    # Assemble tools ONCE for this session
    tools = await assemble_all_tools(user_id, CORE_TOOLS)

    # If sandbox is unavailable, filter out sandbox-dependent tools
    if not sandbox_id:
        logger.info("sandbox_unavailable_filtering_tools", session_id=session_id)
        tools = filter_sandbox_tools(tools)

    ctx = SessionContext(
        session_id=session_id,
        user_id=user_id,
        sandbox_id=sandbox_id,
        tools=tools,
        connected_apps=connected_apps,
    )

    cache_session(ctx)
    return ctx


# ============================================================
# Main Endpoint: POST /v1/complete
# ============================================================


@router.post("/complete")
async def complete(
    request: CompletionRequest,
    x_user_id: str = Header(..., alias="x-user-id"),
    x_session_id: str | None = Header(None, alias="x-session-id"),
    x_task_id: str | None = Header(None, alias="x-task-id"),
    x_user_name: str | None = Header(None, alias="x-user-name"),
):
    """
    Generate AI completion with full agent capabilities.
    Runs the agentic tool loop with streaming, caching, and billing.
    """
    session_id = request.session_id or x_session_id or "default"
    user_prompt = request.prompt or ""

    # Build initial messages from request
    if request.messages:
        messages = list(request.messages)
    elif user_prompt:
        messages = [{"role": "user", "content": user_prompt}]
    else:
        raise HTTPException(status_code=400, detail="Either prompt or messages is required")

    logger.info(
        "completion_requested",
        user_id=x_user_id,
        session_id=session_id,
        model=request.model,
    )

    model = resolve_model(request.model)

    # Non-Claude models → simple pass-through
    if not model.startswith("claude"):
        if request.stream:
            return StreamingResponse(
                _stream_openai_passthrough(request, x_user_id),
                media_type="text/event-stream",
            )
        return await _openai_passthrough(request, x_user_id)

    # ================================================================
    # Claude agent path
    # ================================================================

    # Step 1: Setup session context (cached per session)
    session_ctx = await setup_session_context(session_id, x_user_id)

    # Step 2: Load conversation history from DB
    history = await load_conversation_history(session_id)
    if history:
        # Prepend history before the new user message, then merge any
        # consecutive user messages (e.g., tool_results + new prompt)
        from src.session import _merge_consecutive_tool_results
        messages = _merge_consecutive_tool_results(history + messages)

    # NOTE: User message persistence is handled by the Next.js route.ts (agent-proxy.ts)
    # which saves BOTH user + assistant messages with full AI SDK parts.
    # Do NOT save here — it causes duplicate messages in the DB.

    # Step 4: Proactive check — detect missing integrations
    integration_suggestion = None
    if user_prompt:
        integration_suggestion = check_missing_integrations(
            user_prompt, session_ctx.connected_apps
        )
        if integration_suggestion and messages:
            last_msg = messages[-1]
            if isinstance(last_msg.get("content"), str):
                messages[-1] = {
                    "role": "user",
                    "content": f"[System note: {integration_suggestion}]\n\n{last_msg['content']}",
                }

    # Step 5: Build system prompt (stable across turns)
    system_prompt = request.system_prompt or build_system_prompt(
        user_name=x_user_name or "",
        connected_apps=", ".join(session_ctx.connected_apps) if session_ctx.connected_apps else "",
        sandbox_available=session_ctx.sandbox_id is not None,
    )

    # Step 6: Create execution context
    exec_ctx = ExecutionContext(
        user_id=x_user_id,
        session_id=session_id,
        sandbox_id=session_ctx.sandbox_id,
    )

    # Step 7: Stream or non-stream response
    if request.stream:
        return StreamingResponse(
            _stream_agent_response(
                messages=messages,
                system_prompt=system_prompt,
                tools=session_ctx.tools,
                model=model,
                max_tokens=request.max_tokens,
                ctx=exec_ctx,
                user_id=x_user_id,
                session_id=session_id,
                user_prompt=user_prompt,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # Non-streaming path
    client = get_anthropic_client()
    result = await agent_loop(
        client=client,
        messages=messages,
        system_prompt=system_prompt,
        tools=session_ctx.tools,
        model=model,
        max_tokens=request.max_tokens,
        execute_tool_fn=lambda name, inp: execute_tool(name, inp, exec_ctx),
    )

    # Post-completion: save messages, deduct credits, log telemetry
    asyncio.create_task(_post_completion(
        session_id=session_id,
        user_id=x_user_id,
        model=model,
        result=result,
        user_prompt=user_prompt,
    ))

    return CompletionResponse(
        content=result["content"],
        model=model,
        usage=result["usage"],
        tool_calls=result.get("tool_calls"),
        iterations=result.get("iterations", 1),
    )


# ============================================================
# Post-Completion Tasks (async, non-blocking)
# ============================================================


async def _post_completion(
    session_id: str,
    user_id: str,
    model: str,
    result: dict,
    user_prompt: str = "",
) -> None:
    """
    Run after agent_loop completes. Non-blocking — doesn't affect response latency.
    1. Save assistant message to DB
    2. Save tool messages to DB
    3. Deduct credits
    4. Log telemetry
    5. Auto-generate session title if first message
    """
    try:
        usage = result.get("usage", {})
        tool_calls = result.get("tool_calls", [])
        content = result.get("content", "")
        iterations = result.get("iterations", 1)
        duration_ms = result.get("duration_ms", 0)

        # NOTE: Message persistence is handled by the Next.js route.ts (agent-proxy.ts)
        # which saves assistant messages with full AI SDK UIMessage parts.
        # Do NOT save here — it causes duplicate messages and role:tool messages
        # that the frontend displays as raw JSON text.

        # Deduct credits
        credits_used = calculate_credits(
            model=model,
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
            cache_read_tokens=usage.get("cache_read_tokens", 0),
            tool_calls=tool_calls,
        )
        await deduct_credits(
            user_id=user_id,
            session_id=session_id,
            model=model,
            usage=usage,
            tool_calls=tool_calls,
        )

        # Log telemetry
        await log_telemetry(
            user_id=user_id,
            session_id=session_id,
            model=model,
            usage=usage,
            iterations=iterations,
            tool_calls=tool_calls,
            duration_ms=duration_ms,
            credits_used=credits_used,
            success="error" not in result,
            error=result.get("error"),
            task_summary=user_prompt[:200] if user_prompt else "",
        )

        # Auto-generate session title from first message
        msg_count = await get_session_message_count(session_id)
        if msg_count <= 2 and user_prompt:
            # Use first ~60 chars of prompt as title
            title = user_prompt[:60].strip()
            if len(user_prompt) > 60:
                title += "..."
            await update_session_title(session_id, title)

    except Exception as e:
        logger.warning("post_completion_error", error=str(e))


# ============================================================
# Streaming Agent Response (SSE) with Cache Breakpoints
# ============================================================


async def _stream_agent_response(
    messages: list[dict],
    system_prompt: str,
    tools: list[dict],
    model: str,
    max_tokens: int,
    ctx: ExecutionContext,
    user_id: str,
    session_id: str,
    user_prompt: str = "",
) -> AsyncGenerator[str, None]:
    """
    Stream the agent loop response as SSE events with cache optimization.

    Cache breakpoints (3-point strategy):
    1. Last tool definition — caches all tool schemas
    2. System prompt — caches instructions + rules
    3. Last message — caches conversation history
    """
    client = get_anthropic_client()

    def sse(event_type: str, data: dict) -> str:
        return f"data: {json.dumps({'type': event_type, **data})}\n\n"

    # Prepare tools with cache breakpoint on last tool (done once)
    cached_tools = prepare_tools_with_cache(tools)

    all_tool_calls = []
    total_input_tokens = 0
    total_output_tokens = 0
    total_cache_read = 0
    total_cache_create = 0
    collected_text = []

    # Emit sandbox info so the client can make direct browser control requests
    if ctx.sandbox_id:
        yield sse("sandbox_info", {"sandboxId": ctx.sandbox_id})

    for iteration in range(50):  # MAX_ITERATIONS
        iter_text = []
        tool_use_blocks = []
        current_tool_json = ""

        # Apply cache breakpoint on last message (changes each iteration)
        cached_messages = prepare_messages_with_cache(messages)

        try:
            async with client.messages.stream(
                model=model,
                max_tokens=max_tokens,
                system=[
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                tools=cached_tools,
                messages=cached_messages,
            ) as stream:
                async for event in stream:
                    if event.type == "content_block_start":
                        if event.content_block.type == "tool_use":
                            tool_use_blocks.append({
                                "type": "tool_use",
                                "id": event.content_block.id,
                                "name": event.content_block.name,
                                "input": {},
                            })
                            current_tool_json = ""

                    elif event.type == "content_block_delta":
                        if hasattr(event.delta, "text"):
                            text = event.delta.text
                            iter_text.append(text)
                            yield sse("content", {"content": text})
                        elif hasattr(event.delta, "partial_json"):
                            current_tool_json += event.delta.partial_json

                    elif event.type == "content_block_stop":
                        if tool_use_blocks and current_tool_json:
                            try:
                                tool_use_blocks[-1]["input"] = json.loads(current_tool_json)
                            except json.JSONDecodeError:
                                tool_use_blocks[-1]["input"] = {"raw": current_tool_json}
                            current_tool_json = ""

                final_msg = await stream.get_final_message()
                total_input_tokens += final_msg.usage.input_tokens
                total_output_tokens += final_msg.usage.output_tokens
                if hasattr(final_msg.usage, "cache_read_input_tokens"):
                    total_cache_read += final_msg.usage.cache_read_input_tokens or 0
                if hasattr(final_msg.usage, "cache_creation_input_tokens"):
                    total_cache_create += final_msg.usage.cache_creation_input_tokens or 0

        except Exception as e:
            logger.error("stream_agent_error", error=str(e), iteration=iteration)
            yield sse("error", {"error": str(e)})
            yield "data: [DONE]\n\n"
            return

        if iter_text:
            collected_text.extend(iter_text)

        assistant_content = []
        if iter_text:
            assistant_content.append({"type": "text", "text": "".join(iter_text)})
        assistant_content.extend(tool_use_blocks)

        # No tool calls = done
        if not tool_use_blocks:
            usage = {
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "cache_read_tokens": total_cache_read,
                "cache_create_tokens": total_cache_create,
            }
            yield sse("usage", {
                "usage": usage,
                "iterations": iteration + 1,
                "tool_calls_count": len(all_tool_calls),
            })
            yield "data: [DONE]\n\n"

            # Post-completion tasks (async, non-blocking)
            asyncio.create_task(_post_completion(
                session_id=session_id,
                user_id=user_id,
                model=model,
                result={
                    "content": "".join(collected_text),
                    "tool_calls": all_tool_calls,
                    "iterations": iteration + 1,
                    "usage": usage,
                    "duration_ms": 0,  # Not tracked in streaming path precisely
                },
                user_prompt=user_prompt,
            ))
            return

        # Append assistant message to conversation
        messages.append({"role": "assistant", "content": assistant_content})

        # Execute tools
        tool_results = []
        for block in tool_use_blocks:
            yield sse("tool_start", {
                "toolCallId": block["id"],
                "tool": block["name"],
                "input": _safe_truncate(block["input"]),
            })

            try:
                result = await execute_tool(block["name"], block["input"], ctx)
                is_error = False
            except Exception as e:
                logger.error("tool_execution_error", tool=block["name"], error=str(e))
                result = f"Error: {str(e)}"
                is_error = True

            all_tool_calls.append({
                "name": block["name"],
                "input": block["input"],
                "result": result,
                "is_error": is_error,
                "tool_use_id": block["id"],
            })

            content_str = json.dumps(result) if isinstance(result, dict) else str(result)

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block["id"],
                "content": content_str,
                "is_error": is_error,
            })

            yield sse("tool_result", {
                "toolCallId": block["id"],
                "tool": block["name"],
                "success": not is_error,
                "result": result,
                "summary": _safe_truncate(result, max_len=200),
            })

            # Emit a dedicated browser_frame event for live canvas updates
            # when a browser tool result contains a screenshot
            if (
                not is_error
                and isinstance(result, dict)
                and result.get("screenshot")
                and block["name"].startswith("browser_")
            ):
                yield sse("browser_frame", {
                    "screenshot": result["screenshot"],
                    "url": result.get("url", ""),
                    "title": result.get("title", ""),
                })

        messages.append({"role": "user", "content": tool_results})

    # Max iterations
    yield sse("warning", {"message": "Task reached maximum iterations (50)."})
    yield "data: [DONE]\n\n"


def _safe_truncate(data: Any, max_len: int = 500) -> Any:
    if isinstance(data, dict):
        truncated = {}
        for k, v in data.items():
            if isinstance(v, str) and len(v) > max_len:
                truncated[k] = v[:max_len] + "..."
            else:
                truncated[k] = v
        return truncated
    if isinstance(data, str) and len(data) > max_len:
        return data[:max_len] + "..."
    return data


# ============================================================
# OpenAI Pass-through (for non-Claude models)
# ============================================================


async def _stream_openai_passthrough(
    request: CompletionRequest,
    user_id: str,
) -> AsyncGenerator[str, None]:
    client = get_openai_client()
    messages = [
        {"role": "system", "content": request.system_prompt or "You are a helpful AI assistant."},
        {"role": "user", "content": request.prompt or ""},
    ]
    stream = await client.chat.completions.create(
        model=request.model or "gpt-4o",
        messages=messages,
        max_tokens=request.max_tokens,
        temperature=request.temperature,
        stream=True,
    )
    async for chunk in stream:
        if chunk.choices[0].delta.content:
            yield f"data: {json.dumps({'type': 'content', 'content': chunk.choices[0].delta.content})}\n\n"
    yield f"data: {json.dumps({'type': 'done', 'usage': {}})}\n\n"
    yield "data: [DONE]\n\n"


async def _openai_passthrough(
    request: CompletionRequest,
    user_id: str,
) -> CompletionResponse:
    client = get_openai_client()
    messages = [
        {"role": "system", "content": request.system_prompt or "You are a helpful AI assistant."},
        {"role": "user", "content": request.prompt or ""},
    ]
    response = await client.chat.completions.create(
        model=request.model or "gpt-4o",
        messages=messages,
        max_tokens=request.max_tokens,
        temperature=request.temperature,
    )
    choice = response.choices[0]
    return CompletionResponse(
        content=choice.message.content or "",
        model=response.model,
        usage={
            "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
            "completion_tokens": response.usage.completion_tokens if response.usage else 0,
        },
    )
