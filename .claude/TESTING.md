# Rubic Testing Instructions

**Binding for**: Claude Code (all sessions)
**Last updated**: 2026-02-09
**Goal**: Zero regressions. Every feature ships with tests. Every bug fix starts with a failing test. No exceptions.

---

## 1. Iron Law: Test-Driven Development

**Every code change follows Red-Green-Refactor. No exceptions.**

```
RED   → Write a failing test that describes the expected behavior
FAIL  → Run it. Watch it fail. Confirm it fails for the RIGHT reason.
GREEN → Write the MINIMUM code to make the test pass
PASS  → Run all tests. Everything green.
REFACTOR → Clean up. Tests stay green.
REPEAT
```

### Rules

1. **No production code without a failing test first.** If code was written before the test, delete it and start over.
2. **Watch the test fail.** If you skip this step, you don't know if the test tests the right thing. A test that passes immediately proves nothing.
3. **Write minimal code.** Don't anticipate. Don't over-engineer. Just make the test pass.
4. **One behavior per test.** Each test should verify exactly one thing. If it fails, you know exactly what broke.
5. **Bug fixes start with a reproduction test.** Before touching any code, write a test that reproduces the bug. Watch it fail. Then fix.

### When to Apply TDD

| Scenario | TDD Required? |
|----------|--------------|
| New feature | **Always** |
| Bug fix | **Always** (reproduction test first) |
| Refactoring | **Always** (tests must exist before refactoring) |
| New tRPC procedure | **Always** |
| New agent tool | **Always** |
| New service endpoint | **Always** |
| One-line config change | No, but verify with existing tests |
| Documentation only | No |

---

## 2. Testing Pyramid

```
           /\
          /E2E\           ← 10-15 specs. Critical user journeys only.
         /──────\
        / Integr \        ← tRPC routers, SSE pipeline, service endpoints,
       /──────────\          WebSocket, OAuth, DB queries
      / Unit Tests \      ← Components, hooks, utils, tools, agent logic,
     /──────────────\        Redux slices, Drizzle queries, validators
    / Type Tests     \    ← TypeScript type assertions, schema validation
   /──────────────────\
```

- **Type tests** (Vitest `expectTypeOf`): Verify type inference, generics, branded types. Zero runtime cost.
- **Unit tests** (Vitest): Fast, isolated, mock external deps. Target: 80%+ on business logic.
- **Integration tests** (Vitest + MSW): Real module interactions. SSE streams, tRPC, DB queries, WebSocket.
- **E2E tests** (Playwright): Actual user flows in a browser. Smoke, auth, chat, canvas.

---

## 3. Tech Stack & Commands

### Frameworks

| Layer | Framework | Version | Config |
|-------|-----------|---------|--------|
| Unit/Integration (TS) | Vitest | 4.x | `vitest.config.mts` / `vitest.config.ts` |
| Component testing | @testing-library/react | 16.3.x | jsdom environment |
| E2E | Playwright | 1.58.x | `playwright.config.ts` |
| Python unit | pytest | 8.x | `pyproject.toml [tool.pytest]` |
| Python async | pytest-asyncio | 0.24.x | `asyncio_mode = "auto"` |
| HTTP mocking | MSW | 2.12.x | `@repo/testing/msw` |
| Test data | @faker-js/faker | 10.x | `@repo/testing/factories` |

### Commands

```bash
# === FULL SUITE (run in this order) ===
pnpm install                          # 1. Dependencies
pnpm services:up                      # 2. Postgres + Redis
pnpm -C apps/app build                # 3. Build (required for bundle-size tests)
pnpm test                             # 4. All Vitest tests (Turbo)
pnpm -C apps/app test:e2e             # 5. Playwright E2E
cd services/agent && python -m pytest  # 6. Python agent tests

# === TARGETED RUNS ===
pnpm -C apps/app test                          # App unit tests only
pnpm -C packages/ai test                       # AI package tests only
pnpm -C services/gateway test                  # Gateway service tests only
pnpm -C apps/app test -- path/to/file.test.ts  # Single file

# === COVERAGE ===
pnpm test:coverage                              # Full coverage report
pnpm -C apps/app test -- --coverage             # App coverage
pnpm -C packages/ai test -- --coverage          # AI package coverage
cd services/agent && python -m pytest --cov=src --cov-report=html  # Python coverage

# === LINT + TYPECHECK (run before committing) ===
pnpm check
pnpm -C apps/app typecheck
pnpm -C packages/ai typecheck

# === E2E ===
pnpm -C apps/app test:e2e                       # All E2E tests
pnpm -C apps/app test:e2e -- --grep "chat"      # Specific E2E tests
pnpm -C apps/app test:e2e:headed                # See the browser
pnpm -C apps/app test:e2e:debug                 # Step through
pnpm -C apps/app test:e2e:ui                    # Playwright UI mode
pnpm -C apps/app test:e2e:codegen               # Generate tests by recording

# === WATCH MODE ===
pnpm -C apps/app test -- --watch                # Watch all
pnpm -C apps/app test -- --watch path/to/file   # Watch single file
```

---

## 4. Test File Locations & Naming

### Convention

| Type | Location | Naming |
|------|----------|--------|
| Unit (TS) | `__tests__/` next to source, or co-located | `*.test.ts`, `*.test.tsx` |
| E2E | `apps/app/e2e/features/` | `*.spec.ts` |
| E2E helpers | `apps/app/e2e/helpers/` | `*.ts` |
| E2E page objects | `apps/app/e2e/page-objects/` | `*.ts` |
| Python | `services/agent/tests/` | `test_*.py` |
| Python fixtures | `services/agent/tests/conftest.py` | N/A |
| Factories | `packages/testing/src/factories/` | `*.ts` |
| MSW handlers | `packages/testing/src/msw/` | `handlers.ts` |

### Key Existing Test Files

```
apps/app/__tests__/                    # App component + hook tests (11 files)
apps/app/lib/chat/__tests__/           # SSE processor, error detection, streams (5 files)
apps/app/e2e/features/                 # E2E specs (10 specs)
packages/ai/components/**/__tests__/   # Tool registry, planner, canvas tests (14 files)
packages/testing/src/                  # Shared factories + MSW handlers
services/gateway/src/tests/            # Gateway service tests
```

---

## 5. Vitest Core Patterns

### 5.1 React Components

```typescript
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("ComponentName", () => {
  it("should render with required props", () => {
    render(<Component title="Hello" />);
    expect(screen.getByText("Hello")).toBeVisible();
  });

  it("should call handler on interaction", async () => {
    const onAction = vi.fn();
    render(<Component onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("should show loading state", () => {
    render(<Component isLoading />);
    expect(screen.getByRole("progressbar")).toBeVisible();
  });

  it("should handle error state", () => {
    render(<Component error="Something failed" />);
    expect(screen.getByText("Something failed")).toBeVisible();
  });
});
```

### 5.2 Custom Hooks

```typescript
import { renderHook, act } from "@testing-library/react";

describe("useCustomHook", () => {
  it("should return initial state", () => {
    const { result } = renderHook(() => useCustomHook());
    expect(result.current.value).toBe(0);
  });

  it("should update state on action", () => {
    const { result } = renderHook(() => useCustomHook());
    act(() => result.current.increment());
    expect(result.current.value).toBe(1);
  });

  it("should cleanup on unmount", () => {
    const cleanup = vi.fn();
    const { unmount } = renderHook(() => useCustomHook({ onCleanup: cleanup }));
    unmount();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
```

### 5.3 Async Functions

```typescript
describe("fetchData", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return data on success", async () => {
    (fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1 }), { status: 200 })
    );
    const result = await fetchData("/api/item/1");
    expect(result).toEqual({ id: 1 });
  });

  it("should throw on 500", async () => {
    (fetch as any).mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(fetchData("/api/item/1")).rejects.toThrow();
  });

  it("should throw on network error", async () => {
    (fetch as any).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(fetchData("/api/item/1")).rejects.toThrow("Failed to fetch");
  });
});
```

### 5.4 Module Mocking

```typescript
// Mock a workspace package
vi.mock("@repo/design-system/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/chat/123",
  useParams: () => ({ id: "123" }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

// Mock tRPC
vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    sessions: {
      list: { useQuery: vi.fn(() => ({ data: [], isLoading: false })) },
      create: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn() })) },
    },
  },
}));

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
}));
```

---

## 6. Vitest Advanced Features

### 6.1 Fake Timers (Debounce, Throttle, Polling, Timeouts)

```typescript
describe("polling behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should poll every 5 seconds", () => {
    const callback = vi.fn();
    startPolling(callback, 5000);

    expect(callback).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(15000);
    expect(callback).toHaveBeenCalledTimes(4);
  });

  it("should debounce search input", async () => {
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} debounceMs={300} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a" } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ab" } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });

    expect(onSearch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onSearch).toHaveBeenCalledOnce();
    expect(onSearch).toHaveBeenCalledWith("abc");
  });

  it("should clear timeout on unmount", () => {
    const { unmount } = render(<PollingComponent />);
    unmount();
    vi.runAllTimers(); // Should not throw
  });
});
```

### 6.2 Hoisted Mocks (Module-Level)

```typescript
// vi.hoisted runs BEFORE imports — use for module-level mocking
const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

// Now mockRouter is available in tests AND in the mock
it("should navigate on submit", async () => {
  render(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(mockRouter.push).toHaveBeenCalledWith("/success");
});
```

### 6.3 Concurrent Tests

```typescript
// Run independent tests in parallel for speed
describe("independent operations", () => {
  it.concurrent("should process item A", async () => {
    const result = await processItem("A");
    expect(result.status).toBe("done");
  });

  it.concurrent("should process item B", async () => {
    const result = await processItem("B");
    expect(result.status).toBe("done");
  });

  it.concurrent("should process item C", async () => {
    const result = await processItem("C");
    expect(result.status).toBe("done");
  });
});
```

### 6.4 Parameterized Tests (`test.each`)

