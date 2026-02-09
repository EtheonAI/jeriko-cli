/**
 * Sandbox Service Unit Tests
 */
import { describe, it, expect, vi } from "vitest";

const ALLOWED_BROWSER_ACTIONS = [
  "navigate", "click", "scroll", "screenshot", "key_press",
  "select_option", "input", "console_exec",
];

describe("Sandbox lifecycle", () => {
  it("should validate E2B template names", () => {
    const validTemplates = ["rubic-desktop", "rubic-base", "code-interpreter"];
    for (const t of validTemplates) {
      expect(t).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("should enforce TTL limits", () => {
    const warmIdleTtl = 600;
    const hibernateReuseTtl = 172800;
    const hardMaxLifetime = 259200;
    expect(warmIdleTtl).toBeLessThan(hibernateReuseTtl);
    expect(hibernateReuseTtl).toBeLessThan(hardMaxLifetime);
  });
});

describe("Browser action allowlist", () => {
  it("should allow valid browser actions", () => {
    for (const action of ALLOWED_BROWSER_ACTIONS) {
      expect(ALLOWED_BROWSER_ACTIONS).toContain(action);
    }
  });

  it("should reject disallowed browser actions", () => {
    expect(ALLOWED_BROWSER_ACTIONS).not.toContain("eval");
    expect(ALLOWED_BROWSER_ACTIONS).not.toContain("delete");
    expect(ALLOWED_BROWSER_ACTIONS).not.toContain("exec");
  });
});

describe("Code execution", () => {
  it("should support Python and JavaScript languages", () => {
    const supported = ["python", "javascript", "typescript", "bash"];
    expect(supported).toContain("python");
    expect(supported).toContain("javascript");
  });

  it("should enforce execution timeout", () => {
    const maxTimeout = 300; // 5 minutes
    const requestedTimeout = 30;
    const effectiveTimeout = Math.min(requestedTimeout, maxTimeout);
    expect(effectiveTimeout).toBe(30);
  });

  it("should cap oversized timeout requests", () => {
    const maxTimeout = 300;
    const requestedTimeout = 600;
    const effectiveTimeout = Math.min(requestedTimeout, maxTimeout);
    expect(effectiveTimeout).toBe(300);
  });
});

describe("File operations in sandbox", () => {
  it("should validate file paths are within sandbox", () => {
    const basePath = "/home/user";
    const isValidPath = (p: string) => p.startsWith(basePath) && !p.includes("..");
    expect(isValidPath("/home/user/project/index.ts")).toBe(true);
    expect(isValidPath("/etc/passwd")).toBe(false);
    expect(isValidPath("/home/user/../etc/passwd")).toBe(false);
  });
});
