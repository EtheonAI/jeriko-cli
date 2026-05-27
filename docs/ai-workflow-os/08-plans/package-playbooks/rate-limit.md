# Rate Limit Package Playbook

Package: `@repo/rate-limit`

Phase: P2.5

Planned MADR: MADR-090

Status: active P2.5 package cleanup

## Ownership

Owns:

- reusable rate-limit helpers;
- Upstash Redis/rate-limit provider boundary;
- package-local rate-limit env validation.

Must not own:

- full security header policy;
- auth session policy;
- app route implementations.

## Current Surface To Audit

Exports:

- `.`
- `./keys`

Current provider SDKs:

- `@upstash/ratelimit`
- `@upstash/redis`

## Sources Checked

| Source                                                          | Type              | Checked Date | Claim Used                                                                                           |
| --------------------------------------------------------------- | ----------------- | -----------: | ---------------------------------------------------------------------------------------------------- |
| `https://upstash.com/docs/oss/sdks/ts/ratelimit/gettingstarted` | Official docs     |   2026-05-27 | Upstash Ratelimit uses configured Redis clients or env helpers and supports sliding windows.         |
| `https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms`   | Official docs     |   2026-05-27 | Fixed window, sliding window, and token bucket are supported algorithms.                             |
| `https://upstash.com/docs/redis/sdks/ratelimit-ts/methods`      | Official docs     |   2026-05-27 | `limit()` returns success/failure metadata and optional pending analytics.                           |
| `npm view @upstash/ratelimit version dist-tags --json`          | Registry metadata |   2026-05-27 | Stable latest is `2.0.8`, matching the package.                                                      |
| `npm view @upstash/redis version dist-tags --json`              | Registry metadata |   2026-05-27 | Stable latest is `1.38.0`, matching the package.                                                     |
| Local package audit                                             | Repo evidence     |   2026-05-27 | Web contact form is the only active root consumer; Redis construction is eager despite optional env. |

## Phase Checklist

- [x] Check Upstash rate-limit and Redis docs plus npm latest.
- [x] Audit consumers and decide standalone package vs merge into `@repo/security`.
- [x] Confirm optional env behavior and failure mode.
- [x] Write MADR-090 before code changes if ownership changes.
- [x] Mark provider entrypoint server-only.
- [x] Make Upstash Redis client lazy.
- [x] Add package-local tests.
- [x] Run `pnpm --filter @repo/rate-limit typecheck`.
- [x] Run `pnpm --filter @repo/rate-limit test`.
- [ ] Validate affected auth/app routes if rate limiting is wired.

## Validation

Latest validation:

- `pnpm --filter @repo/rate-limit typecheck` passed.
- `pnpm --filter @repo/rate-limit test` passed: 1 file / 2 tests.
- root `pnpm test` passed: 16 files / 54 tests.
- `pnpm --filter web typecheck` still fails on existing contact/i18n/calendar/metadata issues outside P2.5.

## Initial Verdict

Keep standalone for now. The package has one active web contact consumer today, but workflow/tool/auth rate limits will need a shared provider boundary and route-specific policies. Do not merge into `@repo/security` until those policies are designed.
