# P2.5 Rate Limit Package Research

Date: 2026-05-27

Package: `@repo/rate-limit`

Status: completed before P2.5 rate-limit cleanup

## Sources Checked

| Source                                                        | Type                 | Evidence Used                                                                                                                       |
| ------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| https://upstash.com/docs/oss/sdks/ts/ratelimit/gettingstarted | Official docs        | Upstash Ratelimit uses `Ratelimit` with `Redis.fromEnv()` or a configured Redis client and supports `slidingWindow`.                |
| https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms   | Official docs        | Upstash Ratelimit supports fixed window, sliding window, and token bucket algorithms; algorithm choice is route/workload dependent. |
| https://upstash.com/docs/redis/sdks/ratelimit-ts/methods      | Official docs        | `limit()` returns success/failure metadata and supports pending analytics work.                                                     |
| https://upstash.com/blog/dynamic-rate-limits                  | Upstash blog         | Dynamic limits are available in latest `@upstash/ratelimit`, useful later for plan/workflow limits but not required in cleanup.     |
| `npm view @upstash/ratelimit version dist-tags --json`        | Registry             | Stable latest is `2.0.8`.                                                                                                           |
| `npm view @upstash/redis version dist-tags --json`            | Registry             | Stable latest is `1.38.0`.                                                                                                          |
| `pnpm outdated --filter @repo/rate-limit --format json`       | Registry/local proof | No outdated direct dependencies reported for `@repo/rate-limit`.                                                                    |

## Version Verdict

- Keep `@upstash/ratelimit@2.0.8`.
- Keep `@upstash/redis@1.38.0`.
- Do not merge `@repo/rate-limit` into `@repo/security` yet; keep it standalone while workflow/app-specific rate policies are still unsettled.

## Implementation Guidance

- `@repo/rate-limit` owns Upstash provider imports and rate-limit helper construction.
- The root provider entrypoint should be server-only because it can use secret Redis REST credentials.
- Do not construct Redis at module import time. Env is optional, and consumers may import the helper while deciding whether to enable rate limiting.
- Throw a clear error only when a limiter is constructed without required credentials.
- Export algorithms intentionally; `slidingWindow` is active now, while `fixedWindow` and `tokenBucket` are useful for later route/workflow-specific policies.
