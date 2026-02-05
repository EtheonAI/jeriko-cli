# Agent Service — Production Architecture

> **VERIFIED against actual codebase — Feb 2026 audit**

## Overview

The agent service (`services/agent/`) is Rubic's AI brain. Python/FastAPI on port 8000. Handles LLM completions, tool execution, task planning, skill loading, and model routing.

**Critical insight from Manus production analysis:** The most successful agent systems do NOT use complex DAG graph frameworks. Manus uses a **sequential planner + executor loop** with ~20 atomic tools and the sandbox filesystem as memory. Their "DAG visualization" is a UI layer over a simple plan, not a graph execution engine. We adopt this proven pattern.

---

## Current State (VERIFIED Feb 2026)

### What EXISTS (817 lines Python)

| File                       | Lines | Status                                                                                                |
| -------------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| `src/main.py`              | 96    | **COMPLETE** — FastAPI with CORS, structured logging, request middleware, 3 routers                   |
| `src/config.py`            | 40    | **COMPLETE** — Pydantic settings with all service URLs + API keys                                     |
| `src/routes/health.py`     | 16    | **STUBBED** — Returns hardcoded "ready", doesn't check dependencies                                   |
| `src/routes/completion.py` | 224   | **COMPLETE** — Streaming works (Anthropic + OpenAI). BUT tools param exists and is NEVER USED         |
| `src/routes/tools.py`      | 439   | **PARTIAL** — 9 tools defined, framework works. 3 stubs (web_search, create_document, generate_image) |

### API Endpoints That Exist

```
GET  /health              → {"status": "ok"}
GET  /ready               → {"status": "ready"} (hardcoded, no dep checks)
POST /v1/complete          → Streaming LLM completion (Anthropic/OpenAI SSE)
GET  /v1/tools             → List native + Composio tools
POST /v1/tools/execute     → Execute a single tool (one-shot, no loop)
```

### What WORKS

- **Streaming completion** — `client.messages.stream()` for Anthropic, `client.chat.completions.create(stream=True)` for OpenAI. SSE format.
- **Tool registry** — 9 tools defined with schemas. `GET /v1/tools` returns them + fetches Composio tools.
- **Tool execution (one-shot)** — `POST /v1/tools/execute` routes to correct handler:
  - `browse_url` — HTTP GET + content extraction (WORKING)
  - `execute_code` — Full E2B sandbox integration: creates sandbox, executes code, returns stdout/stderr (WORKING)
  - `terminal_command` / `file_read` / `file_write` — Forwards to device service (WORKING)
  - Composio tools — Fetches from and executes via connector service (WORKING)
- **Model mapping** — "claude-3-5-sonnet" → "claude-sonnet-4-20250514"
- **Config** — All service URLs configured (sandbox, device, connector, file)

### What's BROKEN / MISSING

1. **NO AGENTIC TOOL LOOP** — `completion.py` accepts `tools: list[dict]` in the request but **NEVER passes them to the LLM**. There is no loop that handles `tool_use` blocks from Claude, executes them, and feeds results back.
2. **NO conversation history** — Each `/v1/complete` call is stateless. No loading from DB, no multi-turn.
3. **NO database integration** — Despite `DATABASE_URL` in config, no queries anywhere.
4. **NO credit deduction** — No billing service calls after completion.
5. **3 tool stubs** — `web_search` (returns empty), `create_document` (hardcoded failure), `generate_image` (hardcoded failure)
6. **NO tool results in response** — `CompletionResponse.tool_calls` is always `None`
7. **NO WebSocket events** — No `message_notify_user` / `message_ask_user` implementation
8. **NO planning system** — No `todo.md` creation, no `should_plan` heuristic
9. **NO skills system** — No skill loading, matching, or progressive injection
10. **NO model routing** — Always uses the model from request (no auto-routing)

### Dependencies (pyproject.toml)

```
fastapi >= 0.115.0, uvicorn, httpx, anthropic >= 0.42.0, openai >= 1.63.0
pydantic >= 2.10.0, pydantic-settings, redis, structlog
e2b >= 1.2.0, e2b-code-interpreter >= 1.0.0
```

### What Downstream Services Are Ready

These services are FULLY IMPLEMENTED and ready for the agent to call:

| Service          | What Agent Calls                                                                  | Status                               |
| ---------------- | --------------------------------------------------------------------------------- | ------------------------------------ |
| Sandbox (4012)   | POST /sandboxes, POST /sandboxes/:id/execute, POST /sandboxes/:id/shell, file ops | **READY** (682 LOC, real E2B)        |
| Device (4001)    | POST /v1/tools/execute, POST /v1/devices/:id/command                              | **READY** (792 LOC, real DB+WS)      |
| Connector (4009) | GET /integrations/:id/tools, POST /integrations/tools/execute                     | **READY** (800 LOC, real Composio)   |
| Knowledge (4011) | POST /query (RAG search)                                                          | **READY** (515 LOC, real embeddings) |
| Billing (4008)   | POST /deduct (credit deduction)                                                   | **PARTIAL** (4 Stripe TODOs)         |
| File (4005)      | POST /upload, GET /files/:id/download                                             | **READY** (492 LOC, real S3)         |

---

## What Needs to Be Built

### Priority 1: Agent Loop (THE critical piece)

Implement `agent_loop()` in a new file `src/routes/agent_loop.py`. This is the difference between "ChatGPT clone" and "Manus competitor".

**Option A (RECOMMENDED): Build the loop in Python agent service**

- Implement `agent_loop()` as described below
- Modify `POST /v1/complete` to use it when tools are provided
- Stream text chunks + tool activity to client via SSE

**Option B: Build the loop in Next.js via Vercel AI SDK**

- Add tools to `streamText()` in `/api/chat/route.ts`
- Use `maxSteps: 10` for multi-step tool execution
- Simpler but less control over context engineering

**Recommended: Option A** — gives us control over cache breakpoints, tool masking, todo.md pattern, credit tracking. The Python service already has the infrastructure (httpx, E2B, streaming).

### Priority 2: Wire 3 Stub Tools

- `web_search` → Serper API (`SERPER_API_KEY` env var)
- `generate_image` → OpenAI DALL-E 3 (already has `openai` package)
- `create_document` → Use sandbox to generate PDFs/docs

### Priority 3: Context Engineering

- Stable system prompt with `cache_control` breakpoints
- Dynamic tool loading (Composio + devices) — once per session
- todo.md planning for multi-step tasks
- Error preservation (is_error flag)

### Priority 4: Session Management

- Conversation history from DB
- Sandbox-per-session lifecycle
- Credit deduction per completion

---

## Architecture: Three Execution Paths

Every request takes one of three paths based on complexity:

### Path 1: Direct Tool Loop (90% of requests — FAST)

```
User message → Context assembly → Model router → Agent loop → Response
```

Simple questions, single-step tasks, quick lookups. No planning overhead. Streams the first token in <500ms.

**Examples:** "What's the weather?", "Summarize this article", "Fix this TypeScript error"

### Path 2: Planned Execution (9% of requests — ACCURATE)

```
User message → Planner creates todo.md → Agent executes plan step-by-step → Verify → Response
```

Multi-step tasks that need a plan. The agent writes a todo.md in the sandbox filesystem, then executes each step, checking items off. The plan is visible in the UI as a "DAG" visualization.

**Examples:** "Build a landing page", "Research competitors and write a report", "Set up a Node.js API with tests"

### Path 3: Orchestrated Execution (~10% of requests — PARALLEL)

```
User message → Orchestrator analyzes → Fan-out workers (max 4/wave) → Artifact store → Synthesize → Verify → Response
```

Tasks with **genuinely independent, parallelizable workstreams**. The orchestrator dynamically decomposes the task into waves of workers. Workers write to an artifact store (filesystem/S3), return references. Workers NEVER talk to each other.

**Research backing:** Google DeepMind found orchestrator-worker improves parallelizable tasks by 80.9%. Anthropic's own multi-agent system outperforms single-agent by 90.2% on research tasks. BUT: sequential reasoning degrades 39-70% with multi-agent — ONLY use for genuinely parallel work.

**Examples:** "Manage social media across Twitter, Instagram, Facebook", "Research 5 competitors and compare them", "Build frontend + backend + write docs simultaneously"

---

## The Agent Loop (Core Engine)

This is the heart of everything. Every path uses this loop.

### How It Works (Anthropic Claude)

```python
# The canonical agentic tool loop for Claude
# Based on Anthropic's official documentation

import anthropic
import json

MAX_ITERATIONS = 50  # Manus averages ~50 tool calls per complex task

async def agent_loop(
    client: anthropic.AsyncAnthropic,
    messages: list[dict],
    system_prompt: str,
    tools: list[dict],
    model: str,
    max_tokens: int = 4096,
    execute_tool_fn = None,  # async (name, input) -> result
    on_text_chunk = None,    # async (text) -> None (for streaming to client)
    on_tool_start = None,    # async (name, input) -> None
    on_tool_result = None,   # async (name, result) -> None
) -> dict:
    """
    Full agentic loop with streaming text and tool execution.
    Returns final text content and all tool calls made.
    """
    all_tool_calls = []
    total_input_tokens = 0
    total_output_tokens = 0
    total_cache_read = 0
    total_cache_create = 0

    for iteration in range(MAX_ITERATIONS):
        # Use streaming for text output, collect tool_use blocks
        collected_text = []
        tool_use_blocks = []
        current_tool_json = ""

        async with client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            system=[
                {"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}
            ],
            tools=tools,
            messages=messages,
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
                        collected_text.append(event.delta.text)
                        if on_text_chunk:
                            await on_text_chunk(event.delta.text)
                    elif hasattr(event.delta, "partial_json"):
                        current_tool_json += event.delta.partial_json
                elif event.type == "content_block_stop":
                    if tool_use_blocks and current_tool_json:
                        try:
                            tool_use_blocks[-1]["input"] = json.loads(current_tool_json)
                        except json.JSONDecodeError:
                            tool_use_blocks[-1]["input"] = {"raw": current_tool_json}
                        current_tool_json = ""

            # Get usage from final message
            final_msg = stream.get_final_message()
            total_input_tokens += final_msg.usage.input_tokens
            total_output_tokens += final_msg.usage.output_tokens
            if hasattr(final_msg.usage, "cache_read_input_tokens"):
                total_cache_read += final_msg.usage.cache_read_input_tokens
            if hasattr(final_msg.usage, "cache_creation_input_tokens"):
                total_cache_create += final_msg.usage.cache_creation_input_tokens

        # Build assistant content for message history
        assistant_content = []
        if collected_text:
            assistant_content.append({"type": "text", "text": "".join(collected_text)})
        assistant_content.extend(tool_use_blocks)

        # No tool calls = done
        if not tool_use_blocks:
            return {
                "content": "".join(collected_text),
                "tool_calls": all_tool_calls,
                "iterations": iteration + 1,
                "usage": {
                    "input_tokens": total_input_tokens,
                    "output_tokens": total_output_tokens,
                    "cache_read_tokens": total_cache_read,
                    "cache_create_tokens": total_cache_create,
                },
            }

        # Append assistant message
        messages.append({"role": "assistant", "content": assistant_content})

        # Execute tools — ALL results in a SINGLE user message
        # (Anthropic requirement for parallel tool use)
        tool_results = []
        for block in tool_use_blocks:
            if on_tool_start:
                await on_tool_start(block["name"], block["input"])

            try:
                result = await execute_tool_fn(block["name"], block["input"])
                is_error = False
            except Exception as e:
                result = f"Error: {str(e)}"
                is_error = True

            all_tool_calls.append({
                "name": block["name"],
                "input": block["input"],
                "result": result,
                "is_error": is_error,
            })

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block["id"],
                "content": json.dumps(result) if isinstance(result, dict) else str(result),
                "is_error": is_error,  # Claude adapts when it sees errors
            })

            if on_tool_result:
                await on_tool_result(block["name"], result, is_error)

        # tool_result blocks MUST come first in the content array
        messages.append({"role": "user", "content": tool_results})

    # Max iterations reached
    return {
        "content": "".join(collected_text) if collected_text else "Task reached maximum iterations.",
        "tool_calls": all_tool_calls,
        "iterations": MAX_ITERATIONS,
        "max_iterations_reached": True,
        "usage": {
            "input_tokens": total_input_tokens,
            "output_tokens": total_output_tokens,
            "cache_read_tokens": total_cache_read,
            "cache_create_tokens": total_cache_create,
        },
    }
```

