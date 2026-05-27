# MADR-090: Standalone Rate Limit Package With Lazy Upstash Client

Date: 2026-05-27

Status: accepted

Package: `@repo/rate-limit`

## Context

`@repo/rate-limit` currently has one active consumer: the web contact server action. It owns Upstash Redis and Upstash Ratelimit provider imports.

The package env keys are optional so the repo can build without Redis credentials. However, the root entrypoint currently constructs a Redis client at module import time using optional values. That contradicts the optional-env contract and makes imports unsafe before consumers decide whether rate limiting is enabled.

The package could eventually merge into `@repo/security`, but rate limits are workload-specific: contact forms, auth endpoints, workflow runs, tool calls, AI token budgets, and connector actions will likely have different policies.

## Decision

Keep `@repo/rate-limit` standalone for now.

Refactor provider construction:

- make the Upstash Redis client lazy;
- throw only when creating a limiter without required credentials;
- mark the root provider entrypoint `server-only`;
- add tests for missing credentials and lazy construction.

## Consequences

Positive:

- Imports are safe without Redis env.
- Provider ownership remains package-local.
- Future workflow/app route policies can build on a clean package.

Negative:

- Package remains separate from security for now.
- Route-specific policies and dynamic limits remain future work.

## References

- `docs/ai-workflow-os/09-research/2026-05-27-p2-5-rate-limit-upstash-research.md`
- `docs/ai-workflow-os/10-audit/rate-limit-p2-5-audit-2026-05-27.md`
- https://upstash.com/docs/oss/sdks/ts/ratelimit/gettingstarted
- https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms
- https://upstash.com/docs/redis/sdks/ratelimit-ts/methods

## Checklist

- [x] Package playbook updated.
- [x] Root entrypoint marked server-only.
- [x] Redis client is lazy.
- [x] Missing env fails at limiter creation, not import.
- [x] Package tests added.
- [x] Rate-limit typecheck passes.
- [x] Rate-limit tests pass.
- [x] Root tests pass.

## Validation Notes

- `@repo/rate-limit` typecheck and tests passed.
- root `pnpm test` passed with 16 files / 54 tests.
- `apps/web` typecheck remains blocked by existing contact/i18n/calendar/metadata issues outside P2.5.
