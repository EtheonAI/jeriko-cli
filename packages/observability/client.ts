/*
 * This file configures the initialization of Sentry on the client.
 * The config you add here will be used whenever a users loads a page in their browser.
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

    replaysOnErrorSampleRate: 1,

    /*
     * This sets the sample rate to be 10%. You may want this to be 100% while
     * in development and sample at a lower rate in production
     */
    replaysSessionSampleRate: 0.1,

    // You can remove this option if you're not planning to use the Sentry Session Replay feature:
    integrations: [
      Sentry.replayIntegration({
        // Additional Replay configuration goes in here, for example:
        maskAllText: true,
        blockAllMedia: true,
      }),
      // Send console.log, console.error, and console.warn calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ["log", "error", "warn"] }),
    ],
  });
};
