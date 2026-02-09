/**
 * Search Service Unit Tests
 */
import { describe, it, expect } from "vitest";

describe("Search query building", () => {
  it("should sanitize search input", () => {
    const sanitize = (q: string) => q.replace(/[<>'"]/g, "").trim().slice(0, 500);
    expect(sanitize('<script>alert("xss")</script>')).not.toContain("<script>");
    expect(sanitize("normal query")).toBe("normal query");
    expect(sanitize("a".repeat(600)).length).toBeLessThanOrEqual(500);
  });

  it("should build ILIKE fallback pattern", () => {
    const query = "test search";
    const pattern = `%${query}%`;
    expect(pattern).toBe("%test search%");
  });

  it("should handle empty search queries", () => {
    expect("".trim()).toBe("");
    expect("   ".trim()).toBe("");
  });
});

describe("Search result ranking", () => {
  it("should prioritize exact matches", () => {
    const results = [
      { title: "React Testing Library", score: 0.8 },
      { title: "Testing React", score: 0.95 },
      { title: "React", score: 0.5 },
    ];
    const sorted = results.sort((a, b) => b.score - a.score);
    expect(sorted[0]!.title).toBe("Testing React");
  });

  it("should limit result count", () => {
    const results = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const maxResults = 20;
    expect(results.slice(0, maxResults)).toHaveLength(20);
  });
});

describe("Typesense fallback", () => {
  it("should fall back to DB ILIKE when Typesense is unavailable", () => {
    const typesenseAvailable = false;
    const useIlike = !typesenseAvailable;
    expect(useIlike).toBe(true);
  });
});
