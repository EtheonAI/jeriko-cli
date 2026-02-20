import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../index.js";

describe("webrtc-media routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("health check returns ok", async () => {
    const resp = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(resp.statusCode).toBe(200);
    const body = resp.json() as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("webrtc-media");
  });

  it("ICE servers endpoint returns iceServers array", async () => {
    const resp = await app.inject({
      method: "GET",
      url: "/v1/media/ice-servers",
    });

    expect(resp.statusCode).toBe(200);
    const body = resp.json() as { iceServers: unknown[]; ttl: number };
    expect(body.iceServers).toBeInstanceOf(Array);
    expect(body.iceServers.length).toBeGreaterThan(0);
    expect(body.ttl).toBeGreaterThan(0);
  });
});
