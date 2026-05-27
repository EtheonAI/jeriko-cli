# Observability Package Playbook

Package: `@repo/observability`

Date: 2026-05-27

Status: P2.6 boundary cleanup completed

Priority: P2 platform package

## Ownership

What this package owns:

- Sentry client/server/edge initialization;
- Sentry request-error forwarding from Next.js instrumentation;
- Sentry Next config wrapper;
- Better Stack/Logtail config wrapper;
- observability env keys;
- shared error capture and parse helpers;
- status UI export.

What this package must not own:

- app route handlers;
- app-specific error pages;
- analytics/product events;
- auth/database/payment provider behavior.
- workflow run tracing policy before the workflow runtime exists.

## Current Surface

Exports:

- `@repo/observability`
- `@repo/observability/client`
- `@repo/observability/server`
- `@repo/observability/edge`
- `@repo/observability/instrumentation`
- `@repo/observability/next-config`
- `@repo/observability/keys`
- `@repo/observability/status`

Provider SDKs:

- `@sentry/nextjs`
- `@logtail/next`

Env keys:

- Sentry org/project/DSN;
- Better Stack/Logtail tokens and endpoints.

## Sources Checked

| Source                                                                         | Type              | Checked Date | Claim Used                                                                                                                           |
| ------------------------------------------------------------------------------ | ----------------- | -----------: | ------------------------------------------------------------------------------------------------------------------------------------ |
| `https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/`      | Official docs     |   2026-05-27 | Sentry Next.js uses `withSentryConfig`, client/server/edge init files, `onRequestError`, and `global-error.tsx` capture.             |
| `https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation` | Official docs     |   2026-05-27 | Next.js instrumentation supports optional `register` and `onRequestError`.                                                           |
| `https://nextjs.org/docs/app/guides/instrumentation`                           | Official docs     |   2026-05-27 | Runtime-specific instrumentation should be conditionally imported inside `register`.                                                 |
| `https://betterstack.com/docs/logs/javascript/nextjs/`                         | Official docs     |   2026-05-27 | Current Better Stack App Router docs use `@logtail/next`, `withBetterStack`, and `NEXT_PUBLIC_BETTER_STACK_*` env.                   |
| `npm view @sentry/nextjs version dist-tags peerDependencies engines --json`    | Registry metadata |   2026-05-27 | Latest `@sentry/nextjs` is `10.54.0`, matching package.                                                                              |
| `npm view @logtail/next version dist-tags peerDependencies engines --json`     | Registry metadata |   2026-05-27 | Latest `@logtail/next` is `0.3.1`, matching package.                                                                                 |
| Local package audit                                                            | Repo evidence     |   2026-05-27 | Package uses separate client/server/edge init files and public Next config wrapper; app web still leaked direct Sentry imports/deps. |

## Local Audit

Commands:

```bash
find packages/observability -maxdepth 2 -type f
pnpm --filter @repo/observability typecheck
```

Findings:

- Provider config is package-owned and optional by env.
- Sentry traces were sampled at `1` in all environments.
- Root `.` export points to a missing `index.ts`.
- `apps/web` imports `@sentry/nextjs` directly in `global-error.tsx`.
- `apps/web` declares direct Sentry/Sentry-support deps that active source should not own.
- Package instrumentation does not yet expose `onRequestError`.
- Package Next config uses the older `withLogtail` alias instead of current Better Stack naming.

## Decision

Verdict: keep core, preserve package ownership, and complete the provider boundary.

Reason:

- Observability is a core package.
- Current Sentry docs recommend adjusting production sample rates.
- Current Sentry and Next.js docs support request-error capture through `onRequestError`.
- Apps should import package-owned observability helpers, not vendor SDKs.
- Use full tracing in development and lower production tracing to `0.1`; further sampling policy remains deferred.

## Refactor Checklist

- [x] Latest Sentry and Logtail registry metadata checked.
- [x] Sentry docs checked.
- [x] Set Sentry trace sampling to `1` in development and `0.1` outside development.
- [x] Add missing `index.ts` root export.
- [x] Add package-owned `onRequestError`.
- [x] Re-export package `onRequestError` from app instrumentation files.
- [x] Remove direct web Sentry import/deps.
- [x] Prefer `withBetterStack` in package Next config wrapper.
- [x] Add package-local tests.
- [x] Typecheck passes.
- [x] Tests pass.

## Validation

```bash
pnpm --filter @repo/observability typecheck
```

Latest validation:

- `pnpm --filter @repo/observability typecheck` passed.
- `pnpm --filter @repo/observability test` passed: 1 file / 4 tests.
- `pnpm --filter app typecheck` passed.
- root `pnpm test` passed: 17 files / 58 tests.
- `pnpm --filter web typecheck` still fails on existing contact/i18n/calendar/metadata issues outside P2.6.

## Open Risks

- Final Sentry sampling should be tuned with real production traffic and cost data.
- App error pages should remain app-owned while capture helpers stay package-owned.
- Router transition instrumentation, web vitals, route handler wrappers, and workflow trace propagation remain future work.
