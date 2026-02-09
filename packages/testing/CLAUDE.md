# packages/testing — Shared Test Utilities

## What This Is
Shared testing infrastructure: Vitest config factories, test data factories, MSW handlers. Every test file should use this package.

## Exports

### Config Factories (`@repo/testing`)
```typescript
import { createReactConfig, createServiceConfig } from "@repo/testing";
```
- `createReactConfig()` — For React/Next.js apps (jsdom, coverage thresholds)
- `createServiceConfig()` — For Node.js services (node env, coverage thresholds)

### Test Data Factories (`@repo/testing/factories`)
```typescript
import {
  createMockUser,
  createMockSession,
  createMockSessionList,
  createMockMessage,
  createMockConversation,
  createMockAgent,
  createMockAgentTask,
} from "@repo/testing/factories";
```
- ALWAYS use these — never inline test data objects
- Override only what your specific test cares about
- Factories produce deterministic, realistic data

### MSW Handlers (`@repo/testing/msw`)
```typescript
import { handlers } from "@repo/testing/msw";
import { setupServer } from "msw/node";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```
- SSE stream generators: `generateTextSSEStream()`, `generateToolSSEStream()`
- Full UIMessage protocol support
- Session, agent, conversation API mocks

## Rules
1. When adding a new entity type, add a factory function here
2. When adding a new API endpoint, add an MSW handler here
3. Factories must produce valid data that passes Zod schema validation
4. Use `onUnhandledRequest: "error"` to catch unmocked API calls
5. Reset handlers after each test to prevent test pollution