---

## Context Engineering (The #1 Cost & Accuracy Lever)

These techniques come directly from Manus's production blog and Anthropic's documentation. They are not optional — they are the difference between a $5 task and a $0.50 task.

### Rule 1: Stable System Prompt Prefix

The system prompt MUST be identical across all turns in a conversation. Every change invalidates the KV-cache, and you re-pay for all those tokens at 10x the cached price.

**DO:**

- Put tool definitions in system prompt (they're static per session)
- Put skill registry in system prompt
- Put behavioral rules in system prompt
- Use `cache_control: {"type": "ephemeral"}` on the system prompt

**DON'T:**

- Add timestamps to the system prompt
- Dynamically add/remove tool definitions mid-conversation
- Change the system prompt between turns
- Put conversation-specific data in the system prompt

**Cache hierarchy (Anthropic):** `tools` → `system` → `messages`. Changes at any level invalidate that level and everything after it.

### Rule 2: Tool Masking, Not Tool Removal

When a tool shouldn't be used in the current step, DON'T remove it from the tool list (this changes the cache prefix). Instead, add an instruction in the system prompt:

```
## Current Step Constraints
Do not use browser_* tools in this step. Focus on file operations only.
```

Manus uses consistent tool naming prefixes (`browser_*`, `shell_*`, `file_*`) so constraint enforcement works via simple string matching.

### Rule 3: Filesystem-as-Memory (The Core Pattern)

The sandbox filesystem IS the agent's memory. Not a database, not Redis, not the context window.

**Why:** Context windows are limited (128K tokens), expensive, and model performance degrades with long contexts. The filesystem is unlimited, persistent, and directly operable.

**Implementation:**

```
/home/user/
  todo.md              # Current plan with progress (rewritten each step)
  context/             # Intermediate results from each step
    step_1_research.md
    step_2_analysis.json
  output/              # Final artifacts for the user
    report.pdf
    website/
  errors.log           # Errors encountered (NEVER delete — see Rule 5)
```

**Restorable compression:** When context gets long, drop large observations but keep URLs/file paths. The agent can re-fetch the URL or re-read the file if needed. This compresses context without permanent information loss.

### Rule 4: The todo.md Pattern (Attention Manipulation)

After ~50 tool calls, the original user request is buried deep in the context where attention is weakest. The todo.md pattern fixes this.

**How it works:**

1. Agent writes `todo.md` at task start with a structured checklist
2. After EACH step, agent reads and rewrites `todo.md` with the completed item checked off
3. The most recent `file_write` of `todo.md` appears at the TAIL of the context — in the attention hotspot
4. This "recites" the global plan into the model's recent attention span

**Example:**

```markdown
# Task: Build a React landing page with contact form

## Steps

- [x] Step 1: Create React project with Vite (completed)
- [x] Step 2: Install Tailwind CSS and configure (completed)
- [x] Step 3: Create Hero section component (completed)
- [ ] Step 4: Create Contact form with validation ← CURRENT
- [ ] Step 5: Add responsive design
- [ ] Step 6: Test in browser
- [ ] Step 7: Deploy and share URL
```

Anthropic developed the same pattern independently as `claude-progress.txt` for their long-running agent harness.

### Rule 5: Keep Errors in Context

**NEVER erase failures.** When the model sees its own failed actions and stack traces, it implicitly updates its beliefs and avoids repeating the same mistakes.

```python
# When a tool returns an error:
tool_results.append({
    "type": "tool_result",
    "tool_use_id": block["id"],
    "content": f"Error: {error_message}\nStack trace: {traceback}",
    "is_error": True,  # Claude specifically handles this flag
})
# Claude will adapt its approach — retry with different parameters,
# try an alternative tool, or explain the issue to the user.
```

### Rule 6: Break Repetitive Patterns

When the agent performs similar actions repeatedly (reviewing multiple files, processing multiple items), vary the serialization format slightly to prevent the model from falling into imitative patterns and drifting.

### Rule 7: Anthropic Cache Breakpoints

Place `cache_control` on exactly three points:

1. **Last tool definition** — caches all tool schemas
2. **End of system prompt** — caches instructions + rules
3. **Last message in conversation** — caches conversation history

```python
system=[
    {
        "type": "text",
        "text": system_prompt,
        "cache_control": {"type": "ephemeral"}  # 5-min TTL, refreshed on use
    }
]

# For multi-hour agentic sessions, use 1-hour TTL:
# "cache_control": {"type": "ephemeral", "ttl": "1h"}
```

**Monitor cache performance** in every response:

- `cache_read_input_tokens` — cache HIT (10x cheaper)
- `cache_creation_input_tokens` — cache MISS (1.25x base cost)
- `input_tokens` — uncached tokens after last breakpoint

**Target:** >80% cache hit rate on input tokens.

---

## Tool Definitions (The ~20 Atomic Tools)

Manus uses ~20 atomic tools. Complex actions are composed through code execution in the sandbox. We follow the same pattern.

### Core Tools (Always Available)

```python
TOOLS = [
    # === Communication ===
    {
        "name": "message_notify_user",
        "description": "Send a progress update or message to the user. Use this to keep the user informed about what you're doing, especially for long-running tasks. Do NOT use this for final results — just return text normally for that.",
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "The message to send"},
                "type": {"type": "string", "enum": ["info", "progress", "warning", "error"], "default": "info"},
            },
            "required": ["message"],
        },
    },
    {
        "name": "message_ask_user",
        "description": "Ask the user a question when you need clarification, a decision, or approval before proceeding. Use this when the next step is ambiguous or requires user input.",
        "input_schema": {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "options": {"type": "array", "items": {"type": "string"}, "description": "Optional multiple-choice options"},
            },
            "required": ["question"],
        },
    },

    # === File System ===
    {
        "name": "file_read",
        "description": "Read the contents of a file from the sandbox filesystem. Use this to read code, configuration, data files, or any text content. Returns the file content as a string. For binary files, returns base64-encoded content.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute path to the file"},
                "encoding": {"type": "string", "default": "utf-8"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "file_write",
        "description": "Write content to a file in the sandbox filesystem. Creates the file if it doesn't exist, overwrites if it does. Use this for creating new files, updating code, saving data, or writing the todo.md plan.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute path to the file"},
                "content": {"type": "string", "description": "Content to write"},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "file_str_replace",
        "description": "Replace a specific string in a file. More precise than rewriting the entire file. Use for targeted code edits, configuration changes, or content updates.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "old_str": {"type": "string", "description": "The exact string to find"},
                "new_str": {"type": "string", "description": "The replacement string"},
            },
            "required": ["path", "old_str", "new_str"],
        },
    },

    # === Shell / Code Execution ===
    {
        "name": "shell_exec",
        "description": "Execute a shell command in the sandbox terminal. Use for: installing packages (npm, pip, apt-get), running builds, starting dev servers, git operations, file system operations (mkdir, cp, mv, ls), and any terminal command. Commands run with sudo privileges. Use -y flag for package installs to avoid confirmation prompts. For long-running commands, use & to background them.",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "The shell command to execute"},
                "timeout": {"type": "integer", "default": 30, "description": "Timeout in seconds"},
            },
            "required": ["command"],
        },
    },
    {
        "name": "code_execute",
        "description": "Execute a code snippet in the sandbox. Supports Python, JavaScript, and Bash. Use for data processing, calculations, testing code snippets, or running scripts. Returns stdout, stderr, and exit code.",
        "input_schema": {
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "language": {"type": "string", "enum": ["python", "javascript", "bash"], "default": "python"},
                "timeout": {"type": "integer", "default": 30},
            },
            "required": ["code"],
        },
    },

    # === Web / Browser ===
    {
        "name": "web_search",
        "description": "Search the web for information. Returns titles, URLs, and snippets. Use for finding current information, researching topics, looking up documentation, or finding solutions to technical problems.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "num_results": {"type": "integer", "default": 5, "maximum": 10},
            },
            "required": ["query"],
        },
    },
    {
        "name": "browser_navigate",
        "description": "Navigate to a URL in the sandbox browser. Use for fetching web pages, previewing built websites, or accessing web applications. Returns the page content as text.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string"},
            },
            "required": ["url"],
        },
    },
    {
        "name": "browser_screenshot",
        "description": "Take a screenshot of the current browser page. Returns the screenshot as a base64-encoded image. Use for verifying website builds, checking UI rendering, or capturing visual content.",
        "input_schema": {
            "type": "object",
            "properties": {
                "full_page": {"type": "boolean", "default": false},
            },
        },
    },

    # === Deployment ===
    {
        "name": "deploy_expose_port",
        "description": "Expose a local port in the sandbox to a public URL. Use after starting a dev server (e.g., on port 3000) to share the result with the user. Returns the public URL.",
        "input_schema": {
            "type": "object",
            "properties": {
                "port": {"type": "integer", "description": "The local port to expose (e.g., 3000, 8080)"},
                "name": {"type": "string", "description": "A name for this deployment"},
            },
            "required": ["port"],
        },
    },

    # === Image Generation ===
    {
        "name": "generate_image",
        "description": "Generate an image using DALL-E 3. Use for creating illustrations, diagrams, logos, or any visual content the user requests. Returns the image URL and saves it to the sandbox.",
        "input_schema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "Detailed description of the image to generate"},
                "size": {"type": "string", "enum": ["1024x1024", "1792x1024", "1024x1792"], "default": "1024x1024"},
            },
            "required": ["prompt"],
        },
    },

    # === Employee Mode: Recurring Tasks ===
    {
        "name": "schedule_recurring_task",
        "description": "Schedule a task to run automatically on a recurring basis. Use this when the user wants ongoing/continuous work (e.g., 'post to social media every week', 'check email daily', 'monitor competitors'). Creates an automated task that runs without user intervention.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Name for this recurring task"},
                "description": {"type": "string", "description": "What the agent should do each time"},
                "skill_id": {"type": "string", "description": "Skill to execute (from a previously created skill)"},
                "schedule": {"type": "string", "enum": ["daily", "weekly", "biweekly", "monthly"]},
                "day_of_week": {"type": "string", "description": "For weekly: monday, tuesday, etc."},
                "time": {"type": "string", "description": "Time in user's timezone, e.g., '09:00'"},
                "duration": {"type": "string", "description": "How long: '3 months', '6 months', 'indefinite'"},
            },
            "required": ["name", "description", "schedule"],
        },
    },

    # === Outcome Tracking ===
    {
        "name": "check_outcomes",
        "description": "Check the results/engagement/analytics of previously completed work. Use at the start of recurring tasks to learn what worked and adjust strategy. Works with social media analytics, email metrics, website traffic, etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "source": {"type": "string", "enum": ["social_media", "email", "website", "custom"]},
                "platform": {"type": "string", "description": "Specific platform: twitter, instagram, etc."},
                "timeframe": {"type": "string", "default": "last_7_days"},
            },
            "required": ["source"],
        },
    },
]
```

**Total: ~20 core tools** — matches the Manus pattern. Complex actions are composed through sandbox code execution, not more tools.

### Dynamic Tools (Loaded per User)

These are added to the tool list based on the user's connected apps and devices:

```python
async def get_dynamic_tools(user_id: str) -> list[dict]:
    """Fetch Composio tools and device tools for this user."""
    tools = []

    # Composio tools — from connector service
    composio_tools = await fetch_composio_tools(user_id)
    for tool in composio_tools:
        tools.append({
            "name": f"app_{tool['app_name']}_{tool['action']}",  # e.g., app_github_create_issue
            "description": tool["description"],
            "input_schema": tool["parameters"],
            "_source": "composio",
            "_app_name": tool["app_name"],
        })

    # Device tools — from device service
    devices = await fetch_user_devices(user_id)
    for device in devices:
        if device["status"] == "online":
            tools.append({
                "name": f"device_{device['id']}_command",
                "description": f"Execute a command on {device['name']} ({device['type']}). "
                    f"This is a real device — commands have real consequences. "
                    f"Always confirm destructive actions with the user first.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string"},
                        "require_approval": {"type": "boolean", "default": True},
                    },
                    "required": ["command"],
                },
                "_source": "device",
                "_device_id": device["id"],
            })

    return tools
```

**Important:** Dynamic tools are loaded ONCE at session start and cached. They are NOT reloaded between turns (this would break KV-cache).

---

## Tool Execution Router

```python
async def execute_tool(name: str, input: dict, context: ExecutionContext) -> dict:
    """Route tool execution to the appropriate handler."""

    # File operations → sandbox service
    if name in ("file_read", "file_write", "file_str_replace"):
        return await sandbox_file_operation(context.sandbox_id, name, input)

    # Shell/code execution → sandbox service
    if name in ("shell_exec", "code_execute"):
        return await sandbox_execute(context.sandbox_id, name, input)

    # Web search → Serper API
    if name == "web_search":
        return await serper_search(input["query"], input.get("num_results", 5))

    # Browser → sandbox browser (via E2B)
    if name.startswith("browser_"):
        return await sandbox_browser(context.sandbox_id, name, input)

    # Deploy → sandbox port exposure (via E2B)
    if name == "deploy_expose_port":
        return await sandbox_expose_port(context.sandbox_id, input["port"])

    # Image generation → OpenAI DALL-E
    if name == "generate_image":
        return await dalle_generate(input["prompt"], input.get("size", "1024x1024"))

    # User communication → WebSocket
    if name in ("message_notify_user", "message_ask_user"):
        return await send_to_user(context.user_id, context.session_id, name, input)

    # Composio tools (prefixed with app_)
    if name.startswith("app_"):
        return await composio_execute(context.user_id, name, input)

    # Device tools (prefixed with device_)
    if name.startswith("device_"):
        return await device_execute(context.user_id, name, input)

    # Employee mode: recurring tasks
    if name == "schedule_recurring_task":
        return await create_recurring_task(context.user_id, context.session_id, input)

    # Outcome tracking
    if name == "check_outcomes":
        return await execute_check_outcomes(context.user_id, input)

    return {"error": f"Unknown tool: {name}"}
```

---

## Website Building (How It Actually Works)

This is the exact pattern Manus uses, adapted for Rubic:

### Step-by-Step Flow

1. **User asks:** "Build me a React landing page for a SaaS product"

2. **Agent creates sandbox** (or reuses existing session sandbox)

3. **Agent writes todo.md:**

```markdown
# Task: Build React landing page for SaaS product

- [ ] Create React project with Vite
- [ ] Install and configure Tailwind CSS
- [ ] Create Hero section with headline and CTA
- [ ] Create Features section with 3 feature cards
- [ ] Create Pricing section
- [ ] Create Contact form
- [ ] Add responsive design
- [ ] Start dev server and preview
- [ ] Deploy and share URL
```

4. **Agent executes plan step by step:**

```
shell_exec: npm create vite@latest website -- --template react-ts
shell_exec: cd website && npm install
shell_exec: cd website && npm install -D tailwindcss @tailwindcss/vite
file_write: /home/user/website/src/App.tsx → [hero section code]
file_write: /home/user/website/src/components/Features.tsx → [features code]
file_write: /home/user/website/src/components/Pricing.tsx → [pricing code]
file_write: /home/user/website/src/components/Contact.tsx → [contact form code]
file_str_replace: /home/user/website/todo.md → [check off completed items]
shell_exec: cd website && npm run dev -- --host 0.0.0.0 --port 3000 &
browser_navigate: http://localhost:3000
browser_screenshot: [verify the page renders correctly]
deploy_expose_port: 3000
message_notify_user: "Your landing page is live at https://..."
```

5. **Agent updates todo.md** after each step, checking items off

6. **Agent verifies** by taking a screenshot and checking the result

7. **Agent delivers** the public URL to the user

### Tool Implementation for Website Building

All website building happens through `shell_exec`, `file_write`, `file_str_replace`, and `deploy_expose_port`. There is NO special "website builder" tool — the agent composes complex behavior through atomic operations in the sandbox.

The `deploy_expose_port` tool maps to E2B's sandbox URL exposure:

```python
async def sandbox_expose_port(sandbox_id: str, port: int) -> dict:
    """Expose a sandbox port to a public URL via E2B."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.sandbox_service_url}/sandboxes/{sandbox_id}/expose",
            json={"port": port},
        )
        data = resp.json()
        return {
            "url": data["url"],
            "port": port,
            "message": f"Website is live at {data['url']}",
        }
```

---

## Planning System

### When to Plan

The agent decides whether to create a plan based on task complexity:

```python
PLANNING_TRIGGERS = [
    "build", "create", "develop", "implement", "set up", "design",
    "write a report", "research and", "analyze", "multiple steps",
    "full-stack", "website", "application", "deploy",
]

def should_plan(prompt: str) -> bool:
    """Simple heuristic: plan if the task seems multi-step."""
    prompt_lower = prompt.lower()
    return any(trigger in prompt_lower for trigger in PLANNING_TRIGGERS)
```

### Planning Prompt

Add this to the system prompt when planning is triggered:

```
## Planning Rules
When you receive a complex multi-step task:
1. FIRST, use file_write to create /home/user/todo.md with a structured checklist
2. Each step should be specific and actionable
3. After completing each step, use file_read then file_write to update todo.md (check off completed items)
4. If a step fails, note the error in todo.md and adapt the plan
5. At the end, verify all items are checked off
```

This is injected into the system prompt, NOT a separate planner agent. The same agent plans AND executes. This is how Manus works and it's simpler and faster than a separate planning service.

---

## Skills System (User-Uploaded + Agent-Created)

Skills are reusable workflows. Users upload them. **The agent also creates them automatically** when it detects a recurring pattern.

### Skill Format

```
skills/
  my-skill/
    SKILL.md           # Instructions for the agent (loaded into context when triggered)
    metadata.json      # Name, triggers, parameters, estimated credits
    scripts/           # Optional executable scripts (run in sandbox)
    resources/         # Optional reference data, templates
```

### Progressive Loading (Critical for Low Overhead)

**Stage 1 — Registry (~100 tokens per skill, always in system prompt):**

```
## Available Skills
- web-scraper: Extract structured data from websites (triggers: scrape, extract data)
- weekly-social-media: Generate and schedule social media posts (triggers: social media, posts)
- code-reviewer: Review code for bugs and improvements (triggers: review, code review)
```

**Stage 2 — Instructions (loaded when skill is triggered, 2K-5K tokens):**
When the agent's response indicates using a skill, inject the full SKILL.md into the next user message as context.

**Stage 3 — Resources (loaded on demand into sandbox):**
Scripts and data files are written to the sandbox filesystem when needed.

This three-stage system means 50 skills cost only ~5K tokens in the system prompt (registry only). Full instructions load ONLY when triggered. This is how we keep overhead low.

### Skill Matching

```python
def match_skills(prompt: str, registry: dict[str, SkillMetadata]) -> list[str]:
    """Match user prompt against skill triggers."""
    prompt_lower = prompt.lower()
    matches = []
    for skill_id, meta in registry.items():
        if any(trigger in prompt_lower for trigger in meta.triggers):
            matches.append(skill_id)
    return matches
```

### Agent-Created Skills (Self-Learning)

The agent can create skills automatically when it detects recurring patterns:

```python
async def maybe_create_skill(
    user_id: str,
    session_id: str,
    task_summary: str,
    tool_calls: list[dict],
    iterations: int,
) -> dict | None:
    """
    After completing a multi-step task, check if this should become a reusable skill.

    Triggers:
    - User has done a similar task 2+ times (check telemetry)
    - Task took 5+ tool calls (complex enough to be worth saving)
    - Task succeeded (don't save failed workflows)
    """
    # Check if user has done similar tasks before
    similar_count = await db.fetchval("""
        SELECT COUNT(*) FROM execution_telemetry
        WHERE user_id = $1
        AND similarity(task_summary, $2) > 0.6
        AND success = TRUE
        AND created_at > NOW() - INTERVAL '30 days'
    """, user_id, task_summary)

    if similar_count < 2 or iterations < 5:
        return None  # Not recurring enough

    # Generate skill definition using a cheap model (Haiku)
    skill_def = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": f"""Create a reusable skill definition from this completed task.

Task: {task_summary}
Tools used: {[t['name'] for t in tool_calls]}
Steps: {iterations}

Return JSON:
{{
    "name": "short-name",
    "description": "What this skill does",
    "triggers": ["keyword1", "keyword2"],
    "instructions": "Step-by-step instructions for the agent to repeat this task"
}}"""}],
    )

    skill = json.loads(skill_def.content[0].text)

    # Save to database
    await db.execute("""
        INSERT INTO skills (id, author_id, name, slug, description, instructions, triggers, source, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'agent_created', 'active')
    """, create_id(), user_id, skill["name"], slugify(skill["name"]),
         skill["description"], skill["instructions"], json.dumps(skill["triggers"]))

    # Notify user
    await send_to_user(user_id, session_id, "message_notify_user", {
        "message": f"I noticed you do this often. I've saved '{skill['name']}' as a reusable skill. Next time just say '{skill['triggers'][0]}' and I'll handle it automatically.",
        "type": "info",
    })

    return skill
```

### Database Schema for Skills

```sql
CREATE TABLE skills (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    version TEXT DEFAULT '1.0.0',
    description TEXT,
    instructions TEXT,                -- Full SKILL.md content
    triggers JSONB DEFAULT '[]',
    parameters JSONB DEFAULT '{}',
    tools_required JSONB DEFAULT '[]',
    estimated_credits INTEGER DEFAULT 1,
    tags JSONB DEFAULT '[]',
    source TEXT DEFAULT 'user',       -- 'user' | 'agent_created' | 'builtin' | 'marketplace'
    is_public BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    install_count INTEGER DEFAULT 0,
    rating REAL,
    storage_key TEXT,                 -- S3 key for scripts/resources
    status TEXT DEFAULT 'draft',      -- draft, active, disabled
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_skills (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    skill_id TEXT NOT NULL REFERENCES skills(id),
    is_enabled BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}',
    installed_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Self-Updating Memory (Per-User Learning)

The agent remembers user preferences, brand voice, what worked, and what didn't. This memory updates automatically — no user action required.

### Memory Storage

```sql
CREATE TABLE agent_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,           -- 'preference' | 'brand' | 'pattern' | 'correction'
    key TEXT NOT NULL,                -- e.g., "writing_tone", "preferred_hashtags"
    value JSONB NOT NULL,             -- The actual memory content
    confidence REAL DEFAULT 0.5,      -- 0-1, increases with reinforcement
    source TEXT DEFAULT 'observed',   -- 'observed' | 'explicit' | 'corrected'
    last_used_at TIMESTAMPTZ,
    use_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category, key)
);
```

### How Memory Gets Created (Automatic)

```python
MEMORY_EXTRACTORS = {
    # After the agent generates content and user says "make it more casual"
    "correction": {
        "triggers": ["make it more", "change the tone", "too formal", "too casual",
                     "I prefer", "always use", "don't use", "my brand"],
        "action": "extract_preference_correction",
    },
    # After agent uses a tool successfully for the user
    "pattern": {
        "triggers": None,  # Automatic — runs after every successful task
        "action": "extract_usage_pattern",
    },
}