```typescript
describe("input validation", () => {
  it.each([
    { input: "", expected: false, reason: "empty string" },
    { input: "valid@email.com", expected: true, reason: "valid email" },
    { input: "no-at-sign", expected: false, reason: "missing @" },
    { input: "@no-local", expected: false, reason: "missing local part" },
    { input: "a@b.c", expected: true, reason: "minimal valid email" },
  ])("validates $reason: $input → $expected", ({ input, expected }) => {
    expect(isValidEmail(input)).toBe(expected);
  });
});

// Table format
it.each`
  status  | code   | message
  ${"ok"} | ${200} | ${"Success"}
  ${"err"}| ${500} | ${"Server Error"}
  ${"na"} | ${404} | ${"Not Found"}
`("maps $status to $code with $message", ({ status, code, message }) => {
  expect(mapStatus(status)).toEqual({ code, message });
});
```

### 6.5 Async Assertions (`vi.waitFor`)

```typescript
it("should eventually show the result", async () => {
  render(<AsyncComponent />);

  await vi.waitFor(() => {
    expect(screen.getByText("Result loaded")).toBeVisible();
  }, { timeout: 5000, interval: 100 });
});

it("should retry until condition met", async () => {
  const spy = vi.fn().mockRejectedValueOnce(new Error("retry")).mockResolvedValue("ok");

  await vi.waitFor(async () => {
    const result = await spy();
    expect(result).toBe("ok");
  });
});
```

### 6.6 Type-Level Testing

```typescript
import { expectTypeOf, assertType } from "vitest";

describe("type safety", () => {
  it("should infer correct return type", () => {
    expectTypeOf(createSession).returns.toMatchTypeOf<Session>();
  });

  it("should accept correct parameter types", () => {
    expectTypeOf(createSession).parameter(0).toMatchTypeOf<{
      userId: string;
      model: string;
    }>();
  });

  it("should not accept invalid types", () => {
    // @ts-expect-error - number is not valid for userId
    assertType(createSession({ userId: 123 }));
  });

  it("should infer branded types", () => {
    type UserId = string & { __brand: "UserId" };
    expectTypeOf<UserId>().toBeString();
    expectTypeOf<UserId>().not.toEqualTypeOf<string>();
  });

  it("should resolve promise types", () => {
    expectTypeOf(fetchUser("1")).resolves.toMatchTypeOf<User>();
  });
});
```

### 6.7 Snapshot Testing (When to Use)

```typescript
// USE snapshots for: static config, error messages, API schemas
it("should match error response format", () => {
  const error = createErrorResponse(404, "Not found");
  expect(error).toMatchInlineSnapshot(`
    {
      "error": {
        "code": 404,
        "message": "Not found",
      },
      "success": false,
    }
  `);
});

// DO NOT use snapshots for: dynamic content, timestamps, random IDs
// ❌ BAD
it("should render messages", () => {
  render(<MessageList messages={messages} />);
  expect(container).toMatchSnapshot(); // breaks on every render
});

// ✅ GOOD — assert specific content
it("should render messages", () => {
  render(<MessageList messages={messages} />);
  expect(screen.getByText("Hello")).toBeVisible();
  expect(screen.getAllByRole("article")).toHaveLength(3);
});
```

---

## 7. Redux Store Testing

### 7.1 Slice Testing

```typescript
import { configureStore } from "@reduxjs/toolkit";
import { chatSlice, sendMessage, clearMessages } from "@/lib/store/slices/chat";

describe("chatSlice", () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({ reducer: { chat: chatSlice.reducer } });
  });

  it("should have correct initial state", () => {
    expect(store.getState().chat).toEqual({
      messages: [],
      isStreaming: false,
      error: null,
    });
  });

  it("should add message on sendMessage", () => {
    store.dispatch(sendMessage({ role: "user", content: "hello" }));
    expect(store.getState().chat.messages).toHaveLength(1);
    expect(store.getState().chat.messages[0].content).toBe("hello");
  });

  it("should clear all messages", () => {
    store.dispatch(sendMessage({ role: "user", content: "hello" }));
    store.dispatch(clearMessages());
    expect(store.getState().chat.messages).toHaveLength(0);
  });
});
```

### 7.2 Selector Testing

```typescript
import { selectActiveSession, selectSessionById } from "@/lib/store/selectors";

describe("session selectors", () => {
  const state = {
    sessions: {
      items: [
        { id: "1", title: "Chat 1", isActive: true },
        { id: "2", title: "Chat 2", isActive: false },
      ],
    },
  };

  it("should select the active session", () => {
    expect(selectActiveSession(state)).toEqual(state.sessions.items[0]);
  });

  it("should select session by ID", () => {
    expect(selectSessionById(state, "2")).toEqual(state.sessions.items[1]);
  });

  it("should return undefined for missing session", () => {
    expect(selectSessionById(state, "999")).toBeUndefined();
  });

  it("should memoize selector results", () => {
    const result1 = selectActiveSession(state);
    const result2 = selectActiveSession(state);
    expect(result1).toBe(result2); // Same reference = memoized
  });
});
```

### 7.3 Async Thunk Testing

```typescript
import { createSession } from "@/lib/store/thunks/sessions";

describe("createSession thunk", () => {
  it("should dispatch pending then fulfilled on success", async () => {
    const store = configureStore({
      reducer: { sessions: sessionsReducer },
    });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "new-session" }))
    );

    await store.dispatch(createSession({ model: "claude-sonnet-4-5-20250929" }));

    const state = store.getState().sessions;
    expect(state.items).toContainEqual(expect.objectContaining({ id: "new-session" }));
    expect(state.isCreating).toBe(false);
  });

  it("should set error on failure", async () => {
    const store = configureStore({
      reducer: { sessions: sessionsReducer },
    });
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));

    await store.dispatch(createSession({ model: "claude-sonnet-4-5-20250929" }));

    expect(store.getState().sessions.error).toBe("Network error");
  });
});
```

### 7.4 Redux + WebSocket Sync Testing

```typescript
describe("WebSocket → Redux sync", () => {
  it("should update store on socket message", () => {
    const store = configureStore({ reducer: { devices: devicesReducer } });
    const mockSocket = new MockSocketIO();

    initSocketSync(store, mockSocket);

    mockSocket.emit("device:status", {
      deviceId: "light-1",
      status: "on",
    });

    expect(store.getState().devices.byId["light-1"].status).toBe("on");
  });

  it("should handle socket disconnect gracefully", () => {
    const store = configureStore({ reducer: { connection: connectionReducer } });
    const mockSocket = new MockSocketIO();

    initSocketSync(store, mockSocket);
    mockSocket.emit("disconnect");

    expect(store.getState().connection.status).toBe("disconnected");
  });
});
```

---

## 8. tRPC Router Testing

### 8.1 Router Test Setup

```typescript
import { createCallerFactory } from "@/lib/trpc/server";
import { appRouter } from "@/lib/trpc/routers";
import { createMockContext } from "@repo/testing/factories";

describe("sessions router", () => {
  const createCaller = createCallerFactory(appRouter);

  const createAuthedCaller = () => {
    const ctx = createMockContext({ userId: "user-1" });
    return createCaller(ctx);
  };

  it("should list user sessions", async () => {
    const caller = createAuthedCaller();
    const sessions = await caller.sessions.list();
    expect(sessions).toBeInstanceOf(Array);
  });

  it("should reject unauthenticated requests", async () => {
    const caller = createCaller(createMockContext({ userId: null }));
    await expect(caller.sessions.list()).rejects.toThrow("UNAUTHORIZED");
  });
});
```

### 8.2 Input Validation Testing

```typescript
describe("sessions.create input validation", () => {
  it.each([
    { input: {}, error: "title is required" },
    { input: { title: "" }, error: "title must not be empty" },
    { input: { title: "a".repeat(256) }, error: "title too long" },
  ])("should reject invalid input: $error", async ({ input }) => {
    const caller = createAuthedCaller();
    await expect(caller.sessions.create(input)).rejects.toThrow();
  });

  it("should accept valid input", async () => {
    const caller = createAuthedCaller();
    const session = await caller.sessions.create({ title: "New Chat" });
    expect(session.id).toBeDefined();
    expect(session.title).toBe("New Chat");
  });
});
```

### 8.3 Middleware Testing

```typescript
describe("tRPC auth middleware", () => {
  it("should set user context from session", async () => {
    const ctx = createMockContext({
      session: { user: { id: "user-1", name: "Test" } },
    });
    const caller = createCaller(ctx);
    const user = await caller.user.me();
    expect(user.id).toBe("user-1");
  });

  it("should enforce rate limits", async () => {
    const caller = createAuthedCaller();
    const promises = Array.from({ length: 100 }, () =>
      caller.sessions.create({ title: "spam" })
    );
    await expect(Promise.all(promises)).rejects.toThrow("RATE_LIMIT");
  });
});
```

### 8.4 All 17 Routers — Test Checklist

Every tRPC router must have tests for:
- [ ] CRUD operations (create, read, update, delete)
- [ ] Input validation (Zod schema boundaries)
- [ ] Auth enforcement (unauthenticated → 401)
- [ ] User isolation (user A can't see user B's data)
- [ ] Error handling (DB errors, not found, conflict)
- [ ] Edge cases (empty lists, max limits, special characters)

| Router | Procedures | Priority | Key Test Focus |
|--------|-----------|----------|----------------|
| sessions | 5 | P0 | CRUD, user isolation |
| messages | 3 | P0 | Parts persistence, role filtering |
| agents | 7 | P0 | Task creation, status transitions |
| apiKeys | 5 | P0 | Max 5/user, key format, revoke |
| files | 8 | P1 | Upload, versioning, presigned URLs |
| connectors | 12 | P1 | OAuth flow, catalog sync |
| notifications | 10 | P1 | Delivery, preferences, batching |
| scheduledTasks | 10 | P1 | Cron validation, execution |
| projects | 13 | P1 | Members, permissions |
| knowledge | 14 | P1 | Ingestion, retrieval |
| billing | 18 | P1 | Stripe webhooks, usage tracking |
| mail | 11 | P2 | Email sending, templates |
| user | 14 | P2 | Profile, preferences |
| search | 7 | P2 | Query parsing, ranking |
| devices | 7 | P2 | Proxy to device service |
| webhooks | 11 | P2 | HMAC, retries |
| websiteBuilder | 16 | P2 | Templates, AI generation |

