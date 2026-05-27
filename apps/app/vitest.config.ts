import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineProject({
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "react",
    },
  },
  resolve: {
    alias: [
      { find: "@", replacement: root },
      {
        find: "@repo/auth/next",
        replacement: resolve(root, "../../packages/auth/src/next.ts"),
      },
      {
        find: "@repo/auth/validations",
        replacement: resolve(root, "../../packages/auth/src/validations/auth.ts"),
      },
      {
        find: "server-only",
        replacement: resolve(root, "./tests/support/server-only.test-stub.ts"),
      },
      { find: "@repo", replacement: resolve(root, "../../packages") },
    ],
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup-env.ts"],
  },
});
