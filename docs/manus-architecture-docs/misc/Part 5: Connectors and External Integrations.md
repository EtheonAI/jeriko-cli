# Part 5: Connectors and External Integrations

## 5.1 Overview

Manus extends its capabilities through **connectors** — external service integrations using the **Model Context Protocol (MCP)**. These connectors allow Claude to interact with third-party services (Gmail, Slack, GitHub, etc.) through a standardized protocol. Over **190 connectors** are available in the Manus settings panel.

---

## 5.2 MCP Architecture

### What is MCP?

MCP (Model Context Protocol) is an open protocol (created by Anthropic) that standardizes how LLMs communicate with external tools and data sources. Manus uses MCP as the backbone for all connector integrations.

### MCP Flow in Manus

```
Claude decides to use a connector (e.g., Gmail)
    ↓
Claude calls shell_exec with manus-mcp-cli command
    ↓
Orchestration → E2B Sandbox → start_server → PTY
    ↓
manus-mcp-cli binary executes inside sandbox
    ↓
manus-mcp-cli → HTTPS → MCP Server (Manus infrastructure)
    ↓
MCP Server → OAuth → External API (e.g., Gmail API)
    ↓
Response → MCP Server → manus-mcp-cli → stdout/file
    ↓
Claude reads the output
```

**Key insight:** MCP tools are NOT first-class tools like `file_write` or `shell_exec`. They are accessed **indirectly** through the shell tool by running `manus-mcp-cli`.

---

## 5.3 manus-mcp-cli Binary

### Location and Usage

```bash
# Binary location
/usr/local/bin/manus-mcp-cli

# List available tools for a server
manus-mcp-cli tool list --server gmail

# Call a specific tool
manus-mcp-cli tool call gmail_search_messages --server gmail --input '{"query": "from:user@example.com"}'
```

### How It Works

1. **Pre-configured servers:** The orchestration layer injects MCP server configurations into the sandbox environment
2. **Authentication:** OAuth tokens are stored server-side (Manus infrastructure), not in the sandbox
3. **Transport:** manus-mcp-cli communicates with MCP servers over HTTPS
4. **Results:** Large results are written to `/tmp/manus-mcp/mcp_result_*.json`

### Configuration Injection

When a user enables a connector in Manus settings:
```
1. User enables "Gmail" in Settings → Connectors
2. OAuth flow: User → Google OAuth → Manus stores tokens
3. On next session: Orchestration injects MCP config into sandbox
4. System prompt updated: "The following MCP server names are configured: gmail"
5. Claude now knows it can use manus-mcp-cli --server gmail
```

---

## 5.4 Gmail Connector (Detailed Example)

### Available Tools

```bash
$ manus-mcp-cli tool list --server gmail
```

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `gmail_search_messages` | `query`, `maxResults` | Search emails |
| `gmail_read_threads` | `threadIds[]` | Read full threads |
| `gmail_send_messages` | `to`, `subject`, `body`, `cc`, `bcc` | Send email |
| `gmail_create_draft` | `to`, `subject`, `body` | Create draft |
| `gmail_get_labels` | - | List all labels |
| `gmail_modify_labels` | `messageIds[]`, `addLabels[]`, `removeLabels[]` | Modify labels |

### Execution Example

```bash
# Claude executes this via shell_exec:
manus-mcp-cli tool call gmail_search_messages \
  --server gmail \
  --input '{"query": "from:boss@company.com after:2026/02/01", "maxResults": 10}'

# Output (to stdout or /tmp/manus-mcp/mcp_result_*.json):
{
  "messages": [
    {
      "id": "msg_abc123",
      "threadId": "thread_xyz",
      "from": "boss@company.com",
      "subject": "Q1 Review",
      "snippet": "Please review the attached...",
      "date": "2026-02-05T10:30:00Z",
      "labels": ["INBOX", "IMPORTANT"]
    }
  ]
}
```

### OAuth Flow

```
User clicks "Connect Gmail" in Manus Settings
    ↓
Manus redirects to Google OAuth consent screen
    ↓
User grants permissions (read, send, modify)
    ↓
Google returns authorization code to Manus callback
    ↓
Manus exchanges code for access_token + refresh_token
    ↓
Tokens stored in Manus backend (NOT in sandbox)
    ↓
MCP server uses stored tokens for API calls
```

---

## 5.5 Connector Categories

Based on the 190+ available connectors:

