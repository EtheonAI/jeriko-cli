import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      VERCEL_OIDC_TOKEN: z.string().optional(),
      VERCEL_TOKEN: z.string().optional(),
      VERCEL_TEAM_ID: z.string().optional(),
      VERCEL_PROJECT_ID: z.string().optional(),
    },
    runtimeEnv: {
      VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
      VERCEL_TOKEN: process.env.VERCEL_TOKEN,
      VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID,
      VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
    },
    emptyStringAsUndefined: true,
  });
