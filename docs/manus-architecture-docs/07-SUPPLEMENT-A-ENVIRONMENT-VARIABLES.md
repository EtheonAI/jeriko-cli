# Supplement A: Environment Variables — Complete Deep Dive

## A.1 Overview

Every E2B sandbox is loaded with environment variables from **four distinct sources**, injected at different times during the sandbox lifecycle. These variables serve different purposes: system configuration, user secrets, LLM access, observability, and API authentication. This document traces every variable, its source, injection time, and exact purpose.

---

## A.2 The Four Injection Sources

### Source 1: Base Template Image (`/home/ubuntu/.env`)

**When injected:** At E2B template build time (baked into the VM image)
**Created:** Feb 6, 2026 (part of the template snapshot)
**Loaded by:** `.bashrc` on every shell spawn: `[ -f "$HOME/.env" ] && source "$HOME/.env"`

```bash
# Application Environment
export APP_ENV=PROD

# Runtime API
export RUNTIME_API_HOST=https://api.manus.im

# OpenTelemetry (Observability)
export OTEL_SERVICE_NAME=sandbox-runtime
export OTEL_EXPORTER_OTLP_ENDPOINT=https://http.butterflyotel.online

# Sentry (Error Tracking)
export SENTRY_DSN=https://...@sentry.butterflyotel.online/9

# Code Server (Internal)
export CODE_SERVER_PASSWORD="5da9dd2cee09d5f5"

# Neko Server (WebRTC)
export NEKO_USER_PASSWORD="eee5e523ca12466a"
```

**Purpose of each:**

| Variable | Purpose | Used By |
|----------|---------|---------|
| `APP_ENV=PROD` | Tells runtime this is production, not dev | start_server, all services |
| `RUNTIME_API_HOST` | Base URL for Manus API calls from within sandbox | data_api.py, start_server |
| `OTEL_SERVICE_NAME` | Identifies this service in telemetry traces | OpenTelemetry SDK |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Where to send traces/metrics | OpenTelemetry exporter |
| `SENTRY_DSN` | Error reporting endpoint | Sentry SDK |
| `CODE_SERVER_PASSWORD` | Password for internal code-server (port 8329) | code-server process |
| `NEKO_USER_PASSWORD` | Password for Neko WebRTC server (port 8333) | Neko server process |

### Source 2: User Secrets (`/home/ubuntu/.user_env`)

