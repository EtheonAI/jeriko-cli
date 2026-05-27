import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

type SharedTestConfigOptions = {
  readonly include?: string[];
  readonly setupFiles?: string[];
};

type ReactTestConfigOptions = SharedTestConfigOptions & {
  readonly rootDir: string;
};

const defaultExcludes = ["node_modules", "dist", ".next", "e2e"];

/**
 * Shared Vitest config for React/Next.js apps.
 *
 * Usage:
 *   import { createReactConfig } from "@repo/testing";
 *   export default createReactConfig({ rootDir: import.meta.dirname });
 */
export function createReactConfig({
  include = ["tests/**/*.test.{ts,tsx}", "tests/**/*.spec.{ts,tsx}"],
  rootDir,
  setupFiles = [],
}: ReactTestConfigOptions) {
  return defineConfig({
    plugins: [react()],
    test: {
      environment: "jsdom",
      globals: true,
      include,
      exclude: defaultExcludes,
      setupFiles,
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html", "lcov"],
        exclude: [...defaultExcludes, "**/*.d.ts", "**/*.test.*", "**/*.spec.*", "**/*.config.*"],
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
 * Shared Vitest config for Node.js packages.
 *
 * Usage:
 *   import { createNodeConfig } from "@repo/testing";
 *   export default createNodeConfig();
 */
export function createNodeConfig({
  include = ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
  setupFiles = [],
}: SharedTestConfigOptions = {}) {
  return defineConfig({
    test: {
      globals: true,
      environment: "node",
      include,
      exclude: ["node_modules", "dist"],
      setupFiles,
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
