/**
 * WebSocket Integration Tests
 *
 * Tests the full WebSocket lifecycle: connection, authentication,
 * channel subscriptions, message delivery, and cleanup.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import {
  setAuthResult,
  createTestServer,
  connectWs,
  waitForMessage,
  collectMessages,
  sendJson,
  getPort,
  simulateRedisMessage,
  getChannelCallbacks,
  getMockPubCalls,
  clearMockState,
} from "./helpers.js";

let app: FastifyInstance;
let port: number;

beforeAll(async () => {
  app = await createTestServer();
  await app.listen({ port: 0, host: "127.0.0.1" });
  port = getPort(app);
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  setAuthResult({ userId: "user-123", email: "test@jeriko.com" });
  clearMockState();
});

// ─── Connection Lifecycle ─────────────────────────────────────────

describe("Connection lifecycle", () => {
  let ws: WebSocket;

  afterEach(() => {
    if (ws && ws.readyState <= 1) ws.close();
  });

  it("should accept authenticated connections and send connected message", async () => {
    ws = await connectWs(port);
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("connected");
    expect(msg.data).toHaveProperty("clientId");
    expect((msg.data as Record<string, unknown>).userId).toBe("user-123");
  });

  it("should auto-subscribe to user's personal channel", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    const channels = getChannelCallbacks();
    expect(channels.has("user:user-123")).toBe(true);
  });

  it("should clean up subscriptions on disconnect", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    ws.close();
    await new Promise((r) => setTimeout(r, 200));

    const channels = getChannelCallbacks();
    expect(channels.has("user:user-123")).toBe(false);
  });
});

// ─── Ping/Pong ────────────────────────────────────────────────────

describe("Ping/Pong", () => {
  let ws: WebSocket;

  afterEach(() => {
    if (ws && ws.readyState <= 1) ws.close();
  });

  it("should respond to ping with pong containing timestamp", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "ping" });
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("pong");
    expect(msg.data).toHaveProperty("ts");
    expect(typeof (msg.data as Record<string, unknown>).ts).toBe("number");
  });
});

// ─── Channel Subscriptions ────────────────────────────────────────

describe("Channel subscriptions", () => {
  let ws: WebSocket;

  afterEach(() => {
    if (ws && ws.readyState <= 1) ws.close();
  });

  it("should subscribe to allowed session channels", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "subscribe", data: { channel: "session:abc-123" } });
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("subscribed");
    expect((msg.data as Record<string, unknown>).channel).toBe("session:abc-123");
  });

  it("should subscribe to public channels", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "subscribe", data: { channel: "public:announcements" } });
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("subscribed");
  });

  it("should reject unauthorized channel subscriptions", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "subscribe", data: { channel: "user:other-user" } });
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("error");
    expect((msg.data as Record<string, unknown>).message).toContain("Not authorized");
  });

  it("should handle unsubscribe", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "subscribe", data: { channel: "session:abc" } });
    await waitForMessage(ws); // subscribed

    sendJson(ws, { type: "unsubscribe", data: { channel: "session:abc" } });
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("unsubscribed");
    expect((msg.data as Record<string, unknown>).channel).toBe("session:abc");
  });

  it("should error on missing channel field", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "subscribe", data: {} });
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("error");
    expect((msg.data as Record<string, unknown>).message).toContain("Missing channel");
  });
});

// ─── Message Delivery via Redis ───────────────────────────────────

describe("Redis pub/sub message delivery", () => {
  let ws: WebSocket;

  afterEach(() => {
    if (ws && ws.readyState <= 1) ws.close();
  });

  it("should deliver messages from user's personal channel", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    const testPayload = { type: "notification", data: { text: "Hello!" } };
    simulateRedisMessage("user:user-123", testPayload);

    const msg = await waitForMessage(ws);
    expect(msg.type).toBe("notification");
    expect((msg.data as Record<string, unknown>).text).toBe("Hello!");
  });

  it("should deliver messages from subscribed session channels", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "subscribe", data: { channel: "session:test-session" } });
    await waitForMessage(ws); // subscribed

    simulateRedisMessage("session:test-session", { type: "agent:update", data: { status: "thinking" } });

    const msg = await waitForMessage(ws);
    expect(msg.type).toBe("agent:update");
  });

  it("should NOT deliver messages from unsubscribed channels", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "subscribe", data: { channel: "session:temp" } });
    await waitForMessage(ws); // subscribed

    sendJson(ws, { type: "unsubscribe", data: { channel: "session:temp" } });
    await waitForMessage(ws); // unsubscribed

    simulateRedisMessage("session:temp", { type: "should-not-arrive" });

    const msgs = await collectMessages(ws, 1, 500);
    expect(msgs.filter((m) => m.type === "should-not-arrive")).toHaveLength(0);
  });
});

// ─── Task Commands ────────────────────────────────────────────────

describe("Task commands", () => {
  let ws: WebSocket;

  afterEach(() => {
    if (ws && ws.readyState <= 1) ws.close();
  });

  it("should forward task:start to Redis tasks:commands channel", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "task:start", data: { taskId: "task-1", input: "Run analysis" } });

    await new Promise((r) => setTimeout(r, 200));
    const pubCalls = getMockPubCalls();
    const taskCall = pubCalls.find((c) => c.channel === "tasks:commands" && c.message.includes("task:start"));
    expect(taskCall).toBeDefined();
  });

  it("should forward task:cancel to Redis", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "task:cancel", data: { taskId: "task-2" } });

    await new Promise((r) => setTimeout(r, 200));
    const pubCalls = getMockPubCalls();
    const taskCall = pubCalls.find((c) => c.channel === "tasks:commands" && c.message.includes("task:cancel"));
    expect(taskCall).toBeDefined();
  });
});

// ─── Unknown Messages ─────────────────────────────────────────────

describe("Unknown messages", () => {
  let ws: WebSocket;

  afterEach(() => {
    if (ws && ws.readyState <= 1) ws.close();
  });

  it("should return error for unknown message types", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "unknown_type" });
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("error");
    expect((msg.data as Record<string, unknown>).message).toContain("Unknown message type");
  });
});
