import { withToolbar } from "@repo/feature-flags/next-config";
import { config } from "@repo/next-config";
import { withLogging, withSentry } from "@repo/observability/next-config";
import type { NextConfig } from "next";
import { env } from "@/env";

const nextConfig = async (): Promise<NextConfig> => {
  let resolvedConfig: NextConfig = withToolbar(withLogging(config));

  if (env.VERCEL) {
    resolvedConfig = await withSentry(resolvedConfig);
  }

  return resolvedConfig;
};

export default nextConfig;
