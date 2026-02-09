import { describe, it, expect } from "vitest";

/**
 * Tests for normalizeParts logic from use-chat-session.ts (P0.6).
 *
 * normalizeParts ensures every tool part has:
 * 1. A `state` field (defaults to "output-available")
 * 2. A `toolName` field (derived from type "tool-{toolName}" → toolName)
 */

// Reproduce the normalizeParts logic
function normalizeParts(parts: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!parts || !Array.isArray(parts)) return [];
  const normalized: Record<string, unknown>[] = [];

  for (const p of parts) {
    const pType = (p.type as string) || "";

    // Only process tool parts (type starts with "tool-")
    if (pType.startsWith("tool-")) {
      const derivedToolName = (p.toolName as string) || pType.slice(5) || "unknown";
      if (!p.state || !p.toolName) {
        normalized.push({
          ...p,
          state: p.state || "output-available",
          toolName: derivedToolName,
        });
      } else {
        normalized.push(p);
      }
    } else {
      normalized.push(p);
    }
  }

  return normalized;
}

describe("normalizeParts", () => {
  it("passes through non-tool parts unchanged", () => {
    const parts = [
      { type: "text", text: "Hello" },
      { type: "reasoning", reasoning: "thinking" },
    ];
    const result = normalizeParts(parts);
    expect(result).toEqual(parts);
  });

  it("adds missing state to tool parts", () => {
    const parts = [
      { type: "tool-browser_navigate", toolName: "browser_navigate", toolCallId: "tc1" },
    ];
    const result = normalizeParts(parts);
    expect(result[0].state).toBe("output-available");
  });

  it("derives toolName from type when missing", () => {
    const parts = [
      { type: "tool-shell_exec", state: "output-available", toolCallId: "tc1" },
    ];
    const result = normalizeParts(parts);
    expect(result[0].toolName).toBe("shell_exec");
  });

  it("derives both state and toolName when both missing", () => {
    const parts = [
      { type: "tool-file_read", toolCallId: "tc1" },
    ];
    const result = normalizeParts(parts);
    expect(result[0].state).toBe("output-available");
    expect(result[0].toolName).toBe("file_read");
  });

  it("preserves existing state and toolName", () => {
    const parts = [
      { type: "tool-web_search", state: "output-error", toolName: "web_search", toolCallId: "tc1" },
    ];
    const result = normalizeParts(parts);
    expect(result[0].state).toBe("output-error");
    expect(result[0].toolName).toBe("web_search");
  });

  it("handles empty/null parts gracefully", () => {
    expect(normalizeParts([])).toEqual([]);
    expect(normalizeParts(null as unknown as Record<string, unknown>[])).toEqual([]);
    expect(normalizeParts(undefined as unknown as Record<string, unknown>[])).toEqual([]);
  });

  it("handles mixed parts (text + tool)", () => {
    const parts = [
      { type: "text", text: "I'll search for that." },
      { type: "tool-web_search", toolCallId: "tc1" },
      { type: "text", text: "Here are the results." },
    ];
    const result = normalizeParts(parts);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("text");
    expect(result[1].toolName).toBe("web_search");
    expect(result[1].state).toBe("output-available");
    expect(result[2].type).toBe("text");
  });

  it("defaults toolName to 'unknown' for type 'tool-' with no name suffix", () => {
    const parts = [
      { type: "tool-", toolCallId: "tc1" },
    ];
    const result = normalizeParts(parts);
    expect(result[0].toolName).toBe("unknown");
  });
});
