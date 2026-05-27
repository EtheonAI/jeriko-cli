import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      BLOB_READ_WRITE_TOKEN: z.string().optional(),
      PAYLOAD_DATABASE_URL: z.string().url().optional(),
      PAYLOAD_EMAIL_FROM_ADDRESS: z.string().email().optional(),
      PAYLOAD_EMAIL_FROM_NAME: z.string().default("Jeriko CMS"),
      PAYLOAD_POSTGRES_SCHEMA: z.string().optional(),
      PAYLOAD_PREVIEW_SECRET: z.string().optional(),
      PAYLOAD_SECRET: z.string().min(32).optional(),
      PAYLOAD_SERVER_URL: z.string().url().optional(),
      RESEND_API_KEY: z.string().optional(),
    },
    runtimeEnv: {
      BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
      PAYLOAD_DATABASE_URL: process.env.PAYLOAD_DATABASE_URL,
      PAYLOAD_EMAIL_FROM_ADDRESS: process.env.PAYLOAD_EMAIL_FROM_ADDRESS,
      PAYLOAD_EMAIL_FROM_NAME: process.env.PAYLOAD_EMAIL_FROM_NAME,
      PAYLOAD_POSTGRES_SCHEMA: process.env.PAYLOAD_POSTGRES_SCHEMA,
      PAYLOAD_PREVIEW_SECRET: process.env.PAYLOAD_PREVIEW_SECRET,
      PAYLOAD_SECRET: process.env.PAYLOAD_SECRET,
      PAYLOAD_SERVER_URL: process.env.PAYLOAD_SERVER_URL,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
    },
    emptyStringAsUndefined: true,
  });
