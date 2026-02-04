import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    TYPESENSE_HOST: z.string().default("localhost"),
    TYPESENSE_PORT: z.coerce.number().default(8108),
    TYPESENSE_PROTOCOL: z.enum(["http", "https"]).default("http"),
    TYPESENSE_API_KEY: z.string().min(1),
  },
  experimental__runtimeEnv: {},
});