async def extract_and_store_memories(
    user_id: str,
    messages: list[dict],
    tool_calls: list[dict],
) -> None:
    """
    Run after each agent_loop completion.
    Uses Haiku (cheapest model) to extract memories — costs <$0.001 per extraction.
    Only runs if conversation had 3+ turns (enough signal).
    """
    if len(messages) < 6:  # 3 turns = 6 messages (user + assistant)
        return

    # Extract using Haiku — CHEAP
    extraction = await client.messages.create(
        model="claude-haiku-4-5-20251001",  # $0.80/MTok — negligible cost
        max_tokens=512,
        messages=[{"role": "user", "content": f"""Extract user preferences from this conversation.
Only extract CLEAR preferences, not guesses. Return JSON array:
[{{"category": "preference|brand|pattern|correction",
   "key": "short_key_name",
   "value": "the preference",
   "confidence": 0.5-1.0}}]

Return [] if no clear preferences found.

Last 3 messages: {json.dumps(messages[-6:])}"""}],
    )

    memories = json.loads(extraction.content[0].text)
    for mem in memories:
        # Upsert — if memory exists, increase confidence
        await db.execute("""
            INSERT INTO agent_memory (id, user_id, category, key, value, confidence, source)
            VALUES ($1, $2, $3, $4, $5, $6, 'observed')
            ON CONFLICT (user_id, category, key) DO UPDATE SET
                value = $5,
                confidence = LEAST(agent_memory.confidence + 0.1, 1.0),
                use_count = agent_memory.use_count + 1,
                updated_at = NOW()
        """, create_id(), user_id, mem["category"], mem["key"],
             json.dumps(mem["value"]), mem["confidence"])
