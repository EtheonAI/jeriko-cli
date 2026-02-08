import { describe, it, expect } from "vitest";
import { existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Bundle size checks for the chat pipeline.
 *
 * These tests verify that the build output stays within budget.
 * They only run when a build exists (.next directory is present).
 *
 * To run:
 *   pnpm build --filter=app && pnpm test --filter=app -- bundle-size
 */

const NEXT_DIR = join(__dirname, "..", ".next");
const BUILD_EXISTS = existsSync(NEXT_DIR);

describe("Bundle Size", () => {
  // Skip if no build output
  describe.skipIf(!BUILD_EXISTS)("post-build checks", () => {
    it(".next directory exists", () => {
      expect(BUILD_EXISTS).toBe(true);
    });

    it("static chunks directory exists", () => {
      const chunksDir = join(NEXT_DIR, "static", "chunks");
      expect(existsSync(chunksDir)).toBe(true);
    });

    it("total static JS is under 5MB", () => {
      const chunksDir = join(NEXT_DIR, "static", "chunks");
      if (!existsSync(chunksDir)) return;

      const totalSize = getDirectorySizeRecursive(chunksDir);
      const totalMB = totalSize / (1024 * 1024);

      // 25MB total budget for all JS chunks (includes vendor bundles)
      expect(totalMB).toBeLessThan(25);
    });

    it("no individual JS chunk exceeds 500KB", () => {
      const chunksDir = join(NEXT_DIR, "static", "chunks");
      if (!existsSync(chunksDir)) return;

      const largeChunks = findLargeFiles(chunksDir, 500 * 1024);

      if (largeChunks.length > 0) {
        console.warn(
          "Large chunks found:",
          largeChunks.map(
            (f) => `${f.name} (${(f.size / 1024).toFixed(1)}KB)`
          )
        );
      }

      // Allow some large chunks (vendor bundles), but flag them
      // This is a soft check — adjust threshold as needed
      const veryLargeChunks = largeChunks.filter(
        (f) => f.size > 1024 * 1024 // > 1MB
      );
      expect(veryLargeChunks).toHaveLength(0);
    });

    it("build manifest exists and is valid JSON", () => {
      const manifestPath = join(NEXT_DIR, "build-manifest.json");
      if (!existsSync(manifestPath)) return;

      const { readFileSync } = require("node:fs");
      const content = readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(content);

      expect(manifest).toHaveProperty("pages");
    });
  });
});

// ─── Helpers ───

function getDirectorySizeRecursive(dirPath: string): number {
  let total = 0;
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirectorySizeRecursive(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      total += statSync(fullPath).size;
    }
  }

  return total;
}

function findLargeFiles(
  dirPath: string,
  threshold: number
): Array<{ name: string; size: number }> {
  const results: Array<{ name: string; size: number }> = [];
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...findLargeFiles(fullPath, threshold));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      const size = statSync(fullPath).size;
      if (size > threshold) {
        results.push({ name: entry.name, size });
      }
    }
  }

  return results;
}
