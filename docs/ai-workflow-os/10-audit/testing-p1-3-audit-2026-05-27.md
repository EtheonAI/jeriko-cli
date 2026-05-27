# Testing Package P1.3 Audit

Date: 2026-05-27

Package: `@repo/testing`

Scope:

- shared testing package;
- active exports and consumers;
- stale fixtures/helpers;
- registry/docs validation.

Out of scope:

- rewriting app tests;
- adding Playwright;
- fixing `apps/web` typecheck failures;
- adding workflow-domain factories before workflow schema stabilizes.

## Current Surface

Exports:

- `.`
- `./setup`
- `./factories`
- `./db`
- `./db/seed`
- `./helpers/trpc-caller`
- `./msw`
- `./msw/browser`

Current active consumers:

- none outside docs and package self-comments.

Command evidence:

```bash
rg '@repo/testing' -n --glob '!legacy/**' .
```

## Findings

### P1.3-1: Public Exports Are Mostly Stale Domain Helpers

The package exports old session/message/agent/device/file/connector factories, database mock helpers, tRPC caller helpers, and MSW handlers.

These reflect the old Manus/chat/service app more than the reset app and `.flow` platform.

Decision:

- delete stale public exports;
- keep only shared Vitest config helpers.

### P1.3-2: No Active Consumers

No active app/package imports `@repo/testing`.

Decision:

- breaking the stale public API is acceptable because there are no active consumers;
- future tests should introduce package-local helpers first, then promote genuinely shared helpers later.

### P1.3-3: Dependencies Can Be Trimmed

After deleting factories and MSW handlers, `@faker-js/faker`, `msw`, `react`, and `react-dom` are no longer needed by this package.

Decision:

- remove stale dependencies from `packages/testing/package.json`;
- keep Vitest/Vite/plugin-react only for shared test config helpers.

## Checklist

- [x] Official Vitest docs checked.
- [x] Official MSW docs checked.
- [x] Faker docs checked.
- [x] Latest registry metadata checked.
- [x] Current exports listed.
- [x] Active consumers searched.
- [x] Keep/refactor/delete verdict written.
- [x] MADR-084 created.
- [x] Package playbook updated.
- [x] Remove stale fixtures/helpers/MSW/trpc/db exports.
- [x] Trim stale dependencies.
- [x] Run `@repo/testing` typecheck.
- [x] Run root tests.

## Validation Commands

```bash
pnpm --filter @repo/testing typecheck
pnpm test
```

Pre-change package typecheck passed:

```bash
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs --filter @repo/testing typecheck
```

Post-change package typecheck passed with the same command.

Dependency sync required after trimming package dependencies:

```bash
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs install
```

Result:

- lockfile already up to date after lockfile-only update;
- node_modules updated: `+17 -39`;
- husky prepare passed.

Root tests:

```bash
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs test
```

Result:

- 13 test files passed;
- 45 tests passed.
