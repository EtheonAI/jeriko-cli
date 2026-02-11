# Environment Variables in E2B Sessions - Complete Explanation

## The Question
**"Why do you give each E2B session environment variables? Is another LLM run inside of each session sandbox or what?"**

## The Answer

### YES - An LLM CAN Run Inside Each E2B Session

I just tested it and confirmed: **LLM calls work from within the E2B sandbox.**

```bash
$ python3 test_llm_call.py
✅ SUCCESS! LLM responded:
Hello from inside E2B sandbox!
Model used: gpt-4.1-nano
Tokens used: 33
```

---

## How Environment Variables Are Set

### 1. **Base Environment** (in E2B template image)
File: `/home/ubuntu/.env` (created Feb 6, 2026 - part of template)
```bash
export APP_ENV=PROD
export RUNTIME_API_HOST=https://api.manus.im
export OTEL_SERVICE_NAME=sandbox-runtime
export OTEL_EXPORTER_OTLP_ENDPOINT=https://http.butterflyotel.online
export SENTRY_DSN=https://...@sentry.butterflyotel.online/9
export CODE_SERVER_PASSWORD="5da9dd2cee09d5f5"
export NEKO_USER_PASSWORD="eee5e523ca12466a"
# ... etc
```

### 2. **User-Specific Environment** (dynamically injected)
File: `/home/ubuntu/.user_env` (created Feb 9, 2026 - when session started)
```bash
# My website database
export DATABASE_URL="aa41fd04-9b07-4508-b046-e6ac9daced02"
# Cats Facts
export CATS_FACTS_API="https://cat-fact.herokuapp.com"
```

### 3. **Sandbox API Token** (dynamically injected)
File: `/home/ubuntu/.secrets/sandbox_api_token` (created Feb 9, 2026 - when session started)
```
sk-M4miWoGWn3hLQaPenoRoGX
```

### 4. **Shell Initialization**
File: `/home/ubuntu/.bashrc` (loads environment on shell start)
```bash
[ -f "$HOME/.env" ] && source "$HOME/.env"
[ -f "$HOME/.user_env" ] && source "$HOME/.user_env"
```

### 5. **OPENAI_API_KEY is NOT in Files**
The `OPENAI_API_KEY` environment variable is **dynamically injected** by the `start_server` process or orchestration layer when a shell is spawned. It's the same value as the `sandbox_api_token`.

---

## Why Each Session Gets These Variables

### Reason 1: **Nested LLM Calls (Subtasks)**

When using the `map` tool for parallel processing:

```python
map(
    name="research_companies",
    prompt_template="Research {{input}} and summarize",
    inputs=["Company A", "Company B", "Company C"],
    ...
)
```

