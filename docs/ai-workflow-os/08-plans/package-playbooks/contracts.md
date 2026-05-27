# Package Playbook: @repo/contracts

Package: `@repo/contracts`

Date: 2026-05-26

Status: retired by MADR-067

Priority: deleted package; historical playbook retained for audit trail

## Ownership

What this package owned before retirement:

- Runtime/API contract schemas.
- Zod validation for stream events, tool inputs, messages, and sandbox request/response contracts.
- Format adapters for wire protocols that are explicitly kept for compatibility.

What this package must not own:

- Provider SDK clients.
- Runtime execution logic.
- App UI state.
- E2B/Vercel implementation details beyond provider-neutral contract fields.

## Current Surface

Exports:

- `@repo/contracts`
- `@repo/contracts/sandbox`

Consumers:

- None outside its own tests at retirement time.

Provider SDKs:

- None.

Env keys:

- None.

## Sources Checked

| Source                                                                           | Type               | Checked Date | Claim Used                                                                                                          |
| -------------------------------------------------------------------------------- | ------------------ | -----------: | ------------------------------------------------------------------------------------------------------------------- |
| https://zod.dev/packages/zod                                                     | Official docs      |   2026-05-26 | Zod 4 is the current stable package for application schemas.                                                        |
| https://zod.dev/api                                                              | Official docs      |   2026-05-26 | Use schema definitions plus `parse`/`safeParse`; discriminated unions fit event contracts.                          |
| https://zod.dev/library-authors                                                  | Official docs      |   2026-05-26 | Zod 3 is functionally end-of-life; new library work should target Zod 4.                                            |
| https://vercel.com/docs/vercel-sandbox                                           | Official docs      |   2026-05-26 | Vercel Sandbox runs untrusted/user-generated code in Firecracker microVMs and should be integrated through the SDK. |
| https://vercel.com/docs/llms-full.txt                                            | llms-full          |   2026-05-26 | Vercel docs source for current Sandbox, monorepo, and platform guidance.                                            |
| `pnpm view zod version`                                                          | Registry metadata  |   2026-05-26 | Latest `zod` is `4.4.3`; installed package matches.                                                                 |
| `pnpm view vitest version`                                                       | Registry metadata  |   2026-05-26 | Latest `vitest` is `4.1.7`; installed package matches.                                                              |
| `pnpm view @vercel/sandbox version`                                              | Registry metadata  |   2026-05-26 | Latest `@vercel/sandbox` is `2.0.0`; provider SDK belongs in `@repo/sandbox`, not contracts.                        |
| `packages/contracts/**` local audit                                              | Local source/types |   2026-05-26 | Sandbox contracts still had E2B/Neko-specific field names and README wording.                                       |
| https://turborepo.dev/docs/crafting-your-repository/creating-an-internal-package | Official docs      |   2026-05-26 | Internal packages should have one purpose; a central unrelated contract bucket is the wrong shape.                  |

## Local Audit

Commands:

```bash
find packages/contracts -maxdepth 3 -type f | sort
rg -n "e2b|E2B|neko|vnc|sandboxId|hostname|template" packages/contracts apps packages --glob '!node_modules/**' --glob '!legacy/**'
pnpm --filter @repo/contracts typecheck
pnpm --filter @repo/contracts test
```

Findings:

- `packages/contracts/src/sandbox/schemas.ts` used `e2bSandboxId`, `vncUrl`, E2B comments, `/home/user` path assumptions, and E2B example data.
- `packages/contracts/src/schemas/events.ts` exposed `neko_ready` and `nekoUrl`.
- README listed Neko/E2B era event names as active contracts.
- The package has no provider SDK dependency, which is correct.

## Decision

Verdict: delete and rehome owned contracts

Reason:

- The package had no active consumers outside its own tests.
- It mixed unrelated domains: AI stream events, tool schemas, messages, sandbox schemas, and adapters.
- Package-local contracts are still required, but ownership belongs in `@repo/flow`, `@repo/sandbox`, `@repo/ai`, future `@repo/connectors`, or future `@repo/artifacts`.
- MADR-067 supersedes the earlier keep/refactor direction.

## Refactor Checklist

- [x] Replace E2B-specific sandbox response fields with provider-neutral fields.
- [x] Replace `neko_ready` / `nekoUrl` with provider-neutral stream readiness fields.
- [x] Keep no provider SDK imports.
- [x] Update tests to match the new contract names.
- [x] Update README contract inventory.
- [x] Run package typecheck.
- [x] Run package tests.
- [x] Run dependency graph validation.
- [x] Re-audit external consumers.
- [x] Delete `packages/contracts`.
- [x] Remove root `test` filter.
- [x] Remove deleted contracts project from root Vitest config.
- [x] Refresh lockfile.
- [x] Re-run package/app/graph validation after deletion.

## Validation

```bash
pnpm --filter @repo/contracts typecheck
pnpm --filter @repo/contracts test
pnpm boundaries:cruise
```

Result:

- `pnpm --filter @repo/contracts typecheck` passed.
- `pnpm --filter @repo/contracts test` passed: 6 files, 118 tests.
- `pnpm boundaries:cruise` passed with 0 errors and 0 warnings.
- `pnpm --filter app --filter web typecheck` passed after the contract change.
- Deletion validation passed:
  - `pnpm install`
  - `pnpm --filter "./packages/*" typecheck`
  - `pnpm test`
  - `pnpm --filter app --filter web typecheck`
  - `pnpm boundaries:cruise`

## Open Risks

- Legacy AI canvas code still contains E2B/Neko naming and must be handled in the AI/app phase rather than by reviving a central contracts package.
- Database migration history still contains old column names; future schema migration should add provider-neutral columns instead of rewriting migration history.
