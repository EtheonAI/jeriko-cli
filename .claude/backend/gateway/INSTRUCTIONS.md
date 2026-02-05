# Gateway Service Instructions

## Overview

The gateway service (`services/gateway/`) is the API gateway for all Rubic backend services. It is the single entry point for all client requests -- the frontend, CLI, and third-party API consumers all connect through the gateway. It handles authentication, rate limiting, request proxying, WebSocket real-time streaming, and SSE event delivery.

**Port:** 4001 (configurable via `PORT` env var)
**Framework:** Node.js / Fastify
**Status:** Most complete service in the backend -- has working auth, proxy, WebSocket, SSE, health checks

---

## Current File Structure

```
services/gateway/src/
  index.ts              # 116 lines - Fastify app bootstrap, plugin registration, error handling, request logging
  plugins/
    auth.ts             # 35 lines - JWT/API key authentication via @repo/service-utils extractAuth
  routes/
    health.ts           # 73 lines - /health, /health/detailed (checks Redis + downstream services), /ready
    proxy.ts            # 146 lines - Generic /:service/* proxy to downstream services
    websocket.ts        # 219 lines - /v1/stream (WebSocket), /v1/events (SSE), Redis pub/sub
```

---

## How the Gateway Works Today

### Authentication (`src/plugins/auth.ts`)

The auth plugin decorates every request with `request.auth: AuthContext | null`. It extracts auth from either:

- `Authorization: Bearer <jwt>` header
- `x-api-key: <key>` header

The `extractAuth` function from `@repo/service-utils` handles the actual JWT verification and API key lookup. The `requireAuth` helper throws a 401 if auth is null.

```typescript
// From src/plugins/auth.ts
fastify.addHook("onRequest", async (request) => {
  const authorization = request.headers.authorization;
  const apiKey = request.headers["x-api-key"] as string | undefined;
  request.auth = await extractAuth(authorization, apiKey);
});
```

### Proxy Routing (`src/routes/proxy.ts`)

All downstream services are registered with their URLs:

```typescript
const services: Record<string, ServiceConfig> = {
  tasks: { url: process.env.TASK_SERVICE_URL || "http://localhost:4002" },
  agents: { url: process.env.AGENT_SERVICE_URL || "http://localhost:8000" },
  devices: { url: process.env.DEVICE_SERVICE_URL || "http://localhost:8080" },
  files: { url: process.env.FILE_SERVICE_URL || "http://localhost:4005" },
  websites: { url: process.env.WEBSITE_SERVICE_URL || "http://localhost:4004" },
  billing: { url: process.env.BILLING_SERVICE_URL || "http://localhost:4008" },
  notifications: { url: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4006" },
  webhooks: { url: process.env.WEBHOOK_SERVICE_URL || "http://localhost:4007" },
  connectors: { url: process.env.CONNECTOR_SERVICE_URL || "http://localhost:4009" },
  search: { url: process.env.SEARCH_SERVICE_URL || "http://localhost:4013" },
  projects: { url: process.env.PROJECT_SERVICE_URL || "http://localhost:4010" },
  knowledge: { url: process.env.KNOWLEDGE_SERVICE_URL || "http://localhost:4011" },
  sandbox: { url: process.env.SANDBOX_SERVICE_URL || "http://localhost:4012" },
};
```

The proxy handler at `GET/POST/PUT/DELETE /v1/:service/*` forwards requests to the appropriate downstream service. It:

1. Allows unauthenticated `/health` checks
2. Requires auth for all other requests via `requireAuth(request)`
3. Passes `x-request-id`, `x-user-id`, and `x-user-email` headers downstream
4. Handles timeout errors (504) and connection errors (502)

### WebSocket & SSE (`src/routes/websocket.ts`)

**WebSocket endpoint:** `GET /v1/stream`

