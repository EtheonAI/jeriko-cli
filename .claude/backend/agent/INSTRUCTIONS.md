# Agent Service Instructions

## Overview

The agent service (`services/agent/`) is the AI brain of Rubic. It handles LLM completions, tool execution, and agent orchestration. It is the ONLY Python service in the backend -- everything else is Node.js/Fastify.

**Port:** 8000 (configurable via `PORT` env var)
**Framework:** Python / FastAPI
**Status:** Has working LLM streaming for Anthropic + OpenAI. Tool definitions exist but most are stubs. No tool loop, no multi-turn, no credit tracking.

---

## Current File Structure

```
services/agent/src/
  __init__.py
  config.py             # 38 lines - Pydantic settings (env vars for API keys, service URLs)
  main.py               # 97 lines - FastAPI app, CORS, logging middleware, error handler
  routes/
    __init__.py
    health.py           # Health check endpoint
    completion.py       # 225 lines - Real streaming for Anthropic + OpenAI
    tools.py            # 302 lines - 9 tool definitions, execute endpoint, mostly stubs
```

---

## How the Agent Service Works Today

### Configuration (`src/config.py`)

Uses `pydantic_settings.BaseSettings` to load env vars:

```python
class Settings(BaseSettings):
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    google_api_key: str | None = None
    e2b_api_key: str | None = None
    task_service_url: str = "http://localhost:3002"
    device_service_url: str = "http://localhost:8080"
    file_service_url: str = "http://localhost:3003"
    database_url: str = "postgresql://rubic:rubic@localhost:5432/rubic"
```

### Completion (`src/routes/completion.py`)

**Endpoint:** `POST /v1/complete`

**Request model:**

```python
class CompletionRequest(BaseModel):
    prompt: str
    model: str = "claude-3-5-sonnet"
    max_tokens: int = 4096
    temperature: float = 0.7
    system_prompt: str | None = None
    tools: list[dict] | None = None
    stream: bool = True
    target_device_id: str | None = None
```

**Headers required:** `x-user-id` (required), `x-task-id` (optional)

**What works:**

- Streaming via SSE for both Anthropic and OpenAI models
- Non-streaming completion for both providers
- Model routing: `claude*` goes to Anthropic, `gpt*` goes to OpenAI
- Model name mapping: `claude-3-5-sonnet` is mapped to `claude-sonnet-4-20250514`

**What does NOT work:**

- The `tools` field in the request is accepted but never passed to the LLM API calls
- Only single-message conversations (user prompt only, no conversation history)
- No credit deduction or usage tracking
- No error retry or fallback between providers

### Tools (`src/routes/tools.py`)

**Endpoints:**

- `GET /v1/tools` - Lists all 9 available tools
- `POST /v1/tools/execute` - Executes a single tool by name

**Currently defined tools (8 total, the 9th `terminal_command` is device-routed):**

| Tool               | Status   | Implementation                                       |
| ------------------ | -------- | ---------------------------------------------------- |
| `web_search`       | STUB     | Returns `{"message": "Search integration pending"}`  |
| `browse_url`       | WORKING  | Uses `httpx` to fetch URL, returns first 5000 chars  |
| `execute_code`     | STUB     | Returns `{"message": "E2B integration pending"}`     |
| `terminal_command` | FORWARDS | Forwards to device service at `device_service_url`   |
| `file_read`        | FORWARDS | Requires `device_id`, forwards to device service     |
| `file_write`       | FORWARDS | Requires `device_id`, forwards to device service     |
| `create_document`  | STUB     | Returns `{"message": "Document generation pending"}` |
| `generate_image`   | STUB     | Returns `{"message": "Image generation pending"}`    |

**Device tool forwarding** is the most complete pattern. When a tool has `required_capabilities` and a `target_device_id`, it calls:

```python
response = await client.post(
    f"{device_url}/v1/tools/execute",
    json={"tool_name": ..., "arguments": ..., "device_id": ...},
    headers={"x-user-id": user_id, "x-task-id": task_id or ""},
    timeout=30.0,
)
```

The device service can return `202` (requires user approval) or `200` (result).

---

## What Needs to Be Built

### 1. Full Tool Loop (CRITICAL)

The most important missing piece. Currently, the LLM is called once with a prompt and returns text. There is no agentic tool loop.

**How it should work:**

```
User prompt
    |
    v
LLM call (with tool definitions)
    |
    v
LLM returns tool_use block?
    |--- No --> Return text response
    |--- Yes --> Execute tool(s)
                    |
                    v
                 Get tool results
                    |
                    v
                 Call LLM again with tool results
                    |
                    v
                 (repeat until LLM returns text with no tool_use)
```

**Implementation for Anthropic:**