```

### How Memory Gets Used (Injected Into System Prompt)

```python
async def get_user_memory_context(user_id: str) -> str:
    """
    Load high-confidence memories into system prompt.
    Only loads memories with confidence > 0.6 and used in last 30 days.
    Typically 200-500 tokens — minimal overhead.
    """
    memories = await db.fetch("""
        SELECT category, key, value FROM agent_memory
        WHERE user_id = $1 AND confidence > 0.6
        AND (last_used_at > NOW() - INTERVAL '30 days' OR use_count > 3)
        ORDER BY confidence DESC, use_count DESC
        LIMIT 20
    """, user_id)

    if not memories:
        return ""

    sections = {"preference": [], "brand": [], "pattern": [], "correction": []}
    for m in memories:
        sections[m["category"]].append(f"- {m['key']}: {json.loads(m['value'])}")

    context = "\n## What I Know About You\n"
    if sections["brand"]:
        context += "Brand: " + "; ".join(s.split(": ", 1)[1] for s in sections["brand"]) + "\n"
    if sections["preference"]:
        context += "Preferences: " + "; ".join(s.split(": ", 1)[1] for s in sections["preference"]) + "\n"
    if sections["correction"]:
        context += "Remember: " + "; ".join(s.split(": ", 1)[1] for s in sections["correction"]) + "\n"

    return context
```

### Memory Decay

Unused memories decay automatically. A weekly cron job:

```python
async def decay_memories():
    """Reduce confidence of unused memories. Delete very low ones."""
    await db.execute("""
        UPDATE agent_memory SET confidence = confidence * 0.95
        WHERE last_used_at < NOW() - INTERVAL '14 days'
    """)
    await db.execute("""
        DELETE FROM agent_memory WHERE confidence < 0.2
    """)
```

### Cost Impact

- Memory extraction: Haiku call with ~500 tokens input = **~$0.0004 per conversation**
- Memory loading: ~300 tokens added to system prompt = **cached after first turn, free thereafter**
- Total overhead: **<$0.001 per conversation** — negligible

---

## Proactive Agent Behavior (Smart + Autonomous)

The agent doesn't just respond — it proactively suggests, warns, and acts.

### Missing Integration Detection

```python
async def check_missing_integrations(
    user_id: str,
    prompt: str,
    connected_apps: list[str],
) -> str | None:
    """
    If user asks for something that requires an unconnected app, suggest it.
    Runs BEFORE the agent loop — zero overhead if no suggestion needed.
    """
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

    prompt_lower = prompt.lower()
    suggestions = []

    for app, keywords in PLATFORM_KEYWORDS.items():
        if any(kw in prompt_lower for kw in keywords):
            if app not in connected_apps:
                suggestions.append(app)

    if suggestions:
        return (
            f"I notice you want to work with {', '.join(suggestions)}, "
            f"but {'it is' if len(suggestions) == 1 else 'they are'} not connected yet. "
            f"Would you like to connect {'it' if len(suggestions) == 1 else 'them'} now? "
            f"Go to Settings → Applications to connect."
        )
    return None
```

### Proactive Suggestions in System Prompt

Add to the system prompt behavioral rules:

```
## Proactive Behavior
- If the user's task would benefit from a connected app they don't have, suggest connecting it
- If you notice a recurring task pattern, suggest creating a skill for it
- If you complete a task, suggest related follow-ups ("Want me to also schedule these posts?")
- If a tool fails, explain what went wrong and suggest alternatives — don't just retry silently
- If the user asks for something across platforms, proactively check which ones are connected
```

---

## Model Routing (Optimized for Cost)

### Three-Tier System

```python
MODELS = {
    "fast": "claude-haiku-4-5-20251001",       # $0.80/MTok in, $4/MTok out — 18x cheaper than Opus
    "balanced": "claude-sonnet-4-5-20250929",   # $3/MTok in, $15/MTok out
    "powerful": "claude-opus-4-5-20251101",     # $15/MTok in, $75/MTok out — reserve for high-value
}

# COST-FIRST routing: default to cheapest model that can handle the task
ROUTING_RULES = {
    "fast": [
        # Haiku handles these well — use it aggressively
        "simple questions", "formatting", "extraction", "summarize",
        "file operations", "todo.md updates", "status checks",
        "memory extraction", "skill matching", "scheduling",
        "translation", "data formatting", "json generation",
    ],
    "balanced": [
        # Sonnet for anything requiring reasoning
        "code generation", "debugging", "analysis",
        "planning", "web research synthesis", "content creation",
        "multi-step reasoning", "social media posts", "blog writing",
    ],
    "powerful": [
        # Opus ONLY for orchestration planning or very complex reasoning
        "architecture design", "complex multi-file debugging",
        "orchestration planning", "scientific analysis",
    ],
}

# CRITICAL COST RULES:
# - Main agent loop: Sonnet (default) or Haiku (simple tasks)
# - Worker agents: Haiku for content/scheduling, Sonnet for code/research
# - Orchestrator planning: Sonnet (NOT Opus — Sonnet is good enough)
# - Memory extraction: ALWAYS Haiku
# - Skill creation: ALWAYS Haiku
# - Opus: Only when user explicitly requests "powerful" mode

WORKER_MODEL_RULES = {
    "content_writer": "claude-haiku-4-5-20251001",    # Haiku writes great social media content
    "scheduler": "claude-haiku-4-5-20251001",          # Scheduling is mechanical
    "researcher": "claude-sonnet-4-5-20250929",        # Research needs reasoning
    "designer": "claude-sonnet-4-5-20250929",          # Design prompts need creativity
    "coder": "claude-sonnet-4-5-20250929",             # Code needs accuracy
    "default": "claude-haiku-4-5-20251001",            # Default workers to Haiku
}

def route_model(task_type: str, user_preference: str | None = None) -> str:
    """Select model based on task complexity. User can override."""
    if user_preference:
        return MODELS.get(user_preference, MODELS["balanced"])

    for tier, keywords in ROUTING_RULES.items():
        if any(kw in task_type.lower() for kw in keywords):
            return MODELS[tier]

    return MODELS["balanced"]  # Default to Sonnet

def route_worker_model(worker_role: str) -> str:
    """Select cheapest model that can handle the worker's role."""
    return WORKER_MODEL_RULES.get(worker_role, WORKER_MODEL_RULES["default"])
```

### Cost Comparison (Why This Matters)

```
Task: "Create social media posts for 3 platforms"

WITHOUT cost routing (all Sonnet):
  Orchestrator: 10K tokens × $3/MTok = $0.03
  4 workers × 8K tokens × $3/MTok = $0.096
  Total: ~$0.13