---

## 9. Chat Pipeline Testing (P0 — CRITICAL)

### 9.1 SSE Processor

```typescript
import { SSEProcessor } from "@/lib/chat/sse-processor";

describe("SSEProcessor", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  // Every SSE event type MUST have a test
  it.each([
    { event: "content", data: '{"text":"hello"}', expected: { type: "text-delta", textDelta: "hello" } },
    { event: "tool_start", data: '{"id":"t1","name":"browser_navigate"}', expected: { type: "tool-input-start" } },
    { event: "tool_result", data: '{"id":"t1","output":"done"}', expected: { type: "tool-output-available" } },
    { event: "sandbox_info", data: '{"sandbox_id":"s1"}', expected: { type: "message-metadata" } },
    { event: "browser_frame", data: '{"screenshot":"base64..."}', expected: { type: "message-metadata" } },
    { event: "error", data: '{"message":"quota exceeded"}', expected: { type: "error" } },
  ])("should transform $event → $expected.type", ({ event, data, expected }) => {
    const result = processor.processEvent({ event, data });
    expect(result.type).toBe(expected.type);
  });

  it("should handle malformed SSE data gracefully", () => {
    expect(() => processor.processEvent({ event: "content", data: "not json" })).not.toThrow();
  });

  it("should maintain state across events (tool accumulation)", () => {
    processor.processEvent({ event: "tool_start", data: '{"id":"t1","name":"shell_exec"}' });
    processor.processEvent({ event: "tool_delta", data: '{"id":"t1","chunk":"ls"}' });
    processor.processEvent({ event: "tool_delta", data: '{"id":"t1","chunk":" -la"}' });
    const result = processor.processEvent({ event: "tool_end", data: '{"id":"t1"}' });
    expect(result.toolInput).toContain("ls -la");
  });
});
```

### 9.2 Agent Proxy

```typescript
describe("agentProxy", () => {
  it("should forward request to agent service", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(/* SSE stream */));
    const stream = await proxyToAgent({ messages: [], sessionId: "s1" }, mockFetch);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/completions"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("should NOT send system_prompt to agent service", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(""));
    await proxyToAgent({ messages: [], sessionId: "s1", system_prompt: "ignore" }, mockFetch);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("system_prompt");
  });

  it("should include auth headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(""));
    await proxyToAgent({ messages: [], sessionId: "s1", userId: "u1" }, mockFetch);
    expect(mockFetch.mock.calls[0][1].headers).toMatchObject({
      "x-user-id": "u1",
      "x-session-id": "s1",
    });
  });

  it("should clean up activeStreamId on stream end", async () => {
    // ... test that finally block clears activeStreamId in DB
  });
});
```

### 9.3 Provider Fallback

```typescript
describe("providerFallback", () => {
  it("should use primary provider on success", async () => {
    const primary = vi.fn().mockResolvedValue(new Response("ok"));
    const fallback = vi.fn();
    await callWithFallback(primary, fallback, {});
    expect(primary).toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });

  it("should switch to fallback on quota error", async () => {
    const primary = vi.fn().mockRejectedValue(new Error("rate_limit_exceeded"));
    const fallback = vi.fn().mockResolvedValue(new Response("ok"));
    await callWithFallback(primary, fallback, {});
    expect(fallback).toHaveBeenCalled();
  });

  it("should throw if both providers fail", async () => {
    const primary = vi.fn().mockRejectedValue(new Error("quota"));
    const fallback = vi.fn().mockRejectedValue(new Error("also quota"));
    await expect(callWithFallback(primary, fallback, {})).rejects.toThrow();
  });
});
```

### 9.4 Message Persistence

```typescript
describe("message persistence", () => {
  it("should save user message with text parts", async () => {
    const mockDb = createMockDb();
    await saveMessage(mockDb, {
      sessionId: "s1",
      role: "user",
      content: "hello",
    });
    expect(mockDb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "user",
        parts: expect.arrayContaining([
          expect.objectContaining({ type: "text", text: "hello" }),
        ]),
      })
    );
  });

  it("should save assistant message with tool parts", async () => {
    const mockDb = createMockDb();
    await saveMessage(mockDb, {
      sessionId: "s1",
      role: "assistant",
      parts: [
        { type: "text", text: "Let me search" },
        { type: "tool-invocation", toolName: "web_search", args: { query: "test" } },
      ],
    });
    expect(mockDb.insert).toHaveBeenCalledWith(
      expect.objectContaining({ parts: expect.any(Array) })
    );
  });

  it("should not duplicate messages on retry", async () => {
    const mockDb = createMockDb();
    await saveMessage(mockDb, { sessionId: "s1", role: "user", content: "hello" });
    await saveMessage(mockDb, { sessionId: "s1", role: "user", content: "hello" });
    // Should deduplicate or use upsert
  });
});
```

### 9.5 Resumable Streams

```typescript
describe("resumable streams", () => {
  it("should create stream via consumeSseStream (POST)", async () => {
    const mockRedis = createMockRedis();
    const sourceStream = createMockSSEStream(["text-delta: hello"]);
    const { stream, streamId } = await consumeSseStream(sourceStream, mockRedis);
    expect(streamId).toBeDefined();
    expect(mockRedis.xadd).toHaveBeenCalled();
  });

  it("should resume stream via resumeExistingStream (GET)", async () => {
    const mockRedis = createMockRedis();
    mockRedis.xrange.mockResolvedValue([
      ["1-0", { data: "text-delta: hello" }],
      ["2-0", { data: "text-delta: world" }],
    ]);
    const stream = await resumeExistingStream("stream-123", mockRedis);
    const chunks = await collectStream(stream);
    expect(chunks).toContain("hello");
    expect(chunks).toContain("world");
  });

  it("should fall back gracefully without Redis", async () => {
    const sourceStream = createMockSSEStream(["text-delta: hello"]);
    const { stream } = await consumeSseStream(sourceStream, null); // no Redis
    const chunks = await collectStream(stream);
    expect(chunks).toContain("hello"); // Still works, just not resumable
  });

  it("should clear activeStreamId on stream end", async () => {
    const mockDb = createMockDb();
    const mockRedis = createMockRedis();
    await handleStreamEnd("session-1", "stream-1", mockDb);
    expect(mockDb.update).toHaveBeenCalledWith(
      expect.objectContaining({ activeStreamId: null })
    );
  });
});
```

### 9.6 Error Detection

```typescript
describe("error detection", () => {
  it.each([
    { error: "rate_limit_exceeded", type: "rate_limit" },
    { error: "authentication_error", type: "auth" },
    { error: "context_length_exceeded", type: "context_length" },
    { error: "overloaded_error", type: "overloaded" },
    { error: "ECONNREFUSED", type: "connection" },
    { error: "timeout", type: "timeout" },
  ])("should detect $type error from: $error", ({ error, type }) => {
    expect(detectErrorType(error)).toBe(type);
  });

  it("should return 'unknown' for unrecognized errors", () => {
    expect(detectErrorType("something weird")).toBe("unknown");
  });
});
```

---

## 10. Canvas System Testing

### 10.1 TOOL_VIEW_MAP Completeness

```typescript
import { TOOL_VIEW_MAP } from "@repo/ai/components/canvas/use-canvas";

describe("TOOL_VIEW_MAP", () => {
  const BROWSER_TOOLS = [
    "browser_navigate", "browser_view", "browser_click", "browser_input",
    "browser_scroll", "browser_scroll_up", "browser_scroll_down",
    "browser_move_mouse", "browser_key_press", "browser_press_key",
    "browser_select_option", "browser_console_exec", "browser_console_view",
    "browser_screenshot", "browser_restart",
    "info_search_web", "web_search", "search_web",
    "deploy_expose_port", "deploy_apply_deployment", "make_manus_page",
  ];

  const TERMINAL_TOOLS = [
    "shell_exec", "shell_view", "shell_wait", "shell_write_to_process",
    "shell_kill_process", "code_execute",
  ];

  const CODE_TOOLS = [
    "file_read", "file_write", "file_str_replace", "file_find_in_content",
    "file_find_by_name",
  ];

  const NO_CANVAS_TOOLS = [
    "show_plan", "message_notify_user", "message_ask_user",
    "generate_image", "schedule_task", "track_analytics",
  ];

  it.each(BROWSER_TOOLS)("should map %s → browser", (tool) => {
    expect(TOOL_VIEW_MAP[tool]).toBe("browser");
  });

  it.each(TERMINAL_TOOLS)("should map %s → terminal", (tool) => {
    expect(TOOL_VIEW_MAP[tool]).toBe("terminal");
  });

  it.each(CODE_TOOLS)("should map %s → code", (tool) => {
    expect(TOOL_VIEW_MAP[tool]).toBe("code");
  });

  it.each(NO_CANVAS_TOOLS)("should NOT map %s to any canvas", (tool) => {
    expect(TOOL_VIEW_MAP[tool]).toBeUndefined();
  });
});
```

### 10.2 Canvas State Transitions

```typescript
describe("useCanvas", () => {
  it("should detect browser view from browser_navigate", () => {
    const messages = [createMessageWithTool("browser_navigate", { url: "https://example.com" })];
    const { result } = renderHook(() => useCanvas(messages));
    expect(result.current.activeView).toBe("browser");
  });

  it("should detect terminal view from shell_exec", () => {
    const messages = [createMessageWithTool("shell_exec", { command: "ls" })];
    const { result } = renderHook(() => useCanvas(messages));
    expect(result.current.activeView).toBe("terminal");
  });

  it("should accumulate terminal output across tool calls", () => {
    const messages = [
      createMessageWithTool("shell_exec", { command: "echo 1" }, { output: "1\n" }),
      createMessageWithTool("shell_exec", { command: "echo 2" }, { output: "2\n" }),
    ];
    const { result } = renderHook(() => useCanvas(messages));
    expect(result.current.terminalOutput).toContain("1\n");
    expect(result.current.terminalOutput).toContain("2\n");
  });

  it("should extract screenshot from browser_frame metadata", () => {
    const messages = [createMessageWithMetadata("browser_frame", {
      screenshot: "data:image/png;base64,ABC",
      url: "https://example.com",
      title: "Example",
    })];
    const { result } = renderHook(() => useCanvas(messages));
    expect(result.current.browserScreenshot).toContain("base64,ABC");
  });

  it("should allow user to override auto-detected view", () => {
    const messages = [createMessageWithTool("browser_navigate", { url: "https://example.com" })];
    const { result } = renderHook(() => useCanvas(messages));
    act(() => result.current.onSelectView("terminal"));
    expect(result.current.activeView).toBe("terminal");
  });
});
```

