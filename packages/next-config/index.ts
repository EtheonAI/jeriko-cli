import withBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

export const config: NextConfig = {
  // React Compiler for automatic memoization (React 19+)
  // Automatically memoizes components, reducing unnecessary re-renders
  reactCompiler: true,

  // Transpile workspace packages and ai package for proper resolution
  transpilePackages: [
    "@repo/ai",
    "@repo/design-system",
    "@repo/auth",
    "@repo/database",
    "@repo/observability",
    "@repo/analytics",
    "@repo/feature-flags",
    "@repo/notifications",
    "@repo/collaboration",
    "@repo/security",
    "@repo/seo",
    "@repo/webhooks",
    "ai",
    "@ai-sdk/openai",
    "@ai-sdk/anthropic",
    "@ai-sdk/google",
  ],

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },

  // biome-ignore lint/suspicious/useAwait: rewrites is async
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://us.i.posthog.com/decide",
      },
    ];
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export const withAnalyzer = (sourceConfig: NextConfig): NextConfig =>
  withBundleAnalyzer()(sourceConfig);
