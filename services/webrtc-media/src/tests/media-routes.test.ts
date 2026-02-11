import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../index.js";

describe("webrtc-media routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates and fetches a media session", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/v1/media/sessions",
      payload: {
        sessionId: "sess_1",
        sandboxId: "sbx_1",
        provider: "neko",
      },
    });

    expect(create.statusCode).toBe(201);
    const created = create.json() as { streamUrl: string };
    expect(created.streamUrl).toContain("session=sbx_1");

    const get = await app.inject({
      method: "GET",
      url: "/v1/media/sessions/by-session/sess_1",
    });

    expect(get.statusCode).toBe(200);
    const got = get.json() as { sessionId: string; sandboxId: string };
    expect(got.sessionId).toBe("sess_1");
    expect(got.sandboxId).toBe("sbx_1");
  });

  it("stops media session", async () => {
    const del = await app.inject({
      method: "DELETE",
      url: "/v1/media/sessions/by-session/sess_1",
    });

    expect(del.statusCode).toBe(200);

    const missing = await app.inject({
      method: "GET",
      url: "/v1/media/sessions/by-session/sess_1",
    });

    expect(missing.statusCode).toBe(404);
  });
});
