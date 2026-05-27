/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ── No circular dependencies ──
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies lead to hard-to-debug issues",
      from: {},
      to: { circular: true },
    },

    // ── Services cannot import from apps ──
    {
      name: "no-service-to-app",
      severity: "error",
      comment: "Services must not depend on app code",
      from: { path: "^services/" },
      to: { path: "^apps/" },
    },

    // ── Packages cannot import from apps ──
    {
      name: "no-package-to-app",
      severity: "error",
      comment: "Shared packages must not depend on app code",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },

    // ── Packages cannot import from services ──
    {
      name: "no-package-to-service",
      severity: "error",
      comment: "Shared packages must not depend on service code",
      from: { path: "^packages/" },
      to: { path: "^services/" },
    },

    // ── Flow language contracts stay provider and app neutral ──
    {
      name: "no-flow-to-app-or-runtime-sdk",
      severity: "error",
      comment:
        "@repo/flow owns source/parser/compiler/runtime contracts only; apps and provider SDKs belong behind adjacent packages.",
      from: { path: "^packages/flow/" },
      to: {
        path: [
          "^apps/",
          "node_modules/@vercel/sandbox",
          "node_modules/@vercel/workflow",
          "node_modules/workflow",
          "node_modules/e2b",
          "node_modules/@e2b/",
          "node_modules/ai",
          "node_modules/@ai-sdk/",
          "node_modules/better-auth",
          "node_modules/drizzle-orm",
          "node_modules/stripe",
          "node_modules/resend",
          "node_modules/typesense",
        ],
      },
    },

    // ── Sandbox providers are owned by @repo/sandbox ──
    {
      name: "no-direct-sandbox-provider-outside-sandbox",
      severity: "error",
      comment:
        "Vercel Sandbox/E2B SDK imports must be isolated behind @repo/sandbox, never app-local or unrelated package-local.",
      from: {
        path: ["^apps/", "^packages/(?!sandbox/)"],
      },
      to: {
        path: ["node_modules/@vercel/sandbox", "node_modules/e2b", "node_modules/@e2b/"],
      },
    },

    // ── Connector providers are owned by @repo/connectors ──
    {
      name: "no-direct-composio-provider-outside-connectors",
      severity: "error",
      comment:
        "Composio SDK imports must be isolated behind @repo/connectors; apps and unrelated packages consume @repo/connectors instead.",
      from: {
        path: ["^apps/", "^packages/(?!connectors/)"],
      },
      to: {
        path: ["node_modules/@composio/", "node_modules/composio-core"],
      },
    },

    // ── Services cannot import from other services ──
    {
      name: "no-cross-service",
      severity: "warn",
      comment: "Services should communicate via APIs, not direct imports",
      from: { path: "^services/([^/]+)/" },
      to: {
        path: "^services/([^/]+)/",
        pathNot: "^services/$1/",
      },
    },

    // ── Apps should not import from other apps ──
    {
      name: "no-cross-app",
      severity: "error",
      comment: "Apps must not import from other apps",
      from: { path: "^apps/([^/]+)/" },
      to: {
        path: "^apps/([^/]+)/",
        pathNot: "^apps/$1/",
      },
    },

    // ── No orphan modules (files not imported anywhere) ──
    {
      name: "no-orphans",
      severity: "info",
      comment: "Detect unused modules",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)\\.[^/]+", // dot files
          "\\.d\\.ts$", // type declarations
          "(^|/)tsconfig\\.json$",
          "(^|/)vitest\\.config",
          "(^|/)next\\.config",
          "(^|/)tailwind\\.config",
          "(^|/)postcss\\.config",
          "^apps/.*/app/", // Next.js file-based routing
          "^apps/.*/e2e/", // E2E tests
          "^k6/", // Load tests
          "\\.test\\.", // Test files
          "\\.spec\\.", // Spec files
          "\\.stories\\.", // Storybook stories
          "(^|/)tests/(support|fixtures)/", // Test-only support files
          "seed", // Seed files
        ],
      },
      to: {},
    },

    // ── No dev dependencies in production code ──
    {
      name: "no-dev-dep-in-prod",
      severity: "error",
      comment: "Don't import devDependencies in production code",
      from: {
        pathNot: [
          "\\.test\\.",
          "\\.spec\\.",
          "\\.stories\\.",
          "(^|/)test/",
          "(^|/)tests/(support|fixtures)/",
          "(^|/)__tests__/",
          "(^|/)e2e/",
          "vitest\\.config",
        ],
      },
      to: { dependencyTypes: ["npm-dev"] },
    },
  ],

  options: {
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: [
        "node_modules",
        "\\.next",
        "dist",
        "coverage",
        "\\.turbo",
        "\\.git",
        "storybook-static",
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/(@[^/]+/[^/]+|[^/]+)",
      },
      text: {
        highlightFocused: true,
      },
    },
  },
};
