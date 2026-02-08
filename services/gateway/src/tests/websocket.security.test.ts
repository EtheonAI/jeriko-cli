/**
 * WebSocket Security & Penetration Tests
 *
 * Tests authentication bypass, authorization, rate limiting,
 * message size limits, injection attempts, and connection flooding.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import {
  setAuthResult,
  createTestServer,
  connectWs,
  waitForMessage,
  waitForClose,
  collectMessages,
  sendJson,
  getPort,
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
  setAuthResult({ userId: "user-sec-1", email: "sec@rubic.com" });
  clearMockState();
});

// ─── Authentication Bypass ────────────────────────────────────────

describe("Authentication bypass attempts", () => {
  it("should reject connections with no token", async () => {
    setAuthResult(null);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/stream`);
    const { code } = await waitForClose(ws);

    expect(code).toBe(4001);
  });

  it("should reject connections with invalid token", async () => {
    setAuthResult(null);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/stream`, {
      headers: { Authorization: "Bearer invalid-garbage-token" },
    });
    const { code } = await waitForClose(ws);

    expect(code).toBe(4001);
  });

  it("should reject connections with empty Bearer header", async () => {
    setAuthResult(null);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/stream`, {
      headers: { Authorization: "Bearer " },
    });
    const { code } = await waitForClose(ws);

    expect(code).toBe(4001);
  });

  it("should accept connections with valid query param token", async () => {
    setAuthResult({ userId: "user-query-auth" });

    const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/stream?token=valid-jwt`);
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("connected");
    expect((msg.data as Record<string, unknown>).userId).toBe("user-query-auth");
    ws.close();
  });
});

// ─── Authorization ────────────────────────────────────────────────

describe("Channel authorization", () => {
  let ws: WebSocket;

  afterEach(() => {
    if (ws && ws.readyState <= 1) ws.close();
  });

  it("should prevent subscribing to another user's channel", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "subscribe", data: { channel: "user:other-user-id" } });
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("error");
    expect((msg.data as Record<string, unknown>).message).toContain("Not authorized");
  });

  it("should prevent subscribing to device channels of other users", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "subscribe", data: { channel: "device:other-user:thermostat" } });
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("error");
    expect((msg.data as Record<string, unknown>).message).toContain("Not authorized");
  });

  it("should allow subscribing to device channels containing own userId", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "subscribe", data: { channel: "device:user-sec-1:thermostat" } });
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("subscribed");
  });

  it("should prevent subscribing to arbitrary internal channels", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    const forbiddenChannels = [
      "admin:broadcast",
      "internal:system",
      "billing:events",
    ];

    for (const channel of forbiddenChannels) {
      sendJson(ws, { type: "subscribe", data: { channel } });
      const msg = await waitForMessage(ws);
      expect(msg.type).toBe("error");
    }
  });
});

// ─── Rate Limiting ────────────────────────────────────────────────

describe("Rate limiting", () => {
  let ws: WebSocket;

  afterEach(() => {
    if (ws && ws.readyState <= 1) ws.close();
  });

  it("should enforce per-client rate limit of 30 messages/second", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    // Blast 35 messages rapidly
    for (let i = 0; i < 35; i++) {
      sendJson(ws, { type: "ping" });
    }

    const messages = await collectMessages(ws, 35, 3000);

    const pongs = messages.filter((m) => m.type === "pong");
    const errors = messages.filter(
      (m) => m.type === "error" && ((m.data as Record<string, unknown>).message as string).includes("Rate limited")
    );

    expect(pongs.length).toBeLessThanOrEqual(30);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ─── Message Size Limits ──────────────────────────────────────────

describe("Message size limits", () => {
  let ws: WebSocket;

  afterEach(() => {
    if (ws && ws.readyState <= 1) ws.close();
  });

  it("should reject messages exceeding 64KB", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    const largePayload = "x".repeat(70000);
    ws.send(JSON.stringify({ type: "ping", data: { payload: largePayload } }));

    const msg = await waitForMessage(ws);
    expect(msg.type).toBe("error");
    expect((msg.data as Record<string, unknown>).message).toContain("too large");
  });

  it("should accept messages under 64KB", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    const payload = "x".repeat(60000);
    ws.send(JSON.stringify({ type: "ping", data: { payload } }));

    const msg = await waitForMessage(ws);
    expect(msg.type).toBe("pong");
  });
});

// ─── Malformed Messages ──────────────────────────────────────────

describe("Malformed message handling", () => {
  let ws: WebSocket;

  afterEach(() => {
    if (ws && ws.readyState <= 1) ws.close();
  });

  it("should handle invalid JSON gracefully", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    ws.send("{not valid json");
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("error");
    expect((msg.data as Record<string, unknown>).message).toContain("Invalid message format");
  });

  it("should handle messages without type field", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    ws.send(JSON.stringify({ data: "no type" }));
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("error");
    expect((msg.data as Record<string, unknown>).message).toContain("type");
  });

  it("should handle empty string messages", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    ws.send("");
    const msg = await waitForMessage(ws);
    expect(msg.type).toBe("error");
  });

  it("should handle null type values", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    ws.send(JSON.stringify({ type: null }));
    const msg = await waitForMessage(ws);
    expect(msg.type).toBe("error");
  });

  it("should handle numeric type values", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    ws.send(JSON.stringify({ type: 42 }));
    const msg = await waitForMessage(ws);
    expect(msg.type).toBe("error");
  });
});

// ─── Injection Attempts ──────────────────────────────────────────

describe("Injection attempts", () => {
  let ws: WebSocket;

  afterEach(() => {
    if (ws && ws.readyState <= 1) ws.close();
  });

  it("should handle XSS in channel names", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "subscribe", data: { channel: '<script>alert("xss")</script>' } });
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("error");
  });

  it("should handle prototype pollution attempts", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    ws.send(JSON.stringify({ type: "subscribe", data: { channel: "session:ok", __proto__: { admin: true } } }));

    const msg = await waitForMessage(ws);
    expect(["subscribed", "error"]).toContain(msg.type);
  });

  it("should handle SQL injection in channel names", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "subscribe", data: { channel: "session:1' OR '1'='1" } });
    const msg = await waitForMessage(ws);

    expect(["subscribed", "error"]).toContain(msg.type);
  });

  it("should handle extremely long channel names", async () => {
    ws = await connectWs(port);
    await waitForMessage(ws); // connected

    sendJson(ws, { type: "subscribe", data: { channel: "session:" + "a".repeat(10000) } });
    const msg = await waitForMessage(ws);

    expect(msg.type).toBeDefined();
  });
});

// ─── Connection Flooding ─────────────────────────────────────────

describe("Connection flooding", () => {
  it("should handle many simultaneous connections", async () => {
    const connectionCount = 50;
    const connections: WebSocket[] = [];

    try {
      const results = await Promise.allSettled(
        Array.from({ length: connectionCount }, () => connectWs(port))
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          connections.push(result.value);
        }
      }

      expect(connections.length).toBeGreaterThan(connectionCount * 0.8);

      const messagePromises = connections.map((ws) => waitForMessage(ws, 3000));
      const messages = await Promise.allSettled(messagePromises);

      const connectedCount = messages.filter(
        (r) => r.status === "fulfilled" && r.value.type === "connected"
      ).length;

      expect(connectedCount).toBe(connections.length);
    } finally {
      for (const ws of connections) {
        if (ws.readyState <= 1) ws.close();
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  });
});