- Authenticates via `?token=<jwt>` query param or `Authorization` header
- Registers client in an in-memory `Map<string, WebSocketClient>`
- Auto-subscribes client to `user:<userId>` Redis channel
- Handles incoming message types: `ping`, `subscribe`, `task:start`, `task:continue`, `task:cancel`
- Task commands are forwarded to `tasks:commands` Redis pub/sub channel

**SSE endpoint:** `GET /v1/events`

- Simpler alternative to WebSocket for clients that only need to receive events
- Subscribes to `user:<userId>` Redis channel
- Sends heartbeat every 30 seconds
- Cleans up Redis subscription on disconnect

**Broadcast utilities:**

```typescript
// Send event to specific user (via Redis pub/sub)
export async function broadcastToUser(userId: string, message: { type: string; data: unknown });

// Send event to all connected clients
export async function broadcastToAll(message: { type: string; data: unknown });
```

### Health Checks (`src/routes/health.ts`)

- `GET /health` - Simple OK response
- `GET /health/detailed` - Checks Redis connectivity + pings downstream task/agent/device services
- `GET /ready` - Readiness probe (checks Redis connectivity)

Currently only checks 3 downstream services (task, agent, device). Should check all 13.

---

## What Needs to Be Built

### 1. Complete Service Health Aggregation

The detailed health check at `src/routes/health.ts` line 28-32 only checks 3 services:

```typescript
const services = [
  { name: "task", url: process.env.TASK_SERVICE_URL },
  { name: "agent", url: process.env.AGENT_SERVICE_URL },
  { name: "device", url: process.env.DEVICE_SERVICE_URL },
];
```

**Action:** Add all 13 services from the proxy config to the health check. Run health checks in parallel using `Promise.allSettled` to avoid one slow service blocking the response. Add version info from each service's health response.

### 2. Rate Limiting Per User Tier

Current rate limiting in `src/index.ts` lines 34-42 is flat: 100 requests per minute for everyone, keyed by API key, auth header, or IP.

**Action:** Implement tiered rate limiting based on the user's subscription plan:

- **Free tier:** 30 requests/minute, 500/hour
- **Pro tier:** 100 requests/minute, 5000/hour
- **Enterprise tier:** 500 requests/minute, unlimited/hour

Implementation approach:

1. After auth resolves, look up the user's plan from a Redis cache (key: `user:plan:<userId>`)
2. On cache miss, call the billing service to get the user's plan
3. Configure different `@fastify/rate-limit` thresholds based on plan type
4. The billing service or tRPC router should populate the Redis cache on subscription changes

### 3. Request/Response Logging to Analytics

The current logging at `src/index.ts` lines 77-94 logs to stdout via the structured logger. This data should also be sent to an analytics pipeline.

**Action:**

1. On each completed request (`onResponse` hook), publish a structured event to Redis channel `analytics:requests` containing: userId, method, path, service, statusCode, responseTime, requestId, timestamp
2. The analytics pipeline (or a separate consumer) can aggregate this for dashboards
3. Optionally, persist high-value events (errors, slow requests) to the `usageRecords` table via the billing service

### 4. WebSocket Event Broadcasting for Agent Status

The WebSocket infrastructure exists but needs richer event types for the frontend agent visualization.

**Action:** Define and broadcast these event types from the task/agent services through Redis pub/sub:

- `agent:status` - Agent status changes (idle, thinking, executing, waiting, completed, failed)
- `agent:progress` - Progress updates (0-100%) for long-running tasks
- `agent:tool_call` - When agent invokes a tool (name, arguments, status)
- `agent:tool_result` - Tool execution result
- `agent:message` - Streaming message content (text chunks)
- `task:status` - Task status changes
- `task:step` - Inngest step completions
- `sandbox:output` - Code execution stdout/stderr from sandbox

The frontend should receive these on the `user:<userId>` channel to update the agent visualization panel in real-time.

### 5. Streaming Proxy for Agent Completions

The current proxy in `src/routes/proxy.ts` reads the full response body before sending it back. This breaks streaming for the agent service's SSE `/v1/complete` endpoint.