---

## 11. Tool Registry Testing

### 11.1 All 34 Tools Have Renderers

```typescript
import { getToolRenderer, TOOL_RENDERERS } from "@repo/ai/components/tools/tool-registry";
import { GenericTool } from "@repo/ai/components/tools/generic-tool";

const ALL_TOOLS = [
  // Communication (2)
  "message_notify_user", "message_ask_user",
  // File (5)
  "file_read", "file_write", "file_str_replace", "file_find_in_content", "file_find_by_name",
  // Shell (5)
  "shell_exec", "shell_view", "shell_wait", "shell_write_to_process", "shell_kill_process",
  // Code (1)
  "code_execute",
  // Search (1)
  "web_search",
  // Browser (13)
  "browser_navigate", "browser_view", "browser_click", "browser_input",
  "browser_scroll", "browser_scroll_up", "browser_scroll_down",
  "browser_move_mouse", "browser_key_press", "browser_press_key",
  "browser_select_option", "browser_console_exec", "browser_console_view",
  "browser_screenshot", "browser_restart",
  // Deploy (2)
  "deploy_expose_port", "deploy_apply_deployment",
  // Image (1)
  "generate_image",
  // Schedule (1)
  "schedule_task",
  // Analytics (1)
  "track_analytics",
  // Plan (1)
  "show_plan",
];

describe("tool-registry", () => {
  it.each(ALL_TOOLS)("should have explicit renderer for %s", (toolName) => {
    const renderer = getToolRenderer(toolName);
    expect(renderer).toBeDefined();
    expect(renderer).not.toBe(GenericTool);
  });

  it("should return GenericTool for unknown tools", () => {
    expect(getToolRenderer("unknown_tool")).toBe(GenericTool);
  });

  it("should handle both snake_case and camelCase", () => {
    expect(getToolRenderer("show_plan")).toBe(getToolRenderer("showPlan"));
  });
});
```

### 11.2 Individual Renderer Testing

```typescript
describe("ShowPlanRenderer", () => {
  it("should render plan steps", () => {
    render(<ShowPlanRenderer args={{
      steps: [
        { title: "Research", status: "completed" },
        { title: "Implement", status: "in_progress" },
        { title: "Test", status: "pending" },
      ]
    }} />);
    expect(screen.getByText("Research")).toBeVisible();
    expect(screen.getByText("Implement")).toBeVisible();
  });

  it("should show loading state when tool is pending", () => {
    render(<ShowPlanRenderer args={undefined} state="pending" />);
    expect(screen.getByRole("progressbar")).toBeVisible();
  });
});
```

---

## 12. Drizzle ORM & Database Testing

### 12.1 Query Testing

```typescript
import { db } from "@repo/database";
import { sessions, messages } from "@repo/database/schema";
import { eq } from "drizzle-orm";

describe("session queries", () => {
  // Use test transaction that rolls back
  it("should create and retrieve a session", async () => {
    await db.transaction(async (tx) => {
      const [created] = await tx.insert(sessions).values({
        id: "test-session",
        userId: "test-user",
        title: "Test Chat",
      }).returning();

      const found = await tx.query.sessions.findFirst({
        where: eq(sessions.id, "test-session"),
      });

      expect(found).toEqual(expect.objectContaining({
        id: "test-session",
        title: "Test Chat",
      }));

      // Rollback — don't pollute test DB
      tx.rollback();
    });
  });
});
```

### 12.2 ESM Import Wrapper Testing

```typescript
// Critical: test the (mod as any).default ?? mod pattern
describe("ESM import wrapper", () => {
  it("should handle default export wrapping", () => {
    const mod = { default: { sessions: {} } };
    const result = (mod as any).default ?? mod;
    expect(result).toEqual({ sessions: {} });
  });

  it("should handle direct export", () => {
    const mod = { sessions: {} };
    const result = (mod as any).default ?? mod;
    expect(result).toEqual({ sessions: {} });
  });
});
```

### 12.3 Schema Validation Testing

```typescript
describe("schema validation", () => {
  it("should require userId on sessions", () => {
    expect(() => insertSessionSchema.parse({ title: "Test" })).toThrow();
  });

  it("should enforce api key format", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^rk_live_[A-Za-z0-9_-]{32}$/);
  });

  it("should limit api keys to 5 per user", async () => {
    // Create 5 keys, then assert 6th fails
  });
});
```

### 12.4 Neon HTTP Driver Gotcha

```typescript
describe("Neon HTTP driver limitations", () => {
  it("should warn that transactions are not supported", () => {
    // Neon HTTP driver does NOT support db.transaction()
    // Webhook service uses transactions — must use different approach
    // This test documents the limitation
    expect(true).toBe(true); // Canary test
  });
});
```

---

## 13. WebSocket Testing

### 13.1 Socket.io Client Testing

```typescript
import { createMockSocket } from "@repo/testing/factories";

describe("WebSocket connection", () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
  });

  afterEach(() => {
    mockSocket.disconnect();
  });

  it("should connect on mount", () => {
    renderHook(() => useSocket());
    expect(mockSocket.connected).toBe(true);
  });

  it("should handle device status updates", () => {
    const store = configureStore({ reducer: { devices: devicesReducer } });
    initSocketSync(store, mockSocket);

    mockSocket.serverEmit("device:status", {
      deviceId: "light-1",
      state: "on",
    });

    expect(store.getState().devices.byId["light-1"].state).toBe("on");
  });

  it("should reconnect on disconnect", async () => {
    renderHook(() => useSocket());
    mockSocket.disconnect();

    await vi.waitFor(() => {
      expect(mockSocket.connected).toBe(true);
    });
  });

  it("should not leak listeners on unmount", () => {
    const { unmount } = renderHook(() => useSocket());
    const listenerCount = mockSocket.listenerCount("device:status");
    unmount();
    expect(mockSocket.listenerCount("device:status")).toBe(listenerCount - 1);
  });
});
```

### 13.2 Gateway WebSocket Route Testing

```typescript
describe("gateway WebSocket", () => {
  it("should authenticate socket connection", async () => {
    const socket = createTestSocket({ token: "valid-token" });
    await socket.connect();
    expect(socket.connected).toBe(true);
  });

  it("should reject unauthenticated connections", async () => {
    const socket = createTestSocket({ token: null });
    await expect(socket.connect()).rejects.toThrow();
  });

  it("should route messages to correct rooms", async () => {
    const socket1 = createTestSocket({ userId: "user-1" });
    const socket2 = createTestSocket({ userId: "user-2" });

    await socket1.connect();
    await socket2.connect();

    socket1.emit("session:join", { sessionId: "s1" });

    const received = vi.fn();
    socket2.on("session:update", received);

    socket1.emit("session:update", { sessionId: "s1", data: "test" });

    // socket2 should NOT receive user-1's session update
    expect(received).not.toHaveBeenCalled();
  });
});
```

---

## 14. Better-Auth & proxy.ts Testing

### 14.1 Auth Session Testing

```typescript
describe("auth sessions", () => {
  it("should create session on login", async () => {
    const response = await authClient.signIn.email({
      email: "test@example.com",
      password: "password123",
    });
    expect(response.session).toBeDefined();
    expect(response.session.userId).toBeDefined();
  });

  it("should expire session after timeout", async () => {
    vi.useFakeTimers();
    const session = await createTestSession();

    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1); // 24h + 1ms

    const isValid = await validateSession(session.token);
    expect(isValid).toBe(false);

    vi.useRealTimers();
  });

  it("should handle concurrent sessions", async () => {
    const session1 = await createTestSession({ userId: "user-1" });
    const session2 = await createTestSession({ userId: "user-1" });
    // Both should be valid
    expect(await validateSession(session1.token)).toBe(true);
    expect(await validateSession(session2.token)).toBe(true);
  });
});
```

### 14.2 proxy.ts Testing (Next.js 16 Middleware)

```typescript
// IMPORTANT: Next.js 16 uses proxy.ts, NOT middleware.ts
import { proxyHandler } from "@/proxy";

describe("proxy.ts", () => {
  it("should redirect unauthenticated to /sign-in", async () => {
    const req = createMockRequest("/chat/123", { cookies: {} });
    const response = await proxyHandler(req);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in");
  });

  it("should allow authenticated requests", async () => {
    const req = createMockRequest("/chat/123", {
      cookies: { "better-auth.session": "valid-token" },
    });
    const response = await proxyHandler(req);
    expect(response.status).not.toBe(307);
  });

  it("should allow public routes without auth", async () => {
    const publicRoutes = ["/sign-in", "/sign-up", "/api/auth", "/api/health"];
    for (const route of publicRoutes) {
      const req = createMockRequest(route, { cookies: {} });
      const response = await proxyHandler(req);
      expect(response.status).not.toBe(307);
    }
  });

  it("should set security headers", async () => {
    const req = createMockRequest("/");
    const response = await proxyHandler(req);
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
```

---

## 15. Service-Level Testing

### 15.1 Service Test Template (All 13 TS Services)

```typescript
// services/{name}/src/tests/{route}.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { buildApp } from "../index.js";

describe("{ServiceName} Service", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    await app.listen({ port: 0 }); // Random port
  });

  afterAll(async () => {
    await app.close();
  });

  it("should respond to health check", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
```

### 15.2 Gateway Service

