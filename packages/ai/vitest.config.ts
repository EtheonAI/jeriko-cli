import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": new URL("./tests/support/server-only.test-stub.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist"],
  },
});