WITH cost routing (Haiku workers):
  Orchestrator: 10K tokens × $3/MTok = $0.03
  4 workers × 8K tokens × $0.80/MTok = $0.026
  Total: ~$0.056 (57% cheaper)

WITH cache hits (>80% hit rate):
  Most input tokens cached at $0.30/MTok
  Total: ~$0.02 (85% cheaper than naive approach)
```

### Cost Tracking

Every agent loop call tracks and returns token usage. After the loop completes:

```python
async def deduct_credits(user_id: str, usage: dict, tools_used: list) -> None:
    """Deduct credits based on usage."""
    # Token-based cost (from usage dict)
    token_credits = calculate_token_credits(
        usage["input_tokens"],
        usage["output_tokens"],
        usage["cache_read_tokens"],
        model_tier,
    )

    # Tool-based cost
    tool_credits = sum(TOOL_CREDIT_COSTS.get(t["name"], 0) for t in tools_used)

    total = token_credits + tool_credits

    # Call billing service
    await billing_service.deduct(user_id, total, metadata={
        "session_id": session_id,
        "model": model,
        "iterations": iterations,
        "tools_used": [t["name"] for t in tools_used],
    })
```

---

## Sandbox Management

### One Sandbox Per Session

Each agent session gets a single E2B sandbox. This sandbox persists for the duration of the session (up to 24h active, 14 days paused).

```python
async def get_or_create_sandbox(session_id: str, user_id: str) -> str:
    """Get existing sandbox for session, or create a new one."""
    # Check DB for existing sandbox
    existing = await db.fetchrow(
        "SELECT id, e2b_sandbox_id, status FROM sandboxes WHERE agent_session_id = $1 AND status = 'running'",
        session_id,
    )
    if existing:
        return existing["id"]

    # Create new sandbox via sandbox service
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.sandbox_service_url}/sandboxes",
            json={
                "userId": user_id,
                "agentSessionId": session_id,
                "config": {"timeout": 3600, "memory": 512},
            },
        )
        return resp.json()["id"]
```

### Pause/Resume for Long Tasks

```python
async def pause_session(session_id: str) -> None:
    """Pause sandbox and save state for later resume."""
    sandbox = await get_sandbox_for_session(session_id)
    if sandbox:
        await sandbox_service.pause(sandbox["id"])
        # The todo.md and all files persist in the paused sandbox
        # E2B preserves full VM state for up to 14 days

async def resume_session(session_id: str) -> None:
    """Resume a paused sandbox."""
    sandbox = await get_sandbox_for_session(session_id)
    if sandbox:
        await sandbox_service.resume(sandbox["id"])
        # Agent reads todo.md to know where it left off
```

---

## Employee Mode (Recurring + Continuous Tasks)

This is the critical difference between an "assistant" (answers when asked) and an "employee" (works autonomously on ongoing tasks).

### How It Works

When a user says "handle my social media every week" or "monitor competitors daily," the agent:

1. **Executes the task once** (normal agent loop / orchestrator)
2. **Creates a skill** from the completed task (auto-skill creation)
3. **Creates a scheduled task** via Inngest to repeat on a schedule
4. **Each recurrence**: Inngest triggers → agent loads skill + memory → executes → learns from outcomes

```python
# New tool: the agent can schedule its own recurring tasks
{
    "name": "schedule_recurring_task",
    "description": "Schedule a task to run automatically on a recurring basis. Use this when the user wants ongoing/continuous work (e.g., 'post to social media every week', 'check email daily'). The task will run automatically without the user needing to ask again.",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "Name for this recurring task"},
            "description": {"type": "string", "description": "What the agent should do each time"},
            "skill_id": {"type": "string", "description": "Skill to execute (if already created)"},
            "schedule": {
                "type": "string",
                "enum": ["daily", "weekly", "biweekly", "monthly"],
                "description": "How often to run"
            },
            "day_of_week": {"type": "string", "description": "For weekly: monday, tuesday, etc."},
            "time": {"type": "string", "description": "Time of day in user's timezone, e.g., '09:00'"},
            "duration": {"type": "string", "description": "How long to continue, e.g., '3 months', 'indefinite'"},
        },
        "required": ["name", "description", "schedule"],
    },
}
```

### Inngest Integration

```python
async def execute_scheduled_agent_task(event: dict) -> None:
    """
    Called by Inngest on schedule. This is the "employee" doing their job.
    """
    user_id = event["data"]["user_id"]
    skill_id = event["data"]["skill_id"]
    task_id = event["data"]["task_id"]

    # Load user memory (what they like, brand voice, past outcomes)
    memory = await get_user_memory_context(user_id)

    # Load skill instructions
    skill = await db.fetchrow("SELECT * FROM skills WHERE id = $1", skill_id)

    # Load connected apps (for Composio tools)
    connected_apps = await fetch_user_connected_apps(user_id)

    # Check: should we orchestrate or single-agent?
    if skill and "orchestrate" in (skill.get("metadata") or {}):
        result = await orchestrate(
            client=client,
            user_prompt=skill["instructions"],
            user_id=user_id,
            session_id=f"scheduled-{task_id}-{datetime.now().isoformat()}",
            tools=await assemble_tools(user_id, connected_apps),
            system_prompt=build_system_prompt(
                user_memory=memory,
                connected_apps=format_apps(connected_apps),
            ),
        )
    else:
        result = await agent_loop(
            client=client,
            messages=[{"role": "user", "content": skill["instructions"]}],
            system_prompt=build_system_prompt(user_memory=memory),
            tools=await assemble_tools(user_id, connected_apps),
            model=route_model(skill["instructions"]),
            execute_tool_fn=lambda name, inp: execute_tool(name, inp, ctx),
        )

    # Log the execution
    await db.execute("""
        INSERT INTO task_executions (id, scheduled_task_id, status, result_summary, credits_used)
        VALUES ($1, $2, 'completed', $3, $4)
    """, create_id(), task_id, result["content"][:500], result["usage"]["total_credits"])

    # Notify user with summary (non-intrusive — in-app notification, not interruption)
    await send_notification(user_id, {
        "type": "scheduled_task_completed",
        "title": f"✅ {skill['name']} completed",
        "body": result["content"][:200],
        "task_id": task_id,
    })

    # Post-task learning (same as interactive sessions)
    await extract_and_store_memories(user_id, result["messages"], result["tool_calls"])
```

### The Full "Employee" Flow

```
Day 1:
  User: "Handle my social media for the next 3 months. Post 3x/week
         to Twitter, Instagram, Facebook."

  Agent:
    1. Checks integrations → Twitter ✅, Instagram ✅, Facebook ❌
       → "Facebook isn't connected. Connect it in Settings → Applications."
    2. Orchestrator creates initial month's content (Wave 1: researcher + writers, Wave 2: designer + scheduler)
    3. Schedules: app_twitter, app_instagram post the first batch
    4. Creates "weekly-social-media" skill from the workflow
    5. Creates recurring Inngest task: every Monday 9am, run the skill
    6. Tells user: "I've created and scheduled your first 2 weeks of posts.
       I'll create fresh content every Monday automatically. You'll get
       a summary each week. Want to review before I post, or should I
       post automatically?"

Week 2 (Monday 9am — automatic, no user action):
  Inngest triggers → Agent wakes up
    1. Loads memory: brand voice, hashtags, what worked last week
    2. Checks last week's engagement (via Composio app_twitter_get_analytics)
    3. Stores outcomes in memory: "carousel posts got 3x engagement"
    4. Creates this week's content (adjusts strategy based on outcomes)
    5. Schedules posts for the week
    6. Sends notification: "Week 2 social media scheduled. Last week's
       top post got 847 likes. This week I'm focusing more on carousels."

Week 8 (automatic):
  Agent: "Your 3-month plan ends in 4 weeks. Want me to continue?
          Here's your performance summary: average engagement up 40%
          since we started, best performing content type: behind-the-scenes."
```

---

## Outcome Feedback Loop (Learning from Results)

The agent doesn't just create content — it learns what WORKS.

### How Outcomes Get Tracked

```python
# New tool: check outcomes from previous agent actions
{
    "name": "check_outcomes",
    "description": "Check the results/engagement/analytics of previously completed work. Use this at the start of recurring tasks to learn what worked and adjust strategy.",
    "input_schema": {
        "type": "object",
        "properties": {
            "source": {"type": "string", "enum": ["social_media", "email", "website", "custom"]},
            "platform": {"type": "string", "description": "e.g., twitter, instagram"},
            "timeframe": {"type": "string", "default": "last_7_days"},
        },
        "required": ["source"],
    },
}

async def execute_check_outcomes(user_id: str, input: dict) -> dict:
    """Fetch analytics via Composio and return structured outcomes."""
    source = input["source"]

    if source == "social_media":
        platform = input.get("platform", "all")
        # Fetch via Composio tools
        analytics = await composio_execute(user_id, f"app_{platform}_get_analytics", {
            "timeframe": input.get("timeframe", "last_7_days"),
        })
        return analytics

    return {"message": "No analytics available for this source"}
```

### Storing Outcomes in Memory

After checking outcomes, the agent stores insights:

```python
async def store_outcome_learnings(user_id: str, outcomes: dict) -> None:
    """
    Extract learnings from outcome data and store in memory.
    Runs after check_outcomes tool call.
    """
    # Use Haiku to extract insights — cheap
    insights = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[{"role": "user", "content": f"""Extract 2-3 key learnings from this analytics data.
Return JSON array: [{{"key": "what_works", "value": "insight"}}]
Data: {json.dumps(outcomes)}"""}],
    )

    for insight in json.loads(insights.content[0].text):
        await upsert_memory(user_id, "pattern", insight["key"], insight["value"], confidence=0.7)
```

### The Feedback Cycle

```
Execute task → Deliver results → [time passes] → Check outcomes
     ↑                                                    │
     │              Store learnings in memory              │
     │                        ↑                            │
     └────────────────────────┴────────────────────────────┘
```

Each cycle, the agent gets smarter about what works for THIS specific user.

---

## Multi-Agent Streaming UX

When workers run in parallel, the user MUST see real-time progress.

### SSE Event Types for Orchestration

```python
# Events sent to client during orchestrated execution
SSE_EVENTS = {
    # Orchestration lifecycle
    "orchestration.started": {"plan": [...], "total_workers": 4, "waves": 2},
    "orchestration.wave_started": {"wave": 1, "workers": ["researcher", "content_writer", "designer"]},

    # Per-worker progress
    "worker.started": {"worker_id": "content_writer", "role": "content_writer", "objective": "Write 12 Twitter posts"},
    "worker.tool_call": {"worker_id": "content_writer", "tool": "file_write", "detail": "Writing twitter-post-3.md"},
    "worker.progress": {"worker_id": "content_writer", "progress": 0.25, "message": "3/12 posts written"},
    "worker.completed": {"worker_id": "content_writer", "summary": "12 Twitter posts created", "duration_ms": 8500},
    "worker.failed": {"worker_id": "designer", "error": "DALL-E rate limit", "retrying": True},

    # Synthesis
    "orchestration.synthesizing": {"message": "Combining all worker results..."},
    "orchestration.completed": {"total_duration_ms": 25000, "workers_completed": 4, "workers_failed": 0},
}

