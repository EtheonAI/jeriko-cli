# P2.6 Observability Package Research

Date: 2026-05-27

Package: `@repo/observability`

Status: completed before P2.6 observability cleanup

## Sources Checked

| Source                                                                       | Type                 | Evidence Used                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/      | Official docs        | Sentry's current Next.js setup wraps `next.config` with `withSentryConfig`, creates client/server/edge initialization files, exports `onRequestError = Sentry.captureRequestError` from `instrumentation.ts`, and captures render errors from `app/global-error.tsx`. |
| https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/     | Official docs        | Sentry initialization options belong in the provider-owned setup files; sampling, logs, replay, and privacy options should be centralized.                                                                                                                            |
| https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation | Official docs        | Next.js `instrumentation.ts` supports `register` and optional `onRequestError`; async work in `onRequestError` must be awaited, and the hook receives error/request/context.                                                                                          |
| https://nextjs.org/docs/app/guides/instrumentation                           | Official docs        | Runtime-specific instrumentation should be conditionally imported from inside `register` using `process.env.NEXT_RUNTIME`.                                                                                                                                            |
| https://nextjs.org/docs/app/getting-started/error-handling                   | Official docs        | `global-error.tsx` is a Client Component and must define its own `<html>` and `<body>` tags.                                                                                                                                                                          |
| https://betterstack.com/docs/logs/javascript/nextjs/                         | Official docs        | Current Better Stack Next.js docs use `@logtail/next`, `withBetterStack`, `NEXT_PUBLIC_BETTER_STACK_*` env, and App Router-compatible logging/error patterns.                                                                                                         |
| `npm view @sentry/nextjs version dist-tags peerDependencies engines --json`  | Registry             | Stable latest is `10.54.0`; peer range includes `next@^16.0.0-0`; Node engine is `>=18`.                                                                                                                                                                              |
| `npm view @logtail/next version dist-tags peerDependencies engines --json`   | Registry             | Stable latest is `0.3.1`; peer range is `next >=15` and `react >=18`; Node engine is `>=18`.                                                                                                                                                                          |
| `pnpm outdated --filter @repo/observability --format json`                   | Registry/local proof | No outdated direct dependencies reported for `@repo/observability`.                                                                                                                                                                                                   |

## Version Verdict

- Keep `@sentry/nextjs@10.54.0`.
- Keep `@logtail/next@0.3.1`.
- No package version upgrade is required in P2.6.

## Implementation Guidance

- `@repo/observability` owns direct Sentry and Better Stack/Logtail SDK imports.
- Apps may keep Next.js convention files such as `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `global-error.tsx`, and `error.tsx`, but those files should import through `@repo/observability`.
- App package manifests should not declare Sentry or Sentry support packages directly unless app source imports those packages directly.
- Keep runtime-specific Sentry initialization behind conditional dynamic imports inside the package instrumentation entrypoint.
- Export `onRequestError` from `@repo/observability/instrumentation` so apps can re-export it from their Next.js instrumentation convention files without importing `@sentry/nextjs`.
- Prefer the current Better Stack `withBetterStack` name in package code; `withLogtail` is still an alias, but the latest docs use Better Stack naming.
- Defer deeper observability product work, including route handler wrappers, web vitals, Sentry router-transition instrumentation, production sampling policy, and trace propagation, until after the package boundary is clean.
