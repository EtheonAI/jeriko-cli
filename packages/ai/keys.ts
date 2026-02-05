import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      OPENAI_API_KEY: z.string().startsWith("sk-").optional(),
      ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-").optional(),
    },
    runtimeEnv: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    },
  });
