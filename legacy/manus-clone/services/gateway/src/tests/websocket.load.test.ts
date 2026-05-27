/**
 * WebSocket Load Tests
 *
 * Tests concurrent connections, message throughput, backpressure handling,
 * subscription fan-out, and metrics tracking under load.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
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
  setAuthResult({ userId: "load-user-1", email: "load@jeriko.com" });
  clearMockState();
});

// ─── Concurrent Connections ───────────────────────────────────────

describe("Concurrent connections", () => {
  it("should handle 100 concurrent connections", async () => {
    const COUNT = 100;
    const connections: WebSocket[] = [];

    try {
      const startTime = Date.now();
      const results = await Promise.allSettled(
        Array.from({ length: COUNT }, () => connectWs(port))
      );
      const connectTime = Date.now() - startTime;

      for (const r of results) {
        if (r.status === "fulfilled") connections.push(r.value);
      }

      expect(connections.length).toBe(COUNT);
      console.log(`  [load] Connected ${connections.length} clients in ${connectTime}ms`);

      const msgResults = await Promise.allSettled(
        connections.map((ws) => waitForMessage(ws, 5000))
      );

      const connected = msgResults.filter(
        (r) => r.status === "fulfilled" && r.value.type === "connected"
      ).length;

      expect(connected).toBe(COUNT);
      console.log(`  [load] All ${connected} clients received connected message`);
    } finally {
      for (const ws of connections) {
        if (ws.readyState <= 1) ws.close();
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  });
});

// ─── Message Throughput ───────────────────────────────────────────

describe("Message throughput", () => {
  it("should handle 100 ping/pong cycles within rate limit", async () => {
    const ws = await connectWs(port);
    await waitForMessage(ws); // connected

    try {
      const startTime = Date.now();
      const responses: number[] = [];

      for (let batch = 0; batch < 4; batch++) {
        for (let i = 0; i < 25; i++) {
          sendJson(ws, { type: "ping" });
        }
        const msgs = await collectMessages(ws, 25, 3000);
        responses.push(msgs.filter((m) => m.type === "pong").length);

        if (batch < 3) await new Promise((r) => setTimeout(r, 1100));
      }

      const elapsed = Date.now() - startTime;
      const total = responses.reduce((a, b) => a + b, 0);

      console.log(`  [load] Received ${total} pongs in ${elapsed}ms`);
      expect(total).toBeGreaterThanOrEqual(90);
    } finally {
      ws.close();
    }
  });
});

// ─── Fan-out Message Delivery ─────────────────────────────────────

describe("Fan-out delivery", () => {
  it("should deliver a message to all clients subscribed to the same channel", async () => {
    const SUBSCRIBER_COUNT = 20;
    const connections: WebSocket[] = [];

    try {
      for (let i = 0; i < SUBSCRIBER_COUNT; i++) {
        setAuthResult({ userId: `fanout-user-${i}` });
        const ws = await connectWs(port);
        await waitForMessage(ws); // connected

        sendJson(ws, { type: "subscribe", data: { channel: "session:shared-room" } });
        await waitForMessage(ws); // subscribed
        connections.push(ws);
      }

      simulateRedisMessage("session:shared-room", { type: "agent:thinking", data: { step: 42 } });

      const msgResults = await Promise.allSettled(
        connections.map((ws) => waitForMessage(ws, 2000))
      );

      const delivered = msgResults.filter(
        (r) => r.status === "fulfilled" && r.value.type === "agent:thinking"
      ).length;

      expect(delivered).toBe(SUBSCRIBER_COUNT);
      console.log(`  [load] Delivered to all ${delivered}/${SUBSCRIBER_COUNT} subscribers`);
    } finally {
      for (const ws of connections) {
        if (ws.readyState <= 1) ws.close();
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  });
});

// ─── Multiple Channel Subscriptions ───────────────────────────────

describe("Multi-channel subscriptions", () => {
  it("should handle subscribing to many channels simultaneously", async () => {
    const ws = await connectWs(port);
    await waitForMessage(ws); // connected

    try {
      const CHANNEL_COUNT = 30;
      const channels = Array.from({ length: CHANNEL_COUNT }, (_, i) => `session:multi-${i}`);

      for (const channel of channels) {
        sendJson(ws, { type: "subscribe", data: { channel } });
      }

      const msgs = await collectMessages(ws, CHANNEL_COUNT, 5000);
      const subscribed = msgs.filter((m) => m.type === "subscribed").length;

      expect(subscribed).toBe(CHANNEL_COUNT);
      console.log(`  [load] Subscribed to ${subscribed} channels`);

      for (let i = 0; i < 5; i++) {
        simulateRedisMessage(channels[i]!, { type: `test-${i}`, data: { idx: i } });
      }

      const deliveredMsgs = await collectMessages(ws, 5, 2000);
      expect(deliveredMsgs.length).toBe(5);
    } finally {
      ws.close();
    }
  });
});

// ─── Rapid Connect/Disconnect ─────────────────────────────────────

describe("Rapid connect/disconnect cycles", () => {
  it("should handle rapid connect/disconnect without leaking resources", async () => {
    const CYCLES = 30;
    const startTime = Date.now();

    for (let i = 0; i < CYCLES; i++) {
      const ws = await connectWs(port);
      await waitForMessage(ws); // connected
      ws.close();
      await new Promise((r) => setTimeout(r, 30));
    }

    const elapsed = Date.now() - startTime;
    console.log(`  [load] ${CYCLES} connect/disconnect cycles in ${elapsed}ms`);

    // Give cleanup handlers time to fire
    await new Promise((r) => setTimeout(r, 200));

    const remaining = getChannelCallbacks();
    expect(remaining.size).toBe(0);
  });
});

// ─── Burst Message Pattern ────────────────────────────────────────

describe("Burst message patterns", () => {
  it("should survive message burst followed by silence", async () => {
    const ws = await connectWs(port);
    await waitForMessage(ws); // connected

    try {
      // Send 29 messages rapidly (just under rate limit)
      for (let i = 0; i < 29; i++) {
        sendJson(ws, { type: "ping" });
      }

      const msgs = await collectMessages(ws, 29, 3000);
      const pongs = msgs.filter((m) => m.type === "pong").length;
      expect(pongs).toBeGreaterThanOrEqual(25);

      // Wait for rate limit window to reset
      await new Promise((r) => setTimeout(r, 1200));

      for (let i = 0; i < 10; i++) {
        sendJson(ws, { type: "ping" });
      }

      const msgs2 = await collectMessages(ws, 10, 2000);
      const pongs2 = msgs2.filter((m) => m.type === "pong").length;
      expect(pongs2).toBe(10);
    } finally {
      ws.close();
    }
  });
});

// ─── Metrics Tracking ─────────────────────────────────────────────

describe("Metrics tracking", () => {
  it("should track connection and message metrics", async () => {
    const { metrics, getConnectionCount } = await import("../routes/websocket.js");

    const initialConnections = metrics.connectionsTotal;
    const initialMessagesIn = metrics.messagesIn;
    const initialMessagesOut = metrics.messagesOut;

    const ws = await connectWs(port);
    await waitForMessage(ws); // connected

    expect(metrics.connectionsTotal).toBeGreaterThan(initialConnections);
    expect(getConnectionCount()).toBeGreaterThan(0);

    sendJson(ws, { type: "ping" });
    await waitForMessage(ws); // pong

    expect(metrics.messagesIn).toBeGreaterThan(initialMessagesIn);
    expect(metrics.messagesOut).toBeGreaterThan(initialMessagesOut);

    ws.close();
    await new Promise((r) => setTimeout(r, 100));
  });
});
