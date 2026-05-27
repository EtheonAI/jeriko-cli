import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

const createRequest = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : undefined,
  });

describe("app proxy auth routing", () => {
  it("allows unauthenticated public auth pages", async () => {
    const { proxy } = await import("../proxy");
    const response = await proxy(createRequest("/login"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows unauthenticated support routes through to route handlers", async () => {
    const { proxy } = await import("../proxy");

    const healthResponse = await proxy(createRequest("/api/health"));
    const flagsResponse = await proxy(createRequest("/.well-known/vercel/flags"));

    expect(healthResponse.status).toBe(200);
    expect(healthResponse.headers.get("x-middleware-next")).toBe("1");
    expect(flagsResponse.status).toBe(200);
    expect(flagsResponse.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows public metadata assets through without auth redirects", async () => {
    const { proxy } = await import("../proxy");
    const response = await proxy(createRequest("/manifest.webmanifest"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects unauthenticated app routes to login with callback", async () => {
    const { proxy } = await import("../proxy");
    const response = await proxy(createRequest("/?tab=runs"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?callbackUrl=%2F%3Ftab%3Druns"
    );
  });

  it("redirects authenticated users away from the login page", async () => {
    const { proxy } = await import("../proxy");
    const response = await proxy(createRequest("/login", "better-auth.session_token=test-token"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });
});
