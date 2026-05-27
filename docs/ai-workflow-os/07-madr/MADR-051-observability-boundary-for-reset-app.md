# MADR-051: Keep Observability Behind A Conditional Boundary

Date: 2026-05-26

Status: accepted

## Context

The reset `apps/app` build still stalls in the Next.js `16.2.6` default Turbopack compile phase. Webpack builds pass with the same environment, but emit Sentry/OpenTelemetry dynamic dependency warnings.

Official references checked before this decision:

- Next CLI docs: `next build` supports `--debug-build-paths`, `--debug-prerender`, and `--experimental-cpu-prof`; Turbopack builds should emit `build-main-*` and `build-turbopack-*` CPU profiles.
- Next Turbopack docs: Turbopack is the default in Next 16 and exposes tracing for diagnosis.
- Sentry Next.js manual setup docs: Sentry's App Router setup uses `withSentryConfig`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and `global-error.tsx`.
- Sentry options docs: setting no DSN means events are not sent; to disable Sentry completely by environment, initialize Sentry conditionally.

Local evidence:

- A traced compile-only Turbopack build with `--debug-build-paths='app/(unauthenticated)/**/page.tsx'` still stalled at compile.
- `.next/diagnostics/build-diagnostics.json` reported `buildStage: compile` and `useBuildWorker: true`.
- `.next/trace-turbopack` was generated and was roughly 107 MB.
- Extracted trace strings showed Sentry/OpenTelemetry dominating the non-Next package surface:
  - `@sentry/core`: 7866 hits
  - `@opentelemetry/api`: 1797 hits
  - `@sentry/nextjs`: 1244 hits
  - `@sentry/browser`: 810 hits
  - `@sentry/node`: 777 hits
- `apps/app/next.config.ts` imported `withSentry` from `@repo/observability/next-config`, and that module statically imported `@sentry/nextjs` even when local `env.VERCEL` was false.
- Client error boundaries imported `captureException` directly from `@sentry/nextjs`.
- `apps/app/instrumentation-client.ts` imported `@repo/observability/client`, whose top-level module statically imported `@sentry/nextjs`.

## Decision

Keep observability as a platform package, but make `@repo/observability` the only application-facing Sentry boundary.

Rules:

- App code must not import `@sentry/nextjs` directly.
- `@repo/observability/next-config` must not statically import Sentry at module load. `withSentryConfig` is loaded only when the app explicitly enables the Sentry build wrapper.
- Runtime Sentry init and error capture must no-op when `NEXT_PUBLIC_SENTRY_DSN` is not configured.
- Sentry remains available for production/Vercel once DSN and Sentry build env vars are present.

## Consequences

Positive:

- Reset/local builds no longer pay the full Sentry/OpenTelemetry import cost just because the package exists.
- App error UI stays decoupled from the concrete observability provider.
- The production observability path remains intact and easier to replace later if the platform changes providers.

Tradeoffs:

- Sentry initialization/capture wrappers become async because the provider is dynamically imported.
- If future code needs Sentry-specific APIs such as `captureRequestError` or server action instrumentation, those APIs must be exposed intentionally from `@repo/observability` instead of imported directly in route code.

## Validation Checklist

- [x] Refactor `@repo/observability` to avoid static Sentry imports on generic module load.
- [x] Replace direct `@sentry/nextjs` imports in `apps/app` error boundaries with `@repo/observability/error`.
- [x] Run `pnpm --filter @repo/observability typecheck`.
- [x] Run `pnpm --filter app typecheck`.
- [x] Run targeted ESLint for touched app and package files.
- [x] Run `pnpm test:smoke`.
- [x] Re-run traced default Turbopack build and compare trace package surface.
- [x] Re-run Webpack build as fallback evidence.
- [x] Update the bug research note with results.
