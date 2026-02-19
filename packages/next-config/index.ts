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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com https://us-assets.i.posthog.com https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https:",
      "font-src 'self' data:",
      "connect-src 'self' http://localhost:* https://*.e2b.app https://us.i.posthog.com https://us-assets.i.posthog.com https://*.sentry.io wss: ws:",
      "frame-src 'self' https://*.e2b.dev https://*.e2b.dev:* https://*.e2b.app https://*.e2b.app:* data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
];

export const config: NextConfig = {
  // React Compiler for automatic memoization (React 19+)
  reactCompiler: true,

  // Turbopack exposes source maps by default — disable for security
  productionBrowserSourceMaps: false,

  // Externalize server-only packages so Node.js resolves them natively.
  // Required for pnpm strict hoisting — Turbopack can't resolve transitive
  // deps of transpiled workspace packages from the app root.
  serverExternalPackages: [
    "@node-rs/argon2",
    "@node-rs/bcrypt",
    "sharp",
    // NOTE: better-auth is NOT here — it has /react hooks used in SSR of client
    // components. Resolution is handled by public-hoist-pattern in .npmrc instead.
    // @repo/database
    "drizzle-orm",
    "@neondatabase/serverless",
    // @repo/observability
    "@logtail/next",
    // @repo/analytics
    "posthog-node",
    // @repo/notifications
    "@knocklabs/node",
    // @repo/collaboration
    "@liveblocks/node",
    // @repo/security
    "@arcjet/next",
    "@nosecone/next",
    // @repo/webhooks
    "svix",
  ],

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "lodash-es",
      "@radix-ui/react-icons",
      "react-icons",
      "motion",
      "react-markdown",
      "shiki",
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
  ],

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes EXCEPT auth API
        // (Better-Auth sets large Set-Cookie headers that, combined with CSP,
        // exceed Chrome's response header size limit → ERR_RESPONSE_HEADERS_TOO_BIG)
        source: "/((?!api/auth).*)",
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