```typescript
describe("Gateway", () => {
  it("should proxy API requests to correct service", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/completions",
      headers: { "x-user-id": "user-1" },
    });
    // Should forward to agent service
  });

  it("should handle SSE passthrough", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/completions",
      headers: { accept: "text/event-stream" },
    });
    expect(response.headers["content-type"]).toContain("text/event-stream");
  });

  it("should enforce rate limits", async () => {
    const requests = Array.from({ length: 101 }, () =>
      app.inject({ method: "POST", url: "/api/v1/completions" })
    );
    const responses = await Promise.all(requests);
    expect(responses.some((r) => r.statusCode === 429)).toBe(true);
  });

  it("should set CORS headers", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/completions",
      headers: { origin: "https://app.rubic.dev" },
    });
    expect(response.headers["access-control-allow-origin"]).toBeDefined();
  });
});
```

### 15.3 Sandbox Service

```typescript
describe("Sandbox Service", () => {
  it("should create sandbox", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sandboxes",
      payload: { template: "base", userId: "user-1" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().sandboxId).toBeDefined();
  });

  it("should execute code in sandbox", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sandboxes/s1/code",
      payload: { code: "print('hello')", language: "python" },
    });
    expect(response.json().output).toContain("hello");
  });

  it("should validate browser action allowlist", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sandboxes/s1/browser",
      payload: { action: "DANGEROUS_ACTION", params: {} },
    });
    expect(response.statusCode).toBe(400);
  });

  it("should handle browser actions", async () => {
    const ALLOWED_ACTIONS = ["navigate", "click", "scroll", "screenshot", "key_press"];
    for (const action of ALLOWED_ACTIONS) {
      const response = await app.inject({
        method: "POST",
        url: "/sandboxes/s1/browser",
        payload: { action, params: { url: "https://example.com" } },
      });
      expect(response.statusCode).not.toBe(400);
    }
  });
});
```

### 15.4 Device Service

```typescript
describe("Device Service", () => {
  it("should register a device", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/devices",
      payload: { name: "Test Light", type: "light", userId: "user-1" },
    });
    expect(response.statusCode).toBe(201);
  });

  it("should register HA hub", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/hubs",
      payload: {
        url: "http://homeassistant.local:8123",
        accessToken: "test-token",
        userId: "user-1",
      },
    });
    expect(response.statusCode).toBe(201);
  });

  it("should test HA connection", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/hubs/hub-1/test",
    });
    expect(response.json()).toHaveProperty("connected");
  });

  it("should discover HA entities", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/hubs/hub-1/discover",
    });
    expect(response.json().entities).toBeInstanceOf(Array);
  });

  it("should enforce command safety checks", async () => {
    // Dangerous commands should be rejected
    const response = await app.inject({
      method: "POST",
      url: "/devices/d1/commands",
      payload: { command: "factory_reset" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("should isolate users (user A can't see user B's devices)", async () => {
    const responseA = await app.inject({
      method: "GET",
      url: "/devices",
      headers: { "x-user-id": "user-a" },
    });
    const responseB = await app.inject({
      method: "GET",
      url: "/devices",
      headers: { "x-user-id": "user-b" },
    });
    const idsA = responseA.json().map((d: any) => d.id);
    const idsB = responseB.json().map((d: any) => d.id);
    expect(idsA).not.toEqual(expect.arrayContaining(idsB));
  });
});
```

### 15.5 File Service

```typescript
describe("File Service", () => {
  it("should upload file to S3", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/files",
      payload: createMultipartPayload("test.txt", "hello world"),
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().url).toContain("s3");
  });

  it("should version files", async () => {
    // Upload v1
    await app.inject({ method: "POST", url: "/files", payload: createMultipartPayload("doc.md", "v1") });
    // Upload v2
    await app.inject({ method: "POST", url: "/files", payload: createMultipartPayload("doc.md", "v2") });

    const response = await app.inject({ method: "GET", url: "/files/doc.md/versions" });
    expect(response.json()).toHaveLength(2);
  });

  it("should reject oversized files", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/files",
      payload: createMultipartPayload("big.bin", "x".repeat(100 * 1024 * 1024)),
    });
    expect(response.statusCode).toBe(413);
  });

  it("should validate MIME types", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/files",
      payload: createMultipartPayload("script.exe", "MZ...", "application/x-msdownload"),
    });
    expect(response.statusCode).toBe(400);
  });
});
```

### 15.6 Other Services (Checklist)

Each service needs at minimum:
- [ ] Health check endpoint test
- [ ] CRUD operation tests
- [ ] Auth/user isolation tests
- [ ] Input validation tests
- [ ] Error handling tests

| Service | Key Test Focus |
|---------|---------------|
| Connector | OAuth flow, Composio SDK, tool catalog sync |
| Task | Inngest function trigger, status transitions |
| Notification | Knock email, Web Push, in-app delivery |
| Webhook | HMAC verification, retry logic, idempotency |
| Knowledge | Embedding generation, vector search, retrieval |
| Search | Typesense query, DB ILIKE fallback |
| Billing | Stripe webhook, usage tracking, quota enforcement |
| Project | CRUD, member management, permissions |
| Website | Template rendering, AI generation |

---

## 16. Python Agent Service Testing (pytest)

### 16.1 conftest.py Setup

```python
# services/agent/tests/conftest.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from src.main import app
from src.config import Settings

@pytest.fixture
def settings():
    return Settings(
        DATABASE_URL="postgresql://test:test@localhost:5432/test",
        ANTHROPIC_API_KEY="test-key",
        E2B_API_KEY="test-e2b-key",
    )

@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.fetch = AsyncMock(return_value=[])
    db.fetchrow = AsyncMock(return_value=None)
    db.execute = AsyncMock()
    return db

@pytest.fixture
def mock_sandbox():
    sandbox = MagicMock()
    sandbox.id = "test-sandbox"
    sandbox.filesystem = MagicMock()
    sandbox.process = MagicMock()
    return sandbox

@pytest.fixture
def mock_anthropic():
    client = AsyncMock()
    client.messages.create = AsyncMock()
    return client

@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

@pytest.fixture
def mock_session():
    return {
        "session_id": "test-session",
        "user_id": "test-user",
        "model": "claude-sonnet-4-5-20250929",
        "provider": "anthropic",
    }
```

### 16.2 Tool Executor Testing (All 32 Tools)

```python
import pytest
from src.tool_executor import execute_tool

# === FILE TOOLS (5) ===

@pytest.mark.asyncio
async def test_file_write(mock_sandbox):
    result = await execute_tool("file_write", {
        "file_path": "/home/user/test.txt",
        "content": "hello world",
    }, sandbox=mock_sandbox)
    assert result["success"] is True

@pytest.mark.asyncio
async def test_file_write_rejects_dangerous_path(mock_sandbox):
    with pytest.raises(ValueError, match="path"):
        await execute_tool("file_write", {
            "file_path": "/etc/passwd",
            "content": "hack",
        }, sandbox=mock_sandbox)

@pytest.mark.asyncio
async def test_file_read(mock_sandbox):
    mock_sandbox.filesystem.read.return_value = b"hello"
    result = await execute_tool("file_read", {
        "file_path": "/home/user/test.txt",
    }, sandbox=mock_sandbox)
    assert result["content"] == "hello"

@pytest.mark.asyncio
async def test_file_find_by_name(mock_sandbox):
    mock_sandbox.process.start_and_wait.return_value = MagicMock(
        stdout="file1.py\nfile2.py\n", exit_code=0
    )
    result = await execute_tool("file_find_by_name", {
        "pattern": "*.py",
    }, sandbox=mock_sandbox)
    assert len(result["files"]) == 2

# === SHELL TOOLS (5) ===

@pytest.mark.asyncio
async def test_shell_exec(mock_sandbox):
    mock_sandbox.process.start_and_wait.return_value = MagicMock(
        stdout="hello\n", stderr="", exit_code=0
    )
    result = await execute_tool("shell_exec", {
        "command": "echo hello",
    }, sandbox=mock_sandbox)
    assert result["exit_code"] == 0
    assert "hello" in result["stdout"]

@pytest.mark.asyncio
async def test_shell_exec_timeout(mock_sandbox):
    mock_sandbox.process.start_and_wait.side_effect = TimeoutError()
    result = await execute_tool("shell_exec", {
        "command": "sleep 999",
        "timeout": 1,
    }, sandbox=mock_sandbox)
    assert result["success"] is False

# === BROWSER TOOLS (13) ===

@pytest.mark.asyncio
async def test_browser_navigate(mock_sandbox):
    result = await execute_tool("browser_navigate", {
        "url": "https://example.com",
    }, sandbox=mock_sandbox)
    assert result["success"] is True
    assert "screenshot" in result or "content" in result

@pytest.mark.asyncio
async def test_browser_click(mock_sandbox):
    result = await execute_tool("browser_click", {
        "coordinate": [640, 360],
    }, sandbox=mock_sandbox)
    assert result["success"] is True

# === COMMUNICATION TOOLS (2) ===

@pytest.mark.asyncio
async def test_message_notify_user():
    result = await execute_tool("message_notify_user", {
        "text": "Task complete",
    })
    assert result["delivered"] is True

# === PARAMETERIZED: All tools accept valid input ===

@pytest.mark.parametrize("tool_name,args", [
    ("file_write", {"file_path": "/home/user/test.txt", "content": "test"}),
    ("file_read", {"file_path": "/home/user/test.txt"}),
    ("shell_exec", {"command": "echo test"}),
    ("browser_navigate", {"url": "https://example.com"}),
    ("web_search", {"query": "test"}),
    ("show_plan", {"steps": [{"title": "Step 1", "status": "pending"}]}),
    ("generate_image", {"prompt": "a cat"}),
    ("schedule_task", {"description": "test", "cron": "0 * * * *"}),
])
@pytest.mark.asyncio
async def test_tool_accepts_valid_input(tool_name, args, mock_sandbox):
    """Every tool should accept its documented input without error."""
    result = await execute_tool(tool_name, args, sandbox=mock_sandbox)
    assert "error" not in result or result.get("success") is True
```

### 16.3 Agent Loop Testing

