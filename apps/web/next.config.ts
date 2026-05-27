import { withToolbar } from "@repo/feature-flags/next-config";
import createNextIntlPlugin from "@repo/internationalization/plugin";
import { withCMS } from "@repo/cms/next-config";
import { config } from "@repo/next-config";
import { withLogging, withSentry } from "@repo/observability/next-config";
import type { NextConfig } from "next";
import { env } from "@/env";

const withNextIntl = createNextIntlPlugin();

const nextConfig = async (): Promise<NextConfig> => {
  let resolvedConfig: NextConfig = withToolbar(withLogging(config));

  const redirects: NextConfig["redirects"] = async () => [
    {
      source: "/legal",
      destination: "/legal/privacy",
      statusCode: 301,
    },
  ];

  resolvedConfig.redirects = redirects;

  if (env.VERCEL) {
    resolvedConfig = await withSentry(resolvedConfig);
  }

  return withCMS(withNextIntl(resolvedConfig));
};

export default nextConfig;
