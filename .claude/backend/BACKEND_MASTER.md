# Backend Master Instructions

> **13 microservices** | Gateway (Fastify), Agent (Python/FastAPI), rest (Fastify Node.js)

## Architecture

```
Client (Next.js) ──→ tRPC (direct DB) ──→ PostgreSQL
                 ──→ Gateway (:4001) ──→ Services ──→ PostgreSQL
                 ──→ WebSocket (Socket.io) ──→ Redis Pub/Sub
```

**Two API paths:**

1. **tRPC** (apps/app/lib/trpc/) - Direct DB access for frontend CRUD (billing, sessions, messages, search, etc.)
2. **Gateway** (services/gateway/) - Proxies to backend services for compute-heavy work (agent, task, device, sandbox)

## Service Status Matrix

| Service          | Port | Language        | Status  | Key Gap                          |
| ---------------- | ---- | --------------- | ------- | -------------------------------- |
| **gateway**      | 4001 | Node.js/Fastify | PARTIAL | Working proxy + WebSocket + auth |
| **agent**        | 8000 | Python/FastAPI  | PARTIAL | LLM calls work, tools are stubs  |
| **task**         | 4002 | Node.js/Fastify | PARTIAL | Inngest works, no DB persistence |
| **billing**      | 4008 | Node.js/Fastify | STUB    | All 8 endpoints are TODO         |
| **connector**    | 4009 | Node.js/Fastify | STUB    | No Composio integration          |
| **file**         | 4005 | Node.js/Fastify | STUB    | Multipart registered, no S3      |
| **device**       | 8080 | Go (planned)    | EMPTY   | No implementation                |
| **sandbox**      | 4012 | Node.js/Fastify | STUB    | No E2B integration               |
| **website**      | 4004 | Node.js/Fastify | STUB    | No builder logic                 |
| **knowledge**    | 4011 | Node.js/Fastify | STUB    | No embeddings/vector             |
| **notification** | 4006 | Node.js/Fastify | STUB    | No Knock integration             |
| **search**       | 4013 | Node.js/Fastify | STUB    | No Typesense integration         |
| **webhook**      | 4007 | Node.js/Fastify | STUB    | Signature stub only              |
| **project**      | 4010 | Node.js/Fastify | STUB    | All endpoints TODO               |

## THE Critical Gap: Services Don't Use Database

The #1 problem: `packages/database/` has 15+ comprehensive Drizzle schemas, but **zero services import or use them**. Every service has `// TODO: Insert into database when schema is ready` comments.

### How to Fix (for each service):

```typescript
// Step 1: Add @repo/database to service's package.json
// Step 2: Import in route handler
import { db, tableName, eq, and, desc } from "@repo/database";

// Step 3: Replace TODO with query
// BEFORE:
fastify.get("/items", async () => {
  return { data: [], meta: { total: 0 } }; // TODO: Fetch from database
});

// AFTER:
fastify.get("/items", async (request) => {
  const items = await db
    .select()
    .from(tableName)
    .where(eq(tableName.userId, request.userId))
    .orderBy(desc(tableName.createdAt));
  return { data: items, meta: { total: items.length } };
});
```

## Gateway Service (PARTIAL - `services/gateway/`)

### What works:

- `src/index.ts` (116 lines) - Fastify with CORS, Helmet, rate limiting, WebSocket
- `src/plugins/auth.ts` - JWT/API key authentication
- `src/routes/proxy.ts` - Generic proxy to all downstream services
- `src/routes/websocket.ts` - WebSocket with Redis pub/sub, room management, SSE
- `src/routes/health.ts` - Health + readiness checks with Redis test

### What needs work:

- Service discovery uses env vars with localhost fallbacks (fine for dev, needs config for prod)

## Agent Service (PARTIAL - `services/agent/`)

### What works:

- `src/main.py` (97 lines) - FastAPI with CORS, logging
- `src/routes/completion.py` (225 lines) - Both streaming and non-streaming LLM calls
  - Anthropic Claude: `stream_anthropic()` with `client.messages.stream()`
  - OpenAI GPT: `stream_openai()` with `client.chat.completions.create(stream=True)`
  - SSE format output
- `src/routes/tools.py` (302 lines) - 9 tools defined (mostly stubs)

### What needs work:

- `tools.py`: Most tools return placeholder data. Need real implementations:
  - `web_search` → integrate Serper/Tavily/Composio
  - `execute_code` → call sandbox service (E2B)
  - `create_document` → call file service
  - `generate_image` → call DALL-E/Stable Diffusion
- Multi-turn conversation support (currently single prompt)
- Tool loop (call tool → get result → continue reasoning)
- Composio tool registration
- Credit tracking per API call

## Task Service (PARTIAL - `services/task/`)

### What works:

- `src/routes/inngest.ts` (159 lines) - Three Inngest functions:
  1. `execute-task` - Calls agent service, 3 retries
  2. `scheduled-task` - Triggers task execution on schedule
  3. `approval-workflow` - Wait for approval with 24h timeout
- `src/routes/tasks.ts` (197 lines) - REST endpoints with Zod validation

### What needs work:

- `tasks.ts`: All CRUD uses in-memory objects, needs Drizzle queries to `agentSessions` + `agentTasks` tables
- `inngest.ts` Step 1 "prepare-context": Load user preferences, conversation history, available tools
- `inngest.ts` Step 3 "process-result": Save result to `messages` table, update task status, deduct credits
- Publish WebSocket events after task completion
- Scheduled task CRON support (integrate with `scheduledTasks` table)

## Stub Services Pattern

All stub services (`services/{billing,connector,file,knowledge,notification,project,sandbox,search,webhook}/src/index.ts`) follow the same pattern:

1. Fastify server with CORS
2. Route definitions with correct HTTP methods and paths
3. Request/response shapes defined
4. All implementations are `// TODO` with hardcoded/empty responses

**To implement each one:** See individual instruction files in `backend/{service}/INSTRUCTIONS.md`

## Standard Response Format

All services should return:

```json
{
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO-8601"
  },
  "error": null
}
```

Error format:

```json
{
  "data": null,
  "meta": { "requestId": "uuid", "timestamp": "ISO-8601" },
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

## Docker Compose

- `docker-compose.services.yml` - Development (all services + PostgreSQL + Redis)
- `docker-compose.prod.yml` - Production configuration
- `docker-compose.typesense.yml` - Typesense search infrastructure
- Each service has its own `Dockerfile` with multi-stage builds

## Environment Variables

See `services/.env.example` (95 variables) for all service configuration.
