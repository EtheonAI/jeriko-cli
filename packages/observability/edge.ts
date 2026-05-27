/*
 * This file configures the initialization of Sentry for edge runtime.
 * The config you add here will be used whenever a page or API route is loaded in an edge runtime.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import { keys } from "./keys";

type SentryInitResult = ReturnType<typeof import("@sentry/nextjs").init>;
const tracesSampleRate = process.env.NODE_ENV === "development" ? 1 : 0.1;

export const initializeSentry = async (): Promise<SentryInitResult | undefined> => {
  const dsn = keys().NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    return;
  }

  const Sentry = await import("@sentry/nextjs");

  return Sentry.init({
    dsn,

    // Enable logging
    enableLogs: true,

    tracesSampleRate,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Integrations for console logging
    integrations: [
      // Send console.log, console.error, and console.warn calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ["log", "error", "warn"] }),
    ],
  });
};