async def stream_worker_progress(
    user_id: str,
    session_id: str,
    worker_id: str,
    event_type: str,
    data: dict,
) -> None:
    """Send real-time worker progress to the client via SSE."""
    await gateway_publish(session_id, {
        "type": f"worker.{event_type}",
        "worker_id": worker_id,
        **data,
    })
```

### What the User Sees (UI)

```
┌─────────────────────────────────────────────────┐
│  🔄 Creating your social media plan...          │
│                                                 │
│  Wave 1/2                                       │
│  ├─ 📝 Content Writer  ████████░░ 80%          │
│  │     Writing Instagram post 10/12...          │
│  ├─ 🔍 Researcher      ██████████ ✅ Done       │
│  │     30-day content calendar ready            │
│  └─ 🎨 Designer        ██████░░░░ 60%          │
│        Generating image 7/12...                 │
│                                                 │
│  Wave 2 — waiting for Wave 1...                 │
│  └─ 📅 Scheduler       ░░░░░░░░░░ Queued       │
└─────────────────────────────────────────────────┘
```

### Hooking Workers to Stream Progress

```python
async def run_worker_with_streaming(spec: WorkerSpec, ...) -> WorkerResult:
    """Worker wrapper that streams progress to client."""
    await stream_worker_progress(user_id, session_id, spec.id, "started", {
        "role": spec.role, "objective": spec.objective,
    })

    result = await agent_loop(
        ...,
        on_tool_start=lambda name, inp: stream_worker_progress(
            user_id, session_id, spec.id, "tool_call",
            {"tool": name, "detail": str(inp)[:100]},
        ),
        on_tool_result=lambda name, res, err: stream_worker_progress(
            user_id, session_id, spec.id, "progress",
            {"tool": name, "success": not err},
        ),
    )

    await stream_worker_progress(user_id, session_id, spec.id, "completed", {
        "summary": result["content"][:200],
        "duration_ms": result.get("duration_ms", 0),
    })

    return result
```

---

## Verification Step

After orchestration or complex tasks, verify quality before delivering.

### Lightweight Verification (Haiku — Cheap)

```python
async def verify_output(
    user_prompt: str,
    output_summary: str,
    artifacts: list[str],
    user_memory: dict,
) -> dict:
    """
    Quick quality check using Haiku (~$0.001 per verification).
    NOT a full re-execution — just a checklist comparison.
    """
    verification = await client.messages.create(
        model="claude-haiku-4-5-20251001",  # Cheapest possible
        max_tokens=512,
        messages=[{"role": "user", "content": f"""Verify this task output against the original request.

Original request: {user_prompt}
Output summary: {output_summary}
Artifacts produced: {artifacts}
User preferences: {json.dumps(user_memory)}

Check:
1. Does the output cover ALL aspects of the request?
2. Does it match the user's known preferences/brand voice?
3. Are there any obvious errors or gaps?

Return JSON:
{{"passed": true/false, "score": 0-10, "issues": ["list of issues if any"]}}"""}],
    )

    result = json.loads(verification.content[0].text)

    # If verification fails, the orchestrator handles the gaps
    if not result["passed"]:
        return {"verified": False, "issues": result["issues"]}

    return {"verified": True, "score": result["score"]}
```

### When Verification Runs

- **Always** after orchestrated tasks (multi-agent)
- **Always** after scheduled/recurring tasks (no human in the loop)
- **Optional** after complex single-agent tasks (5+ tool calls)
- **Never** for simple Q&A (waste of tokens)

Cost: ~$0.001 per verification (Haiku with ~600 tokens). Negligible.

---

## System Prompt Template

```python
def build_system_prompt(
    agent_type: str = "assistant",
    tools_registry: str = "",
    skills_registry: str = "",
    user_name: str = "",
    user_memory: str = "",        # From get_user_memory_context()
    connected_apps: str = "",     # List of connected integrations
) -> str:
    """
    Build the system prompt. This MUST be stable across turns.
    Changes invalidate the KV-cache.

    IMPORTANT: user_memory and connected_apps are loaded ONCE at session start.
    They do NOT change between turns (preserving KV-cache).
    """
    return f"""You are Rubic, an advanced AI assistant that helps users accomplish real-world tasks.
You have access to a sandbox environment where you can read/write files, execute code, browse the web, and deploy applications.

## Core Principles
1. Be FAST — respond to simple questions immediately, don't over-plan
2. For multi-step tasks, create a todo.md plan first using file_write
3. Execute one step at a time, verify results, then proceed
4. If something fails, keep the error visible and try a different approach
5. When building websites or apps, deploy them and share the URL
6. For destructive device commands, always ask the user for approval first

## Be Proactive
- If a task needs an app the user hasn't connected, tell them which one and where to connect it
- If you notice a recurring pattern, suggest creating a reusable skill
- After completing a task, suggest relevant follow-ups ("Want me to also schedule these?")
- If a tool fails, explain what happened and suggest alternatives — don't just retry silently
- If the user asks about multiple platforms, check which ones are actually connected

## Communication
- Use message_notify_user to keep the user informed during long tasks
- Use message_ask_user when you need clarification or approval
- For simple responses, just reply with text (no tool needed)

## Tools
- shell_exec: Terminal commands (npm, pip, git). Use -y for installs.
- code_execute: Run code snippets (Python, JS, Bash)
- file_write / file_read / file_str_replace: File operations in the sandbox
- web_search: Find current information
- browser_navigate / browser_screenshot: Browse and verify web pages
- deploy_expose_port: Make a local server publicly accessible
- generate_image: Create images with DALL-E

{skills_registry}

{user_memory}

## Connected Apps
{connected_apps or "No apps connected yet. Suggest the user connect apps in Settings → Applications."}

## User
Name: {user_name or "User"}
"""
```

---

## API Endpoints

### POST /v1/complete (Main Entry Point)

```python
class CompletionRequest(BaseModel):
    prompt: str | None = None
    messages: list[dict] | None = None
    model: str | None = None           # None = auto-route
    max_tokens: int = 4096
    temperature: float = 0.7
    system_prompt: str | None = None   # Override (rare)
    stream: bool = True
    session_id: str | None = None
    skill_ids: list[str] | None = None

# Headers: x-user-id (required), x-task-id (optional)
```

**Flow (optimized for speed + low overhead):**

1. Load user context in parallel: `asyncio.gather(connected_apps, devices, skills, memory)`
2. **Proactive check:** `check_missing_integrations()` — if user needs unconnected app, prepend suggestion
3. Get or create sandbox for session (reuse existing — don't create unnecessarily)
4. Build system prompt (stable, cacheable — includes memory + connected apps)
5. Assemble tools ONCE: core + dynamic Composio + dynamic device (cached per session)
6. Load conversation history from DB if session_id provided
7. Check: `should_orchestrate()` → if yes, route to `/v1/orchestrate` instead
8. Check: `should_plan()` → inject planning rules if multi-step
9. Match skills: `match_skills()` → inject skill instructions if matched
10. Run `agent_loop()` with streaming → SSE to client
11. Persist assistant message to DB
12. Deduct credits (model-tier-aware pricing)
13. **Post-task (async, non-blocking):**
    - `extract_and_store_memories()` — learn from conversation (Haiku, ~$0.0004)
    - `maybe_create_skill()` — save recurring patterns as skills (Haiku, ~$0.0004)
14. Return SSE stream

### POST /v1/orchestrate (Complex Multi-Agent Tasks)

For Path 3 (orchestrated execution). Used when tasks have genuinely independent, parallelizable workstreams (~10% of tasks).

```python
class OrchestrationRequest(BaseModel):
    prompt: str
    session_id: str
    max_workers: int = 4  # Hard cap: never exceed 4 workers per wave
```

See the **Orchestrator-Worker System** section below for full architecture.

### GET /v1/tools (List Available Tools)

Returns all tools available to the authenticated user (core + Composio + device).

### GET /v1/skills (List Skills)

Returns skill registry for the user (built-in + installed + custom).

### POST /v1/skills (Create Custom Skill)

Upload SKILL.md + metadata to create a new skill.

### POST /v1/sessions/{id}/pause (Pause Session)

Pause the sandbox and save state.

### POST /v1/sessions/{id}/resume (Resume Session)

Resume a paused sandbox and continue from todo.md.

---

## Execution Telemetry (Log Everything)

Every agent loop execution logs telemetry for future optimization:

```python
async def log_telemetry(
    user_id: str,
    session_id: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_read_tokens: int,
    iterations: int,
    tools_used: list[str],
    skill_ids: list[str],
    latency_ms: int,
    credits_used: float,
    success: bool,
    error: str | None = None,
):
    """Log to execution_telemetry table. Feeds future model routing optimization."""
    await db.execute("""
        INSERT INTO execution_telemetry
        (user_id, session_id, model_used, input_tokens, output_tokens,
         cache_read_tokens, iterations, tools_called, skill_ids,
         latency_ms, cost_credits, success, error_message, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
    """, user_id, session_id, model, input_tokens, output_tokens,
         cache_read_tokens, iterations, tools_used, skill_ids,
         latency_ms, credits_used, success, error)
```

---

## Device Tool Safety

Device commands affect real hardware. Safety rules:

```python
ALWAYS_REQUIRE_APPROVAL = [
    "rm -rf", "format", "shutdown", "reboot", "kill",
    "chmod 777", "dd if=", "mkfs", "fdisk",
    "sudo rm", "sudo shutdown",
]

async def device_execute(user_id: str, tool_name: str, input: dict) -> dict:
    """Execute device command with safety checks."""
    command = input.get("command", "")

    # Check for dangerous patterns
    for pattern in ALWAYS_REQUIRE_APPROVAL:
        if pattern in command.lower():
            return {
                "status": "approval_required",
                "message": f"This command contains '{pattern}'. Please confirm you want to proceed.",
                "command": command,
            }

    # Also require approval if the tool explicitly requests it
    if input.get("require_approval", True):
        return {
            "status": "approval_required",
            "message": f"Ready to execute on device: {command}",
        }

    # Execute via device service
    device_id = tool_name.split("_")[1]
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.device_service_url}/devices/{device_id}/execute",
            json={"command": command},
            headers={"x-user-id": user_id},
            timeout=30.0,
        )
        return resp.json()
