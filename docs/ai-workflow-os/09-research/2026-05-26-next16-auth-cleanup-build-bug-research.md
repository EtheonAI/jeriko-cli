# Next.js 16 Auth Cleanup Build Bug Research

Date researched: 2026-05-26

Scope: `apps/app` auth route cleanup, React Compiler lint failure, T3 Env build failure, Turbopack production build stall, and Webpack/Sentry/OpenTelemetry warnings observed during R9 cleanup.

Status: resolved for the reset local build; keep monitoring Sentry/Webpack warnings

## Trigger

During R9 auth-page cleanup:

- `apps/app/components/auth/forms/*` was moved into `apps/app/app/(unauthenticated)/_components/forms/*`.
- login/forgot/reset/verify auth pages were narrowed into server page shells plus route-local client islands.
- the old animated unauthenticated background was removed from the route layout.

Validation exposed three separate issues:

1. `eslint "apps/app/app/(unauthenticated)"` failed on `Math.random()` during render in `glowing-stars.tsx`.
2. `pnpm --filter app build` failed immediately when required Better Auth env vars were missing.
3. `pnpm --filter app build` with dummy reset env loaded config but stalled during the default Turbopack optimized production build.

Webpack fallback:

- `next build --webpack` completed successfully with the same dummy reset env.
- Webpack emitted Sentry/OpenTelemetry dynamic dependency warnings.

## Source Evidence

| Source                                                                                                                 | Type                   | Finding                                                                                                                                                                        | Impact                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://react.dev/reference/rules/components-and-hooks-must-be-pure`                                                  | Official React docs    | Components and hooks must be idempotent; non-idempotent functions such as `Math.random()` should not run during render.                                                        | The lint failure was valid. Removing the old background from the reset shell was better than patching around it.                                                    |
| `https://env.t3.gg/docs/nextjs`                                                                                        | Official T3 Env docs   | T3 Env recommends validating env during build via `next.config.ts`; missing required env values fail early.                                                                    | The missing `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` build failure was correct behavior, not a Next bug. README/env docs must say these are required for app build. |
| `https://nextjs.org/docs/app/guides/upgrading/version-16`                                                              | Official Next docs     | Next 16 uses Turbopack by default and allows `--webpack` as an opt-out when needed. Docs also warn plugins can add config behavior.                                            | Default build path should remain Turbopack, but Webpack fallback is useful evidence while isolating Turbopack-specific blockers.                                    |
| `https://nextjs.org/docs/app/api-reference/turbopack`                                                                  | Official Next docs     | Turbopack has known behavior differences from Webpack, and trace files should be generated for performance/memory issues before reporting upstream.                            | Next investigation should use Turbopack tracing/debug evidence, not blind config changes.                                                                           |
| `https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack`                                            | Official Next docs     | Turbopack config is explicit; it supports loaders differently from Webpack and has different root/module-resolution behavior.                                                  | Do not add Webpack-only config to fix a Turbopack issue.                                                                                                            |
| `https://nextjs.org/docs/app/api-reference/cli/next`                                                                   | Official Next docs     | `next build` supports `--debug-build-paths`, `--debug-prerender`, `--experimental-build-mode`, and `--experimental-cpu-prof`.                                                  | Use route-scoped and compile-only diagnostics before changing bundler config.                                                                                       |
| `https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/`                                              | Official Sentry docs   | Sentry's official Next setup wraps Next config with `withSentryConfig` and supports tunnel routes/source map behavior.                                                         | Sentry config must be treated as build tooling, not only runtime code.                                                                                              |
| `https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/build/`                                       | Official Sentry docs   | Sentry has build-time options for source maps and logger behavior.                                                                                                             | Build-time Sentry options should be reviewed before changing source map/plugin behavior.                                                                            |
| `https://docs.sentry.io/platforms/javascript/configuration/options/#dsn`                                               | Official Sentry docs   | If no DSN is set, Sentry does not send data; complete environment-based disablement should be handled by conditional initialization.                                           | The reset app should keep observability installed but avoid initializing/importing Sentry unless Sentry is configured.                                              |
| `https://raw.githubusercontent.com/getsentry/sentry-javascript/develop/packages/nextjs/src/config/withSentryConfig.ts` | Official Sentry source | Sentry detects the active bundler, builds Turbopack-specific config, uses Next production compile hooks for Turbopack, and only injects Webpack config when Webpack is active. | Sentry/Turbopack support exists, but its build hooks and source map behavior are part of the investigation surface.                                                 |

## Local Evidence

### React Compiler Lint

Command:

```bash
pnpm exec eslint 'apps/app/app/(unauthenticated)'
```

Observed failure:

```text
react-hooks/purity
Math.random is an impure function. Calling an impure function can produce unstable results.
```

Root cause:

