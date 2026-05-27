# Sandbox Package Playbook

Package: `@repo/sandbox`

Date: 2026-05-26

Status: Vercel adapter implemented behind provider-neutral package boundary

Priority: P2 core platform package

## Ownership

What this package owns:

- provider-neutral sandbox contracts;
- command/file/session interfaces;
- Vercel Sandbox adapter;
- mock/local test adapter;
- sandbox validation schemas.

What this package must not own:

- `.flow` parsing or execution planning;
- app route handlers;
- UI rendering;
- database persistence;
- provider-specific secrets outside its env contract;
- direct old E2B service behavior.

## Current Surface

Exports:

- `@repo/sandbox`
- `@repo/sandbox/contracts`
- `@repo/sandbox/keys`
- `@repo/sandbox/mock`
- `@repo/sandbox/vercel`

Provider SDKs:

- `@vercel/sandbox`, isolated inside `@repo/sandbox/vercel`.

Intentional decision:

- Apps, `@repo/flow`, and unrelated packages must not import `@vercel/sandbox` directly.
- `@repo/sandbox` exposes provider-neutral contracts from the root package and provider-specific implementation through `@repo/sandbox/vercel`.
- The mock adapter exists for unit tests and future workflow executor tests that must not create real microVMs.

## Sources Checked

| Source                                                                                                          | Type                  | Checked Date | Claim Used                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------- | --------------------- | -----------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://vercel.com/docs/vercel-sandbox`                                                                        | Official docs         |   2026-05-26 | Vercel Sandbox safely runs untrusted/user-generated code in ephemeral Linux VMs.                                                                                     |
| `https://vercel.com/docs/vercel-sandbox/sdk-reference`                                                          | Official SDK docs     |   2026-05-26 | SDK provides `Sandbox.create`, `Sandbox.get`, `runCommand`, `writeFiles`, `readFileToBuffer`, `domain`, `stop`, OIDC auth, ports, env, timeouts, and network policy. |
| `https://vercel.com/docs/llms-full.txt`                                                                         | Official llms-full    |   2026-05-26 | Confirms sandbox auth, runtimes, timeout/resource limits, ports, and pricing/limits notes.                                                                           |
| `https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md`                               | Official project docs |   2026-05-26 | Provider SDK imports can be blocked outside the owning package with forbidden dependency rules.                                                                      |
| `pnpm view @vercel/sandbox version engines peerDependencies dependencies --registry https://registry.npmjs.org` | Registry metadata     |   2026-05-26 | Latest `@vercel/sandbox` is `2.0.0`; no peer dependency conflict surfaced.                                                                                           |
| `packages/sandbox/node_modules/@vercel/sandbox/dist/*.d.ts`                                                     | Installed SDK types   |   2026-05-26 | Current SDK type shape uses `Sandbox.get({ name })`, `writeFiles`, `readFileToBuffer`, and `domain(port)`.                                                           |
| Local legacy sandbox audit docs                                                                                 | Repo evidence         |   2026-05-26 | Old E2B/service code remains legacy reference only.                                                                                                                  |

## Decision

Verdict: create and keep.

Reason:

- AI Workflow OS needs untrusted code execution.
- Vercel Sandbox is the target provider, but provider SDK details should stay behind `@repo/sandbox`.
- `@repo/flow` should plan sandbox tasks without importing Vercel provider code.
- Real sandbox auth should use Vercel OIDC when available, with optional token/team/project env for local/external contexts.

## Refactor Checklist

- [x] Create package scaffold.
- [x] Add provider-neutral contracts.
- [x] Pass package typecheck.
- [x] Add env contract after Vercel Sandbox implementation research.
- [x] Add Vercel adapter under `@repo/sandbox/vercel`.
- [x] Add mock adapter for tests under `@repo/sandbox/mock`.
- [x] Add package tests.
- [x] Add dependency-cruiser rule preventing apps and unrelated packages from importing sandbox provider SDKs directly.
- [ ] Add old E2B delete/migration checklist after the AI package phase, where remaining E2B UI/hooks actually live.

## Validation

```bash
pnpm --filter @repo/sandbox typecheck
pnpm --filter @repo/sandbox test
pnpm --filter "./packages/*" typecheck
pnpm test
pnpm --filter app --filter web typecheck
pnpm boundaries:cruise
```

Latest validation:

- `pnpm --filter @repo/sandbox typecheck` passed.
- `pnpm --filter @repo/sandbox test` passed: 2 files, 6 tests.
- `pnpm --filter "./packages/*" typecheck` passed across active packages.
- `pnpm test` passed: 4 files, 16 tests, now including `@repo/sandbox`.
- `pnpm --filter app --filter web typecheck` passed.
- `pnpm boundaries:cruise` passed with 0 errors and 0 warnings.
- `pnpm outdated -r` with `npm_config_registry=https://registry.npmjs.org` returned no outdated dependency output.

## Open Risks

- Real Vercel Sandbox integration tests require Vercel auth and should be opt-in, not part of default local/root tests.
- Browser automation dependencies may require snapshots and should not be mixed into the base package contract.
- Persistent workspace/file sync needs a separate artifact/storage design.
- The old E2B UI/hook names still live mostly in `@repo/ai`; they should be handled during the AI package phase, not hidden inside this package.
