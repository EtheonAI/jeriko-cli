import { describe, it, expect } from "vitest";

/**
 * Tests for the timeline scrubber logic added in P2.15.
 * The timeline maps a percentage (0-100) to a tool call index,
 * then pins that tool call.
 */

describe("Timeline percentage → tool call index mapping", () => {
  // Reproduce the mapping logic from use-canvas.ts onTimelineChange
  function mapPercentageToIndex(percentage: number, totalToolCalls: number): number {
    if (totalToolCalls === 0) return -1;
    const idx = Math.round((percentage / 100) * (totalToolCalls - 1));
    return Math.max(0, Math.min(idx, totalToolCalls - 1));
  }

  it("maps 0% to index 0", () => {
    expect(mapPercentageToIndex(0, 5)).toBe(0);
  });

  it("maps 100% to last index", () => {
    expect(mapPercentageToIndex(100, 5)).toBe(4);
  });

  it("maps 50% to middle index", () => {
    expect(mapPercentageToIndex(50, 5)).toBe(2);
  });

  it("maps 25% correctly for 5 items", () => {
    expect(mapPercentageToIndex(25, 5)).toBe(1);
  });

  it("handles single tool call", () => {
    expect(mapPercentageToIndex(0, 1)).toBe(0);
    expect(mapPercentageToIndex(50, 1)).toBe(0);
    expect(mapPercentageToIndex(100, 1)).toBe(0);
  });

  it("handles empty tool calls", () => {
    expect(mapPercentageToIndex(50, 0)).toBe(-1);
  });

  it("clamps to valid range", () => {
    expect(mapPercentageToIndex(150, 3)).toBe(2);
    expect(mapPercentageToIndex(-10, 3)).toBe(0);
  });
});

describe("Browser history entry structure", () => {
  interface BrowserHistoryEntry {
    url: string;
    screenshot?: string;
    title?: string;
  }

  it("stores screenshot and title with URL", () => {
    const entry: BrowserHistoryEntry = {
      url: "https://example.com",
      screenshot: "base64data",
      title: "Example",
    };
    expect(entry.url).toBe("https://example.com");
    expect(entry.screenshot).toBe("base64data");
    expect(entry.title).toBe("Example");
  });

  it("allows entries without screenshot (HTTP fallback mode)", () => {
    const entry: BrowserHistoryEntry = {
      url: "https://example.com",
      title: "Example",
    };
    expect(entry.screenshot).toBeUndefined();
  });
});
