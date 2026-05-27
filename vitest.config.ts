import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "apps/app/vitest.config.ts",
      // Packages
      "packages/ai/vitest.config.ts",
      "packages/auth/vitest.config.ts",
      "packages/cms/vitest.config.ts",
      "packages/connectors/vitest.config.ts",
      "packages/email/vitest.config.ts",
      "packages/flow/vitest.config.ts",
      "packages/internationalization/vitest.config.ts",
      "packages/observability/vitest.config.ts",
      "packages/rate-limit/vitest.config.ts",
      "packages/sandbox/vitest.config.ts",
      "packages/search/vitest.config.ts",
      "packages/security/vitest.config.ts",
      "packages/seo/vitest.config.ts",
    ],
  },
});
