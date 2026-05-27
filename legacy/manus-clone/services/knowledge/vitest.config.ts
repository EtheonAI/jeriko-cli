import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/tests/**/*.test.ts"],
    setupFiles: ["src/tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 15000,
    sequence: {
      concurrent: false,
    },
  },
});
