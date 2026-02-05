# Rubic Backend Microservices Documentation

**Version:** 1.0.0  
**Status:** In Development  
**Last Updated:** 2026-02-04

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Service Catalog](#service-catalog)
4. [API Design](#api-design)
5. [Database Schema](#database-schema)
6. [Real-Time Communication](#real-time-communication)
7. [Device Control System](#device-control-system)
8. [AI Agent Orchestration](#ai-agent-orchestration)
9. [Third-Party Integrations](#third-party-integrations)
10. [Deployment & Operations](#deployment--operations)

---

## Overview

Rubic's backend is a polyglot microservices architecture designed for real-time AI agent orchestration, device control, and workflow automation. It leverages multiple languages (TypeScript, Python, Go) to optimize for specific service requirements.

### Key Capabilities

- **Multi-Agent AI Orchestration** - DAG-based agent workflows with tool calling
- **Real-Time Device Control** - PC, MQTT, WiFi, Bluetooth device management
- **Workflow Automation** - Scheduled tasks with durable execution
- **Code Sandboxing** - Secure AI-generated code execution
- **Third-Party Integrations** - 800+ tools via Composio

### Technology Stack

| Service   | Language | Framework | Purpose                      |
| --------- | -------- | --------- | ---------------------------- |
| Gateway   | Node.js  | Fastify   | API routing, WebSocket proxy |
| Task      | Node.js  | Fastify   | Task lifecycle management    |
| Agent     | Python   | FastAPI   | LLM orchestration, tools     |
| Device    | Go       | Chi       | Device control, MQTT         |
| File      | Node.js  | Fastify   | File upload, S3              |
| Website   | Node.js  | Fastify   | Website builder, deployments |
| Knowledge | Python   | FastAPI   | RAG, embeddings              |
| Sandbox   | Go       | gRPC      | E2B sandbox orchestration    |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENT LAYER                                      │
│  Next.js App  │  Mobile Apps  │  CLI Tools  │  Third-Party Webhooks                │
└───────────────────┬────────────────┬────────────────┬────────────────┬──────────────┘
                    │                │                │                │
                    ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY LAYER (AWS ALB)                             │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │  Rate Limiting  │  Auth Validation  │  Request Routing  │  TLS Termination  │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
└───────────────────┬────────────────┬────────────────┬────────────────┬──────────────┘
                    │                │                │                │
┌───────────────────┴────────────────┴────────────────┴────────────────┴──────────────┐
│                              MICROSERVICES LAYER (ECS Fargate)                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │   Gateway    │  │    Task      │  │    Agent     │  │   Device     │            │
│  │   Service    │  │   Service    │  │   Service    │  │   Service    │            │
│  │  (Node.js)   │  │  (Node.js)   │  │  (Python)    │  │    (Go)      │            │
│  │    :3000     │  │    :3001     │  │    :3002     │  │    :3005     │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                 │                 │                 │                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │    File      │  │   Project    │  │   Sandbox    │  │  Connector   │            │
│  │   Service    │  │   Service    │  │   Service    │  │   Service    │            │
│  │  (Node.js)   │  │  (Node.js)   │  │    (Go)      │  │  (Node.js)   │            │
│  │    :3003     │  │    :3004     │  │    :3009     │  │    :3008     │            │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │   Webhook    │  │   Billing    │  │  Knowledge   │  │Notification  │            │
│  │   Service    │  │   Service    │  │   Service    │  │   Service    │            │
│  │  (Node.js)   │  │  (Node.js)   │  │  (Python)    │  │  (Node.js)   │            │
│  │    :3006     │  │    :3011     │  │    :3010     │  │    :3007     │            │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                    │                │                │                │
                    ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA & MESSAGING LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │  PostgreSQL  │  │    Redis     │  │  AWS SQS/    │  │   AWS S3     │            │
│  │    (RDS)     │  │ (ElastiCache)│  │  EventBridge │  │   Storage    │            │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                                      │
│  ┌──────────────┐  ┌──────────────┐                                                  │
│  │   pgvector   │  │   AWS IoT    │                                                  │
│  │  (Embeddings)│  │    Core      │                                                  │
│  └──────────────┘  └──────────────┘                                                  │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL SERVICES                                       │
│  OpenAI │ Anthropic │ Google │ Composio │ E2B │ Stripe │ Resend │ AWS Services      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Communication Patterns

| Pattern          | Use Case                   | Implementation       |
| ---------------- | -------------------------- | -------------------- |
| **Synchronous**  | Immediate request/response | REST API, gRPC       |
| **Asynchronous** | Background jobs, events    | AWS SQS, EventBridge |
| **Real-time**    | Streaming, live updates    | WebSocket, SSE       |
| **Pub/Sub**      | Broadcast, notifications   | Redis Pub/Sub        |

---

## Service Catalog

### 1. Gateway Service (Node.js/TypeScript)

**Port:** 3000  
**Status:** Implemented  
**Lines of Code:** ~600

**Responsibilities:**

- HTTP request routing to downstream services
- WebSocket connection management
- Authentication/authorization
- Rate limiting
- Request/response transformation
- API versioning

**Key Endpoints:**

```yaml
POST   /v1/auth/token           # Exchange credentials for token
GET    /v1/health              # Health check
WS     /v1/stream              # WebSocket for real-time
ALL    /v1/:service/*          # Proxy to services
```

**Implementation:**

```typescript
// services/gateway/src/index.ts
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { proxyRoutes } from "./routes/proxy";
import { websocketRoutes } from "./routes/websocket";

const app = Fastify({
  logger: true,
  requestIdHeader: "x-request-id",
});

await app.register(websocket);
await app.register(proxyRoutes, { prefix: "/v1" });
await app.register(websocketRoutes, { prefix: "/v1" });
```

---

### 2. Task Service (Node.js/TypeScript)

**Port:** 3001  
**Status:** Partially Implemented  
**Lines of Code:** ~430

**Responsibilities:**

- Task CRUD operations
- Task status management
- Multi-turn conversation handling
- Task scheduling

**Key Endpoints:**

```yaml
POST   /v1/tasks                # Create task
GET    /v1/tasks                # List tasks
GET    /v1/tasks/:id            # Get task
PUT    /v1/tasks/:id            # Update task
DELETE /v1/tasks/:id            # Delete task
POST   /v1/tasks/:id/continue   # Continue multi-turn
POST   /v1/tasks/:id/cancel     # Cancel task
```

**Database Schema:**

```typescript
// packages/database/src/schema/tasks.ts
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id"),
  prompt: text("prompt").notNull(),
  agentProfile: text("agent_profile").default("rubic-1.0"),
  taskMode: text("task_mode").default("agent"),
  status: text("status").default("pending"),
  error: jsonb("error"),
  config: jsonb("config").default({}),
  metadata: jsonb("metadata").default({}),
  creditUsage: integer("credit_usage").default(0),
  tokenUsage: jsonb("token_usage").default({}),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

---

### 3. Agent Service (Python/FastAPI)

**Port:** 3002  
**Status:** Implemented  
**Lines of Code:** ~680

**Responsibilities:**

- LLM provider orchestration (OpenAI, Anthropic, Google)
- Tool execution coordination
- Context management
- Streaming response handling
- Composio integration

**Key Endpoints:**

```yaml
POST   /v1/complete              # Generate completion
POST   /v1/complete/stream       # Streaming completion
GET    /v1/tools                 # List available tools
POST   /v1/tools/execute         # Execute tool
GET    /v1/health                # Health check
```

**Agent Profiles:**

```python
AGENT_PROFILES = {
    "rubic-1.0-lite": {
        "model": "gpt-4o-mini",
        "max_tokens": 4096,
        "tools": ["web_search", "calculator"],
        "cost_multiplier": 0.5
    },
    "rubic-1.0": {
        "model": "claude-3-5-sonnet",
        "max_tokens": 8192,
        "tools": ["all"],
        "cost_multiplier": 1.0
    },
    "rubic-1.0-max": {
        "model": "claude-opus",
        "max_tokens": 32768,
        "tools": ["all"],
        "cost_multiplier": 5.0
    }
}
```

**Tool Registry:**

```python
# services/agent/src/routes/tools.py
TOOLS: dict[str, ToolDefinition] = {
    "web_search": ToolDefinition(...),
    "browse_url": ToolDefinition(...),
    "execute_code": ToolDefinition(...),
    "terminal_command": ToolDefinition(...),
    "file_read": ToolDefinition(...),
    "file_write": ToolDefinition(...),
    "create_document": ToolDefinition(...),
    "generate_image": ToolDefinition(...),
}
```

---

### 4. Device Service (Go)

**Port:** 3005  
**Status:** Implemented  
**Lines of Code:** ~1,110

**Responsibilities:**

- PC remote control (terminal, file operations, browser)
- MQTT broker integration (AWS IoT Core)
- WiFi/Bluetooth device discovery
- Command execution with safety limits

**Key Endpoints:**

```yaml
POST   /v1/devices              # Register device
GET    /v1/devices              # List devices
GET    /v1/devices/:id          # Get device details
DELETE /v1/devices/:id          # Unregister device
POST   /v1/devices/:id/command  # Execute command
WS     /v1/devices/:id/stream   # Real-time stream
POST   /v1/tools/execute        # Tool execution
```

**Device Types:**

```go
const (
    DeviceTypePC        DeviceType = "pc"
    DeviceTypeMQTT      DeviceType = "mqtt"
    DeviceTypeWiFi      DeviceType = "wifi"
    DeviceTypeBluetooth DeviceType = "bluetooth"
)
```

**Safety Rules:**

```go
var DangerousCommands = []string{
    "rm -rf /",
    "rm -rf /*",
    "mkfs",
    ":(){:|:&};:",  // Fork bomb
}

var RequiresApproval = []string{
    "rm", "sudo", "chmod", "chown",
    "kill", "reboot", "shutdown",
}
```

---

### 5. Website Service (Node.js/TypeScript)

**Port:** 3004  
**Status:** Implemented  
**Lines of Code:** ~810

**Responsibilities:**

- Website/web app project creation
- AI code generation (like v0, Bolt, Lovable)
- WebContainer runtime for browser preview
- Template system (React, Next.js, Vue, Svelte)
- Deployment to production (Vercel, Netlify)
- Database provisioning (TiDB Serverless)

**Key Endpoints:**

```yaml
POST   /v1/websites              # Create website project
GET    /v1/websites              # List websites
PUT    /v1/websites/:id          # Update website
POST   /v1/websites/:id/generate # AI generate code
POST   /v1/websites/:id/deploy   # Deploy to production
POST   /v1/websites/:id/database # Provision TiDB
```

---

### 6. Other Services (Stubs)

| Service              | Status | Port | Language |
| -------------------- | ------ | ---- | -------- |
| File Service         | Stub   | 3003 | Node.js  |
| Project Service      | Stub   | 3004 | Node.js  |
| Webhook Service      | Stub   | 3006 | Node.js  |
| Notification Service | Stub   | 3007 | Node.js  |
| Connector Service    | Stub   | 3008 | Node.js  |
| Sandbox Service      | Stub   | 3009 | Go       |
| Knowledge Service    | Stub   | 3010 | Python   |
| Billing Service      | Stub   | 3011 | Node.js  |
| Search Service       | Stub   | 3012 | Node.js  |

---

## API Design

### API Standards

**Versioning:** URI path versioning (`/v1/`, `/v2/`)

**Authentication:**

- API Key header: `X-API-Key: <key>`
- JWT Bearer: `Authorization: Bearer <token>`

**Response Format:**

```json
{
  "data": {},
  "meta": {
    "request_id": "req_xxx",
    "timestamp": "2026-02-04T12:00:00Z"
  },
  "error": null
}
```

**Error Format:**

```json
{
  "data": null,
  "meta": {
    "request_id": "req_xxx",
    "timestamp": "2026-02-04T12:00:00Z"
  },
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [{ "field": "prompt", "message": "Required" }]
  }
}
```

---

## Database Schema

### PostgreSQL Schema Overview

```sql
-- Core schemas
CREATE SCHEMA IF NOT EXISTS core;       -- Users, auth, settings
CREATE SCHEMA IF NOT EXISTS tasks;      -- Task management
CREATE SCHEMA IF NOT EXISTS devices;    -- Device control
CREATE SCHEMA IF NOT EXISTS knowledge;  -- RAG/embeddings
CREATE SCHEMA IF NOT EXISTS billing;    -- Payments/subscriptions
CREATE SCHEMA IF NOT EXISTS integrations; -- Connectors/webhooks
```

### Key Tables

| Schema       | Table         | Purpose                     |
| ------------ | ------------- | --------------------------- |
| core         | users         | User accounts (Better-Auth) |
| tasks        | tasks         | Task definitions            |
| tasks        | task_messages | Conversation history        |
| devices      | devices       | Registered devices          |
| devices      | commands      | Device command log          |
| files        | files         | File metadata               |
| integrations | connectors    | OAuth integrations          |
| integrations | webhooks      | Webhook configurations      |

### Redis Data Structures

```yaml
# Session Management
session:{user_id}:{session_id}: Hash
  TTL: 7 days

# Rate Limiting
ratelimit:{user_id}:{endpoint}: String (counter)
  TTL: 60 seconds

# Task Streaming
task:stream:{task_id}: Stream
  TTL: 24 hours

# Device State
device:{device_id}:state: Hash
  TTL: 1 hour

# Pub/Sub Channels
channel:user:{user_id}
channel:task:{task_id}
channel:device:{device_id}
```

---

## Real-Time Communication

### WebSocket Architecture

```
Client ──WebSocket──► Gateway ──Redis Pub/Sub──► Services
                         │
                         └── Broadcast to other clients
```

### Event Types

```typescript
// Server → Client
type ServerEvent =
  | { type: "task_update"; taskId: string; status: TaskStatus }
  | { type: "task_progress"; taskId: string; message: string; progress?: number }
  | { type: "task_output"; taskId: string; content: MessagePart[] }
  | { type: "device_status"; deviceId: string; status: DeviceStatus }
  | { type: "device_output"; deviceId: string; output: string }
  | { type: "notification"; notification: Notification };

// Client → Server
type ClientEvent =
  | { type: "subscribe"; channels: string[] }
  | { type: "unsubscribe"; channels: string[] }
  | { type: "task_command"; taskId: string; action: "cancel" | "pause" | "resume" }
  | { type: "device_command"; deviceId: string; command: string };
```

---

## Device Control System

### Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                        DEVICE CONTROL LAYER                           │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    Device Service (Go)                           │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │  │
│  │  │ PC Control  │ │ MQTT Bridge │ │WiFi Manager │ │ BLE Mgr   │  │  │
│  │  │  Handler    │ │   Handler   │ │   Handler   │ │  Handler  │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │  │
│  │                                                                  │  │
│  │  ┌─────────────────────────────────────────────────────────────┐│  │
│  │  │              Safety & Validation Layer                      ││  │
│  │  └─────────────────────────────────────────────────────────────┘│  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
└────────────────┬──────────────────────┬───────────────────────────────┘
                 │                      │
    ┌────────────┴────────┐  ┌──────────┴───────────┐
    ▼                     ▼  ▼                      ▼
┌─────────┐        ┌────────────────┐        ┌──────────────┐
│   PC    │        │  AWS IoT Core  │        │   WiFi/BLE   │
│  Agent  │        │  (MQTT Broker) │        │   Devices    │
└─────────┘        └────────────────┘        └──────────────┘
```

### PC Agent Installation

```bash
# macOS/Linux
curl -fsSL https://agent.rubic.ai/install.sh | bash

# Windows (PowerShell)
iwr -useb https://agent.rubic.ai/install.ps1 | iex

# npm (cross-platform)
npm install -g @rubic/agent
rubic-agent start
```

### MQTT Topic Structure

```
rubic/{user_id}/{device_id}/telemetry    # Device → Cloud
rubic/{user_id}/{device_id}/command      # Cloud → Device
rubic/{user_id}/{device_id}/command/ack  # Device → Cloud
rubic/{user_id}/{device_id}/status       # Bidirectional
rubic/{user_id}/{device_id}/config       # Cloud → Device
```

---

## AI Agent Orchestration

### Multi-Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       AGENT SERVICE (Python)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Agent Orchestrator                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │  │
│  │  │   Router    │  │   Planner   │  │  Executor   │          │  │
│  │  │   Agent     │  │   Agent     │  │   Agent     │          │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    LLM Provider Layer                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  │
│  │  │ Anthropic│  │  OpenAI  │  │  Google  │  │  Custom  │     │  │
│  │  │  Claude  │  │  GPT-4   │  │  Gemini  │  │  Models  │     │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      Tool Registry                            │  │
│  │  • Web Search    • Code Execution   • File Operations         │  │
│  │  • Browser       • API Calls        • Device Control          │  │
│  │  • Knowledge     • Image Gen        • Data Analysis           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Tool Integration (Composio)

```python
# services/agent/src/tools/composio_tools.py
from composio import ComposioToolSet

toolset = ComposioToolSet(api_key=os.getenv('COMPOSIO_API_KEY'))

# Get pre-configured tools
gmail_tools = toolset.get_tools(actions=['GMAIL_SEND_EMAIL'])
slack_tools = toolset.get_tools(actions=['SLACK_SEND_MESSAGE'])
github_tools = toolset.get_tools(actions=['GITHUB_CREATE_ISSUE'])

# Execute tool
toolset.execute_action(
    action='GMAIL_SEND_EMAIL',
    params={
        'to': 'user@example.com',
        'subject': 'Hello from Rubic',
        'body': 'This is an AI-generated email.'
    },
    entity_id=user_id
)
```

---

## Third-Party Integrations

### Service Matrix

| Service          | Category      | Purpose                     | Status  |
| ---------------- | ------------- | --------------------------- | ------- |
| **Composio**     | AI Tools      | 800+ pre-built integrations | Active  |
| **Inngest**      | Workflows     | Durable execution           | Planned |
| **E2B**          | Sandboxing    | Secure code execution       | Active  |
| **AWS IoT Core** | Device Mgmt   | MQTT broker                 | Active  |
| **Stripe**       | Payments      | Billing/subscriptions       | Active  |
| **Knock**        | Notifications | Multi-channel notifications | Active  |
| **Svix**         | Webhooks      | Webhook delivery            | Active  |
| **Resend**       | Email         | Transactional emails        | Active  |
| **PostHog**      | Analytics     | Product analytics           | Active  |
| **Sentry**       | Errors        | Error tracking              | Active  |

### Composio Integration

```python
# Configuration
COMPOSIO_API_KEY=your_api_key

# Supported Integrations
- Gmail, Google Calendar, Google Drive
- Slack, Discord, Microsoft Teams
- GitHub, GitLab, Bitbucket
- Notion, Confluence, Linear
- Jira, Asana, Trello
- HubSpot, Salesforce, Zendesk
- 800+ more
```

---

## Deployment & Operations

### Docker Compose (Development)

```yaml
# docker-compose.services.yml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: rubic
      POSTGRES_PASSWORD: rubic
      POSTGRES_DB: rubic
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  gateway:
    build: ./services/gateway
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://rubic:rubic@postgres:5432/rubic
      - REDIS_URL=redis://redis:6379

  agent:
    build: ./services/agent
    ports:
      - "3002:3002"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - E2B_API_KEY=${E2B_API_KEY}
      - COMPOSIO_API_KEY=${COMPOSIO_API_KEY}
```

### AWS Deployment

| Component      | Service                   |
| -------------- | ------------------------- |
| Compute        | ECS Fargate               |
| Load Balancing | Application Load Balancer |
| Database       | RDS PostgreSQL            |
| Cache          | ElastiCache Redis         |
| Storage        | S3                        |
| IoT            | AWS IoT Core              |
| Message Queue  | SQS + EventBridge         |
| Secrets        | AWS Secrets Manager       |

### Monitoring

```typescript
// Health check endpoint
GET /health

Response:
{
  "status": "healthy",
  "service": "gateway",
  "version": "1.0.0",
  "checks": {
    "database": "pass",
    "redis": "pass",
    "upstream": "pass"
  }
}
```

---

## Related Documentation

- [Frontend Architecture](../frontend/README.md)
- [Testing Guide](../testing/README.md)
- [Device Control ADR](../adr/004-device-control-system.md)
- [Microservices Stack ADR](../adr/002-microservices-stack.md)
- [Database Design ADR](../adr/003-database-design.md)
