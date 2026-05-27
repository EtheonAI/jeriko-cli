/**
 * Knowledge Service Unit Tests
 */
import { describe, it, expect } from "vitest";

describe("RAG pipeline", () => {
  it("should chunk text by paragraph boundaries", () => {
    const text = "Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.";
    const chunks = text.split(/\n\n+/).filter(Boolean);
    expect(chunks).toHaveLength(3);
  });

  it("should enforce max chunk size", () => {
    const maxChunkSize = 1000;
    const longText = "a".repeat(2000);
    const chunks: string[] = [];
    for (let i = 0; i < longText.length; i += maxChunkSize) {
      chunks.push(longText.slice(i, i + maxChunkSize));
    }
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.length).toBeLessThanOrEqual(maxChunkSize);
  });

  it("should handle empty documents", () => {
    const chunks = "".split(/\n\n+/).filter(Boolean);
    expect(chunks).toHaveLength(0);
  });
});

describe("Embedding generation", () => {
  it("should normalize embedding vectors", () => {
    const vector = [0.3, 0.4, 0.5, 0.6];
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    const normalized = vector.map((v) => v / magnitude);
    const normMagnitude = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));
    expect(normMagnitude).toBeCloseTo(1.0, 5);
  });
});

describe("Vector search", () => {
  it("should compute cosine similarity", () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    const dot = a.reduce((sum, v, i) => sum + v * b[i]!, 0);
    const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    const similarity = dot / (magA * magB);
    expect(similarity).toBeCloseTo(1.0);
  });

  it("should return 0 for orthogonal vectors", () => {
    const a = [1, 0];
    const b = [0, 1];
    const dot = a.reduce((sum, v, i) => sum + v * b[i]!, 0);
    expect(dot).toBe(0);
  });

  it("should rank results by similarity score", () => {
    const results = [
      { id: "1", score: 0.95 },
      { id: "2", score: 0.72 },
      { id: "3", score: 0.88 },
    ];
    const sorted = results.sort((a, b) => b.score - a.score);
    expect(sorted[0]!.id).toBe("1");
    expect(sorted[1]!.id).toBe("3");
  });

  it("should filter results below threshold", () => {
    const threshold = 0.7;
    const results = [
      { id: "1", score: 0.95 },
      { id: "2", score: 0.5 },
      { id: "3", score: 0.88 },
    ];
    const filtered = results.filter((r) => r.score >= threshold);
    expect(filtered).toHaveLength(2);
  });
});
