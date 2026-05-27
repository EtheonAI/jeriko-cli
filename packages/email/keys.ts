import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      RESEND_FROM: z.string().default("Jeriko <noreply@etheon.ai>"),
      RESEND_TOKEN: z.string().optional(),
      RESEND_API_KEY: z.string().optional(),
    },
    runtimeEnv: {
      RESEND_FROM: process.env.RESEND_FROM,
      RESEND_TOKEN: process.env.RESEND_TOKEN || process.env.RESEND_API_KEY,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
    },
    emptyStringAsUndefined: true,
  });
