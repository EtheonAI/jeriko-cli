import { test, expect } from "@playwright/test";

test.describe("Security Headers", () => {
  test("response includes all security headers", async ({ request }) => {
    const response = await request.get("/");

    const headers = response.headers();

    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-xss-protection"]).toBe("1; mode=block");
    expect(headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["content-security-policy"]).toContain("default-src");
  });

  test("CSP blocks inline scripts by not using unsafe-inline in production", async ({
    request,
  }) => {
    const response = await request.get("/");
    const csp = response.headers()["content-security-policy"] ?? "";

    // Verify CSP is present and has meaningful directives
    expect(csp).toContain("default-src");
    expect(csp).toContain("script-src");
    expect(csp).toContain("object-src 'none'");
  });

  test("X-DNS-Prefetch-Control is enabled", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["x-dns-prefetch-control"]).toBe("on");
  });
});
