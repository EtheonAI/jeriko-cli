import withBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com https://us-assets.i.posthog.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com https://*.sentry.io wss: ws:",
      "frame-src 'self' https://*.e2b.dev https://*.e2b.dev:* https://*.e2b.app https://*.e2b.app:* data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

export const config: NextConfig = {
  // React Compiler for automatic memoization (React 19+)
  reactCompiler: true,

  // Turbopack exposes source maps by default — disable for security
  productionBrowserSourceMaps: false,

  // Auto-transform barrel imports to direct imports at build time.
  // Prevent Turbopack hash mismatches in pnpm monorepo (GitHub #87737)
  serverExternalPackages: [
    "@node-rs/argon2",
    "@node-rs/bcrypt",
    "sharp",
  ],

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "lodash-es",
      "@radix-ui/react-icons",
      "react-icons",
    ],
  },

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
    remotePatterns: [],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
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
