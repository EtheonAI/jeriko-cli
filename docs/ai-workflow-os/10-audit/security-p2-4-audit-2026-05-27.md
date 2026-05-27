# P2.4 Security Package Audit

Date: 2026-05-27

Package: `@repo/security`

Status: completed before P2.4 security cleanup

## Current Package Surface

Files audited:

- `packages/security/package.json`
- `packages/security/index.ts`
- `packages/security/middleware.ts`
- `packages/security/keys.ts`
- `packages/security/tsconfig.json`
- `apps/app/app/(authenticated)/layout.tsx`
- `apps/web/proxy.ts`
- `apps/web/package.json`

Active exports before cleanup:

- `@repo/security`
- `@repo/security/keys`
- `@repo/security/middleware`

Active consumers:

- `apps/app/env.ts` extends `@repo/security/keys`.
- `apps/app/app/(authenticated)/layout.tsx` calls `secure()`.
- `apps/web/env.ts` extends `@repo/security/keys`.
- `apps/web/proxy.ts` consumes `secure()` and Nosecone middleware/options.
- `@repo/next-config` externalizes Arcjet/Nosecone provider packages for server resolution.

## Findings

### Keep

- Arcjet runtime protection helper.
- Nosecone middleware/options.
- Optional `ARCJET_KEY` env contract.
- CSP disabled by default until app-specific providers/assets are finalized.

### Refactor

- `apps/web/package.json` declares a direct `@arcjet/next` dependency even though only `@repo/security` imports Arcjet. Remove the app dependency to restore provider ownership.
- Add package-local tests for no-key and development skip behavior.

### Delete

- No security package source deletion in P2.4.

### Defer

- CSP design for the future app/workflow sandbox UI.
- Route-specific security policies for API, auth, workflow, and tool endpoints.
- Rate-limit package merge/split decision.
- Arcjet AI security rules for prompt injection, PII, and AI token/cost budget protection.

## Validation Before Cleanup

Commands:

```bash
npm view @arcjet/next version dist-tags --json
npm view @nosecone/next version dist-tags --json
pnpm outdated --filter @repo/security --format json
pnpm --filter @repo/security typecheck
rg "@repo/security|secure\\(|securityMiddleware|noseconeOptions|ARCJET_KEY|@arcjet/next|@nosecone/next" apps packages
rg "@arcjet/next|@nosecone/next" package.json apps packages
```

Results:

- `@arcjet/next` stable latest: `1.4.0`.
- `@nosecone/next` stable latest: `1.4.0`.
- `pnpm outdated --filter @repo/security --format json` returned `{}`.
- `@repo/security` typecheck passed before cleanup.
- Direct active provider imports are package-owned, but `apps/web` still had an unused direct `@arcjet/next` dependency.

## Cleanup Checklist

- [x] Update package playbook and MADR before code changes.
- [x] Remove unused `@arcjet/next` dependency from `apps/web`.
- [x] Add package-local security tests under `packages/security/tests`.
- [x] Add `@repo/security` test script/config.
- [x] Include `@repo/security` in root Vitest projects.
- [x] Run `@repo/security` typecheck.
- [x] Run `@repo/security` tests.
- [x] Run affected app/web typechecks as practical.
- [x] Run root tests.
- [x] Confirm provider SDK imports/deps are package-owned.

## Validation After Cleanup

Commands:

```bash
pnpm --filter @repo/security typecheck
pnpm --filter @repo/security test
pnpm --filter app typecheck
pnpm --filter web typecheck
pnpm test
rg "@arcjet/next|@nosecone/next" package.json apps packages --glob '!**/node_modules/**'
```

Results:

- `@repo/security` typecheck passed.
- `@repo/security` tests passed: 1 file / 2 tests.
- `apps/app` typecheck passed.
- root `pnpm test` passed: 15 files / 52 tests.
- `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues outside P2.4.
- Active provider imports/dependencies are package-owned by `@repo/security`; `@repo/next-config` still lists provider packages for server externalization.
