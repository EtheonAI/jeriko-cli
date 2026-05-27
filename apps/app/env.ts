import { keys as analytics } from "@repo/analytics/keys";
import { keys as auth } from "@repo/auth/keys";
import { keys as database } from "@repo/database/keys";
import { keys as email } from "@repo/email/keys";
import { keys as flags } from "@repo/feature-flags/keys";
import { keys as core } from "@repo/next-config/keys";
import { keys as notifications } from "@repo/notifications/keys";
import { keys as observability } from "@repo/observability/keys";
import { keys as payments } from "@repo/payments/keys";
import { keys as security } from "@repo/security/keys";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  extends: [
    auth(),
    analytics(),
    core(),
    database(),
    email(),
    flags(),
    notifications(),
    observability(),
    payments(),
    security(),
  ],
  server: {
    E2E_AUTH_BYPASS: z.enum(["true", "false"]).optional(),
  },
  client: {},
  runtimeEnv: {
    E2E_AUTH_BYPASS: process.env.E2E_AUTH_BYPASS,
  },
  emptyStringAsUndefined: true,
});
