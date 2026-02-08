import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "apps/app/vitest.config.mts",
  "apps/api/vitest.config.mts",
  "packages/ai/vitest.config.ts",
  "packages/search/vitest.config.ts",
  "packages/service-utils/vitest.config.ts",
  "services/gateway/vitest.config.ts",
]);
