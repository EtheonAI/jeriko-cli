# services/gateway — Testing Rules

## What This Is
Fastify gateway: API proxy, WebSocket, SSE passthrough, Redis pub/sub, rate limiting, CORS.

## Framework
- **Vitest 4.x** (node environment)
- Config: `vitest.config.ts`
- Setup: `src/tests/setup.ts`
- Test timeout: 30s test, 15s hook
- Sequential execution (not concurrent)

## What to Test

### Proxy Routing (P0)
1. API requests route to correct service based on path
2. Auth headers forwarded (x-user-id, x-session-id)
3. Request/response streaming works

### WebSocket (P1)
1. Connection authentication (valid token → connect, invalid → reject)
2. Room management (join, leave, broadcast)
3. Message routing (user A's events don't leak to user B)
4. Reconnection handling
5. No listener leaks on disconnect

### SSE Passthrough (P0)
1. `Content-Type: text/event-stream` preserved
2. Events stream through without buffering
3. Connection cleanup on client disconnect

### Rate Limiting (P1)
1. Below limit → 200
2. At limit → 429
3. Rate limit resets after window

### CORS (P1)
1. Allowed origins → proper headers
2. Disallowed origins → rejected
3. Preflight OPTIONS handled

### Health Check
1. `/health` → `{ status: "ok" }` with 200

## Pattern
```typescript
import Fastify from "fastify";

describe("Gateway", () => {
  let app: ReturnType<typeof Fastify>;
  beforeAll(async () => { app = await buildApp({ testing: true }); });
  afterAll(async () => { await app.close(); });

  it("should respond to health", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
  });
});
```