```python
@pytest.mark.asyncio
async def test_agent_stops_after_max_iterations(mock_db, mock_session, mock_anthropic):
    """Agent loop must not run forever."""
    # Mock the LLM to always request another tool call
    mock_anthropic.messages.create.return_value = MockResponse(
        content=[{"type": "tool_use", "id": "t1", "name": "shell_exec", "input": {"command": "ls"}}],
        stop_reason="tool_use",
    )
    loop = AgentLoop(db=mock_db, session=mock_session, client=mock_anthropic, max_iterations=5)
    result = await loop.run("do something complex")
    assert loop.iteration_count <= 5

@pytest.mark.asyncio
async def test_agent_calls_show_plan_for_complex_tasks(mock_db, mock_session, mock_anthropic):
    mock_anthropic.messages.create.return_value = MockResponse(
        content=[
            {"type": "tool_use", "id": "t1", "name": "show_plan", "input": {
                "steps": [{"title": "Research", "status": "pending"}]
            }},
        ],
        stop_reason="tool_use",
    )
    loop = AgentLoop(db=mock_db, session=mock_session, client=mock_anthropic)
    result = await loop.run("build me a website")
    tool_names = [call["name"] for call in result["tool_calls"]]
    assert "show_plan" in tool_names

@pytest.mark.asyncio
async def test_agent_stops_on_end_turn(mock_db, mock_session, mock_anthropic):
    mock_anthropic.messages.create.return_value = MockResponse(
        content=[{"type": "text", "text": "Hello!"}],
        stop_reason="end_turn",
    )
    loop = AgentLoop(db=mock_db, session=mock_session, client=mock_anthropic)
    result = await loop.run("say hello")
    assert loop.iteration_count == 1

@pytest.mark.asyncio
async def test_consecutive_message_merging(mock_db, mock_session):
    """Anthropic API forbids consecutive same-role messages."""
    messages = [
        {"role": "user", "content": "hello"},
        {"role": "user", "content": "world"},
    ]
    merged = _merge_consecutive_messages(messages)
    assert len(merged) == 1
    assert "hello" in merged[0]["content"]
    assert "world" in merged[0]["content"]
```

### 16.4 SSE Protocol Testing

```python
@pytest.mark.asyncio
async def test_completion_streams_valid_sse(async_client, mock_session):
    response = await async_client.post("/v1/completions", json={
        "messages": [{"role": "user", "content": "hi"}],
        "session_id": mock_session["session_id"],
    })
    events = parse_sse_events(response.text)
    event_types = [e["type"] for e in events]

    assert "start" in event_types
    assert "text-delta" in event_types or "tool-input-start" in event_types
    assert "finish" in event_types

@pytest.mark.asyncio
async def test_completion_rejects_missing_session(async_client):
    response = await async_client.post("/v1/completions", json={
        "messages": [{"role": "user", "content": "hi"}],
    })
    assert response.status_code == 400

@pytest.mark.asyncio
async def test_completion_handles_provider_error(async_client, mock_anthropic):
    mock_anthropic.messages.create.side_effect = Exception("rate_limit_exceeded")
    response = await async_client.post("/v1/completions", json={
        "messages": [{"role": "user", "content": "hi"}],
        "session_id": "test-session",
    })
    events = parse_sse_events(response.text)
    assert any(e.get("type") == "error" for e in events)
```

### 16.5 SandboxRuntime Protocol Testing

```python
@pytest.mark.asyncio
async def test_direct_sdk_runtime_creates_sandbox():
    runtime = DirectSdkRuntime(api_key="test-key")
    sandbox = await runtime.create_sandbox(template="base")
    assert sandbox.id is not None

@pytest.mark.asyncio
async def test_runtime_protocol_exec_command(mock_runtime):
    result = await mock_runtime.exec_command("echo hello")
    assert result.stdout == "hello\n"

@pytest.mark.asyncio
async def test_runtime_protocol_write_file(mock_runtime):
    await mock_runtime.write_file("/test.txt", "content")
    content = await mock_runtime.read_file("/test.txt")
    assert content == "content"
```

---

## 17. E2E Testing (Playwright)

### 17.1 Page Object Model

```typescript
// e2e/page-objects/chat-page.ts
export class ChatPage {
  constructor(private page: Page) {}

  readonly input = this.page.getByTestId("chat-input");
  readonly sendButton = this.page.getByRole("button", { name: /send/i });
  readonly messageList = this.page.getByTestId("message-list");
  readonly sidebar = this.page.getByTestId("sidebar");

  async goto(chatId: string) {
    await this.page.goto(`/chat/${chatId}`);
    await this.page.waitForLoadState("networkidle");
  }

  async sendMessage(text: string) {
    await this.input.fill(text);
    await this.sendButton.click();
  }

  async waitForAssistantResponse() {
    await this.page.waitForSelector('[data-role="assistant"]');
  }

  async getMessageCount() {
    return this.messageList.getByRole("article").count();
  }
}
```

### 17.2 Auth Setup

```typescript
// e2e/auth.setup.ts
import { test as setup, expect } from "@playwright/test";

setup("authenticate", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(process.env.TEST_EMAIL!);
  await page.getByLabel("Password").fill(process.env.TEST_PASSWORD!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("/");
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
```

### 17.3 Network Mocking

```typescript
import { sse, textDelta, startEvent, finishEvent, toolCall } from "../helpers/sse-streams";

test("should render streamed text response", async ({ page }) => {
  await page.route("**/api/chat", (route) => {
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body: [startEvent(), textDelta("Hello "), textDelta("world!"), finishEvent()].join(""),
    });
  });

  const chatPage = new ChatPage(page);
  await chatPage.goto("test-session");
  await chatPage.sendMessage("hi");
  await expect(page.getByText("Hello world!")).toBeVisible();
});

test("should render tool call with plan", async ({ page }) => {
  await page.route("**/api/chat", (route) => {
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body: [
        startEvent(),
        toolCall("show_plan", { steps: [{ title: "Research", status: "in_progress" }] }),
        textDelta("Working on it..."),
        finishEvent(),
      ].join(""),
    });
  });

  const chatPage = new ChatPage(page);
  await chatPage.goto("test-session");
  await chatPage.sendMessage("build a website");
  await expect(page.getByText("Research")).toBeVisible();
});
```

### 17.4 Waiting Strategies

```typescript
// BANNED — fixed timeouts
await page.waitForTimeout(3000); // ❌ NEVER

// GOOD — condition-based waits
await expect(page.getByText("Welcome")).toBeVisible();          // ✅
await page.waitForLoadState("networkidle");                      // ✅
await page.waitForURL("/dashboard");                             // ✅
await expect(page.getByRole("button")).toBeEnabled();             // ✅
await page.waitForResponse("**/api/chat");                       // ✅
await expect(page.getByTestId("loader")).not.toBeVisible();      // ✅
```

### 17.5 Visual Regression

```typescript
test("homepage matches screenshot", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("homepage.png", {
    fullPage: true,
    maxDiffPixels: 100,
  });
});

test("chat page matches screenshot", async ({ page }) => {
  await page.goto("/chat/test");
  await expect(page).toHaveScreenshot("chat-empty.png", {
    mask: [page.getByTestId("timestamp")], // Mask dynamic content
  });
});
```

### 17.6 Accessibility

```typescript
import AxeBuilder from "@axe-core/playwright";

test.describe("accessibility", () => {
  const CRITICAL_PAGES = ["/", "/chat/test", "/devices", "/applications", "/files"];

  for (const pagePath of CRITICAL_PAGES) {
    test(`${pagePath} passes accessibility audit`, async ({ page }) => {
      await page.goto(pagePath);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("chat input is keyboard accessible", async ({ page }) => {
    await page.goto("/chat/test");
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("chat-input")).toBeFocused();
  });

  test("sidebar is navigable with keyboard", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    // Should be able to navigate sidebar items with arrow keys
  });
});
```

### 17.7 Mobile Responsive

```typescript
test.describe("mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone

  test("sidebar is collapsed on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("sidebar")).not.toBeVisible();
  });

  test("hamburger menu opens sidebar", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-button").click();
    await expect(page.getByTestId("sidebar")).toBeVisible();
  });

  test("chat input is usable on mobile", async ({ page }) => {
    await page.goto("/chat/test");
    const input = page.getByTestId("chat-input");
    await input.tap();
    await input.fill("hello from mobile");
    await expect(input).toHaveValue("hello from mobile");
  });
});
```

---

## 18. Security Testing

### 18.1 XSS Prevention

```typescript
describe("XSS prevention", () => {
  it("should sanitize user message content", () => {
    render(<Message content='<script>alert("xss")</script>' role="user" />);
    expect(document.querySelector("script")).toBeNull();
  });

  it("should sanitize tool output", () => {
    render(<ToolOutput content='<img src=x onerror=alert(1)>' />);
    expect(document.querySelector("img[onerror]")).toBeNull();
  });

  it("should escape HTML in chat input", async () => {
    render(<ChatInput />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "<script>alert(1)</script>" } });
    // Value should be escaped, not executed
    expect(input).toHaveValue("<script>alert(1)</script>");
  });
});
```

### 18.2 Auth Security

```typescript
describe("auth security", () => {
  it("should prevent CSRF with token validation", async () => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { origin: "https://evil.com" },
    });
    expect(response.status).toBe(403);
  });

  it("should prevent session fixation", async () => {
    const sessionBefore = await getSessionId();
    await login("test@example.com", "password");
    const sessionAfter = await getSessionId();
    expect(sessionAfter).not.toBe(sessionBefore);
  });

  it("should not expose sensitive data in error responses", async () => {
    const response = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ invalid: true }),
    });
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
    expect(JSON.stringify(body)).not.toContain("API_KEY");
    expect(JSON.stringify(body)).not.toContain("password");
  });
});
```

### 18.3 API Key Security

