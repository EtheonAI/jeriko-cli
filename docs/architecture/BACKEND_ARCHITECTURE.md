# Rubic Backend Microservices Architecture

**Version:** 1.0.0
**Status:** Planning
**Date:** 2026-02-04
**Authors:** Engineering Team

---

## Executive Summary

This document outlines the comprehensive backend microservices architecture for Rubic, an AI-powered autonomous agent platform. The architecture is designed based on extensive reverse engineering of Manus.im's production system and aligned with 2026 best practices for cloud-native, real-time AI platforms.

**Key Objectives:**
- Build a scalable, AWS-hosted microservices backend
- Support real-time streaming and bidirectional communication
- Enable device control (PC, MQTT, IoT, WiFi/Bluetooth)
- Integrate seamlessly with the existing Next.js frontend
- Maintain polyglot capabilities (TypeScript, Python, Go)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Principles](#2-architecture-principles)
3. [Service Decomposition](#3-service-decomposition)
4. [API Design](#4-api-design)
5. [Database Architecture](#5-database-architecture)
6. [Real-Time Communication](#6-real-time-communication)
7. [Device Control System](#7-device-control-system)
8. [AI Agent Orchestration](#8-ai-agent-orchestration)
9. [Infrastructure & Deployment](#9-infrastructure--deployment)
10. [Security Architecture](#10-security-architecture)
11. [Third-Party Integrations](#11-third-party-integrations)
12. [Monorepo Structure](#12-monorepo-structure)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENT LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Next.js App (apps/app)  │  Mobile Apps  │  CLI Tools  │  Third-Party Integrations  │
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
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                 │                 │                 │                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │    File      │  │   Project    │  │   Sandbox    │  │  Connector   │            │
│  │   Service    │  │   Service    │  │   Service    │  │   Service    │            │
│  │  (Node.js)   │  │  (Node.js)   │  │    (Go)      │  │  (Node.js)   │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                 │                 │                 │                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │   Webhook    │  │   Billing    │  │  Knowledge   │  │Notification  │            │
│  │   Service    │  │   Service    │  │   Service    │  │   Service    │            │
│  │  (Node.js)   │  │  (Node.js)   │  │  (Python)    │  │  (Node.js)   │            │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘            │
│         │                 │                 │                                       │
│  ┌──────────────┐  ┌──────────────┐                                                │
│  │   Website    │  │   Search     │                                                │
│  │   Service    │  │   Service    │                                                │
│  │  (Node.js)   │  │  (Node.js)   │                                                │
│  └──────────────┘  └──────────────┘                                                │
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
│  │    (RDS)     │  │ (ElastiCache)│  │   EventBrg   │  │   Storage    │            │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                              │
│  │   Pinecone/  │  │   AWS IoT    │  │   OpenSearch │                              │
│  │   pgvector   │  │    Core      │  │              │                              │
│  └──────────────┘  └──────────────┘  └──────────────┘                              │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL SERVICES                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  LLM Providers (OpenAI, Anthropic, Google) │ Composio │ E2B │ Stripe │ Resend      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack Summary

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **API Gateway** | AWS ALB + API Gateway | Native AWS integration, WebSocket support |
| **Compute** | ECS Fargate | Serverless containers, auto-scaling |
| **Primary DB** | PostgreSQL (RDS) | Relational data, ACID compliance |
| **Cache** | Redis (ElastiCache) | Session cache, rate limiting, pub/sub |
| **Message Queue** | AWS SQS + EventBridge | Async task processing, event routing |
| **Object Storage** | AWS S3 | File storage with presigned URLs |
| **Vector DB** | pgvector / Pinecone | Embeddings for RAG |
| **IoT** | AWS IoT Core | MQTT device communication |
| **Search** | OpenSearch | Full-text search, logging |
| **Monitoring** | CloudWatch + Sentry | Observability stack |

---

## 2. Architecture Principles

### 2.1 Core Principles

1. **Service Autonomy**
   - Each microservice owns its data and can be deployed independently
   - Services communicate via well-defined APIs (REST/gRPC) and events

2. **Event-Driven Architecture**
   - Asynchronous communication for long-running operations
   - Event sourcing for agent task execution
   - Real-time updates via WebSocket/SSE

3. **Polyglot Persistence**
   - Right database for the right job
   - PostgreSQL for relational data, Redis for cache, S3 for files

4. **API-First Design**
   - OpenAPI specifications before implementation
   - tRPC for type-safe internal communication
   - REST for external/public APIs

5. **Security by Design**
   - Zero-trust network model
   - Encryption at rest and in transit
   - Principle of least privilege

6. **Cloud-Native**
   - Containerized workloads
   - Infrastructure as Code (Terraform/CDK)
   - Auto-scaling based on demand

### 2.2 Design Patterns

| Pattern | Application |
|---------|-------------|
| **API Gateway** | Single entry point, authentication, rate limiting |
| **CQRS** | Separate read/write models for task management |
| **Saga** | Distributed transactions for multi-step agent tasks |
| **Circuit Breaker** | Resilience for LLM provider failures |
| **Event Sourcing** | Agent execution history and replay |
| **Sidecar** | Service mesh for observability |

---

## 3. Service Decomposition

### 3.1 Service Inventory

| Service | Language | Responsibility | Port |
|---------|----------|----------------|------|
| **Gateway Service** | Node.js/TS | API routing, WebSocket management | 3000 |
| **Task Service** | Node.js/TS | Task lifecycle, status management | 3001 |
| **Agent Service** | Python | LLM orchestration, tool execution | 3002 |
| **File Service** | Node.js/TS | Upload, presigned URLs, cleanup | 3003 |
| **Project Service** | Node.js/TS | Project management, defaults | 3004 |
| **Device Service** | Go | MQTT, PC control, IoT | 3005 |
| **Webhook Service** | Node.js/TS | Event delivery, retry logic | 3006 |
| **Notification Service** | Node.js/TS | Push, email, in-app | 3007 |
| **Connector Service** | Node.js/TS | OAuth, third-party integrations | 3008 |
| **Sandbox Service** | Go | E2B/Firecracker orchestration | 3009 |
| **Knowledge Service** | Python | RAG, embeddings, vector search | 3010 |
| **Billing Service** | Node.js/TS | Stripe, credits, subscriptions | 3011 |

### 3.2 Service Details

#### 3.2.1 Gateway Service (Node.js/TypeScript)

**Responsibilities:**
- HTTP/WebSocket request routing
- Authentication/authorization
- Rate limiting
- Request/response transformation
- API versioning

**Key Endpoints:**
```
POST   /v1/auth/token           - Exchange credentials for token
GET    /v1/health               - Health check
WS     /v1/stream               - WebSocket connection for real-time
```

**Technology:**
- Fastify for HTTP (faster than Express)
- ws library for WebSocket
- Redis for session management
- JWT validation

#### 3.2.2 Task Service (Node.js/TypeScript)

**Responsibilities:**
- Task CRUD operations
- Task status management
- Task queue coordination
- Multi-turn conversation handling

**Key Endpoints:**
```
POST   /v1/tasks                - Create new task
GET    /v1/tasks                - List tasks with filtering
GET    /v1/tasks/:id            - Get task details
PUT    /v1/tasks/:id            - Update task
DELETE /v1/tasks/:id            - Delete task
POST   /v1/tasks/:id/continue   - Continue multi-turn task
```

**Database Tables:**
- `tasks` - Task definitions and status
- `task_messages` - Conversation history
- `task_outputs` - Generated outputs

#### 3.2.3 Agent Service (Python)

**Responsibilities:**
- LLM provider orchestration (OpenAI, Anthropic, Google)
- Tool execution coordination
- Context management
- Streaming response handling

**Technology:**
- FastAPI for async API
- LangChain/LiteLLM for provider abstraction
- Pydantic for validation
- asyncio for concurrent execution

**Key Features:**
- Multi-model routing (lite/standard/max)
- Thinking budget management
- Tool call validation
- Streaming via SSE

#### 3.2.4 Device Service (Go)

**Responsibilities:**
- PC remote control (terminal commands)
- MQTT broker integration
- WiFi/Bluetooth device discovery
- Device state management
- Command execution with safety limits

**Technology:**
- Go for high-performance concurrency
- Eclipse Paho for MQTT
- gRPC for internal communication
- Protocol buffers for message serialization

**Key Endpoints:**
```
POST   /v1/devices              - Register device
GET    /v1/devices              - List devices
POST   /v1/devices/:id/command  - Execute command
WS     /v1/devices/:id/stream   - Real-time device stream
DELETE /v1/devices/:id          - Unregister device
```

#### 3.2.5 File Service (Node.js/TypeScript)

**Responsibilities:**
- Presigned URL generation (S3)
- File metadata management
- Auto-cleanup (48-hour TTL)
- Virus scanning integration

**Key Endpoints:**
```
POST   /v1/files                - Get presigned upload URL
GET    /v1/files                - List user files
GET    /v1/files/:id            - Get file details
DELETE /v1/files/:id            - Delete file
```

#### 3.2.6 Sandbox Service (Go)

**Responsibilities:**
- E2B sandbox provisioning
- Code execution isolation
- Resource limit enforcement
- Session management

**Integration:**
- E2B SDK for sandboxed execution
- Firecracker MicroVMs for isolation
- gRPC for Agent Service communication

#### 3.2.7 Website Service (Node.js/TypeScript)

**Responsibilities:**
- Website/web app project creation
- Real-time AI code generation (like v0, Bolt, Lovable, Replit)
- WebContainer runtime for browser-based preview
- Template system (React, Next.js, Vue, Svelte, etc.)
- Deployment to production (Vercel, Netlify, custom domains)
- Database provisioning (TiDB Serverless/PingCAP)

**Technology:**
- Node.js/TypeScript for API
- WebContainers API for browser-based execution
- Sandpack for code editor components
- Claude/GPT for AI code generation
- Monaco Editor for IDE experience

**Key Endpoints:**
```
POST   /v1/websites                    - Create new website project
GET    /v1/websites                    - List user's websites
GET    /v1/websites/:id                - Get website details
PUT    /v1/websites/:id                - Update website
DELETE /v1/websites/:id                - Delete website
POST   /v1/websites/:id/generate       - AI generate/modify code
POST   /v1/websites/:id/preview        - Generate preview URL
POST   /v1/websites/:id/deploy         - Deploy to production
GET    /v1/websites/:id/files          - List project files
PUT    /v1/websites/:id/files/:path    - Update file content
POST   /v1/websites/:id/database       - Provision TiDB database
```

**Database Tables:**
- `website_projects` - Project metadata, settings
- `website_files` - File contents with version history
- `website_deployments` - Deployment records
- `website_databases` - TiDB database credentials per project

**TiDB/PingCAP Integration:**
```typescript
interface WebsiteDatabase {
  id: string;
  projectId: string;
  tidbClusterId: string;
  connectionString: string; // MySQL-compatible
  branchName: string; // For preview deployments
  createdAt: Date;
}
```

**Deployment Pipeline:**
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ AI Generates│───▶│  Preview    │───▶│  Deploy to  │
│    Code     │    │ (WebContainer)│   │   Vercel    │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   TiDB      │
                   │ (Database)  │
                   └─────────────┘
```

---

## 4. API Design

### 4.1 API Standards

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
    "details": [
      {"field": "prompt", "message": "Required"}
    ]
  }
}
```

### 4.2 Core API Routes

#### Tasks API

```yaml
POST /v1/tasks:
  description: Create a new task
  request:
    body:
      prompt: string (required)
      agentProfile: enum [rubic-1.0, rubic-1.0-lite, rubic-1.0-max]
      taskMode: enum [chat, adaptive, agent]
      attachments: array<Attachment>
      connectors: array<string>
      projectId: string
      interactiveMode: boolean
      locale: string
  response:
    task_id: string
    task_url: string
    status: enum [pending, running, completed, failed]

GET /v1/tasks:
  description: List tasks
  query:
    limit: integer (1-100)
    after: string (cursor)
    status: enum[]
    projectId: string
    query: string (search)
  response:
    data: array<Task>
    has_more: boolean
    next_cursor: string

GET /v1/tasks/{task_id}:
  description: Get task details
  response:
    id: string
    status: enum
    output: array<Message>
    credit_usage: integer
    created_at: timestamp
    updated_at: timestamp
```

#### Devices API

```yaml
POST /v1/devices:
  description: Register a device
  request:
    body:
      name: string
      type: enum [pc, mqtt, wifi, bluetooth]
      config: DeviceConfig
  response:
    device_id: string
    access_token: string
    status: connected | pending

POST /v1/devices/{device_id}/command:
  description: Execute command on device
  request:
    body:
      command: string
      type: enum [shell, script, action]
      timeout: integer
      requiresApproval: boolean
  response:
    execution_id: string
    status: enum [queued, executing, completed, failed]
    output: string

WS /v1/devices/{device_id}/stream:
  description: Real-time device communication
  messages:
    - type: command, data: {command, args}
    - type: output, data: {stdout, stderr}
    - type: state, data: {status, metrics}
```

### 4.3 tRPC Integration

For frontend-backend type safety, we maintain tRPC routers:

```typescript
// packages/api/src/routers/index.ts
export const appRouter = router({
  tasks: tasksRouter,
  projects: projectsRouter,
  files: filesRouter,
  devices: devicesRouter,
  agents: agentsRouter,
  knowledge: knowledgeRouter,
  billing: billingRouter,
  notifications: notificationsRouter,
});
```

---

## 5. Database Architecture

### 5.1 PostgreSQL Schema (Primary)

```sql
-- Users & Auth (managed by Better-Auth)
-- See packages/database/src/schema/users.ts

-- Tasks
CREATE TABLE tasks (
  id VARCHAR(26) PRIMARY KEY,  -- CUID2
  user_id VARCHAR(26) NOT NULL REFERENCES users(id),
  project_id VARCHAR(26) REFERENCES projects(id),
  prompt TEXT NOT NULL,
  agent_profile VARCHAR(50) DEFAULT 'rubic-1.0',
  task_mode VARCHAR(20) DEFAULT 'agent',
  status VARCHAR(20) DEFAULT 'pending',
  error JSONB,
  metadata JSONB DEFAULT '{}',
  credit_usage INTEGER DEFAULT 0,
  locale VARCHAR(10) DEFAULT 'en-US',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_project ON tasks(project_id);

-- Task Messages
CREATE TABLE task_messages (
  id VARCHAR(26) PRIMARY KEY,
  task_id VARCHAR(26) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,  -- user, assistant, system, tool
  content JSONB NOT NULL,      -- MessagePart[]
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_messages_task ON task_messages(task_id);

-- Devices
CREATE TABLE devices (
  id VARCHAR(26) PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,  -- pc, mqtt, wifi, bluetooth
  config JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ,
  access_token_hash VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_devices_status ON devices(status);

-- Device Commands
CREATE TABLE device_commands (
  id VARCHAR(26) PRIMARY KEY,
  device_id VARCHAR(26) NOT NULL REFERENCES devices(id),
  task_id VARCHAR(26) REFERENCES tasks(id),
  command TEXT NOT NULL,
  command_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'queued',
  output TEXT,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  timeout_ms INTEGER DEFAULT 30000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id VARCHAR(26) PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  instruction TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Files
CREATE TABLE files (
  id VARCHAR(26) PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL REFERENCES users(id),
  task_id VARCHAR(26) REFERENCES tasks(id),
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  s3_key VARCHAR(500) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_user ON files(user_id);
CREATE INDEX idx_files_expires ON files(expires_at);

-- Webhooks
CREATE TABLE webhooks (
  id VARCHAR(26) PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL REFERENCES users(id),
  url VARCHAR(2000) NOT NULL,
  events VARCHAR(50)[] DEFAULT '{}',
  secret_hash VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connectors
CREATE TABLE connectors (
  id VARCHAR(26) PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,  -- google, notion, slack, etc.
  config JSONB DEFAULT '{}',
  oauth_token_encrypted TEXT,
  oauth_refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_connectors_user_type ON connectors(user_id, type);
```

### 5.2 Redis Data Structures

```
# Session Cache
session:{user_id}:{session_id} -> JSON (user session data)
TTL: 7 days

# Rate Limiting
rate:{user_id}:{endpoint} -> COUNT
TTL: 60 seconds

# Task Streaming
task_stream:{task_id} -> STREAM (real-time events)
TTL: 24 hours

# Device State
device:{device_id}:state -> JSON (current device state)
device:{device_id}:commands -> LIST (pending commands)

# Pub/Sub Channels
channel:user:{user_id} -> real-time user updates
channel:task:{task_id} -> task progress events
channel:device:{device_id} -> device status changes
```

### 5.3 Vector Database (pgvector/Pinecone)

For RAG and semantic search:

```sql
-- Using pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_embeddings (
  id VARCHAR(26) PRIMARY KEY,
  knowledge_item_id VARCHAR(26) REFERENCES knowledge_items(id),
  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI ada-002 dimensions
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_embeddings_vector ON knowledge_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 6. Real-Time Communication

### 6.1 WebSocket Architecture

```
┌─────────────┐     WebSocket      ┌─────────────────┐
│   Client    │◄──────────────────►│ Gateway Service │
│  (Next.js)  │                    │   (Fastify+WS)  │
└─────────────┘                    └────────┬────────┘
                                            │
                                            │ Redis Pub/Sub
                                            ▼
                              ┌─────────────────────────┐
                              │   Redis (ElastiCache)   │
                              └──────────┬──────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
             ┌──────────┐         ┌──────────┐         ┌──────────┐
             │  Task    │         │  Agent   │         │ Device   │
             │ Service  │         │ Service  │         │ Service  │
             └──────────┘         └──────────┘         └──────────┘
```

### 6.2 Event Types

```typescript
// WebSocket message types
type WSMessage =
  | { type: 'subscribe'; channels: string[] }
  | { type: 'unsubscribe'; channels: string[] }
  | { type: 'task_update'; taskId: string; status: TaskStatus; data?: any }
  | { type: 'task_progress'; taskId: string; message: string; progress?: number }
  | { type: 'task_output'; taskId: string; content: MessagePart[] }
  | { type: 'device_status'; deviceId: string; status: DeviceStatus }
  | { type: 'device_output'; deviceId: string; output: string }
  | { type: 'notification'; notification: Notification }
  | { type: 'error'; error: { code: string; message: string } };
```

### 6.3 Streaming Patterns

**Server-Sent Events (SSE) for Task Streaming:**
```
GET /v1/tasks/{task_id}/stream
Accept: text/event-stream

event: task_update
data: {"status": "running", "message": "Processing..."}

event: output_delta
data: {"type": "text", "delta": "Here is"}

event: output_delta
data: {"type": "text", "delta": " the response..."}

event: task_complete
data: {"status": "completed", "credit_usage": 150}
```

---

## 7. Device Control System

### 7.1 Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                        DEVICE CONTROL LAYER                           │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    Device Service (Go)                           │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │ │
│  │  │ PC Control  │ │ MQTT Bridge │ │WiFi Manager │ │ BLE Mgr   │ │ │
│  │  │  Handler    │ │   Handler   │ │   Handler   │ │  Handler  │ │ │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬─────┘ │ │
│  │         │               │               │               │       │ │
│  │  ┌──────┴───────────────┴───────────────┴───────────────┴─────┐ │ │
│  │  │              Unified Device Protocol Adapter               │ │ │
│  │  └────────────────────────────┬───────────────────────────────┘ │ │
│  │                               │                                  │ │
│  │  ┌────────────────────────────┴───────────────────────────────┐ │ │
│  │  │           Safety & Validation Layer                        │ │ │
│  │  │  • Command whitelisting  • Resource limits  • Rate limits  │ │ │
│  │  │  • Audit logging         • Timeout enforcement             │ │ │
│  │  └────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└────────────────┬──────────────────────┬───────────────────────────────┘
                 │                      │
    ┌────────────┴────────┐  ┌──────────┴───────────┐
    ▼                     ▼  ▼                      ▼
┌─────────┐        ┌────────────────┐        ┌──────────────┐
│   PC    │        │  AWS IoT Core  │        │   WiFi/BLE   │
│  Agent  │        │  (MQTT Broker) │        │   Devices    │
└────┬────┘        └───────┬────────┘        └──────────────┘
     │                     │
     │ WebSocket           │ MQTT
     ▼                     ▼
┌─────────┐        ┌────────────────┐
│ Desktop │        │  IoT Devices   │
│   PC    │        │ (Sensors, etc) │
└─────────┘        └────────────────┘
```

### 7.2 PC Control Agent

**Installation (OpenClaw-style):**
```bash
# Install Rubic Agent on user's PC
curl -fsSL https://agent.rubic.ai/install.sh | bash

# Or via npm
npm install -g @rubic/agent
rubic-agent start
```

**Agent Capabilities:**
- Shell command execution
- File system operations
- Browser automation (Playwright)
- Screenshot capture
- Application control
- System information gathering

**Security Model:**
```typescript
interface ExecutionConstraints {
  // Command restrictions
  allowedCommands: string[];    // Whitelist
  forbiddenPaths: string[];     // Blacklist

  // Resource limits
  maxExecutionTime: number;     // ms
  maxMemory: number;            // bytes
  maxOutputSize: number;        // bytes

  // Safety
  requiresApproval: boolean;    // Human-in-the-loop
  sandboxMode: boolean;         // Isolated execution
}
```

### 7.3 MQTT Device Protocol

**Topic Structure:**
```
rubic/devices/{user_id}/{device_id}/telemetry    # Device → Cloud
rubic/devices/{user_id}/{device_id}/commands     # Cloud → Device
rubic/devices/{user_id}/{device_id}/status       # Bidirectional
rubic/devices/{user_id}/{device_id}/events       # Device events
```

**Message Format:**
```json
{
  "message_id": "msg_xxx",
  "timestamp": "2026-02-04T12:00:00Z",
  "type": "command",
  "payload": {
    "action": "set_temperature",
    "parameters": {"value": 22, "unit": "celsius"}
  },
  "correlation_id": "task_xxx"
}
```

### 7.4 Device API Implementation

```go
// services/device/internal/handler/device_handler.go
package handler

type DeviceHandler struct {
    deviceRepo    repository.DeviceRepository
    commandQueue  queue.CommandQueue
    mqttClient    mqtt.Client
    validator     validation.CommandValidator
}

func (h *DeviceHandler) ExecuteCommand(ctx context.Context, req *pb.CommandRequest) (*pb.CommandResponse, error) {
    // 1. Validate command against safety rules
    if err := h.validator.Validate(req); err != nil {
        return nil, status.Error(codes.InvalidArgument, err.Error())
    }

    // 2. Check device status
    device, err := h.deviceRepo.GetByID(ctx, req.DeviceId)
    if err != nil {
        return nil, status.Error(codes.NotFound, "device not found")
    }

    if device.Status != "online" {
        return nil, status.Error(codes.Unavailable, "device offline")
    }

    // 3. Queue command for execution
    cmd := &domain.Command{
        ID:        ulid.Make().String(),
        DeviceID:  req.DeviceId,
        Type:      req.CommandType,
        Payload:   req.Payload,
        Timeout:   req.Timeout,
        CreatedAt: time.Now(),
    }

    if err := h.commandQueue.Enqueue(ctx, cmd); err != nil {
        return nil, status.Error(codes.Internal, "failed to queue command")
    }

    // 4. Send via appropriate channel (MQTT/WebSocket)
    switch device.Type {
    case "mqtt":
        h.sendMQTTCommand(ctx, device, cmd)
    case "pc":
        h.sendWebSocketCommand(ctx, device, cmd)
    }

    return &pb.CommandResponse{
        ExecutionId: cmd.ID,
        Status:      "queued",
    }, nil
}
```

---

## 8. AI Agent Orchestration

### 8.1 Agent Service Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       AGENT SERVICE (Python)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Agent Orchestrator                         │  │
│  │                                                               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │  │
│  │  │   Router    │  │   Planner   │  │  Executor   │          │  │
│  │  │   Agent     │  │   Agent     │  │   Agent     │          │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │  │
│  │                                                               │  │
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

### 8.2 Agent Profiles

```python
# services/agent/src/config/profiles.py
AGENT_PROFILES = {
    "rubic-1.0-lite": {
        "model": "gpt-4o-mini",
        "max_tokens": 4096,
        "thinking_budget": 0,
        "tools": ["web_search", "calculator"],
        "timeout": 30,
        "cost_multiplier": 0.5
    },
    "rubic-1.0": {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 8192,
        "thinking_budget": 10000,
        "tools": ["web_search", "code_execution", "file_operations", "browser"],
        "timeout": 120,
        "cost_multiplier": 1.0
    },
    "rubic-1.0-max": {
        "model": "claude-opus-4-5-20251101",
        "max_tokens": 32768,
        "thinking_budget": 50000,
        "tools": ["all"],
        "timeout": 600,
        "cost_multiplier": 5.0
    }
}
```

### 8.3 Tool Integration (Composio)

```python
# services/agent/src/tools/composio_tools.py
from composio import ComposioToolSet, App

class ComposioToolProvider:
    def __init__(self, api_key: str):
        self.toolset = ComposioToolSet(api_key=api_key)

    async def get_tools_for_task(self, task_context: dict) -> list:
        """Dynamically select tools based on task context."""
        tools = []

        # Always include core tools
        tools.extend(self.toolset.get_tools([
            App.FILETOOL,
            App.SHELL,
            App.BROWSERTOOL,
        ]))

        # Add connector-specific tools if available
        if task_context.get("connectors"):
            for connector in task_context["connectors"]:
                if connector == "google":
                    tools.extend(self.toolset.get_tools([
                        App.GMAIL,
                        App.GOOGLECALENDAR,
                        App.GOOGLEDRIVE,
                    ]))
                elif connector == "notion":
                    tools.extend(self.toolset.get_tools([App.NOTION]))
                elif connector == "slack":
                    tools.extend(self.toolset.get_tools([App.SLACK]))

        return tools
```

### 8.4 Sandboxed Execution (E2B)

```python
# services/agent/src/sandbox/e2b_executor.py
from e2b_code_interpreter import Sandbox

class SandboxedExecutor:
    def __init__(self, timeout: int = 300):
        self.timeout = timeout

    async def execute_code(
        self,
        code: str,
        language: str = "python"
    ) -> dict:
        """Execute code in isolated E2B sandbox."""
        async with Sandbox(timeout=self.timeout) as sandbox:
            if language == "python":
                result = await sandbox.run_code(code)
            elif language == "javascript":
                result = await sandbox.run_code(code, language="javascript")
            else:
                raise ValueError(f"Unsupported language: {language}")

            return {
                "output": result.text,
                "error": result.error,
                "logs": result.logs,
                "artifacts": [
                    {"name": f.name, "url": f.url}
                    for f in result.artifacts
                ]
            }
```

---

## 9. Infrastructure & Deployment

### 9.1 AWS Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS Account                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      VPC (10.0.0.0/16)                       │   │
│  │                                                               │   │
│  │  ┌─────────────────┐            ┌─────────────────┐         │   │
│  │  │ Public Subnet   │            │ Public Subnet   │         │   │
│  │  │   (us-east-1a)  │            │   (us-east-1b)  │         │   │
│  │  │                 │            │                 │         │   │
│  │  │  ┌───────────┐  │            │  ┌───────────┐  │         │   │
│  │  │  │    ALB    │◄─┼────────────┼──┤    ALB    │  │         │   │
│  │  │  └───────────┘  │            │  └───────────┘  │         │   │
│  │  │        │        │            │        │        │         │   │
│  │  └────────┼────────┘            └────────┼────────┘         │   │
│  │           │                              │                   │   │
│  │  ┌────────┼──────────────────────────────┼────────┐         │   │
│  │  │ Private Subnet (us-east-1a)           │        │         │   │
│  │  │        │                              │        │         │   │
│  │  │  ┌─────┴─────────────────────────────┴─────┐  │         │   │
│  │  │  │           ECS Fargate Cluster           │  │         │   │
│  │  │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │  │         │   │
│  │  │  │  │Gate │ │Task │ │Agent│ │File │  ...  │  │         │   │
│  │  │  │  │way  │ │Svc  │ │Svc  │ │Svc  │       │  │         │   │
│  │  │  │  └─────┘ └─────┘ └─────┘ └─────┘       │  │         │   │
│  │  │  └────────────────────────────────────────┘  │         │   │
│  │  │                                               │         │   │
│  │  └───────────────────────────────────────────────┘         │   │
│  │                                                               │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │                Data Subnet                           │   │   │
│  │  │                                                       │   │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │   │
│  │  │  │   RDS    │  │  Redis   │  │OpenSearch│           │   │   │
│  │  │  │PostgreSQL│  │ElastiCach│  │          │           │   │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘           │   │   │
│  │  │                                                       │   │   │
│  │  └───────────────────────────────────────────────────────┘   │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │      S3         │  │   AWS IoT Core  │  │    SQS/SNS     │     │
│  │   (Storage)     │  │   (MQTT)        │  │  (Messaging)   │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 Docker Compose (Development)

```yaml
# docker-compose.yml
version: "3.9"

services:
  gateway:
    build:
      context: ./services/gateway
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://rubic:rubic@postgres:5432/rubic
    depends_on:
      - redis
      - postgres

  task-service:
    build:
      context: ./services/task
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://rubic:rubic@postgres:5432/rubic
    depends_on:
      - redis
      - postgres

  agent-service:
    build:
      context: ./services/agent
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - E2B_API_KEY=${E2B_API_KEY}
      - COMPOSIO_API_KEY=${COMPOSIO_API_KEY}
    depends_on:
      - redis

  device-service:
    build:
      context: ./services/device
      dockerfile: Dockerfile
    ports:
      - "3005:3005"
    environment:
      - REDIS_URL=redis://redis:6379
      - MQTT_BROKER_URL=mqtt://mosquitto:1883
    depends_on:
      - redis
      - mosquitto

  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=rubic
      - POSTGRES_PASSWORD=rubic
      - POSTGRES_DB=rubic
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto/config:/mosquitto/config

volumes:
  postgres_data:
  redis_data:
```

### 9.3 Terraform Configuration

```hcl
# infrastructure/terraform/main.tf

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "rubic-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "rubic-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "rubic-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# RDS PostgreSQL
module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "6.0.0"

  identifier = "rubic-db"

  engine               = "postgres"
  engine_version       = "16"
  family               = "postgres16"
  major_engine_version = "16"
  instance_class       = "db.t4g.medium"

  allocated_storage     = 100
  max_allocated_storage = 500

  db_name  = "rubic"
  username = "rubic"
  port     = 5432

  vpc_security_group_ids = [module.security_group_rds.security_group_id]
  subnet_ids             = module.vpc.private_subnets

  maintenance_window      = "Mon:00:00-Mon:03:00"
  backup_window           = "03:00-06:00"
  backup_retention_period = 7
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "rubic-redis"
  engine               = "redis"
  node_type            = "cache.t4g.medium"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  security_group_ids   = [module.security_group_redis.security_group_id]
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
}

# S3 Bucket for files
resource "aws_s3_bucket" "files" {
  bucket = "rubic-files-${var.environment}"
}

resource "aws_s3_bucket_lifecycle_configuration" "files" {
  bucket = aws_s3_bucket.files.id

  rule {
    id     = "expire-temp-files"
    status = "Enabled"

    expiration {
      days = 2
    }

    filter {
      prefix = "temp/"
    }
  }
}
```

---

## 10. Security Architecture

### 10.1 Authentication & Authorization

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Web App                    API Requests                             │
│     │                           │                                    │
│     ▼                           ▼                                    │
│  Better-Auth              API Key Header                             │
│  (Session/Cookie)         (X-API-Key)                               │
│     │                           │                                    │
│     └───────────────┬───────────┘                                   │
│                     ▼                                                │
│            Gateway Service                                           │
│                     │                                                │
│                     ▼                                                │
│         ┌──────────────────┐                                        │
│         │  Auth Validator  │                                        │
│         │                  │                                        │
│         │ • JWT validation │                                        │
│         │ • API key check  │                                        │
│         │ • Permission map │                                        │
│         └────────┬─────────┘                                        │
│                  │                                                   │
│                  ▼                                                   │
│         ┌──────────────────┐                                        │
│         │   User Context   │                                        │
│         │                  │                                        │
│         │ • user_id        │                                        │
│         │ • org_id         │                                        │
│         │ • permissions[]  │                                        │
│         │ • rate_limits    │                                        │
│         └──────────────────┘                                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.2 API Key Management

```typescript
// Hierarchical API key structure
interface APIKey {
  id: string;
  prefix: string;        // "rbk_" for production, "rbk_test_" for test
  hash: string;          // Hashed key value
  userId: string;
  name: string;
  permissions: Permission[];
  rateLimit: RateLimit;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
}

// Permission scopes
type Permission =
  | 'tasks:read' | 'tasks:write' | 'tasks:delete'
  | 'files:read' | 'files:write' | 'files:delete'
  | 'devices:read' | 'devices:write' | 'devices:execute'
  | 'projects:read' | 'projects:write'
  | 'webhooks:read' | 'webhooks:write'
  | 'billing:read';
```

### 10.3 Webhook Security

```typescript
// RSA-SHA256 signature verification
interface WebhookSignature {
  algorithm: 'RSA-SHA256';
  headers: {
    'X-Webhook-Signature': string;  // Base64 signature
    'X-Webhook-Timestamp': string;  // Unix timestamp
  };
}

// Signature construction
const signaturePayload = `${timestamp}.${webhookUrl}.${sha256(body)}`;
const signature = rsaSign(signaturePayload, privateKey);
```

### 10.4 Device Security

```typescript
// Device authentication
interface DeviceAuth {
  deviceId: string;
  accessToken: string;    // Short-lived (1 hour)
  refreshToken: string;   // Long-lived (30 days)
  certificate?: string;   // X.509 for MQTT
}

// Command safety rules
interface CommandSafetyRules {
  // Whitelist of allowed commands
  allowedCommands: string[];

  // Paths that cannot be accessed
  forbiddenPaths: string[];

  // Commands requiring approval
  approvalRequired: string[];

  // Resource limits
  maxExecutionTime: number;
  maxMemoryUsage: number;
  maxNetworkBandwidth: number;
}
```

---

## 11. Third-Party Integrations

### 11.1 Service Evaluation Matrix

| Service | Category | Recommendation | Rationale |
|---------|----------|----------------|-----------|
| **Knock** | Notifications | KEEP | Excellent for multi-channel notifications, webhooks, preferences |
| **Svix** | Webhooks | KEEP | Best-in-class webhook delivery with retries, verification |
| **Composio** | Tool Integrations | ADD | 500+ pre-built connectors, reduces integration work |
| **Inngest** | Workflow Orchestration | ADD | Durable execution, event-driven, AI workflow support |
| **E2B** | Code Execution | ADD | Firecracker-based sandboxing, fast startup |
| **Stripe** | Payments | KEEP | Industry standard, already integrated |
| **Resend** | Email | KEEP | Developer-friendly, React Email support |
| **PostHog** | Analytics | KEEP | Product analytics, feature flags |
| **Sentry** | Error Tracking | KEEP | Industry standard for error monitoring |
| **LiveBlocks** | Collaboration | EVALUATE | Good for real-time, but may be redundant with WebSocket |

### 11.2 Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    THIRD-PARTY INTEGRATIONS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     Composio (Tools)                          │  │
│  │  Gmail | Calendar | Notion | Slack | Drive | GitHub | ...    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Inngest (Workflows)                        │  │
│  │  Task orchestration | Background jobs | Scheduled tasks       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     E2B (Sandboxing)                          │  │
│  │  Python execution | JS execution | File operations            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │    Knock    │  │    Svix     │  │   Stripe    │               │
│  │   (Notif)   │  │  (Webhook)  │  │  (Billing)  │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.3 Inngest Workflow Example

```typescript
// services/task/src/workflows/task-execution.ts
import { inngest } from '../lib/inngest';

export const taskExecution = inngest.createFunction(
  { id: 'task-execution', retries: 3 },
  { event: 'task/created' },
  async ({ event, step }) => {
    const { taskId, prompt, agentProfile } = event.data;

    // Step 1: Initialize task
    await step.run('initialize-task', async () => {
      await db.tasks.update({
        where: { id: taskId },
        data: { status: 'running' }
      });
    });

    // Step 2: Get context and tools
    const context = await step.run('prepare-context', async () => {
      const project = await db.projects.findUnique({
        where: { id: event.data.projectId }
      });
      const tools = await composio.getToolsForTask(event.data);
      return { project, tools };
    });

    // Step 3: Execute agent
    const result = await step.run('execute-agent', async () => {
      return agentService.execute({
        taskId,
        prompt,
        agentProfile,
        context: context.project?.instruction,
        tools: context.tools
      });
    });

    // Step 4: Process results
    await step.run('process-results', async () => {
      await db.tasks.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          creditUsage: result.creditUsage
        }
      });

      // Send webhooks
      await webhookService.send(taskId, 'task.completed', result);
    });

    return result;
  }
);
```

---

## 12. Monorepo Structure

### 12.1 Proposed Structure

```
rubic/
├── apps/                           # Deployable applications
│   ├── app/                        # Main Next.js application
│   ├── api/                        # API server (webhooks, cron)
│   ├── web/                        # Marketing website
│   ├── docs/                       # Documentation site
│   ├── email/                      # Email templates
│   ├── storybook/                  # Component library
│   └── studio/                     # Admin/studio
│
├── services/                       # Backend microservices (NEW)
│   ├── gateway/                    # API Gateway (Node.js)
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── task/                       # Task Service (Node.js)
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── agent/                      # Agent Service (Python)
│   │   ├── src/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   └── requirements.txt
│   ├── device/                     # Device Service (Go)
│   │   ├── cmd/
│   │   ├── internal/
│   │   ├── Dockerfile
│   │   └── go.mod
│   ├── file/                       # File Service (Node.js)
│   ├── project/                    # Project Service (Node.js)
│   ├── webhook/                    # Webhook Service (Node.js)
│   ├── notification/               # Notification Service (Node.js)
│   ├── connector/                  # Connector Service (Node.js)
│   ├── sandbox/                    # Sandbox Service (Go)
│   ├── knowledge/                  # Knowledge Service (Python)
│   └── billing/                    # Billing Service (Node.js)
│
├── packages/                       # Shared packages
│   ├── ai/                         # AI SDK, hooks, components
│   ├── database/                   # Drizzle ORM, schemas
│   ├── auth/                       # Better-Auth config
│   ├── design-system/              # UI components
│   ├── notifications/              # Knock integration
│   ├── webhooks/                   # Svix integration
│   ├── payments/                   # Stripe integration
│   ├── storage/                    # S3/Vercel Blob
│   ├── analytics/                  # PostHog
│   ├── observability/              # Sentry, logging
│   ├── rate-limit/                 # Upstash rate limiting
│   ├── email/                      # Resend templates
│   ├── collaboration/              # LiveBlocks
│   ├── cms/                        # BaseHub
│   ├── feature-flags/              # Feature flags
│   ├── internationalization/       # i18n
│   ├── security/                   # Security utils
│   ├── seo/                        # SEO utils
│   ├── testing/                    # Test utilities
│   ├── typescript-config/          # Shared TS config
│   └── next-config/                # Shared Next.js config
│
├── infrastructure/                 # Infrastructure as Code (NEW)
│   ├── terraform/
│   │   ├── environments/
│   │   │   ├── development/
│   │   │   ├── staging/
│   │   │   └── production/
│   │   └── modules/
│   │       ├── ecs/
│   │       ├── rds/
│   │       ├── elasticache/
│   │       └── s3/
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   ├── docker-compose.dev.yml
│   │   └── docker-compose.test.yml
│   └── kubernetes/                 # Future: K8s manifests
│
├── tools/                          # Development tools (NEW)
│   ├── scripts/
│   │   ├── setup.sh
│   │   ├── migrate.sh
│   │   └── deploy.sh
│   └── generators/
│       └── service/                # Service generator
│
├── docs/                           # Documentation
│   ├── architecture/
│   │   └── BACKEND_ARCHITECTURE.md
│   └── adr/
│       ├── 001-prompt-input-architecture.md
│       ├── 002-microservices-stack.md
│       ├── 003-database-design.md
│       └── ...
│
├── turbo.json                      # Turborepo config
├── pnpm-workspace.yaml             # Workspace config
├── package.json                    # Root package.json
├── nx.json                         # NX config (optional)
└── docker-compose.yml              # Root docker-compose
```

### 12.2 Turborepo vs NX Decision

| Aspect | Turborepo | NX |
|--------|-----------|-----|
| **Learning Curve** | Lower | Higher |
| **Polyglot Support** | Limited | Excellent |
| **Cache Efficiency** | Good | Excellent |
| **IDE Integration** | Basic | VSCode extension |
| **Community** | Growing | Large |
| **Complexity** | Lower | Higher |

**Recommendation:** Start with Turborepo (current), migrate to NX if polyglot complexity increases significantly. Turborepo handles JS/TS well; for Python/Go services, use independent build systems with Turbo for orchestration.

### 12.3 Updated turbo.json

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "ui": "tui",
  "envMode": "loose",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [
        ".next/**",
        "!.next/cache/**",
        "**/generated/**",
        "storybook-static/**",
        ".react-email/**",
        "dist/**"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^test"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "docker:build": {
      "dependsOn": ["build"],
      "cache": false
    },
    "docker:push": {
      "dependsOn": ["docker:build"],
      "cache": false
    },
    "migrate": {
      "cache": false
    },
    "clean": {
      "cache": false
    }
  }
}
```

---

## Appendix A: ADR Index

| ADR # | Title | Status |
|-------|-------|--------|
| 001 | Prompt Input Architecture | Proposed |
| 002 | Microservices Tech Stack Selection | Proposed |
| 003 | Database Architecture | Proposed |
| 004 | Real-Time Communication | Proposed |
| 005 | Device Control System | Proposed |
| 006 | Third-Party Service Evaluation | Proposed |
| 007 | Monorepo Structure | Proposed |
| 008 | AWS Infrastructure | Proposed |
| 009 | AI Agent Orchestration | Proposed |
| 010 | Security Architecture | Proposed |

---

## Appendix B: Migration Checklist

- [ ] Create `services/` directory structure
- [ ] Set up Docker compose for local development
- [ ] Create Gateway Service (Node.js)
- [ ] Create Task Service (Node.js)
- [ ] Create Agent Service (Python)
- [ ] Create Device Service (Go)
- [ ] Set up PostgreSQL with pgvector
- [ ] Configure Redis for cache/pub-sub
- [ ] Implement WebSocket in Gateway
- [ ] Integrate Composio for tools
- [ ] Integrate E2B for sandboxing
- [ ] Integrate Inngest for workflows
- [ ] Set up AWS infrastructure with Terraform
- [ ] Create CI/CD pipelines
- [ ] Update frontend to use new APIs
- [ ] Migration testing and validation

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-04 | Engineering Team | Initial architecture document |