```

---

## Orchestrator-Worker System (Multi-Agent)

### When to Orchestrate (The Escalation Decision)

NOT every complex task needs multi-agent. The research is clear:

| Task Type                                                               | Use Multi-Agent? | Why                                                     |
| ----------------------------------------------------------------------- | ---------------- | ------------------------------------------------------- |
| "Fix this bug"                                                          | NO               | Sequential reasoning — multi-agent degrades by 39-70%   |
| "Write a blog post"                                                     | NO               | Single creative task — single agent is faster + cheaper |
| "Build a landing page"                                                  | NO               | Sequential steps — plan + execute with single agent     |
| "Manage social media across 3 platforms"                                | YES              | Independent platform workstreams                        |
| "Research 5 competitors and compare"                                    | YES              | 5 independent research tasks                            |
| "Build frontend + backend + write docs"                                 | YES              | Independent deliverables                                |
| "Create a marketing plan with content for Twitter, Instagram, Facebook" | YES              | Parallel content creation per platform                  |

**The rule:** Orchestrate when a task has **3+ independent workstreams** that don't depend on each other's outputs within a wave.

```python
ORCHESTRATION_TRIGGERS = [
    # Platform parallelism
    ("multiple platforms", lambda p: len(re.findall(r"twitter|instagram|facebook|linkedin|youtube|tiktok", p.lower())) >= 2),
    # Explicit multi-target
    ("multiple deliverables", lambda p: any(w in p.lower() for w in ["and also", "plus also", "in addition"])),
    # Research parallelism
    ("comparative research", lambda p: any(w in p.lower() for w in ["compare", "competitors", "alternatives", "versus"])),
    # Full-stack parallelism
    ("full-stack build", lambda p: "frontend" in p.lower() and "backend" in p.lower()),
]

def should_orchestrate(prompt: str, message_count: int) -> bool:
    """Decide if a task should escalate to multi-agent orchestration."""
    # Only orchestrate on the FIRST message (new task), not mid-conversation
    if message_count > 1:
        return False
    for name, check in ORCHESTRATION_TRIGGERS:
        if check(prompt):
            return True
    return False
```

### Architecture: Orchestrator + Workers + Artifact Store

```
┌─────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                          │
│            (Claude Opus or Sonnet — most capable)        │
│                                                         │
│  1. Analyze task → identify independent workstreams     │
│  2. Create worker specs (objective, format, tools)      │
│  3. Dispatch workers (asyncio.gather, max 4 per wave)   │
│  4. Collect artifact references from workers            │
│  5. Synthesize results                                  │
│  6. Optionally dispatch next wave of workers            │
│  7. Verify final output                                 │
│  8. Deliver to user                                     │
└────────────┬──────┬──────┬──────┬───────────────────────┘
             │      │      │      │
     ┌───────▼┐ ┌───▼───┐ ┌▼─────┐ ┌▼──────┐
     │Worker A│ │Worker B│ │Worker C│ │Worker D│  ← Max 4 per wave
     │(Sonnet)│ │(Sonnet)│ │(Sonnet)│ │(Sonnet)│
     └───┬────┘ └───┬───┘ └───┬───┘ └───┬───┘
         │          │          │          │
         ▼          ▼          ▼          ▼
     ┌──────────────────────────────────────────┐
     │         ARTIFACT STORE                    │
     │   (Sandbox filesystem / S3 / Database)    │
     │                                           │
     │  /artifacts/worker-a/marketing-plan.md    │
     │  /artifacts/worker-b/twitter-posts.json   │
     │  /artifacts/worker-c/instagram-posts.json │
     │  /artifacts/worker-d/facebook-posts.json  │
     └──────────────────────────────────────────┘
```

**Critical rules (from Google DeepMind + Anthropic research):**

- Workers NEVER talk to each other — only orchestrator ↔ worker
- Workers write to artifact store, return lightweight references
- Max 4 workers per wave (the "Rule of 4" — coordination overhead dominates beyond this)
- Each worker gets its OWN agent_loop instance (reuses the same core engine)
- Orchestrator uses the most capable model, workers use cheaper/faster models

### The Orchestration Engine

```python
import asyncio
from dataclasses import dataclass

@dataclass
class WorkerSpec:
    """Specification for a worker agent."""
    id: str
    role: str                # 'content_writer' | 'designer' | 'scheduler' | 'researcher' | 'coder'
    objective: str           # What this worker must accomplish
    output_format: str       # Expected output structure
    tools_allowed: list[str] # Subset of tools this worker can use
    model: str = ""          # Auto-routed by role if empty
    max_iterations: int = 15 # Workers get fewer iterations (cheaper, faster)
    artifact_path: str = ""  # Where to write results

    def __post_init__(self):
        if not self.model:
            self.model = route_worker_model(self.role)

# Pre-defined worker roles with optimized tool subsets
WORKER_ROLES = {
    "content_writer": {
        "system": "You are a content writer. Write engaging, platform-optimized content.",
        "tools": ["file_write", "file_read", "web_search"],
        "model": "claude-haiku-4-5-20251001",  # Haiku writes great content
    },
    "designer": {
        "system": "You are a designer. Create visual assets, generate images, and design layouts.",
        "tools": ["generate_image", "file_write", "file_read", "browser_screenshot"],
        "model": "claude-sonnet-4-5-20250929",  # Design needs more creativity
    },
    "scheduler": {
        "system": "You are a scheduler. Use platform APIs to schedule and publish content.",
        "tools": ["file_read"],  # + dynamically added Composio app_* tools
        "model": "claude-haiku-4-5-20251001",  # Scheduling is mechanical
    },
    "researcher": {
        "system": "You are a researcher. Find information, analyze data, write reports.",
        "tools": ["web_search", "browser_navigate", "file_write", "file_read", "code_execute"],
        "model": "claude-sonnet-4-5-20250929",  # Research needs reasoning
    },
    "coder": {
        "system": "You are a developer. Write, test, and deploy code.",
        "tools": ["shell_exec", "code_execute", "file_write", "file_read", "file_str_replace",
                  "browser_navigate", "browser_screenshot", "deploy_expose_port"],
        "model": "claude-sonnet-4-5-20250929",  # Code needs accuracy
    },
}

@dataclass
class WorkerResult:
    """Result from a completed worker."""
    worker_id: str
    artifact_path: str       # Reference to the artifact in the store
    summary: str             # Brief summary of what was produced
    success: bool
    error: str | None = None
    usage: dict = None       # Token usage for cost tracking


async def orchestrate(
    client: anthropic.AsyncAnthropic,
    user_prompt: str,
    user_id: str,
    session_id: str,
    tools: list[dict],
    system_prompt: str,
) -> dict:
    """
    Multi-agent orchestration engine.

    Flow:
    1. Orchestrator analyzes task and creates worker specs
    2. Workers execute in parallel waves (max 4 per wave)
    3. Orchestrator synthesizes results between waves
    4. Final verification and delivery
    """

    # Step 1: Orchestrator creates the plan
    plan_prompt = f"""Analyze this task and decompose it into independent workstreams.

User request: {user_prompt}

Create a plan with workers. Each worker handles ONE independent workstream.
Rules:
- Maximum 4 workers per wave
- Workers cannot depend on each other within the same wave
- If a worker needs another worker's output, put it in a later wave
- Each worker needs: objective, output_format, tools_allowed

Return your plan as a JSON object:
{{
    "waves": [
        {{
            "workers": [
                {{
                    "id": "worker-a",
                    "objective": "Create a 30-day marketing plan for...",
                    "output_format": "markdown document with weekly breakdown",
                    "tools_allowed": ["web_search", "file_write", "file_read"],
                    "artifact_path": "/artifacts/worker-a/marketing-plan.md"
                }}
            ]
        }}
    ],
    "synthesis_instructions": "How to combine worker outputs into final deliverable"
}}"""

    # Use the main agent loop for planning (single call, no tools needed)
    plan_response = await client.messages.create(
        model="claude-sonnet-4-5-20250929",  # Sonnet is sufficient for planning
        max_tokens=4096,
        system=[{"type": "text", "text": "You are a task planner. Decompose tasks into parallel workstreams.", "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": plan_prompt}],
    )

    plan = parse_plan(plan_response.content[0].text)

    # Step 2: Execute waves sequentially, workers within each wave in parallel
    all_results: list[WorkerResult] = []

    for wave_idx, wave in enumerate(plan["waves"]):
        # Notify user about progress
        await send_to_user(user_id, session_id, "message_notify_user", {
            "message": f"Wave {wave_idx + 1}/{len(plan['waves'])}: Starting {len(wave['workers'])} workers in parallel...",
            "type": "progress",
        })

        # Launch all workers in this wave concurrently
        worker_tasks = []
        for spec in wave["workers"]:
            worker_tasks.append(
                run_worker(
                    client=client,
                    spec=WorkerSpec(**spec),
                    user_id=user_id,
                    session_id=session_id,
                    tools=filter_tools(tools, spec["tools_allowed"]),
                    previous_results=all_results,  # Context from earlier waves
                )
            )

        # asyncio.gather — true parallel execution
        wave_results = await asyncio.gather(*worker_tasks, return_exceptions=True)

        for result in wave_results:
            if isinstance(result, Exception):
                all_results.append(WorkerResult(
                    worker_id="unknown",
                    artifact_path="",
                    summary=f"Worker failed: {str(result)}",
                    success=False,
                    error=str(result),
                ))
            else:
                all_results.append(result)

    # Step 3: Orchestrator synthesizes all worker outputs
    synthesis = await synthesize_results(
        client=client,
        user_prompt=user_prompt,
        results=all_results,
        instructions=plan.get("synthesis_instructions", ""),
        user_id=user_id,
        session_id=session_id,
    )

    return synthesis


async def run_worker(
    client: anthropic.AsyncAnthropic,
    spec: WorkerSpec,
    user_id: str,
    session_id: str,
    tools: list[dict],
    previous_results: list[WorkerResult],
) -> WorkerResult:
    """
    Execute a single worker agent.
    Each worker gets its own agent_loop instance with a focused objective.
    """
    # Build worker-specific system prompt
    context_from_previous = ""
    if previous_results:
        context_from_previous = "\n\n## Context from previous workers:\n"
        for r in previous_results:
            if r.success:
                context_from_previous += f"- {r.worker_id}: {r.summary} (artifact: {r.artifact_path})\n"

    worker_system = f"""You are a specialized worker agent. You have ONE job:

## Your Objective
{spec.objective}

## Expected Output Format
{spec.output_format}

## Rules
- Write your output to: {spec.artifact_path}
- Stay focused on YOUR objective only
- Do not try to do other workers' jobs
- When done, write your final output to the artifact path
{context_from_previous}"""

    messages = [{"role": "user", "content": f"Execute your objective. Write results to {spec.artifact_path}"}]

    try:
        result = await agent_loop(
            client=client,
            messages=messages,
            system_prompt=worker_system,
            tools=tools,
            model=spec.model,
            max_tokens=4096,
            execute_tool_fn=lambda name, input: execute_tool(name, input, ExecutionContext(
                user_id=user_id,
                session_id=session_id,
                sandbox_id=None,  # Workers share the session sandbox
            )),
        )

        return WorkerResult(
            worker_id=spec.id,
            artifact_path=spec.artifact_path,
            summary=result["content"][:200],  # Brief summary
            success=True,
            usage=result.get("usage"),
        )
    except Exception as e:
        return WorkerResult(
            worker_id=spec.id,
            artifact_path=spec.artifact_path,
            summary="",
            success=False,
            error=str(e),
        )