```typescript
describe("API key security", () => {
  it("should hash stored keys (never store plaintext)", async () => {
    const caller = createAuthedCaller();
    const { key } = await caller.apiKeys.create({ name: "test" });

    // The returned key is plaintext (shown once)
    expect(key).toMatch(/^rk_live_/);

    // But stored key should be hashed
    const stored = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyPrefix, key.slice(0, 12) + "..."),
    });
    expect(stored.key).not.toBe(key); // Should be hashed
  });

  it("should enforce max 5 keys per user", async () => {
    const caller = createAuthedCaller();
    for (let i = 0; i < 5; i++) {
      await caller.apiKeys.create({ name: `key-${i}` });
    }
    await expect(caller.apiKeys.create({ name: "key-6" })).rejects.toThrow();
  });
});
```

### 18.4 Input Validation

```typescript
describe("input validation", () => {
  it.each([
    { field: "email", value: "'; DROP TABLE users;--", type: "SQL injection" },
    { field: "name", value: "<script>alert(1)</script>", type: "XSS" },
    { field: "url", value: "javascript:alert(1)", type: "javascript: URI" },
    { field: "path", value: "../../../etc/passwd", type: "path traversal" },
  ])("should reject $type in $field", async ({ field, value }) => {
    const caller = createAuthedCaller();
    await expect(
      caller.user.update({ [field]: value })
    ).rejects.toThrow();
  });
});
```

---

## 19. Performance Testing

### 19.1 Bundle Size

```typescript
describe("bundle size", () => {
  it("should keep main bundle under 500KB", async () => {
    const stats = await getBuildStats();
    const mainBundle = stats.chunks.find((c) => c.name === "main");
    expect(mainBundle.size).toBeLessThan(500 * 1024);
  });

  it("should not increase total bundle size by more than 5%", async () => {
    const current = await getBuildStats();
    const baseline = await readBaseline();
    const increase = (current.totalSize - baseline.totalSize) / baseline.totalSize;
    expect(increase).toBeLessThan(0.05);
  });
});
```

### 19.2 Render Performance

```typescript
describe("render performance", () => {
  it("should render 100 messages in under 200ms", () => {
    const messages = Array.from({ length: 100 }, (_, i) =>
      createMockMessage({ content: `Message ${i}` })
    );
    const start = performance.now();
    render(<MessageList messages={messages} />);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(200);
  });

  it("should not re-render unchanged messages", () => {
    const renderCount = vi.fn();
    const Message = vi.fn(({ content }) => {
      renderCount();
      return <div>{content}</div>;
    });

    const { rerender } = render(<MessageList messages={[msg1]} MessageComponent={Message} />);
    const count1 = renderCount.mock.calls.length;

    rerender(<MessageList messages={[msg1, msg2]} MessageComponent={Message} />);
    // msg1 should NOT re-render, only msg2
    expect(renderCount.mock.calls.length - count1).toBe(1);
  });
});
```

### 19.3 Memory Leaks

```typescript
describe("memory leaks", () => {
  it("should clean up event listeners on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(<StreamingComponent />);
    const addedCount = addSpy.mock.calls.length;

    unmount();
    expect(removeSpy.mock.calls.length).toBeGreaterThanOrEqual(addedCount);
  });

  it("should abort pending requests on unmount", () => {
    const abortSpy = vi.fn();
    vi.spyOn(AbortController.prototype, "abort").mockImplementation(abortSpy);

    const { unmount } = render(<ChatComponent />);
    unmount();
    expect(abortSpy).toHaveBeenCalled();
  });
});
```

---

## 20. Inngest Function Testing

```typescript
describe("Inngest functions", () => {
  it("should trigger execute-task on task creation", async () => {
    const inngest = createTestInngest();
    const result = await inngest.send({
      name: "task/execute",
      data: { taskId: "t1", userId: "u1" },
    });
    expect(result).toBeDefined();
  });

  it("should run cron-scheduler on schedule", async () => {
    const inngest = createTestInngest();
    // Simulate cron trigger
    const result = await inngest.send({
      name: "scheduler/run",
      data: { cronExpression: "0 * * * *" },
    });
    expect(result).toBeDefined();
  });

  it("should handle approval-workflow steps", async () => {
    const inngest = createTestInngest();
    const result = await inngest.send({
      name: "workflow/approval",
      data: { workflowId: "w1", step: "approve", userId: "u1" },
    });
    expect(result.status).toBe("approved");
  });

  it("should retry on transient failure", async () => {
    const handler = vi.fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ success: true });

    const fn = createInngestFunction(handler, { retries: 3 });
    const result = await fn.run({ taskId: "t1" });
    expect(handler).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });
});
```

---

## 21. Environment Variable Validation

```typescript
describe("environment validation", () => {
  it("should fail fast on missing required vars", () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(() => validateEnv()).toThrow("DATABASE_URL is required");
    process.env.DATABASE_URL = original;
  });

  it.each([
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "AGENT_SERVICE_URL",
  ])("should require %s", (varName) => {
    const original = process.env[varName];
    delete process.env[varName];
    expect(() => validateEnv()).toThrow(varName);
    process.env[varName] = original;
  });

  it("should validate DATABASE_URL format", () => {
    process.env.DATABASE_URL = "not-a-url";
    expect(() => validateEnv()).toThrow("invalid");
  });
});
```

---

## 22. Error Boundary Testing

```typescript
describe("ErrorBoundary", () => {
  // Suppress React error boundary console errors in tests
  const originalError = console.error;
  beforeEach(() => { console.error = vi.fn(); });
  afterEach(() => { console.error = originalError; });

  it("should catch component errors and show fallback", () => {
    const ThrowingComponent = () => { throw new Error("boom"); };
    render(
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeVisible();
  });

  it("should report error to Sentry", () => {
    const captureException = vi.fn();
    vi.mock("@sentry/nextjs", () => ({ captureException }));

    const ThrowingComponent = () => { throw new Error("boom"); };
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it("should recover on retry", async () => {
    let shouldThrow = true;
    const MaybeThrow = () => {
      if (shouldThrow) throw new Error("boom");
      return <div>Recovered</div>;
    };

    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeVisible();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await expect(screen.findByText("Recovered")).resolves.toBeVisible();
  });
});
```

---

## 23. Test Isolation & Cleanup

### 23.1 Database Cleanup

```typescript
// Use transactions that rollback for test isolation
describe("with database", () => {
  let tx: Transaction;

  beforeEach(async () => {
    tx = await db.transaction();
  });

  afterEach(async () => {
    await tx.rollback();
  });

  it("should create record in transaction", async () => {
    await tx.insert(sessions).values({ /* ... */ });
    // Changes visible within tx but rolled back after test
  });
});
```

### 23.2 Redis Cleanup

```typescript
beforeEach(async () => {
  await redis.flushdb(); // Clean Redis before each test
});
```

### 23.3 Mock Reset

```typescript
afterEach(() => {
  vi.restoreAllMocks();  // Restore original implementations
  vi.clearAllTimers();    // Clear any pending timers
});
```

### 23.4 Sandbox Cleanup

```python
@pytest.fixture
async def sandbox():
    sb = await create_test_sandbox()
    yield sb
    await sb.kill()  # Always cleanup
```

### 23.5 Test Pollution Detection

```typescript
// Detect tests that leak state
let initialState: any;

beforeEach(() => {
  initialState = JSON.stringify(store.getState());
});

afterEach(() => {
  const finalState = JSON.stringify(store.getState());
  if (initialState !== finalState) {
    console.warn("Test leaked Redux state!");
  }
});
```

---

## 24. Concurrent Request & Race Condition Testing

```typescript
describe("race conditions", () => {
  it("should handle concurrent session creation", async () => {
    const results = await Promise.all([
      caller.sessions.create({ title: "Session 1" }),
      caller.sessions.create({ title: "Session 2" }),
      caller.sessions.create({ title: "Session 3" }),
    ]);
    // All should succeed with unique IDs
    const ids = results.map((r) => r.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("should handle optimistic update rollback on failure", async () => {
    const store = configureStore({ reducer: { sessions: sessionsReducer } });

    // Optimistic update
    store.dispatch(optimisticDelete("session-1"));
    expect(store.getState().sessions.items).not.toContainEqual(
      expect.objectContaining({ id: "session-1" })
    );

    // Server rejects
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("conflict"));
    await store.dispatch(deleteSession("session-1"));

    // Should rollback
    expect(store.getState().sessions.items).toContainEqual(
      expect.objectContaining({ id: "session-1" })
    );
  });

  it("should debounce rapid state updates", async () => {
    vi.useFakeTimers();
    const save = vi.fn();

    for (let i = 0; i < 10; i++) {
      debouncedSave({ content: `update ${i}` }, save);
    }

    vi.advanceTimersByTime(500);
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({ content: "update 9" });

    vi.useRealTimers();
  });
});
```

---

## 25. Webhook Testing

```typescript
describe("webhook service", () => {
  it("should verify HMAC signature", () => {
    const payload = JSON.stringify({ event: "task.completed" });
    const secret = "whsec_test123";
    const signature = createHmacSignature(payload, secret);

    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
    expect(verifyWebhookSignature(payload, "invalid", secret)).toBe(false);
  });

  it("should retry on delivery failure", async () => {
    const deliver = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ status: 200 });

    await dispatchWebhook("https://example.com/hook", { event: "test" }, deliver);
    expect(deliver).toHaveBeenCalledTimes(3);
  });

  it("should enforce idempotency", async () => {
    const eventId = "evt_123";
    await processWebhookEvent(eventId, { type: "payment.success" });
    await processWebhookEvent(eventId, { type: "payment.success" }); // Duplicate

    // Should only process once
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });
});
```

---

## 26. Search & Knowledge Testing

