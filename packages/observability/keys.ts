import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      BETTERSTACK_API_KEY: z.string().optional(),
      BETTERSTACK_URL: z.string().url().optional(),
      BETTER_STACK_SOURCE_TOKEN: z.string().optional(),
      BETTER_STACK_INGESTING_URL: z.string().url().optional(),
      BETTER_STACK_INGEST_ENDPOINT: z.string().url().optional(),
      LOGTAIL_SOURCE_TOKEN: z.string().optional(),
      LOGTAIL_URL: z.string().url().optional(),

      // Added by Sentry Integration, Vercel Marketplace
      SENTRY_ORG: z.string().optional(),
      SENTRY_PROJECT: z.string().optional(),
    },
    client: {
      NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: z.string().optional(),
      NEXT_PUBLIC_BETTER_STACK_INGESTING_URL: z.string().url().optional(),
      NEXT_PUBLIC_BETTER_STACK_CUSTOM_ENDPOINT: z.string().url().optional(),
      NEXT_PUBLIC_BETTER_STACK_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
      NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN: z.string().optional(),
      NEXT_PUBLIC_LOGTAIL_URL: z.string().url().optional(),

      // Added by Sentry Integration, Vercel Marketplace
      NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    },
    runtimeEnv: {
      BETTERSTACK_API_KEY: process.env.BETTERSTACK_API_KEY,
      BETTERSTACK_URL: process.env.BETTERSTACK_URL,
      BETTER_STACK_SOURCE_TOKEN: process.env.BETTER_STACK_SOURCE_TOKEN,
      BETTER_STACK_INGESTING_URL: process.env.BETTER_STACK_INGESTING_URL,
      BETTER_STACK_INGEST_ENDPOINT: process.env.BETTER_STACK_INGEST_ENDPOINT,
      LOGTAIL_SOURCE_TOKEN: process.env.LOGTAIL_SOURCE_TOKEN,
      LOGTAIL_URL: process.env.LOGTAIL_URL,
      NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN,
      NEXT_PUBLIC_BETTER_STACK_INGESTING_URL: process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_URL,
      NEXT_PUBLIC_BETTER_STACK_CUSTOM_ENDPOINT:
        process.env.NEXT_PUBLIC_BETTER_STACK_CUSTOM_ENDPOINT,
      NEXT_PUBLIC_BETTER_STACK_LOG_LEVEL: process.env.NEXT_PUBLIC_BETTER_STACK_LOG_LEVEL,
      NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN: process.env.NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN,
      NEXT_PUBLIC_LOGTAIL_URL: process.env.NEXT_PUBLIC_LOGTAIL_URL,
      SENTRY_ORG: process.env.SENTRY_ORG,
      SENTRY_PROJECT: process.env.SENTRY_PROJECT,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    },
    emptyStringAsUndefined: true,
  });
