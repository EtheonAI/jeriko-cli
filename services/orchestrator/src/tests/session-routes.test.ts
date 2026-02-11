import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../index.js";

describe("session routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const built = await buildApp();
    app = built.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a session and returns canonical shape", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/sessions",
      payload: { userId: "u-test", title: "t", mode: "single" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.sessionId).toBeTruthy();
    expect(body.userId).toBe("u-test");
    expect(body.mode).toBe("single");
  });

  it("runs send-message flow and persists messages/events", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/v1/sessions",
      payload: { userId: "u-flow", mode: "single" },
    });
    const sessionId = created.json().sessionId as string;

    const sendRes = await app.inject({
      method: "POST",
      url: `/v1/sessions/${sessionId}/messages`,
      payload: { message: "hello flow", tools: ["plan"] },
    });

    expect(sendRes.statusCode).toBe(200);
    const events = sendRes.json() as Array<{ type: string }>;
    expect(events.some((e) => e.type === "text-delta")).toBe(true);

    const messagesRes = await app.inject({
      method: "GET",
      url: `/v1/sessions/${sessionId}/messages`,
    });
    expect(messagesRes.statusCode).toBe(200);
    const messagesBody = messagesRes.json() as { messages: Array<{ role: string }> };
    expect(messagesBody.messages.length).toBeGreaterThanOrEqual(2);
    expect(messagesBody.messages.some((m) => m.role === "assistant")).toBe(true);

    const sessionEvents = await app.inject({
      method: "GET",
      url: `/v1/sessions/${sessionId}/events`,
    });
    expect(sessionEvents.statusCode).toBe(200);
    const sessionEventsBody = sessionEvents.json() as { events: Array<{ type: string }> };
    expect(sessionEventsBody.events.some((e) => e.type === "session.created")).toBe(true);
    expect(sessionEventsBody.events.some((e) => e.type === "message.complete")).toBe(true);
  });
});
