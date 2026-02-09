import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  // Apps
  "apps/app/vitest.config.mts",
  "apps/api/vitest.config.mts",

  // Packages
  "packages/ai/vitest.config.ts",
  "packages/search/vitest.config.ts",
  "packages/service-utils/vitest.config.ts",

  // Services
  "services/gateway/vitest.config.ts",
  "services/billing/vitest.config.ts",
  "services/connector/vitest.config.ts",
  "services/device/vitest.config.ts",
  "services/file/vitest.config.ts",
  "services/knowledge/vitest.config.ts",
  "services/notification/vitest.config.ts",
  "services/project/vitest.config.ts",
  "services/sandbox/vitest.config.ts",
  "services/search/vitest.config.ts",
  "services/task/vitest.config.ts",
  "services/webhook/vitest.config.ts",
  "services/website/vitest.config.ts",
]);
