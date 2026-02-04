import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/types/index.ts",
    "src/database/index.ts",
    "src/redis/index.ts",
    "src/logger/index.ts",
    "src/auth/index.ts",
  ],
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["@repo/database", "ioredis", "pino", "jose", "zod", "@paralleldrive/cuid2"],
});