```python
async def agentic_completion(request: CompletionRequest, user_id: str, task_id: str | None):
    client = get_anthropic_client()
    messages = [{"role": "user", "content": request.prompt}]

    # Convert our tool definitions to Anthropic format
    tools = [convert_to_anthropic_tool(t) for t in TOOLS.values()]

    while True:
        response = await client.messages.create(
            model=request.model,
            max_tokens=request.max_tokens,
            messages=messages,
            system=request.system_prompt or "You are Rubic, a helpful AI assistant.",
            tools=tools,
        )

        # Check if the response contains tool_use blocks
        tool_use_blocks = [b for b in response.content if b.type == "tool_use"]

        if not tool_use_blocks:
            # No more tool calls -- extract and return text
            text_content = "".join(b.text for b in response.content if b.type == "text")
            return text_content

        # Add assistant response to messages
        messages.append({"role": "assistant", "content": response.content})

        # Execute each tool and add results
        tool_results = []
        for tool_use in tool_use_blocks:
            result = await execute_tool_by_name(tool_use.name, tool_use.input, user_id, task_id)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_use.id,
                "content": json.dumps(result),
            })

        messages.append({"role": "user", "content": tool_results})
```

For streaming, use `client.messages.stream()` and yield chunks. On tool_use, pause streaming, execute tools, then resume with a new stream call.

### 2. Multi-Turn Conversation Support

Currently `src/routes/completion.py` line 113 only sends `[{"role": "user", "content": request.prompt}]`. There is no conversation history.

**Action:**

1. Add a `messages` field to `CompletionRequest`:
   ```python
   messages: list[dict] | None = None  # Full conversation history
   ```
2. When `messages` is provided, use it directly instead of wrapping `prompt` in a single message
3. When `prompt` is provided without `messages`, wrap it as before (backward compatible)
4. The task service should load conversation history from the `messages` table in the database and pass it to the agent

### 3. Web Search Integration

Replace the stub in `execute_web_search` at `src/routes/tools.py` line 246.

**Option A: Serper API** (recommended for speed)

```python
async def execute_web_search(arguments: dict) -> dict:
    query = arguments.get("query", "")
    num_results = arguments.get("num_results", 5)

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://google.serper.dev/search",
            json={"q": query, "num": num_results},
            headers={"X-API-KEY": settings.serper_api_key},
            timeout=10.0,
        )
        data = response.json()
        return {
            "query": query,
            "results": [
                {"title": r["title"], "url": r["link"], "snippet": r.get("snippet", "")}
                for r in data.get("organic", [])
            ],
        }
```

**Option B: Tavily API** (better for AI summarization)

Add `SERPER_API_KEY` or `TAVILY_API_KEY` to `config.py`.

### 4. E2B Code Execution Integration

Replace the stub in `execute_code` at `src/routes/tools.py` line 270.

**Action:** Instead of executing E2B directly from the agent service, call the sandbox service:

```python
async def execute_code(arguments: dict) -> dict:
    code = arguments.get("code", "")
    language = arguments.get("language", "python")

    async with httpx.AsyncClient() as client:
        # Create or reuse sandbox
        sandbox_response = await client.post(
            f"{settings.sandbox_service_url}/sandboxes",
            json={"userId": current_user_id, "template": language},
            headers={"x-user-id": current_user_id},
        )
        sandbox_id = sandbox_response.json().get("id")

        # Execute code
        exec_response = await client.post(
            f"{settings.sandbox_service_url}/sandboxes/{sandbox_id}/execute",
            json={"code": code, "language": language, "timeout": 30000},
            headers={"x-user-id": current_user_id},
        )
        return exec_response.json()
```

Add `sandbox_service_url` to `config.py`.

### 5. Image Generation (DALL-E)

Replace the stub in `execute_generate_image` at `src/routes/tools.py` line 293.

```python
async def execute_generate_image(arguments: dict) -> dict:
    client = get_openai_client()
    prompt = arguments.get("prompt", "")
    size = arguments.get("size", "1024x1024")

    response = await client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size=size,
        quality="standard",
        n=1,
    )

    image_url = response.data[0].url

    # Upload to file service for persistence
    async with httpx.AsyncClient() as http_client:
        # Download image
        img_response = await http_client.get(image_url)
        # Upload to file service (multipart)
        # ... upload logic ...

    return {
        "prompt": prompt,
        "generated": True,
        "url": image_url,
        "file_id": file_id,
    }
```

### 6. Document Creation

Replace the stub in `execute_create_document` at `src/routes/tools.py` line 282.

**Action:** Call the file service to create and store documents. For PDF generation, use `reportlab` or `weasyprint`. For DOCX, use `python-docx`. Upload the result to the file service.

### 7. Composio Tool Registration

When a user connects an app via Composio (connector service), the available tools should be dynamically added to the agent's tool list.

**Action:**

