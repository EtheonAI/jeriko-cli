# P2.5 Rate Limit Package Audit

Date: 2026-05-27

Package: `@repo/rate-limit`

Status: completed before P2.5 rate-limit cleanup

## Current Package Surface

Files audited:

- `packages/rate-limit/package.json`
- `packages/rate-limit/index.ts`
- `packages/rate-limit/keys.ts`
- `packages/rate-limit/tsconfig.json`
- `apps/web/app/[locale]/contact/actions/contact.tsx`
- `apps/web/env.ts`

Active exports before cleanup:

- `@repo/rate-limit`
- `@repo/rate-limit/keys`

Active consumers:

- `apps/web/env.ts` extends rate-limit keys.
- `apps/web` contact server action imports `createRateLimiter` and `slidingWindow`.

## Findings

### Keep

- Standalone `@repo/rate-limit` package for now.
- Upstash Redis and Upstash Ratelimit provider boundary.
- Optional env keys so builds work without Redis.
- Web contact form use case.

### Refactor

- Current `index.ts` creates `new Redis(...)` at module import time even though env keys are optional. This is fragile and can fail or create invalid clients before consumers decide whether rate limiting is enabled.
- Root provider entrypoint should be `server-only`.
- Add package-local tests for missing credentials and lazy construction.

### Delete

- No package deletion in P2.5.

### Defer

- Merge/split with `@repo/security` after actual route/API/workflow rate-limit policies are designed.
- Dynamic rate limits by plan/org/workflow.
- Upstash analytics/flushing policy.
- Route-handler/proxy-level rate-limit integration.

## Validation Before Cleanup

Commands:

```bash
npm view @upstash/ratelimit version dist-tags --json
npm view @upstash/redis version dist-tags --json
pnpm outdated --filter @repo/rate-limit --format json
pnpm --filter @repo/rate-limit typecheck
rg "@repo/rate-limit|createRateLimiter|slidingWindow|fixedWindow|tokenBucket|UPSTASH_REDIS" apps packages
```

Results:

- `@upstash/ratelimit` stable latest: `2.0.8`.
- `@upstash/redis` stable latest: `1.38.0`.
- `pnpm outdated --filter @repo/rate-limit --format json` returned `{}`.
- `@repo/rate-limit` typecheck passed before cleanup.
- Only active root consumer is the web contact server action.

## Cleanup Checklist

- [x] Update package playbook and MADR before code changes.
- [x] Add `server-only` dependency/import.
- [x] Make Redis client construction lazy.
- [x] Throw clear missing-env errors on limiter creation.
- [x] Add package-local tests.
- [x] Add test script/config and include in root Vitest projects.
- [x] Run `@repo/rate-limit` typecheck.
- [x] Run `@repo/rate-limit` tests.
- [x] Run affected web typecheck as practical.
- [x] Run root tests.

## Validation After Cleanup

Commands:

```bash
pnpm --filter @repo/rate-limit typecheck
pnpm --filter @repo/rate-limit test
pnpm --filter web typecheck
pnpm test
rg "@repo/rate-limit|createRateLimiter|slidingWindow|fixedWindow|tokenBucket|UPSTASH_REDIS" apps packages
```

Results:

- `@repo/rate-limit` typecheck passed.
- `@repo/rate-limit` tests passed: 1 file / 2 tests.
- root `pnpm test` passed: 16 files / 54 tests.
- `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues outside P2.5.
- Active consumer remains the web contact server action.