**When injected:** At session start time (dynamically by orchestration)
**Created:** Feb 9, 2026 (when this user's session started)
**Loaded by:** `.bashrc` on every shell spawn: `[ -f "$HOME/.user_env" ] && source "$HOME/.user_env"`

```bash
# User-defined secrets (from Manus Settings → Secrets panel)
export DATABASE_URL="aa41fd04-9b07-4508-b046-e6ac9daced02"
export CATS_FACTS_API="https://cat-fact.herokuapp.com"
```

**How users add these:**
```
1. User opens Manus Settings → Secrets panel
2. User adds key-value pair (e.g., DATABASE_URL = "...")
3. Manus backend stores encrypted secret
4. On next session start: Orchestration writes to ~/.user_env
5. Available in all shell sessions and code execution
```

### Source 3: Sandbox API Token (`/home/ubuntu/.secrets/sandbox_api_token`)

**When injected:** At session start time (dynamically by orchestration)
**Created:** Feb 9, 2026
**Format:** Plain text file containing a single token

```
sk-M4miWoGWn3hLQaPenoRoGX
```

**This token is THE master key.** It serves as:

| Used As | Purpose |
|---------|---------|
| `OPENAI_API_KEY` | Authenticates LLM proxy calls |
| `x-sandbox-token` header | Authenticates data_api.py proxy calls |
| Sandbox identity | Identifies which user/session this sandbox belongs to |

### Source 4: Dynamic Process Environment (injected by `start_server`)

**When injected:** When `start_server` spawns shell processes
**Not in any file** — injected directly into process environment

```bash
OPENAI_API_KEY=sk-M4miWoGWn3hLQaPenoRoGX
OPENAI_BASE_URL=https://api.manus.im/api/llm-proxy/v1
```

**Evidence:** `OPENAI_API_KEY` is NOT found in `.env` or `.user_env` files, but IS available in shell sessions. This means `start_server` injects it when creating PTY sessions.

---

## A.3 Webdev-Specific Variables (Injected by Orchestration)

When a webdev project is active, additional variables are injected:

| Variable | Value | Purpose |
|----------|-------|---------|
| `BUILT_IN_FORGE_API_KEY` | `<token>` | Internal Manus API key for server-side operations |
| `BUILT_IN_FORGE_API_URL` | `<url>` | Internal Manus API endpoint |
| `JWT_SECRET` | `<secret>` | JWT signing key for webdev auth |
| `OAUTH_SERVER_URL` | `<url>` | OAuth server for user authentication |
| `OWNER_NAME` | `"Khaleel"` | User's display name |
| `OWNER_OPEN_ID` | `"310519663278050818"` | User's unique Manus ID |
| `VITE_ANALYTICS_ENDPOINT` | `<url>` | Analytics collection endpoint |
| `VITE_ANALYTICS_WEBSITE_ID` | `<id>` | Analytics site identifier |
| `VITE_APP_ID` | `<id>` | Application identifier |
| `VITE_APP_LOGO` | `<url>` | Application logo URL |
| `VITE_APP_TITLE` | `"Test WebDev Trace"` | Application title |
| `VITE_FRONTEND_FORGE_API_KEY` | `<key>` | Frontend-safe API key |
| `VITE_FRONTEND_FORGE_API_URL` | `<url>` | Frontend API endpoint |
| `VITE_OAUTH_PORTAL_URL` | `<url>` | OAuth portal for login UI |

**Note:** Variables prefixed with `VITE_` are exposed to the browser via Vite's `import.meta.env`. Variables without the prefix are server-side only.

---

## A.4 The Multi-Purpose Token

The sandbox API token (`sk-M4miWoGWn3hLQaPenoRoGX`) is used in three distinct contexts:

### Context 1: LLM Proxy Access
```python
from openai import OpenAI
client = OpenAI()  # Reads OPENAI_API_KEY and OPENAI_BASE_URL from env
response = client.chat.completions.create(
    model="gpt-4.1-nano",
    messages=[{"role": "user", "content": "Hello"}]
)
# Request goes to: https://api.manus.im/api/llm-proxy/v1/chat/completions
# Authorization: Bearer sk-M4miWoGWn3hLQaPenoRoGX
```

**Available models through proxy:**
- `gpt-4.1-mini` (OpenAI)
- `gpt-4.1-nano` (OpenAI)
- `gemini-2.5-flash` (Google)

### Context 2: Data API Proxy
```python
from data_api import ApiClient
client = ApiClient()  # Reads token from ~/.secrets/sandbox_api_token
result = client.call_api(
    api_id_or_name="some_api",
    body={...}
)
# Request goes to: https://api.manus.im/apiproxy.v1.ApiProxyService/CallApi
# Header: x-sandbox-token: sk-M4miWoGWn3hLQaPenoRoGX
```

### Context 3: Sandbox Identity
```
Orchestration → E2B Sandbox:
  "Which sandbox is this?" → Token identifies user + session
  Used for: billing, rate limiting, access control
```

---

## A.5 Environment Variable Injection Timeline

```
TIME 0: E2B Template Built
    ├── /home/ubuntu/.env created (system config)
    ├── /home/ubuntu/.bashrc created (sources .env files)
    ├── start_server binary installed
    └── All packages pre-installed

TIME 1: Sandbox Spawned from Template (~150ms)
    ├── Firecracker microVM boots
    ├── start_server starts (PID 794)
    ├── Chromium starts (PID 901)
    ├── Neko starts (port 8333)
    └── Base .env already present

TIME 2: Session Initialized (orchestration connects)
    ├── Orchestration writes /home/ubuntu/.user_env
    ├── Orchestration writes /home/ubuntu/.secrets/sandbox_api_token
    ├── start_server registers with orchestration
    └── WebSocket connection established (8330 → 10.9.181.1)

TIME 3: First Shell Spawned (tool call)
    ├── start_server creates PTY
    ├── bash starts, sources .bashrc
    ├── .bashrc sources .env (system vars loaded)
    ├── .bashrc sources .user_env (user secrets loaded)
    ├── start_server injects OPENAI_API_KEY into process env
    └── Shell ready for commands

TIME 4: Subtask Spawned (map tool)
    ├── NEW E2B sandbox created from same template
    ├── Same .env (from template)
    ├── Same .user_env (injected by orchestration)
    ├── Same sandbox_api_token (injected by orchestration)
    ├── Same OPENAI_API_KEY (for independent LLM calls)
    └── Subtask LLM runs independently
```

---

## A.6 Why Each Variable Exists

### For Nested LLM Calls (map tool)
```
OPENAI_API_KEY → Authenticates subtask LLM calls
OPENAI_BASE_URL → Routes through Manus proxy (not direct to OpenAI)
```

When the `map` tool spawns 3 subtask sandboxes:
```
Main Sandbox (169.254.0.21)
    └── map(inputs=["A", "B", "C"])
        ├── Subtask Sandbox #1: OPENAI_API_KEY=sk-M4mi... → Calls LLM for "A"
        ├── Subtask Sandbox #2: OPENAI_API_KEY=sk-M4mi... → Calls LLM for "B"
        └── Subtask Sandbox #3: OPENAI_API_KEY=sk-M4mi... → Calls LLM for "C"
```

### For User Code
```
OPENAI_API_KEY → User's Python/Node.js code can call LLMs
DATABASE_URL → User's code can connect to their database
CATS_FACTS_API → User's code can call their custom APIs
```

### For Observability
```
OTEL_EXPORTER_OTLP_ENDPOINT → Every tool execution traced
OTEL_SERVICE_NAME → Identifies traces as "sandbox-runtime"
SENTRY_DSN → Errors captured and reported
```

### For Internal Services
```
CODE_SERVER_PASSWORD → Protects code-server (port 8329)
NEKO_USER_PASSWORD → Protects Neko WebRTC (port 8333)
RUNTIME_API_HOST → start_server knows where Manus API is
```

---

## A.7 Verified by Live Testing

During investigation, I ran this test inside the sandbox:

```python
from openai import OpenAI
client = OpenAI()  # Uses env vars automatically
response = client.chat.completions.create(
    model="gpt-4.1-nano",
    messages=[{"role": "user", "content": "Say hello from inside E2B sandbox"}]
)
print(response.choices[0].message.content)
# Output: "Hello from inside E2B sandbox!"
# Tokens used: 33
```

**This proves:**
1. `OPENAI_API_KEY` is correctly set in the environment
2. `OPENAI_BASE_URL` correctly points to Manus proxy
3. LLM calls work from within the sandbox
4. The proxy routes to real LLM providers (gpt-4.1-nano responded)
5. Billing is tracked through the proxy (token identifies the user)
