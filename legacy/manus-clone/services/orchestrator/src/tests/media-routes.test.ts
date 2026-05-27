import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../index.js";

describe("media routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.MEDIA_SERVICE_URL = "http://media.local";
    app = (await buildApp()).app;
    await app.ready();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it("starts a media session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ mediaSessionId: "med_1", streamUrl: "https://example" }),
      }),
    );

    const res = await app.inject({
      method: "POST",
      url: "/v1/sessions/sess_x/media/start",
      payload: { sandboxId: "sbx_1", provider: "neko" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { mediaSessionId: string };
    expect(body.mediaSessionId).toBe("med_1");
  });

  it("reads media session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ mediaSessionId: "med_1", sessionId: "sess_x" }),
      }),
    );

    const res = await app.inject({ method: "GET", url: "/v1/sessions/sess_x/media" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { sessionId: string };
    expect(body.sessionId).toBe("sess_x");
  });

  it("stops media session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      }),
    );

    const res = await app.inject({ method: "POST", url: "/v1/sessions/sess_x/media/stop" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });
});