async def synthesize_results(
    client: anthropic.AsyncAnthropic,
    user_prompt: str,
    results: list[WorkerResult],
    instructions: str,
    user_id: str,
    session_id: str,
) -> dict:
    """
    Orchestrator reads all worker artifacts and produces the final deliverable.
    """
    # Build synthesis prompt with artifact references
    artifacts_summary = "\n".join([
        f"- **{r.worker_id}**: {'SUCCESS' if r.success else 'FAILED'} — {r.summary}\n  Artifact: {r.artifact_path}"
        for r in results
    ])

    synthesis_prompt = f"""The workers have completed their tasks. Here are the results:

{artifacts_summary}

Original user request: {user_prompt}

Synthesis instructions: {instructions}

Read each worker's artifact file, then create a unified final deliverable for the user.
Verify that all aspects of the user's request are covered.
If any worker failed, handle that gap yourself."""

    # Run synthesis through the main agent loop (can use file_read to access artifacts)
    return await agent_loop(
        client=client,
        messages=[{"role": "user", "content": synthesis_prompt}],
        system_prompt="You are synthesizing results from multiple worker agents into a final deliverable.",
        tools=tools,  # Full tool set for synthesis
        model="claude-sonnet-4-5-20250929",
        execute_tool_fn=lambda name, input: execute_tool(name, input, ExecutionContext(
            user_id=user_id,
            session_id=session_id,
        )),
    )
```

### Social Media Example (End-to-End with Roles)

```
User: "Handle my social media for my coffee shop across Twitter,
       Instagram, Facebook. Design posts, make a content calendar,
       and schedule everything for the next month."

PRE-CHECK: check_missing_integrations() → User has Twitter + Instagram
           but NOT Facebook → suggest connecting it first

MEMORY LOAD: user's brand voice = "warm, friendly, local community feel"
             preferred hashtags = "#LocalCoffee #CoffeeShop #MorningBrew"
             past correction = "avoid corporate language"

ORCHESTRATOR analyzes → 3 platforms + design + calendar = orchestrate

WAVE 1 (parallel — 3 workers, using ROLES):
┌─ RESEARCHER: "Research coffee shop social media trends for 2026,
│               create a 30-day content calendar with themes per week"
│               Model: Sonnet | Tools: web_search, file_write
│               → writes /artifacts/researcher/content-calendar.md
│
├─ CONTENT_WRITER: "Write 12 Twitter posts (short, punchy, hashtags)
│                   + 12 Instagram captions (emoji, storytelling)
│                   + 12 Facebook posts (longer format)"
│                   Model: Haiku | Tools: file_write, file_read
│                   Brand context from memory injected into prompt
│                   → writes /artifacts/writer/all-posts.json
│
└─ DESIGNER: "Generate 12 Instagram-sized images for a coffee shop,
              themes: morning rituals, new menu items, behind the scenes"
              Model: Sonnet | Tools: generate_image, file_write
              → writes /artifacts/designer/images/

WAVE 2 (needs Wave 1 — 1 worker):
└─ SCHEDULER: "Schedule all posts using the content calendar.
               Use app_twitter_create_post, app_instagram_create_post,
               app_facebook_create_post with the content from Wave 1"
               Model: Haiku | Tools: file_read + Composio app_* tools
               → writes /artifacts/scheduler/schedule-log.json

SYNTHESIS: Orchestrator reads all artifacts (Sonnet, 1 call):
  "Here's your social media plan for the next 30 days:
   - 36 posts total (12 per platform)
   - All posts match your brand voice (warm, community-focused)
   - Images: 12 custom visuals for Instagram
   - Scheduling: Posts queued via your connected accounts
   - Facebook not connected — I created the posts but couldn't schedule.
     Connect Facebook in Settings → Applications to enable scheduling."

POST-TASK: extract_and_store_memories() → saves new patterns
           maybe_create_skill() → "weekly-social-media" skill created
           → "I've saved this as 'weekly social media'. Next time just
              say 'do my social media' and I'll use your brand voice,
              hashtags, and this calendar structure automatically."

COST: ~$0.06 total (Haiku workers + Sonnet researcher + cached prompts)
```

### Cost Control

Multi-agent uses ~15x more tokens. Enforce cost limits:

```python
ORCHESTRATION_CREDIT_MULTIPLIER = 3  # Charge 3x base credits for orchestrated tasks

async def check_orchestration_budget(user_id: str, estimated_workers: int) -> bool:
    """Check if user has enough credits for an orchestrated task."""
    estimated_cost = estimated_workers * 5  # ~5 credits per worker
    balance = await get_credit_balance(user_id)

    if balance < estimated_cost:
        return False  # Fall back to single-agent
    return True
```

### Failure Recovery

```python
async def handle_worker_failure(
    failed_result: WorkerResult,
    spec: WorkerSpec,
    client: anthropic.AsyncAnthropic,
    retry_count: int = 0,
) -> WorkerResult:
    """Retry a failed worker once, then let orchestrator handle the gap."""
    if retry_count >= 1:
        # Don't retry more than once — let the orchestrator fill the gap during synthesis
        return failed_result

    # Retry with error context
    return await run_worker(
        client=client,
        spec=WorkerSpec(
            **{**spec.__dict__,
               "objective": f"{spec.objective}\n\nPrevious attempt failed with: {failed_result.error}\nTry a different approach."}
        ),
        # ... other params
    )
```

---

## Environment Variables

| Variable                | Default                  | Description                  |
| ----------------------- | ------------------------ | ---------------------------- |
| `PORT`                  | `8000`                   | Agent service port           |
| `ANTHROPIC_API_KEY`     | None                     | Anthropic API key (required) |
| `OPENAI_API_KEY`        | None                     | OpenAI API key (for DALL-E)  |
| `DATABASE_URL`          | `postgresql://...`       | PostgreSQL connection        |
| `REDIS_URL`             | `redis://localhost:6379` | Redis for caching            |
| `SANDBOX_SERVICE_URL`   | `http://localhost:4012`  | E2B sandbox service          |
| `DEVICE_SERVICE_URL`    | `http://localhost:8080`  | Device control service       |
| `CONNECTOR_SERVICE_URL` | `http://localhost:4009`  | Composio connector service   |
| `BILLING_SERVICE_URL`   | `http://localhost:4003`  | Billing/credit service       |
| `SERPER_API_KEY`        | None                     | Serper web search            |
| `GATEWAY_URL`           | `http://localhost:4001`  | Gateway (for WebSocket)      |

---

## Implementation Priority

### Phase 1: Core Agent Loop (P0 — HIGHEST PRIORITY)

**What exists:** Streaming LLM completion works. Tool registry exists. E2B sandbox works. Device + Composio forwarding works.
**What's missing:** The agent_loop itself, connecting tools to LLM, conversation history.

- [ ] Create `src/routes/agent_loop.py` with the `agent_loop()` function (code above)
- [ ] Modify `POST /v1/complete` to use `agent_loop()` when tools should be enabled
- [ ] Create `src/routes/tool_executor.py` with the `execute_tool()` router (code above)
- [ ] Wire `shell_exec` and `code_execute` → sandbox service (E2B already works in tools.py — refactor)
- [ ] Wire `file_read`, `file_write`, `file_str_replace` → sandbox service
- [ ] Wire `web_search` → Serper API (new — needs `SERPER_API_KEY`)
- [ ] Wire `browser_navigate` and `browser_screenshot` → sandbox browser
- [ ] Implement `deploy_expose_port` → sandbox port exposure
- [ ] Add `message_notify_user` and `message_ask_user` → WebSocket via gateway
- [ ] Multi-turn conversation: load messages from DB when `session_id` provided
- [ ] Stream tool activity to client (on_tool_start, on_tool_result callbacks → SSE events)

### Phase 2: Context Engineering + Planning

- [ ] Build system prompt with `cache_control` breakpoints (3 points: tools, system, last message)
- [ ] Implement `should_plan()` heuristic + todo.md creation for multi-step tasks
- [ ] Error preservation in context (`is_error: True` flag on tool results)
- [ ] Dynamic tool loading (Composio + devices) — load once at session start, cache
- [ ] Sandbox-per-session lifecycle (get_or_create_sandbox using agentSessionId)
- [ ] Credit deduction after each agent_loop call → billing service

### Phase 3: Skills + Memory + Model Routing

- [ ] Skills database schema (skills, user_skills, agent_memory tables)
- [ ] Progressive skill loading (registry in system prompt → instructions on trigger → resources to sandbox)
- [ ] `GET /v1/skills` and `POST /v1/skills` endpoints
- [ ] Agent-created skills: `maybe_create_skill()` runs post-task
- [ ] Self-updating memory: `extract_and_store_memories()` runs post-task (Haiku, async)
- [ ] Memory loading into system prompt: `get_user_memory_context()` at session start
- [ ] Memory decay cron job (weekly)
- [ ] Model routing: cost-first three-tier + worker role routing
- [ ] Proactive behavior: `check_missing_integrations()` pre-check
- [ ] Telemetry logging (execution_telemetry table)

### Phase 4: Orchestrator-Worker System (Multi-Agent)

- [ ] Implement `should_orchestrate()` detection (multi-platform, comparative, full-stack triggers)
- [ ] Worker ROLES: content_writer, designer, scheduler, researcher, coder (optimized tool subsets + model tiers)
- [ ] Build orchestration engine (`orchestrate()` function with wave-based dispatch)
- [ ] Worker spawning with `asyncio.gather` (max 4 per wave, Haiku for content/scheduling workers)
- [ ] Artifact store: workers write to sandbox filesystem, return references to orchestrator
- [ ] Synthesis step: orchestrator reads artifacts, produces unified output
- [ ] Verification step: Haiku quality check after synthesis (~$0.001)
- [ ] Worker failure recovery: retry once, orchestrator fills gaps
- [ ] Multi-agent streaming UX: SSE events per worker (started, progress, completed, failed)
- [ ] Cost controls: credit check, role-based model routing (Haiku workers = 57% cheaper)

### Phase 5: Employee Mode + Outcome Learning

- [ ] `schedule_recurring_task` tool: agent creates Inngest scheduled tasks
- [ ] `check_outcomes` tool: agent fetches analytics via Composio
- [ ] Inngest handler: `execute_scheduled_agent_task()` — runs skills on schedule
- [ ] Outcome feedback loop: check analytics → extract learnings → store in memory
- [ ] End-to-end test: social media "employee" — create, schedule, run weekly, learn from results
- [ ] Duration management: agent warns when scheduled tasks near expiration

### Phase 6: Polish + Optimization

- [ ] Pause/resume for long-running sessions
- [ ] Website building end-to-end (shell_exec → file_write → deploy_expose_port)
- [ ] `generate_image` → DALL-E 3 integration
- [ ] Cache hit rate monitoring (target >80% hit rate)
- [ ] Per-worker telemetry for orchestrated tasks
- [ ] Device command safety layer
- [ ] Skill marketplace: users share public skills
