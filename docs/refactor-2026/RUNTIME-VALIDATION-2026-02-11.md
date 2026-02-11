# RUNTIME-VALIDATION-2026-02-11.md

## Scope
Validation of app/services runtime and test gates toward Manus-style migration readiness.

## Infrastructure
- `pnpm services:up` -> postgres + redis up
- app server stabilized in `tmux` session `app-dev` on `:3000`

## Monorepo Gate Results
### Typecheck
`pnpm turbo run typecheck --continue` -> **FAIL**
Failing packages include:
- `@repo/ai`
- `@repo/contracts`
- `@repo/database`
- `@repo/feature-flags`
- `@repo/rate-limit`
- `@repo/testing`
- `@repo/typescript-config`
- `api`
- `app`
- `email`
- `storybook`
- `studio`
- `web`

### Test
`pnpm turbo run test --continue` -> **FAIL**
Failing packages include:
- `@repo/service-utils`
- `api`
- `app` (bundle-size test precondition issue)

## Runtime / E2E Checks
### Auth suite
`e2e/features/auth.spec.ts` -> mixed results
- After server stabilization, connectivity issues were resolved.
- Remaining failure: strict locator ambiguity in "login page renders correctly" test.

### Chat full-flow suite
`e2e/features/chat-full-flow.spec.ts` -> **FAIL** during unstable server period (net::ERR_ABORTED/CONNECTION_REFUSED).

### Chat suite
`e2e/features/chat.spec.ts` -> **FAIL** during unstable server period (CONNECTION_REFUSED).

## Conclusion
System is **not** yet green for controlled legacy-service deletion.

## Required Before Deletion
1. Resolve monorepo typecheck failures.
2. Resolve monorepo test failures.
3. Re-run E2E runtime suite on stable app process and capture green evidence.
