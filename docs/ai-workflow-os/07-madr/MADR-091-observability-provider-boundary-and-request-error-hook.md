# MADR-091: Observability Provider Boundary And Request Error Hook

Date: 2026-05-27

Status: accepted

Package: `@repo/observability`

## Context

`@repo/observability` already owns Sentry and Better Stack/Logtail integration for the active apps. The apps use package subpaths for Next config wrappers, env keys, Sentry initialization, and most error capture.

The current audit found several boundary defects:

- `apps/web` still imports `captureException` directly from `@sentry/nextjs` in `global-error.tsx`.
- `apps/web` still declares direct Sentry and Sentry support dependencies.
- `@repo/observability` declares a root export that points to a missing `index.ts`.
- App instrumentation files do not re-export an `onRequestError` hook even though current Next.js and Sentry docs support this for server/request error capture.
- The package uses the older `withLogtail` alias even though current Better Stack docs use `withBetterStack`.

## Decision

Keep `@repo/observability` as the provider owner.

Refactor the boundary:

- add the missing root `index.ts` package export;
- add package-owned `onRequestError` forwarding to Sentry;
- re-export that hook from app instrumentation files;
- move web global error capture through `@repo/observability/error`;
- remove direct app Sentry/Sentry-support dependencies that have no active app source imports;
- use the current Better Stack `withBetterStack` name in package code;
- add package-local tests and include them in root Vitest.

## Consequences

Positive:

- Apps stop importing Sentry internals directly.
- The package export map becomes truthful.
- Server/request error capture aligns with current Sentry and Next.js docs.
- The active package gets regression tests.

Negative:

- Deeper observability features remain future work.
- `apps/web` typecheck is still expected to fail on unrelated contact/i18n/calendar/metadata issues.

## References

- `docs/ai-workflow-os/09-research/2026-05-27-p2-6-observability-sentry-logtail-research.md`
- `docs/ai-workflow-os/10-audit/observability-p2-6-audit-2026-05-27.md`
- https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
- https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation
- https://betterstack.com/docs/logs/javascript/nextjs/

## Checklist

- [x] Package playbook updated.
- [x] Missing root export file added.
- [x] `onRequestError` exported from package instrumentation.
- [x] App instrumentation files re-export package `onRequestError`.
- [x] Web global error uses `@repo/observability/error`.
- [x] Direct unused web Sentry dependencies removed.
- [x] Better Stack wrapper uses current `withBetterStack` naming.
- [x] Package tests added.
- [x] Observability typecheck passes.
- [x] Observability tests pass.
- [x] Root tests pass.

## Validation Notes

- `pnpm --filter @repo/observability typecheck` passed.
- `pnpm --filter @repo/observability test` passed: 1 file / 4 tests.
- `pnpm --filter app typecheck` passed.
- `pnpm test` passed: 17 files / 58 tests.
- `pnpm --filter web typecheck` remains blocked by existing contact/i18n/calendar/metadata issues outside P2.6.
