# P2.6 Observability Package Audit

Date: 2026-05-27

Package: `@repo/observability`

Status: completed after P2.6 observability cleanup

## Current Package Surface

Files audited:

- `packages/observability/package.json`
- `packages/observability/client.ts`
- `packages/observability/server.ts`
- `packages/observability/edge.ts`
- `packages/observability/instrumentation.ts`
- `packages/observability/error.ts`
- `packages/observability/log.ts`
- `packages/observability/next-config.ts`
- `packages/observability/keys.ts`
- `packages/observability/status/index.tsx`
- `apps/app/instrumentation.ts`
- `apps/web/instrumentation.ts`
- `apps/app/app/global-error.tsx`
- `apps/web/app/[locale]/global-error.tsx`
- `apps/app/next.config.ts`
- `apps/web/next.config.ts`
- `apps/web/package.json`

Active exports before cleanup:

- `@repo/observability`
- `@repo/observability/client`
- `@repo/observability/server`
- `@repo/observability/edge`
- `@repo/observability/error`
- `@repo/observability/instrumentation`
- `@repo/observability/keys`
- `@repo/observability/log`
- `@repo/observability/next-config`
- `@repo/observability/status`

Active consumers:

- `apps/app` uses `@repo/observability` for env keys, Next config wrappers, Sentry instrumentation files, and app/global error capture.
- `apps/web` uses `@repo/observability` for env keys, Next config wrappers, Sentry instrumentation files, proxy error parsing, footer status, and contact action error parsing.

## Findings

### Keep

- `@repo/observability` as the provider owner for Sentry and Better Stack/Logtail.
- Separate client/server/edge Sentry initialization files.
- Package-owned Next config wrappers for Sentry and Better Stack/Logtail.
- App-owned error UI files that call package-owned capture helpers.
- Optional env keys so local/package builds work without provider credentials.

### Refactor

- `apps/web/app/[locale]/global-error.tsx` imports `captureException` directly from `@sentry/nextjs`; this violates the package provider boundary and differs from `apps/app`.
- `apps/web/package.json` declares direct `@sentry/nextjs`, `import-in-the-middle`, and `require-in-the-middle` dependencies even though active app source should go through `@repo/observability`.
- `packages/observability/package.json` declares a root `.` export pointing to `./index.ts`, but `packages/observability/index.ts` is missing.
- `packages/observability/instrumentation.ts` exports only `register` support; current Sentry and Next.js docs support `onRequestError` for server/request error capture.
- `packages/observability/next-config.ts` imports `withLogtail`; current Better Stack docs use `withBetterStack`.

### Delete

- Remove direct app-level Sentry/Sentry-support dependencies from `apps/web` when no active source imports them.

### Defer

- Sentry `onRouterTransitionStart` support from `instrumentation-client.ts`.
- Better Stack `withBetterStack` route-handler wrappers.
- Web vitals forwarding.
- Production trace/replay/log sampling policy.
- OpenTelemetry/span propagation across workflow runs, AI tasks, sandbox executions, and connector actions.
- Status page product UX and uptime monitor modeling.

## Validation Before Cleanup

Commands:

```bash
npm view @sentry/nextjs version dist-tags peerDependencies engines --json
npm view @logtail/next version dist-tags peerDependencies engines --json
pnpm outdated --filter @repo/observability --format json
pnpm --filter @repo/observability typecheck
rg "@repo/observability|@sentry/nextjs|@logtail/next|captureException|withSentry|withLogging" apps packages
pnpm why import-in-the-middle
pnpm why require-in-the-middle
```

Results:

- `@sentry/nextjs` stable latest: `10.54.0`.
- `@logtail/next` stable latest: `0.3.1`.
- `pnpm outdated --filter @repo/observability --format json` returned `{}`.
- `@repo/observability` typecheck passed before cleanup.
- Direct app Sentry import exists only in `apps/web/app/[locale]/global-error.tsx`.
- Direct app Sentry dependency exists only in `apps/web/package.json`.
- Direct app `import-in-the-middle` and `require-in-the-middle` entries exist only in `apps/web/package.json`.

## Cleanup Checklist

- [x] Update package playbook and MADR before code changes.
- [x] Add the missing `packages/observability/index.ts` root export file.
- [x] Export `onRequestError` from `@repo/observability/instrumentation`.
- [x] Re-export `onRequestError` from app instrumentation convention files.
- [x] Move `apps/web` global error capture import to `@repo/observability/error`.
- [x] Remove direct unused Sentry/Sentry-support dependencies from `apps/web`.
- [x] Prefer `withBetterStack` in package Next config wrapper.
- [x] Add package-local tests for import safety, capture behavior, and request-error forwarding.
- [x] Add observability tests to the root Vitest projects.
- [x] Run `@repo/observability` typecheck.
- [x] Run `@repo/observability` tests.
- [x] Run affected app/web typechecks as practical.
- [x] Run root tests.

## Validation After Cleanup

Commands:

```bash
pnpm --filter @repo/observability typecheck
pnpm --filter @repo/observability test
pnpm --filter app typecheck
pnpm --filter web typecheck
pnpm test
rg "from [\"']@sentry/nextjs|from [\"']@logtail/next" apps packages --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**'
rg "@sentry/nextjs|import-in-the-middle|require-in-the-middle" apps/*/package.json packages/*/package.json
pnpm why import-in-the-middle
pnpm why require-in-the-middle
pnpm outdated --filter @repo/observability --format json
```

Results:

- `@repo/observability` typecheck passed.
- `@repo/observability` tests passed: 1 file / 4 tests.
- `apps/app` typecheck passed.
- root `pnpm test` passed: 17 files / 58 tests.
- `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues outside P2.6.
- Direct Sentry/Logtail source imports now exist only inside `packages/observability` and its package tests.
- Direct `@sentry/nextjs`, `import-in-the-middle`, and `require-in-the-middle` app package dependencies are removed; `pnpm why` shows the instrumentation packages only as Sentry transitive dependencies under `@repo/observability`.
- `pnpm outdated --filter @repo/observability --format json` returned `{}`.