```typescript
describe("search service", () => {
  it("should search via Typesense when available", async () => {
    const results = await searchService.search("machine learning");
    expect(results).toBeInstanceOf(Array);
    expect(results[0]).toHaveProperty("relevanceScore");
  });

  it("should fallback to DB ILIKE when Typesense is down", async () => {
    vi.spyOn(typesenseClient, "search").mockRejectedValue(new Error("connection refused"));
    const results = await searchService.search("machine learning");
    expect(results).toBeInstanceOf(Array); // Still works via fallback
  });

  it("should handle empty queries", async () => {
    const results = await searchService.search("");
    expect(results).toEqual([]);
  });
});

describe("knowledge service", () => {
  it("should generate embeddings for text", async () => {
    const embedding = await knowledgeService.embed("hello world");
    expect(embedding).toBeInstanceOf(Array);
    expect(embedding.length).toBeGreaterThan(0);
  });

  it("should find similar documents via vector search", async () => {
    await knowledgeService.ingest("doc-1", "TypeScript is a typed language");
    await knowledgeService.ingest("doc-2", "Python is dynamically typed");

    const results = await knowledgeService.search("typed programming language");
    expect(results[0].id).toBe("doc-1"); // More relevant
  });
});
```

---

## 27. Docker & Container Testing

```bash
# Build validation (CI)
docker build -t rubic-gateway -f services/gateway/Dockerfile .
docker build -t rubic-agent -f services/agent/Dockerfile .

# Health check testing
docker run -d --name test-gateway rubic-gateway
sleep 5
curl -f http://localhost:4001/health || exit 1
docker rm -f test-gateway

# Trivy security scan
trivy image --severity CRITICAL,HIGH rubic-gateway
```

```typescript
describe("Dockerfile validation", () => {
  it.each([
    "services/gateway/Dockerfile",
    "services/agent/Dockerfile",
    "services/sandbox/Dockerfile",
  ])("should build %s without errors", async (dockerfile) => {
    const { exitCode } = await exec(`docker build -f ${dockerfile} --target builder .`);
    expect(exitCode).toBe(0);
  });
});
```

---

## 28. Monitoring & Observability Testing

```typescript
describe("Sentry integration", () => {
  it("should capture unhandled errors", () => {
    const captureException = vi.fn();
    vi.mock("@sentry/nextjs", () => ({ captureException }));

    const error = new Error("unhandled");
    window.dispatchEvent(new ErrorEvent("error", { error }));
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("should set user context on auth", () => {
    const setUser = vi.fn();
    vi.mock("@sentry/nextjs", () => ({ setUser }));

    onLogin({ id: "user-1", email: "test@example.com" });
    expect(setUser).toHaveBeenCalledWith({ id: "user-1", email: "test@example.com" });
  });
});

describe("structured logging", () => {
  it("should log with correct level and context", () => {
    const logSpy = vi.spyOn(logger, "info");
    processRequest({ sessionId: "s1", userId: "u1" });
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "s1",
        userId: "u1",
      }),
      expect.any(String)
    );
  });
});
```

---

## 29. Anti-Patterns (NEVER Do These)

### Testing Anti-Patterns

| Anti-Pattern | Why It's Wrong | Do This Instead |
|-------------|----------------|-----------------|
| Testing mock behavior | You're testing your mock, not your code | Test real components or integration |
| `page.waitForTimeout(3000)` | Flaky, slow, unreliable | Use condition-based waits |
| Incomplete mocks | Missing fields cause false passes | Mirror real API shape completely |
| Test-only methods on production classes | Pollutes production code | Use test utilities externally |
| Mocking without understanding deps | Mock breaks test logic silently | Understand the dependency graph first |
| `expect(true).toBe(true)` | Tests nothing | Assert real behavior |
| Ignoring test failures | Technical debt compounds | Fix immediately or delete the test |
| Snapshot testing dynamic content | Snapshots break on every render | Assert specific content |
| Testing implementation details | Breaks on refactor | Test behavior and outcomes |
| Copy-pasting test code | Unmaintainable | Use factories, fixtures, helpers |
| `test.skip` without ticket | Permanently skipped = dead test | Fix or delete, never skip indefinitely |
| Testing in production | No rollback, real user impact | Use staging or mock environments |

### Code Anti-Patterns That Cause Bugs

| Anti-Pattern | Example | Fix |
|-------------|---------|-----|
| No error boundaries | Component crash takes down page | Wrap in ErrorBoundary, test error states |
| Unhandled promise rejection | `fetch()` without catch | Always handle errors, test failure paths |
| Missing null checks | `data.items.map()` when undefined | Optional chaining + test with undefined |
| Race conditions in state | setState after unmount | Cleanup in useEffect, test unmount |
| Stale closures | setTimeout with old state | Use refs or functional updates |
| Unsafe type assertions | `as any` hides type errors | Fix the types, add type tests |
| Consecutive user messages | Anthropic API rejects | Merge consecutive same-role messages |
| `z.record()` single arg | Zod v4 crashes | Use `z.record(z.string(), z.unknown())` |
| Missing `(mod as any).default ?? mod` | ESM wrapping in pnpm | Apply wrapper pattern in all services |

---

## 30. Coverage Targets

| Layer | Lines | Functions | Branches |
|-------|-------|-----------|----------|
| Business logic (utils, hooks) | 80% | 80% | 70% |
| React components | 70% | 70% | 60% |
| tRPC routers | 80% | 80% | 70% |
| Agent tools (Python) | 80% | 80% | 70% |
| Services (endpoints) | 70% | 70% | 60% |
| E2E critical paths | N/A | N/A | N/A |

### Coverage Exclusions

- Generated code, type definitions (`*.d.ts`)
- Config files (`*.config.*`)
- Index re-exports (`**/index.ts` barrel files)
- Test files themselves
- Storybook stories

---

## 31. Test Data Management

### Factories (Always Use These)

```typescript
import {
  createMockUser,
  createMockSession,
  createMockMessage,
  createMockAgent,
  createMockAgentTask,
  createMockConversation,
} from "@repo/testing/factories";

const user = createMockUser();
const session = createMockSession({ userId: user.id });
const message = createMockMessage({ sessionId: session.id, role: "user" });
```

### Rules

1. **Use factories** for all test data. No inline object literals with random values.
2. **Override only what matters** for the specific test. Let factories handle defaults.
3. **Never use production data** in tests.
4. **Clean up after tests.** Every `beforeEach` has a matching `afterEach`.
5. **Deterministic data.** Use seeded faker for reproducible tests.

---

## 32. Mocking Strategy

### What to Mock

| Mock | When |
|------|------|
| External APIs (Anthropic, OpenAI, E2B, Composio, Knock) | Always in unit/integration |
| Database queries | Unit tests only |
| `fetch` / HTTP calls | Unit tests. MSW for integration. |
| `next/navigation` | Component tests using router |
| Design system components | Testing parent component logic |
| Time / Date | Testing time-dependent behavior |
| Socket.io | WebSocket behavior tests |
| Redis | Resumable stream tests |
| S3 | File upload tests |

### What NOT to Mock

| Don't Mock | Why |
|-----------|-----|
| The module under test | You'd be testing your mock |
| Simple utility functions | Test them for real |
| Data transformations | Pure functions, test directly |
| React state/hooks | Use `renderHook` / `act` |
| Internal implementation | Test the public API |

---

## 33. Regression Prevention

### After Every Bug Fix

1. Write a **reproduction test** that fails with the bug
2. Fix the bug
3. Verify the reproduction test passes
4. Add to regression suite
5. **Never delete regression tests**

### Critical Regression Areas (Historically Buggy)

1. **SSE stream parsing** — Event format changes break the entire chat
2. **Tool result rendering** — Missing renderers cause blank tool cards
3. **Canvas state detection** — Wrong TOOL_VIEW_MAP entries show wrong panel
4. **Message persistence** — Parts column format changes break history loading
5. **Auth flow** — Session expiry, token refresh, redirect loops
6. **Consecutive message merging** — Anthropic API rejects consecutive same-role
7. **ESM imports** — `(mod as any).default ?? mod` pattern in services
8. **Zod validation** — `z.record()` requires two args in v4
9. **WebSocket reconnection** — Socket.io reconnection drops state
10. **Provider fallback** — Quota detection varies by provider error format

---

## 34. CI Integration

### Pipeline Order

```
install → lint → typecheck → unit tests → build → e2e tests → python tests → docker build → trivy scan
```

### CI Configuration

- **Retries**: E2E tests retry 2x in CI
- **Workers**: Playwright uses 4 workers in CI
- **Reporters**: GitHub reporter for PR annotations
- **Screenshots**: Captured on failure, uploaded as artifacts
- **Traces**: Captured on first retry for debugging
- **Coverage**: Uploaded to Codecov on every PR

### Pre-Commit Checklist

```bash
pnpm test && pnpm check && pnpm -C apps/app typecheck
```

---

## 35. Non-Negotiables

1. **No merges without full-suite pass.** Period.
2. **No skipping tests.** Fix or delete. Never `test.skip` indefinitely.
3. **No `any` casts to silence test errors.** Fix the types.
4. **No testing internal state.** Test what the user sees and what the API returns.
5. **Bug fixes require reproduction tests.** No exceptions.
6. **Coverage must not decrease.** New code ships with tests.
7. **E2E tests are not optional.** Every user-facing feature gets at least one E2E spec.
8. **Tests run fast.** Unit < 100ms each.
9. **No `page.waitForTimeout()`.** Use condition-based waits.
10. **No production data in tests.** Use factories.

---

## 36. Quick Reference

```
NEW FEATURE:
  1. Write failing test → Watch it fail
  2. Implement minimum code → Watch it pass
  3. Add edge case tests
  4. Add E2E test for the user flow
  5. pnpm test && pnpm check

BUG FIX:
  1. Write reproduction test → Watch it fail
  2. Fix the bug → Watch it pass
  3. pnpm test && pnpm check

REFACTOR:
  1. Verify existing tests pass
  2. Refactor code
  3. Verify tests still pass
  4. pnpm test && pnpm check

NEW SERVICE ENDPOINT:
  1. Write request/response test → Watch it fail
  2. Implement endpoint → Watch it pass
  3. Add auth, validation, error tests
  4. pnpm test && pnpm check

NEW TRPC PROCEDURE:
  1. Write caller test → Watch it fail
  2. Implement procedure → Watch it pass
  3. Add input validation, auth, isolation tests
  4. pnpm test && pnpm check

NEW AGENT TOOL (Python):
  1. Write pytest test → Watch it fail
  2. Implement tool → Watch it pass
  3. Add parameterized tests for edge cases
  4. python -m pytest
```
