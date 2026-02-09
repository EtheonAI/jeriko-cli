import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      // Agent service URL — all AI completions go through this service
      AGENT_SERVICE_URL: z.string().url().optional(),
    },
    runtimeEnv: {
      AGENT_SERVICE_URL: process.env.AGENT_SERVICE_URL,
    },
  });
