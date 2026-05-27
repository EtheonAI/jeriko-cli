import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      COMPOSIO_API_KEY: z.string().min(1).optional(),
    },
    runtimeEnv: {
      COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY,
    },
    emptyStringAsUndefined: true,
  });
