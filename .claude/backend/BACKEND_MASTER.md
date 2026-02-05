# Backend Master Instructions

> **VERIFIED against actual codebase — Feb 2026 audit**
>
> 14 microservices | Gateway (Fastify), Agent (Python/FastAPI), 12 Node.js/Fastify services

## Architecture

```
Client (Next.js) ──→ tRPC (direct DB) ──→ PostgreSQL
                 ──→ Gateway (:4001) ──→ Services ──→ PostgreSQL
                 ──→ /api/chat/route.ts ──→ Vercel AI SDK ──→ LLM providers
                 ──→ WebSocket (Socket.io) ──→ Redis Pub/Sub
```

**Three API paths:**

1. **tRPC** (`apps/app/lib/trpc/`) — 16 routers, 160+ procedures, ALL have real Drizzle queries. Frontend CRUD for billing, sessions, messages, files, connectors, search, etc.
2. **Gateway** (`services/gateway/`) — Auth proxy + WebSocket + SSE + Redis pub/sub. Routes to backend services for compute-heavy work.
3. **Chat Route** (`apps/app/app/api/chat/route.ts`) — 222 lines. Direct LLM streaming via Vercel AI SDK. Persists messages, upserts sessions, auto-generates titles, RAG integration.

## Service Status Matrix (VERIFIED)

| Service          | Port | Language        | LOC  | Status              | What Works                                                                                                            | What's Missing                                                                           |
| ---------------- | ---- | --------------- | ---- | ------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **gateway**      | 4001 | Node.js/Fastify | 554  | **COMPLETE**        | Auth, proxy, WebSocket, SSE, Redis pub/sub                                                                            | Tiered rate limiting, analytics                                                          |
| **agent**        | 8000 | Python/FastAPI  | 817  | **PARTIAL**         | LLM streaming (Anthropic+OpenAI), tool registry, E2B sandbox execution, browse_url, device forwarding, Composio hooks | **NO agentic tool loop**, tools not passed to LLM, no conversation history, 3 tool stubs |
| **task**         | 4002 | Node.js/Fastify | 585  | **COMPLETE**        | Inngest functions (execute-task, scheduled-task, approval-workflow), REST CRUD, DB queries                            | Enhanced Inngest steps (prepare-context, process-result)                                 |
| **billing**      | 4008 | Node.js/Fastify | 343  | **MOSTLY COMPLETE** | All DB queries work, subscription/credit models                                                                       | 4 Stripe API calls (checkout, portal, payment method)                                    |
| **connector**    | 4009 | Node.js/Fastify | 800  | **COMPLETE**        | Composio SDK, OAuth start/callback, catalog sync, integration CRUD, tool listing                                      | —                                                                                        |
| **file**         | 4005 | Node.js/Fastify | 492  | **COMPLETE**        | S3 upload (100MB), presigned download, versioning, bulk upload, webhooks, pagination                                  | —                                                                                        |
| **device**       | 4001 | Node.js/Fastify | 792  | **COMPLETE**        | CRUD, commands, heartbeat, WebSocket, safety validation, tool execution bridge                                        | Smart home (Home Assistant)                                                              |
| **sandbox**      | 4012 | Node.js/Fastify | 682  | **COMPLETE**        | E2B create/connect, code execution, shell commands, file read/write/list, lifecycle management                        | —                                                                                        |
| **knowledge**    | 4011 | Node.js/Fastify | 515  | **COMPLETE**        | RAG pipeline, text extraction, chunking, embeddings (OpenAI), vector search, group CRUD                               | —                                                                                        |
| **notification** | 4006 | Node.js/Fastify | 364  | **COMPLETE**        | Knock email, Web Push, in-app, quiet hours, preferences                                                               | —                                                                                        |
| **search**       | 4013 | Node.js/Fastify | 775  | **COMPLETE**        | Typesense integration + DB ILIKE fallback, autocomplete, multi-collection search                                      | —                                                                                        |
| **webhook**      | 4007 | Node.js/Fastify | 289  | **COMPLETE**        | Event dispatch, HMAC signatures, delivery tracking, retries                                                           | —                                                                                        |
| **project**      | 4010 | Node.js/Fastify | 313  | **COMPLETE**        | CRUD, members, sessions, files, permissions                                                                           | —                                                                                        |
| **website**      | 4004 | Node.js/Fastify | 1285 | **MOSTLY COMPLETE** | Templates, file CRUD, preview simulation, TiDB provisioning                                                           | AI code generation, real deployment                                                      |

**Total backend LOC: ~8,565 lines of working code**

---

## THE Critical Gap: Agent Tool Loop

The #1 problem is NOT that services are stubs (they aren't). The problem is the **agent service doesn't have a tool loop**.

### What Works Now (Chat E2E)

```
Dashboard → create session ID → sessionStorage → navigate /chat/[id]
Chat page → useRealTimeChat hook → POST /api/chat/route.ts (222 lines)
→ Authenticates → Upserts session → Persists user message
→ RAG: queries knowledge service → injects context
→ streamText() via Vercel AI SDK → streams response
→ onFinish: persists assistant message, auto-generates title
```

**This works for simple Q&A but has NO tool execution.**

### What Needs to Happen

```
POST /api/chat/route.ts (or POST /v1/complete on agent service)
→ Assemble tools (core ~12 + dynamic Composio + device)
→ agent_loop: Stream LLM response
  → If LLM returns tool_use blocks:
    → Execute each tool (sandbox, serper, E2B, device, Composio)
    → Feed results back to LLM
    → Loop until LLM returns text-only (no more tools)
→ Stream all text + tool activity to client via SSE
→ Persist final response + tool calls to DB
→ Deduct credits
```