- `apps/app/app/(unauthenticated)/_components/ui/glowing-stars.tsx` called `Math.random()` while mapping JSX in render.
- React official docs explicitly call out `Math.random()` as non-idempotent during render.

Decision:

- Removed the old animated auth background from the reset shell.
- This was not a workaround. The file was old decorative UI, not required for the bare reset app, and it violated React Compiler rules.

### Env Build Failure

Command:

```bash
pnpm --filter app build
```

Observed failure:

```text
Invalid environment variables:
BETTER_AUTH_SECRET expected string, received undefined
BETTER_AUTH_URL expected string, received undefined
```

Root cause:

- `apps/app/next.config.ts` imports `@/env`.
- `apps/app/env.ts` extends `@repo/auth/keys`.
- `@repo/auth/keys` requires `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
- T3 Env validates during build/config load by design.

Decision:

- The app README must list Better Auth env vars as required for build validation.
- Do not bypass T3 Env or make auth secrets optional just to make local build pass.

### Turbopack Build Stall

Command:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/jeriko \
STRIPE_SECRET_KEY=sk_test_dummy \
BETTER_AUTH_SECRET=0123456789abcdef0123456789abcdef \
BETTER_AUTH_URL=http://localhost:3000 \
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
NEXT_PUBLIC_WEB_URL=http://localhost:3001 \
NEXT_PUBLIC_DOCS_URL=http://localhost:3004 \
pnpm --filter app build
```

Observed:

```text
▲ Next.js 16.2.6 (Turbopack)
Creating an optimized production build ...
```

The command produced no compiler error before being interrupted after an extended stall.

First status:

- Reproduced before the observability boundary cleanup.
- Not proven to be caused by the auth page refactor.
- Required isolated Turbopack tracing and import graph reduction before config changes.

Diagnostic commands used:

```bash
NEXT_TURBOPACK_TRACING=1 \
pnpm --filter app exec next build \
  --experimental-build-mode compile \
  '--debug-build-paths=app/(unauthenticated)/**/page.tsx'
```

Before the observability boundary cleanup:

- `--debug-prerender` still stalled at `Creating an optimized production build ...`, confirming the stall happened before prerendering.
- compile-only, unauthenticated-route-only Turbopack build still stalled.
- `.next/diagnostics/build-diagnostics.json` showed:

  ```json
  {
    "buildStage": "compile",
    "buildOptions": {
      "useBuildWorker": "true"
    }
  }
  ```

- The first trace was roughly 107 MB.
- `strings .next/trace-turbopack` package counts showed a large Sentry/OpenTelemetry surface, including:
  - `@sentry/core`: 7866
  - `@opentelemetry/api`: 1797
  - `@sentry/nextjs`: 1244
  - `@sentry/browser`: 810
  - `@sentry/node`: 777

Fix applied:

- Added [`MADR-051`](../07-madr/MADR-051-observability-boundary-for-reset-app.md).
- Stopped app error boundaries from importing `@sentry/nextjs` directly.
- Kept `@sentry/nextjs` owned by `@repo/observability`, not `apps/app`.
- Changed `@repo/observability/client`, `server`, `edge`, and `error` to no-op when `NEXT_PUBLIC_SENTRY_DSN` is absent and dynamically import Sentry only inside the observability boundary.
- Changed `@repo/observability/next-config` so it no longer imports `withSentryConfig` at module load.
- Removed the direct `@sentry/nextjs` dependency from `apps/app/package.json`.

After the cleanup:

- The same compile-only, route-scoped Turbopack diagnostic completed successfully in 9-10 seconds.
- The full default `pnpm --filter app build` Turbopack build completed successfully.
- The new trace still contains Sentry/OpenTelemetry dynamic chunks, which is expected while production observability remains available. The goal of this slice was not to remove observability; it was to prevent app/config top-level imports from forcing Sentry into the reset build path.

### Webpack Build Warnings