1. When listing tools (`GET /v1/tools`), also query the connector service for the user's connected integrations and their available Composio tools
2. Add those tools to the response dynamically
3. When executing a Composio tool, proxy the call to the connector service

### 8. Credit Tracking Per Call

Every LLM call should deduct credits from the user's balance.

**Action:**

1. After each completion (streaming or not), calculate token usage
2. Call the billing service to record usage:
   ```python
   await httpx.AsyncClient().post(
       f"{settings.billing_service_url}/usage",
       json={
           "userId": user_id,
           "type": "agent",
           "amount": calculate_credits(input_tokens, output_tokens, model),
           "metadata": {"model": model, "inputTokens": input_tokens, "outputTokens": output_tokens},
       },
   )
   ```
3. Before starting a completion, check if the user has sufficient credits

### 9. DAG Agent Orchestration

For complex tasks, multiple specialized agents should work in parallel.

**Action:** Create a new file `src/routes/orchestrator.py` with:

1. An orchestrator agent that breaks a task into sub-tasks
2. Each sub-task is assigned to a specialized agent type (researcher, coder, browser, etc.)
3. Sub-tasks can run in parallel using `asyncio.gather`
4. The orchestrator collects results and synthesizes a final response
5. Map to the `agents` and `agentTasks` Drizzle tables for persistence

Agent types from the schema (`packages/database/src/schema/agents.ts`):

- `orchestrator` - Breaks tasks into sub-tasks, coordinates agents
- `researcher` - Web search, knowledge base queries
- `coder` - Code generation, debugging
- `browser` - URL browsing, web scraping
- `file_manager` - File CRUD operations
- `executor` - Code execution in sandbox
- `analyst` - Data analysis, report generation

### 10. Proper Error Handling for Tool Failures

Currently at `src/routes/tools.py` lines 198-200, tool errors return a generic error string. The tool loop needs to handle:

- Tool timeout (wrap each tool call in `asyncio.wait_for`)
- Tool returning an error (pass error back to LLM so it can try a different approach)
- Rate limiting on external APIs (retry with backoff)
- Maximum tool calls per turn (prevent infinite loops -- cap at 20 tool calls)

---

## Environment Variables

| Variable             | Default                                         | Description                     |
| -------------------- | ----------------------------------------------- | ------------------------------- |
| `PORT`               | `8000`                                          | Agent service port              |
| `ENVIRONMENT`        | `development`                                   | Environment name                |
| `ANTHROPIC_API_KEY`  | None                                            | Anthropic API key for Claude    |
| `OPENAI_API_KEY`     | None                                            | OpenAI API key for GPT + DALL-E |
| `GOOGLE_API_KEY`     | None                                            | Google AI API key (Gemini)      |
| `E2B_API_KEY`        | None                                            | E2B sandbox API key             |
| `DATABASE_URL`       | `postgresql://rubic:rubic@localhost:5432/rubic` | Database connection             |
| `REDIS_HOST`         | `localhost`                                     | Redis host                      |
| `REDIS_PORT`         | `6379`                                          | Redis port                      |
| `TASK_SERVICE_URL`   | `http://localhost:3002`                         | Task service URL                |
| `DEVICE_SERVICE_URL` | `http://localhost:8080`                         | Device service URL              |
| `FILE_SERVICE_URL`   | `http://localhost:3003`                         | File service URL                |
| `SERPER_API_KEY`     | None                                            | Serper web search API key       |
| `TAVILY_API_KEY`     | None                                            | Tavily web search API key       |

---

## Database Tables Used

The agent service should read/write these tables from `packages/database/src/schema/`:

| Table            | Schema File   | Purpose                                                     |
| ---------------- | ------------- | ----------------------------------------------------------- |
| `agents`         | `agents.ts`   | Agent instances within sessions (type, status, progress)    |
| `agent_tasks`    | `agents.ts`   | Individual tasks assigned to agents (title, status, result) |
| `agent_sessions` | `sessions.ts` | AI work sessions (userId, title, status)                    |
| `messages`       | `sessions.ts` | Conversation messages (role, content, metadata with tokens) |

Since this is a Python service, it cannot use the Drizzle ORM directly. Options:

1. Use `asyncpg` or `sqlalchemy` with the same table schemas
2. Call other services (task, project) that have Drizzle access to handle DB operations
3. Add a thin data-access layer in the task service that the agent can call

---

## Inter-Service Communication

The agent service is called by:

- **Gateway** - Proxies client requests to `POST /v1/complete` and `GET /v1/tools`
- **Task service** - Calls `POST /v1/complete` with `stream: false` during Inngest task execution

The agent service calls:

- **Sandbox service** - For code execution (`execute_code` tool)
- **Device service** - For device-related tools (terminal, file read/write)
- **File service** - For document creation and file storage
- **Connector service** - For Composio tool lookups (planned)
- **Billing service** - For credit deduction (planned)
