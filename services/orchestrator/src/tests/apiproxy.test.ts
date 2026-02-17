import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../index.js";

// Mock e2b-manager before any imports that use it
vi.mock("../lib/e2b-manager.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/e2b-manager.js")>();
  return {
    ...actual,
    validateProxyToken: vi.fn((token: string) => {
      if (token === "sk-rubic-valid-test-token") {
        return { sandboxId: "sbx-test", userId: "u-test-123", sessionId: "sess-test" };
      }
      return null;
    }),
  };
});

describe("apiproxy routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const built = await buildApp();
    app = built.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 when x-sandbox-token header is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/apiproxy.v1.ApiProxyService/CallApi",
      payload: { apiId: "GMAIL_SEND_EMAIL", body: {} },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/Missing x-sandbox-token/);
  });

  it("returns 401 when token is invalid", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/apiproxy.v1.ApiProxyService/CallApi",
      headers: { "x-sandbox-token": "sk-rubic-invalid-token" },
      payload: { apiId: "GMAIL_SEND_EMAIL", body: {} },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/Invalid sandbox token/);
  });

  it("returns 400 when apiId is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/apiproxy.v1.ApiProxyService/CallApi",
      headers: { "x-sandbox-token": "sk-rubic-valid-test-token" },
      payload: { body: { to: "test@test.com" } },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/Invalid request body/);
  });

  it("routes valid request to connector service and returns jsonData", async () => {
    const mockResult = { success: true, messageId: "msg-123" };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult),
      })
    );

    const res = await app.inject({
      method: "POST",
      url: "/apiproxy.v1.ApiProxyService/CallApi",
      headers: { "x-sandbox-token": "sk-rubic-valid-test-token" },
      payload: {
        apiId: "GMAIL_SEND_EMAIL",
        body: { to: "test@test.com", subject: "Test", body: "Hello" },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.jsonData).toBeDefined();
    const parsed = JSON.parse(body.jsonData);
    expect(parsed.success).toBe(true);
    expect(parsed.messageId).toBe("msg-123");

    // Verify fetch was called with correct args
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain("/tools/execute");
    const fetchBody = JSON.parse(fetchCall[1].body);
    expect(fetchBody.toolName).toBe("GMAIL_SEND_EMAIL");
    expect(fetchBody.arguments.to).toBe("test@test.com");
    expect(fetchCall[1].headers["x-user-id"]).toBe("u-test-123");
  });

  it("forwards connector service error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("Tool not found"),
      })
    );

    const res = await app.inject({
      method: "POST",
      url: "/apiproxy.v1.ApiProxyService/CallApi",
      headers: { "x-sandbox-token": "sk-rubic-valid-test-token" },
      payload: { apiId: "NONEXISTENT_TOOL", body: {} },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/Connector service error/);
  });

  it("returns 500 when connector service is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    );

    const res = await app.inject({
      method: "POST",
      url: "/apiproxy.v1.ApiProxyService/CallApi",
      headers: { "x-sandbox-token": "sk-rubic-valid-test-token" },
      payload: { apiId: "GMAIL_SEND_EMAIL", body: {} },
    });

    expect(res.statusCode).toBe(500);
    expect(res.json().error).toMatch(/ECONNREFUSED/);
  });

  it("passes query and path_params through to connector", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
    );

    const res = await app.inject({
      method: "POST",
      url: "/apiproxy.v1.ApiProxyService/CallApi",
      headers: { "x-sandbox-token": "sk-rubic-valid-test-token" },
      payload: {
        apiId: "GMAIL_SEARCH_MESSAGES",
        body: { q: "from:boss" },
        query: { maxResults: 10 },
        path_params: { userId: "me" },
      },
    });

    expect(res.statusCode).toBe(200);

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const fetchBody = JSON.parse(fetchCall[1].body);
    expect(fetchBody.arguments.q).toBe("from:boss");
    expect(fetchBody.arguments._query).toEqual({ maxResults: 10 });
    expect(fetchBody.arguments._pathParams).toEqual({ userId: "me" });
  });
});
