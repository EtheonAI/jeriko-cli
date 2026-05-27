import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      AGENTMAIL_API_KEY: z.string().min(1).optional(),
      AGENTMAIL_WEBHOOK_SECRET: z.string().optional(),
    },
    runtimeEnv: {
      AGENTMAIL_API_KEY: process.env.AGENTMAIL_API_KEY,
      AGENTMAIL_WEBHOOK_SECRET: process.env.AGENTMAIL_WEBHOOK_SECRET,
    },
    emptyStringAsUndefined: true,
  });