Command:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/jeriko \
STRIPE_SECRET_KEY=sk_test_dummy \
BETTER_AUTH_SECRET=0123456789abcdef0123456789abcdef \
BETTER_AUTH_URL=http://localhost:3000 \
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
NEXT_PUBLIC_WEB_URL=http://localhost:3001 \
NEXT_PUBLIC_DOCS_URL=http://localhost:3001 \
pnpm --filter app exec next build --webpack
```

Result:

- Build passed.
- Next route output was generated.
- Warnings came from Sentry/OpenTelemetry packages using dynamic dependency loading.

Important import traces:

```text
@sentry/nextjs
-> @sentry/node
-> @fastify/otel / @prisma/instrumentation
-> @opentelemetry/instrumentation
-> dynamic dependency warning
```

and:

```text
packages/design-system/lib/fonts.ts
-> packages/design-system/lib/utils.ts
-> @repo/observability/error
-> @sentry/nextjs
```

This second trace is a local architecture smell. A broad design-system utility imports observability/Sentry, so many UI imports can pull Sentry and OpenTelemetry into build graphs.

## Working Hypotheses

### H1: Broad Design-System Utility Pulls Sentry Into Too Much Of The Graph

Evidence:

- `packages/design-system/lib/utils.ts` imports `parseError` from `@repo/observability/error`.
- `@repo/observability/error` imports `@sentry/nextjs`.
- `packages/design-system/lib/fonts.ts` imports `cn` from `utils.ts`.
- `apps/app/app/global-error.tsx` imports `fonts`.
- Webpack trace shows this path reaches Sentry/OpenTelemetry.

Likely fix direction:

- Split `cn` into a pure UI-only utility with no observability import.
- Move `handleError` to a separate client/app utility or observability-aware module.
- Keep design-system primitives free of Sentry, auth, database, env validation, and product observability.

Implemented during this slice:

- `rg` confirmed `handleError()` had no call sites.
- `packages/design-system/lib/utils.ts` now exports only pure UI helpers and no longer imports `@repo/observability/error` or `sonner`.
- This removes the broad `design-system -> observability -> @sentry/nextjs` import path for `cn()` and `fonts`.

### H2: Turbopack Stall Is Related To Sentry/OpenTelemetry Import Boundaries

Evidence:

- Webpack passes but warns on Sentry/OpenTelemetry dynamic dependency loading.
- Turbopack stalls before reporting a compiler error.
- Sentry's official source includes Turbopack-specific build hook/source map behavior.

Counter-evidence:

- `withSentryConfig` only wraps app config when `env.VERCEL` is truthy in `apps/app/next.config.ts`.
- The local dummy Turbopack build did not set `VERCEL=true`, so Sentry's config wrapper was probably not active.
- Sentry can still enter the graph through direct imports and the design-system utility path.

Status:

- Supported by the fix, but not claimed as a Next/Turbopack upstream bug.
- The stall cleared after Sentry imports were moved behind `@repo/observability` and app-level direct imports were removed.
- Sentry/OpenTelemetry still appear in traces as dynamically compiled chunks; remaining Webpack warnings are expected provider/library warnings, not a failing build condition.

### H3: Turbopack Stall Is A General Next 16/Turbopack Issue In This Monorepo

Evidence:

- Next 16 Turbopack differs from Webpack in root/module-resolution/build behavior.
- This repo transpiles many workspace packages.
- `packages/next-config` comments already mention Turbopack and pnpm strict hoisting pressure.

Status:

- Possible, but less specific than H1/H2 until tracing is gathered.

## Completed Investigation

Completed without switching the default bundler to Webpack:

1. Ran Turbopack build diagnostics with official Next CLI flags.
2. Confirmed the stall reproduced before observability import-boundary cleanup.
3. Split the design-system utility import smell by removing the unused `handleError()` export and observability dependency from `packages/design-system/lib/utils.ts`.
4. Moved direct app-level Sentry imports behind `@repo/observability`.
5. Re-ran:

   ```bash
   pnpm --filter app typecheck
   pnpm exec eslint 'apps/app/app/(unauthenticated)'
   pnpm test:smoke
   pnpm --filter app build
   pnpm --filter app exec next build --webpack
   git diff --check
   ```

Next follow-up:

- Do not create an upstream Next/Turbopack issue for this slice, because the default Turbopack build now passes after local import-boundary cleanup.
- Continue tracking Sentry/OpenTelemetry Webpack warnings as observability-package technical debt, not as a blocker for the reset app.

## Current Validation State

Passing:

- `pnpm --filter @repo/observability typecheck`
- `pnpm --filter app typecheck`
- targeted `pnpm exec eslint packages/observability apps/app/next.config.ts apps/app/instrumentation-client.ts apps/app/sentry.server.config.ts apps/app/sentry.edge.config.ts apps/app/app/error.tsx apps/app/app/global-error.tsx 'apps/app/app/(authenticated)/error.tsx'`
- `pnpm test:smoke`
- traced compile-only Turbopack diagnostic with `--experimental-build-mode compile` and `--debug-build-paths`
- `pnpm --filter app build` with reset dummy env, Next `16.2.6`, and default Turbopack
- `pnpm --filter app exec next build --webpack` with reset dummy env
- `git diff --check`

Not passing / not complete:

- `pnpm --filter app build` without env fails correctly because required auth env vars are missing.
- Webpack still emits Sentry/OpenTelemetry dynamic dependency warnings. The build passes, and the warnings are now routed through `@repo/observability` instead of direct app imports.

## Rule Added

For build/lint bugs:

- Research official docs and current package/source behavior before changing config.
- Document the root cause if known.
- If the cause is not proven, state it as a hypothesis and design an isolation test.
- Do not call a Webpack fallback a fix for a Turbopack problem.