| Category | Examples | Protocol |
|----------|----------|----------|
| Email | Gmail, Outlook | MCP → OAuth → REST API |
| Calendar | Google Calendar, Outlook Calendar | MCP → OAuth → REST API |
| Messaging | Slack, Discord, Teams | MCP → OAuth → REST/WebSocket API |
| Code | GitHub, GitLab, Bitbucket | MCP → OAuth → REST API |
| Storage | Google Drive, Dropbox, OneDrive | MCP → OAuth → REST API |
| CRM | Salesforce, HubSpot | MCP → OAuth → REST API |
| Project Management | Jira, Asana, Linear, Notion | MCP → OAuth → REST API |
| Social | Twitter/X, LinkedIn | MCP → OAuth → REST API |
| Database | Supabase, Firebase | MCP → API Key → REST API |
| Custom | User-defined MCP servers | MCP → Custom auth |

---

## 5.6 Custom Secrets (Environment Variables)

Users can add custom API keys and secrets through the Management UI:

### How Secrets Work

```
1. User adds secret in Settings → Secrets panel
2. Secret stored in Manus backend (encrypted)
3. On session start: Secrets injected as environment variables
4. Available in sandbox: process.env.MY_SECRET or $MY_SECRET
```

### Pre-injected Secrets (Always Available)

| Variable | Purpose |
|----------|---------|
| `BUILT_IN_FORGE_API_KEY` | Internal Manus API key |
| `BUILT_IN_FORGE_API_URL` | Internal Manus API URL |
| `JWT_SECRET` | JWT signing for webdev auth |
| `OAUTH_SERVER_URL` | OAuth server endpoint |
| `OWNER_NAME` | User's display name |
| `OWNER_OPEN_ID` | User's unique ID |
| `VITE_ANALYTICS_ENDPOINT` | Analytics collection endpoint |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics site identifier |
| `VITE_APP_ID` | Application identifier |
| `VITE_APP_LOGO` | Application logo URL |
| `VITE_APP_TITLE` | Application title |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend API key |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend API URL |
| `VITE_OAUTH_PORTAL_URL` | OAuth portal URL |

### User-Defined Secrets (Per Task)

From the task context:
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | User's website database connection |
| `CATS_FACTS_API` | Cats Facts API endpoint |

---

## 5.7 LLM Proxy Integration

Manus provides an LLM proxy that allows code running inside the sandbox to make LLM API calls:

### Endpoint
```
POST https://api.manus.im/api/llm-proxy/v1/chat/completions
Authorization: Bearer $OPENAI_API_KEY  (injected into sandbox)
```

### How It Works
```
Code in sandbox → HTTP POST → api.manus.im/api/llm-proxy/v1
    ↓
Manus proxy → Validates token → Routes to actual LLM provider
    ↓
LLM response → Manus proxy → Code in sandbox
```

### Use Cases
- Webdev apps that need AI features (chatbots, summarizers)
- Data processing scripts that need LLM analysis
- MCP servers that need LLM capabilities

### Environment Variables for LLM Proxy
```bash
OPENAI_API_KEY=<injected_token>
VITE_FRONTEND_FORGE_API_KEY=<frontend_key>
VITE_FRONTEND_FORGE_API_URL=<frontend_url>
```

---

## 5.8 Data APIs

Manus provides built-in data APIs accessible from webdev projects:

### Manus OAuth API
```
POST $OAUTH_SERVER_URL/api/auth/login
POST $OAUTH_SERVER_URL/api/auth/verify
GET  $OAUTH_SERVER_URL/api/auth/user
```

### Manus Analytics API
```
POST $VITE_ANALYTICS_ENDPOINT/api/send
  Body: { website: $VITE_ANALYTICS_WEBSITE_ID, ... }
```

### Forge API (Internal)
```
POST $BUILT_IN_FORGE_API_URL/api/v1/...
Authorization: Bearer $BUILT_IN_FORGE_API_KEY
```

Used for:
- Image generation
- Speech-to-text
- S3 file storage
- Push notifications

---

## 5.9 S3 File Storage

### Upload Flow
```
File in sandbox → manus-upload-file → S3 → CDN URL
```

### CDN Domain
```
https://cdn.manus.im/<path>
```

### Usage in Code
```bash
# Upload from sandbox
manus-upload-file /home/ubuntu/image.png
# Returns: https://cdn.manus.im/uploads/abc123/image.png

# Use in webdev project
<img src="https://cdn.manus.im/uploads/abc123/image.png" />
```

### Important Rule
Static assets MUST NOT be stored in the project directory. They must be uploaded to S3 and referenced via CDN URLs. This prevents repository bloat and deployment timeouts.

---

## 5.10 OpenTelemetry Integration

Manus uses OpenTelemetry for observability:

### Traced Components
```
OTEL_EXPORTER_OTLP_ENDPOINT → Manus telemetry collector
```

### What Gets Traced
- Tool execution timing
- LLM API call latency
- Sandbox operations
- Error rates
- Session lifecycle events

### Sentry Integration
```
SENTRY_DSN → Error reporting
```

Captures:
- Unhandled exceptions in sandbox
- Frontend JavaScript errors
- Backend service errors