**Action:** Add a streaming proxy path for agent completion requests. When the request path matches `agents/complete` and the request body has `stream: true`, pipe the response stream directly to the client using `reply.raw` instead of buffering. Example:

```typescript
// Detect streaming agent requests and pipe the response
if (service === "agents" && path === "complete") {
  const response = await fetch(url, { method, headers, body, signal });
  reply.raw.writeHead(response.status, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  for await (const chunk of response.body) {
    reply.raw.write(chunk);
  }
  reply.raw.end();
  return;
}
```

### 6. API Versioning Support

Currently all routes are under `/v1`. Prepare for `/v2` by:

1. Keeping the prefix structure in `src/index.ts` line 55-56
2. Adding a version header `X-API-Version` that clients can send
3. Logging the API version in request logs

---

## Shared Utilities Reference

The gateway imports from `@repo/service-utils` (`packages/service-utils/src/`):

| Export                                                       | Module            | Purpose                               |
| ------------------------------------------------------------ | ----------------- | ------------------------------------- |
| `createLogger`                                               | `logger/index.ts` | Structured pino logger                |
| `createHealthCheck`                                          | `index.ts`        | Standard health check response format |
| `getEnv` / `requireEnv`                                      | `index.ts`        | Environment variable helpers          |
| `extractAuth` / `AuthContext`                                | `auth/index.ts`   | JWT/API key authentication            |
| `getRedisClient` / `getRedisPubClient` / `getRedisSubClient` | `redis/index.ts`  | Redis connections for pub/sub         |
| `successResponse` / `errorResponse`                          | `index.ts`        | Standard API response wrappers        |
| `ErrorCodes`                                                 | `index.ts`        | Standard error code constants         |

---

## Environment Variables

| Variable                   | Default                 | Description                  |
| -------------------------- | ----------------------- | ---------------------------- |
| `PORT`                     | `4001`                  | Gateway listen port          |
| `HOST`                     | `0.0.0.0`               | Gateway listen host          |
| `CORS_ORIGIN`              | `*`                     | Allowed CORS origins         |
| `REDIS_URL`                | (from service-utils)    | Redis connection for pub/sub |
| `TASK_SERVICE_URL`         | `http://localhost:4002` | Task service URL             |
| `AGENT_SERVICE_URL`        | `http://localhost:8000` | Agent service URL            |
| `DEVICE_SERVICE_URL`       | `http://localhost:8080` | Device service URL           |
| `FILE_SERVICE_URL`         | `http://localhost:4005` | File service URL             |
| `WEBSITE_SERVICE_URL`      | `http://localhost:4004` | Website service URL          |
| `BILLING_SERVICE_URL`      | `http://localhost:4008` | Billing service URL          |
| `NOTIFICATION_SERVICE_URL` | `http://localhost:4006` | Notification service URL     |
| `WEBHOOK_SERVICE_URL`      | `http://localhost:4007` | Webhook service URL          |
| `CONNECTOR_SERVICE_URL`    | `http://localhost:4009` | Connector service URL        |
| `SEARCH_SERVICE_URL`       | `http://localhost:4013` | Search service URL           |
| `PROJECT_SERVICE_URL`      | `http://localhost:4010` | Project service URL          |
| `KNOWLEDGE_SERVICE_URL`    | `http://localhost:4011` | Knowledge service URL        |
| `SANDBOX_SERVICE_URL`      | `http://localhost:4012` | Sandbox service URL          |

---

## Development Notes

- The gateway does NOT connect to the database directly. It relies on downstream services for all data operations.
- Redis is required for WebSocket pub/sub and SSE. The gateway will fail readiness checks without it.
- All downstream services receive `x-request-id` and `x-user-id` headers from the gateway. Services should use these for logging correlation and authorization.
- The `request.id` is generated as a UUID by Fastify (`genReqId: () => crypto.randomUUID()`).
