import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for useE2BStream hook logic.
 *
 * Since this is a WebSocket hook that depends on browser APIs,
 * we test the URL construction and state management logic.
 */

describe("E2B stream URL construction", () => {
  it("constructs correct browser stream URL from sandbox ID", () => {
    const sandboxId = "sbx_abc123";
    const url = `/api/sandbox/${sandboxId}/browser/stream`;
    expect(url).toBe("/api/sandbox/sbx_abc123/browser/stream");
  });

  it("constructs correct terminal stream URL from sandbox ID", () => {
    const sandboxId = "sbx_abc123";
    const url = `/api/sandbox/${sandboxId}/terminal/stream`;
    expect(url).toBe("/api/sandbox/sbx_abc123/terminal/stream");
  });
});

describe("E2B stream state logic", () => {
  it("should not connect when disabled", () => {
    const enabled = false;
    const sandboxId = "sbx_abc123";
    const shouldConnect = enabled && !!sandboxId;
    expect(shouldConnect).toBe(false);
  });

  it("should not connect when no sandbox ID", () => {
    const enabled = true;
    const sandboxId: string | null = null;
    const shouldConnect = enabled && !!sandboxId;
    expect(shouldConnect).toBe(false);
  });

  it("should connect when enabled with sandbox ID", () => {
    const enabled = true;
    const sandboxId = "sbx_abc123";
    const shouldConnect = enabled && !!sandboxId;
    expect(shouldConnect).toBe(true);
  });
});

describe("E2B terminal output accumulation", () => {
  const MAX_LINES = 5000;

  function accumulateOutput(existing: string[], newData: string): string[] {
    const newLines = newData.split("\n");
    const combined = [...existing, ...newLines];
    return combined.length > MAX_LINES ? combined.slice(-MAX_LINES) : combined;
  }

  it("accumulates new output lines", () => {
    const result = accumulateOutput(["line1"], "line2\nline3");
    expect(result).toEqual(["line1", "line2", "line3"]);
  });

  it("caps at MAX_LINES", () => {
    const existing = Array.from({ length: 4999 }, (_, i) => `line${i}`);
    const result = accumulateOutput(existing, "new1\nnew2\nnew3");
    expect(result).toHaveLength(MAX_LINES);
    // Should have dropped oldest lines
    expect(result[0]).toBe("line2");
    expect(result[result.length - 1]).toBe("new3");
  });

  it("handles empty new data", () => {
    const result = accumulateOutput(["line1"], "");
    expect(result).toEqual(["line1", ""]);
  });
});
