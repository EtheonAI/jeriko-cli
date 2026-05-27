import { withBetterStack } from "@logtail/next";
import { keys } from "./keys";

const observabilityEnv = keys();
type WithSentryConfig = typeof import("@sentry/nextjs").withSentryConfig;
type ObservabilityNextConfig = Parameters<WithSentryConfig>[0] & {
  transpilePackages?: string[];
};

export const sentryConfig: Parameters<WithSentryConfig>[1] = {
  org: observabilityEnv.SENTRY_ORG,
  project: observabilityEnv.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  /*
   * For all available options, see:
   * https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
   */

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  /*
   * Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
   * This can increase your server load as well as your hosting bill.
   * Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
   * side errors will fail.
   */
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  /*
   * Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
   * See the following for more information:
   * https://docs.sentry.io/product/crons/
   * https://vercel.com/docs/cron-jobs
   */
  automaticVercelMonitors: true,
};

export const withSentry = async (
  sourceConfig: ObservabilityNextConfig
): Promise<ObservabilityNextConfig> => {
  const { withSentryConfig } = await import("@sentry/nextjs");
  const existingTranspilePackages = sourceConfig.transpilePackages ?? [];
  const configWithTranspile = {
    ...sourceConfig,
    transpilePackages: Array.from(new Set([...existingTranspilePackages, "@sentry/nextjs"])),
  };

  return withSentryConfig(configWithTranspile, sentryConfig);
};

const hasBetterStackEndpoint = Boolean(
  observabilityEnv.NEXT_PUBLIC_BETTER_STACK_CUSTOM_ENDPOINT ||
  observabilityEnv.NEXT_PUBLIC_BETTER_STACK_INGESTING_URL ||
  observabilityEnv.BETTER_STACK_INGESTING_URL ||
  observabilityEnv.BETTER_STACK_INGEST_ENDPOINT ||
  observabilityEnv.NEXT_PUBLIC_LOGTAIL_URL ||
  observabilityEnv.LOGTAIL_URL
);

const hasBetterStackToken = Boolean(
  observabilityEnv.NEXT_PUBLIC_BETTER_STACK_CUSTOM_ENDPOINT ||
  observabilityEnv.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN ||
  observabilityEnv.BETTER_STACK_SOURCE_TOKEN ||
  observabilityEnv.NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN ||
  observabilityEnv.LOGTAIL_SOURCE_TOKEN
);

export const withLogging = (config: ObservabilityNextConfig): ObservabilityNextConfig =>
  hasBetterStackEndpoint && hasBetterStackToken ? withBetterStack(config) : config;