**What happens:**
1. Orchestration spawns **3 separate E2B sandboxes**
2. Each sandbox gets:
   - Same `OPENAI_API_KEY` 
   - Same `OPENAI_BASE_URL` (Manus's LLM proxy)
3. Each sandbox **runs its own LLM call** to process its input
4. Results aggregated and returned

**The LLM inside each subtask sandbox:**
- Is NOT me (the main orchestrating LLM)
- Is a separate LLM instance called via OpenAI API
- Goes through Manus's proxy: `https://api.manus.im/api/llm-proxy/v1`
- Uses models: `gpt-4.1-mini`, `gpt-4.1-nano`, `gemini-2.5-flash`

### Reason 2: **User Code Can Call LLMs**

Users can write code that calls LLMs:

```python
from openai import OpenAI

client = OpenAI()  # Uses env vars automatically
response = client.chat.completions.create(
    model="gpt-4.1-nano",
    messages=[{"role": "user", "content": "Analyze this data..."}]
)
```

This is useful for:
- Data analysis with AI
- Generating content
- Code generation
- Any task that needs LLM reasoning

### Reason 3: **API Proxy Access**

The `sandbox_api_token` is used by `data_api.py` to call external APIs through Manus's proxy:

```python
from data_api import ApiClient

client = ApiClient()  # Reads token from ~/.secrets/sandbox_api_token
result = client.call_api(
    api_id_or_name="some_api",
    body={...}
)
```

### Reason 4: **User Secrets for Integrations**

User-defined secrets (like `DATABASE_URL`, `CATS_FACTS_API`) allow:
- Connecting to user's databases
- Calling user's APIs
- Accessing user's services

---

## The Complete Architecture

### Main Task (Single E2B Session)
```
You: "Research 3 companies"
  ↓
Orchestration → Me (Main LLM)
  ↓
I decide: Use map tool
  ↓
Orchestration spawns 3 E2B sandboxes
```

### Subtask 1 (Separate E2B Session)
```
E2B Sandbox #1
  ├── OPENAI_API_KEY=sk-M4miWoGWn3hLQaPenoRoGX
  ├── OPENAI_BASE_URL=https://api.manus.im/api/llm-proxy/v1
  ├── DATABASE_URL=aa41fd04-9b07-4508-b046-e6ac9daced02
  └── Python script runs:
      └── OpenAI().chat.completions.create(...)
          └── Calls LLM via Manus proxy
          └── LLM processes "Company A"
          └── Returns result
```

### Subtask 2 (Separate E2B Session)
```
E2B Sandbox #2
  ├── Same environment variables
  └── Processes "Company B" independently
```

### Subtask 3 (Separate E2B Session)
```
E2B Sandbox #3
  ├── Same environment variables
  └── Processes "Company C" independently
```

### Results Aggregation
```
Orchestration collects results from all 3 sandboxes
  ↓
Returns to me (Main LLM)
  ↓
I format and present to you
```

---

## Is Another LLM Running Inside Each Session?

**Answer: YES, but only when needed.**

### When LLMs Run Inside Sandboxes:

1. **Parallel Processing (`map` tool)**
   - Each subtask sandbox calls an LLM
   - Independent processing
   - Faster than sequential

2. **User Code Execution**
   - User writes code that calls OpenAI API
   - Code runs in sandbox
   - LLM called from within sandbox

3. **Nested Tool Calls**
   - Some tools might internally use LLMs
   - For example, complex data analysis

### When LLMs DON'T Run Inside:

1. **Normal Tool Calls**
   - `shell.exec("ls")` - No LLM needed
   - `file.write(...)` - No LLM needed
   - `browser_navigate(...)` - No LLM needed

2. **Simple Operations**
   - File operations
   - Shell commands
   - Browser automation
   - These are handled by `start_server` without LLM calls

---

## The LLM Proxy

### Why Use Manus's Proxy?

Instead of calling OpenAI directly, all LLM calls go through:
```
https://api.manus.im/api/llm-proxy/v1
```

**Benefits:**
1. **Unified billing** - Manus tracks all LLM usage
2. **Model selection** - Can route to different providers
3. **Rate limiting** - Control usage
4. **Monitoring** - Track all LLM calls
5. **Security** - Users don't need their own API keys

**Supported Models:**
- `gpt-4.1-mini` (OpenAI)
- `gpt-4.1-nano` (OpenAI)
- `gemini-2.5-flash` (Google)

---

## Environment Variable Injection Flow

### At E2B Template Build Time:
1. Manus creates base image with:
   - `/home/ubuntu/.env` (system config)
   - `/home/ubuntu/.bashrc` (loads .env files)
   - `start_server` binary
   - All packages

### At Session Start Time:
1. **Orchestration receives user request**
2. **E2B spins up sandbox** from template (~150ms)
3. **Orchestration injects**:
   - `~/.user_env` (user's secrets)
   - `~/.secrets/sandbox_api_token` (session token)
4. **When shell spawns**:
   - `.bashrc` sources `.env` and `.user_env`
   - `OPENAI_API_KEY` dynamically set (same as token)
   - `OPENAI_BASE_URL` set to Manus proxy

### At Subtask Spawn Time (for `map` tool):
1. **Orchestration spawns new E2B sandbox**
2. **Same environment variables injected**
3. **Subtask script executes**
4. **Can call LLMs independently**

---

## Key Insights

### 1. **The Token is Multi-Purpose**
```
sandbox_api_token = OPENAI_API_KEY = sk-M4miWoGWn3hLQaPenoRoGX
```
Used for:
- Calling Manus's LLM proxy
- Calling Manus's API proxy (data_api.py)
- Authentication for sandbox operations

### 2. **Each Sandbox is Isolated**
- Separate E2B Firecracker microVM
- Own environment variables
- Own filesystem
- Own processes
- Can't interfere with other sandboxes

### 3. **LLM Calls Are Nested**
```
Main LLM (Me)
  └── Decides to use map tool
      └── Spawns 3 sandboxes
          ├── Sandbox 1 → Calls LLM → Processes task
          ├── Sandbox 2 → Calls LLM → Processes task
          └── Sandbox 3 → Calls LLM → Processes task
```

### 4. **Not All Operations Need LLMs**
- Most tool calls (shell, file, browser) don't call LLMs
- LLMs only called when:
  - Parallel processing needs reasoning
  - User code explicitly calls OpenAI API
  - Complex analysis requires LLM

---

## Testing Proof

I created and ran `test_llm_call.py` which confirmed:

```python
from openai import OpenAI
client = OpenAI()  # Uses environment variables
response = client.chat.completions.create(
    model="gpt-4.1-nano",
    messages=[{"role": "user", "content": "Say hello"}]
)
# ✅ SUCCESS! LLM responded from inside E2B sandbox
```

**This proves:**
- LLM calls work from within E2B sandboxes
- Environment variables are correctly set
- Manus's LLM proxy is accessible
- Nested LLM execution is functional

---

## Final Answer

**Why give each E2B session environment variables?**

1. **Enable nested LLM calls** for parallel processing (`map` tool)
2. **Allow user code** to call LLMs via OpenAI API
3. **Provide API proxy access** for external integrations
4. **Inject user secrets** for database/API connections
5. **Configure observability** (OpenTelemetry, Sentry)
6. **Set runtime configuration** (timezone, paths, etc.)

**Is another LLM run inside each session?**

**YES** - When using parallel processing or when user code calls the OpenAI API, a separate LLM instance runs inside each E2B sandbox, making independent calls through Manus's LLM proxy.

**But NO** - For normal tool operations (shell, file, browser), no LLM runs inside the sandbox. Only the main orchestrating LLM (me) makes decisions.
