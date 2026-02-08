import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Shared Vitest config for React/Next.js apps.
 * Usage in app vitest.config.mts:
 *   import { createReactConfig } from "@repo/testing";
 *   export default createReactConfig(__dirname);
 */
export function createReactConfig(rootDir: string) {
  return defineConfig({
    plugins: [react()],
    test: {
      environment: "jsdom",
      globals: true,
      include: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
      exclude: ["node_modules", "dist", ".next", "e2e"],
      setupFiles: [],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html", "lcov"],
        exclude: [
          "node_modules",
          "dist",
          ".next",
          "e2e",
          "**/*.d.ts",
          "**/*.test.*",
          "**/*.spec.*",
          "**/*.config.*",
        ],
      },
    },
    resolve: {
      alias: {
        "@": rootDir,
        "@repo": path.resolve(rootDir, "../../packages"),
      },
    },
  });
}

/**
 * Shared Vitest config for Node.js services.
 * Usage in service vitest.config.ts:
 *   import { createServiceConfig } from "@repo/testing";
 *   export default createServiceConfig();
 */
export function createServiceConfig() {
  return defineConfig({
    test: {
      globals: true,
      environment: "node",
      include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
      exclude: ["node_modules", "dist"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html", "lcov"],
        exclude: [
          "node_modules",
          "dist",
          "**/*.d.ts",
          "**/*.test.ts",
          "**/*.spec.ts",
          "**/index.ts",
        ],
        thresholds: {
          lines: 70,
          functions: 70,
          branches: 60,
          statements: 70,
        },
      },
      testTimeout: 10000,
      hookTimeout: 10000,
    },
  });
}

// Re-export vitest default config for backwards compatibility
const config = defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@repo": path.resolve(__dirname, "../../packages"),
    },
  },
});

export default config;
