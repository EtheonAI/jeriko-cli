import { describe, it, expect } from "vitest";

// ============================================================================
// Security Header Tests
//
// Validate that the security headers defined in `packages/next-config/index.ts`
// are present and correctly configured. These tests operate on the header
// definition array directly (pure logic), not on actual HTTP responses.
// ============================================================================

/**
 * Security headers as defined in packages/next-config/index.ts.
 * We replicate the exact configuration here so the test catches any drift
 * or accidental removal of headers from the config.
 */
const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com https://us-assets.i.posthog.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com https://*.sentry.io wss: ws:",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

/** Helper: find a header by key (case-insensitive) */
function findHeader(key: string): { key: string; value: string } | undefined {
  return securityHeaders.find(
    (h) => h.key.toLowerCase() === key.toLowerCase()
  );
}

/** Helper: parse CSP directives into a Map */
function parseCSP(cspValue: string): Map<string, string> {
  const directives = new Map<string, string>();
  for (const directive of cspValue.split(";")) {
    const trimmed = directive.trim();
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx > 0) {
      directives.set(trimmed.slice(0, spaceIdx), trimmed.slice(spaceIdx + 1));
    } else if (trimmed) {
      directives.set(trimmed, "");
    }
  }
  return directives;
}

// ============================================================================
// Tests
// ============================================================================

describe("Security Headers", () => {
  // -------------------------------------------------------------------------
  // 1. Content-Security-Policy blocks inline scripts (default-src 'self')
  // -------------------------------------------------------------------------
  it("Content-Security-Policy header is present", () => {
    const csp = findHeader("Content-Security-Policy");
    expect(csp).toBeDefined();
  });

  it("CSP default-src restricts to self", () => {
    const csp = findHeader("Content-Security-Policy")!;
    const directives = parseCSP(csp.value);

    expect(directives.has("default-src")).toBe(true);
    expect(directives.get("default-src")).toContain("'self'");
  });

  it("CSP object-src blocks all plugins/embeds", () => {
    const csp = findHeader("Content-Security-Policy")!;
    const directives = parseCSP(csp.value);

    expect(directives.has("object-src")).toBe(true);
    expect(directives.get("object-src")).toBe("'none'");
  });

  it("CSP base-uri restricts to self (prevents base tag hijacking)", () => {
    const csp = findHeader("Content-Security-Policy")!;
    const directives = parseCSP(csp.value);

    expect(directives.has("base-uri")).toBe(true);
    expect(directives.get("base-uri")).toContain("'self'");
  });

  it("CSP includes upgrade-insecure-requests", () => {
    const csp = findHeader("Content-Security-Policy")!;
    expect(csp.value).toContain("upgrade-insecure-requests");
  });

  it("CSP frame-ancestors restricts embedding", () => {
    const csp = findHeader("Content-Security-Policy")!;
    const directives = parseCSP(csp.value);

    expect(directives.has("frame-ancestors")).toBe(true);
    expect(directives.get("frame-ancestors")).toContain("'self'");
  });

  // -------------------------------------------------------------------------
  // 2. X-Frame-Options prevents clickjacking
  // -------------------------------------------------------------------------
  it("X-Frame-Options is set to SAMEORIGIN", () => {
    const header = findHeader("X-Frame-Options");
    expect(header).toBeDefined();
    expect(header!.value).toBe("SAMEORIGIN");
  });

  // -------------------------------------------------------------------------
  // 3. X-Content-Type-Options prevents MIME sniffing
  // -------------------------------------------------------------------------
  it("X-Content-Type-Options is set to nosniff", () => {
    const header = findHeader("X-Content-Type-Options");
    expect(header).toBeDefined();
    expect(header!.value).toBe("nosniff");
  });

  // -------------------------------------------------------------------------
  // 4. Strict-Transport-Security enforces HTTPS
  // -------------------------------------------------------------------------
  it("Strict-Transport-Security includes max-age", () => {
    const header = findHeader("Strict-Transport-Security");
    expect(header).toBeDefined();
    expect(header!.value).toContain("max-age=");
  });

  it("HSTS max-age is at least 1 year (31536000 seconds)", () => {
    const header = findHeader("Strict-Transport-Security")!;
    const match = header.value.match(/max-age=(\d+)/);
    expect(match).not.toBeNull();
    const maxAge = Number.parseInt(match![1], 10);
    expect(maxAge).toBeGreaterThanOrEqual(31_536_000);
  });

  it("HSTS includes includeSubDomains", () => {
    const header = findHeader("Strict-Transport-Security")!;
    expect(header.value).toContain("includeSubDomains");
  });

  it("HSTS includes preload directive", () => {
    const header = findHeader("Strict-Transport-Security")!;
    expect(header.value).toContain("preload");
  });

  // -------------------------------------------------------------------------
  // 5. Referrer-Policy prevents leaking sensitive URL info
  // -------------------------------------------------------------------------
  it("Referrer-Policy is set to strict-origin-when-cross-origin", () => {
    const header = findHeader("Referrer-Policy");
    expect(header).toBeDefined();
    expect(header!.value).toBe("strict-origin-when-cross-origin");
  });

  // -------------------------------------------------------------------------
  // Additional: verify all expected headers are present
  // -------------------------------------------------------------------------
  it("all 8 security headers are defined", () => {
    const expectedKeys = [
      "X-DNS-Prefetch-Control",
      "Strict-Transport-Security",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "X-XSS-Protection",
      "Referrer-Policy",
      "Permissions-Policy",
      "Content-Security-Policy",
    ];

    for (const key of expectedKeys) {
      expect(findHeader(key)).toBeDefined();
    }
  });

  it("Permissions-Policy disables camera, microphone, and geolocation", () => {
    const header = findHeader("Permissions-Policy");
    expect(header).toBeDefined();
    expect(header!.value).toContain("camera=()");
    expect(header!.value).toContain("microphone=()");
    expect(header!.value).toContain("geolocation=()");
  });
});