**See:** `.claude/backend/agent/INSTRUCTIONS.md` (1174 lines) — Full architecture spec.

---

## Service Architecture Details

### Node.js Services — Common Pattern

All 12 Node.js services follow the same structure:

```typescript
import Fastify from "fastify";
import { createLogger, getEnv } from "@repo/service-utils";

const app = Fastify({ logger: false, requestIdHeader: "x-request-id" });
// Health check, CORS, request logging hooks
// Route modules registered via app.register()
// Graceful shutdown on SIGINT/SIGTERM
// Auth via x-user-id header from gateway
// Database via dynamic import of @repo/database
```

**ESM Import Pattern (critical):**

```typescript
import * as database from "@repo/database/service-index";
import { eq, and, desc } from "drizzle-orm";
```

### Agent Service — Python/FastAPI

```python
# FastAPI with structlog, CORS, request logging
# Streaming via SSE (data: {json}\n\n)
# Anthropic + OpenAI support
# httpx for inter-service calls
# e2b + e2b-code-interpreter for sandbox
```

### Gateway — Routing Table

| Path Prefix                          | Target Service | Port |
| ------------------------------------ | -------------- | ---- |
| `/v1/complete`, `/v1/tools`          | Agent          | 8000 |
| `/v1/tasks`, `/v1/inngest`           | Task           | 4002 |
| `/v1/devices`                        | Device         | 4001 |
| `/v1/files`, `/upload`               | File           | 4005 |
| `/v1/sandboxes`                      | Sandbox        | 4012 |
| `/v1/connectors`, `/v1/integrations` | Connector      | 4009 |
| `/v1/knowledge`                      | Knowledge      | 4011 |
| `/v1/notifications`                  | Notification   | 4006 |
| `/v1/webhooks`                       | Webhook        | 4007 |
| `/v1/projects`                       | Project        | 4010 |
| `/v1/search`                         | Search         | 4013 |
| `/v1/websites`                       | Website        | 4004 |
| `/billing`                           | Billing        | 4008 |

---

## What ACTUALLY Needs Building

### P0 — Make Agent Work

1. **Agent tool loop** — The core agentic loop that passes tools to LLM, executes tool_use blocks, feeds results back. See `agent/INSTRUCTIONS.md` for full spec.
2. **Wire web_search** — Integrate Serper API (currently returns empty results)
3. **Wire generate_image** — Integrate DALL-E 3 (currently hardcoded failure)
4. **Wire create_document** — PDF/Word generation (currently hardcoded failure)
5. **Connect chat route to agent service** — Either enhance `/api/chat/route.ts` with Vercel AI SDK tools, OR route through Python agent service

### P0 — Stripe (4 TODOs)

6. **Billing service** — `stripe.checkout.sessions.create()` for subscriptions and credits
7. **Billing service** — `stripe.billingPortal.sessions.create()` for portal URL
8. **Billing service** — `stripe.paymentMethods.detach()` for removing payment methods
9. **Stripe webhook handler** — Verify signatures + process events

### P1 — Smart Home

10. **Device service** — Home Assistant hub routes (`services/device/src/routes/hubs.ts`)
11. **Device service** — HA entity discovery, state, commands via REST API

### P2 — Website Builder

12. **Website service** — Replace in-memory Map with database queries
13. **Website service** — AI code generation via agent service
14. **Website service** — Real deployment (Vercel API)

---

## Inter-Service Communication

```
agent → sandbox (code execution, file operations)
agent → connector (Composio tool execution)
agent → device (device commands)
agent → knowledge (RAG queries)
agent → billing (credit deduction)
agent → gateway (WebSocket for user notifications)
task → agent (execute-task Inngest function)
task → billing (credit checks)
gateway → all services (authenticated proxy)
file → search (index on upload)
connector → search (index on sync)
project → search (index on create)
webhook → all services (event dispatch)
notification → gateway (WebSocket for real-time delivery)
```

---

## Docker & Infrastructure

- `docker-compose.services.yml` — Development (all services + PostgreSQL + Redis)
- `docker-compose.prod.yml` — Production configuration
- `docker-compose.typesense.yml` — Typesense search
- Each service has its own `Dockerfile` with multi-stage builds
- See `services/.env.example` (95 variables) for all configuration

---

## Instruction File Index

| File                                         | Covers                                                             |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `backend/agent/INSTRUCTIONS.md`              | Agent tool loop, context engineering, tools, skills, model routing |
| `backend/task/INSTRUCTIONS.md`               | Task service, Inngest functions, scheduled tasks                   |
| `backend/billing/INSTRUCTIONS.md`            | Billing service, Stripe integration, credits                       |
| `backend/gateway/INSTRUCTIONS.md`            | Gateway proxy, WebSocket, SSE, rate limiting                       |
| `backend/connector/INSTRUCTIONS.md`          | Connector service, Composio, OAuth                                 |
| `backend/device/INSTRUCTIONS.md`             | Device service, commands, WebSocket, Home Assistant                |
| `backend/file/INSTRUCTIONS.md`               | File service, S3 upload, versioning                                |
| `backend/sandbox/INSTRUCTIONS.md`            | Sandbox service, E2B, code execution                               |
| `backend/remaining-services/INSTRUCTIONS.md` | Knowledge, notification, search, webhook, project, website         |
