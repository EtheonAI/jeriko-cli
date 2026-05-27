# TypeScript Config Package Playbook

Package: `@repo/typescript-config`

Date: 2026-05-27

Status: P1.1 active; documented cleanup approved by MADR-082

Priority: P1 foundation package

## Ownership

What this package owns:

- shared TypeScript compiler option presets;
- Next.js app/package preset;
- React library preset;
- repo-wide `ts-reset` ambient import.

What this package must not own:

- app-specific path aliases beyond generic app/package defaults;
- runtime code;
- provider SDK behavior;
- package-specific type exceptions;
- legacy service presets for removed services.

## Current Surface

Public config surface:

- `base.json`
- `nextjs.json`
- `react-library.json`
- `reset.d.ts`
- package `tsconfig.json`

Legacy surface scheduled for deletion:

- `service.json`

Consumers:

- `nextjs.json`: active apps and most React/Next-adjacent packages.
- `base.json`: `@repo/ai`, `@repo/connectors`, `@repo/flow`, `@repo/rate-limit`, `@repo/sandbox`, `@repo/storage`.
- `react-library.json`: no active consumer found in the P1.1 search.
- `service.json`: no active consumer found in the P1.1 search.

Provider SDKs:

- none.

Env keys:

- none.

## Sources Checked

| Source                                                                 | Type              | Checked Date | Claim Used                                                                                                                               |
| ---------------------------------------------------------------------- | ----------------- | -----------: | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `https://www.typescriptlang.org/tsconfig/`                             | Official docs     |   2026-05-27 | `extends`, `include`, `exclude`, strictness, module resolution, and interop options are TSConfig-owned concerns.                         |
| `https://www.typescriptlang.org/docs/handbook/project-references.html` | Official docs     |   2026-05-27 | Centralized common compiler options and solution references are official large-workspace patterns, but references should be intentional. |
| `https://www.typescriptlang.org/tsconfig/moduleResolution.html`        | Official docs     |   2026-05-27 | `Bundler` and `NodeNext` module resolution have different runtime assumptions.                                                           |
| `https://www.typescriptlang.org/tsconfig/noEmit.html`                  | Official docs     |   2026-05-27 | `noEmit` is correct when SWC/bundlers emit runtime JavaScript.                                                                           |
| `https://www.typescriptlang.org/tsconfig/strict.html`                  | Official docs     |   2026-05-27 | `strict` is a family flag that may become stricter in future TypeScript versions.                                                        |
| `npm view typescript version peerDependencies engines`                 | Registry metadata |   2026-05-27 | Latest `typescript` is `6.0.3`, matching the workspace.                                                                                  |
| `npm view @total-typescript/ts-reset version peerDependencies engines` | Registry metadata |   2026-05-27 | Latest `@total-typescript/ts-reset` is `0.6.1`, matching the package.                                                                    |
| Local config audit                                                     | Repo evidence     |   2026-05-27 | `service.json` has no active consumers; broad compiler option changes would create unrelated churn.                                      |

## Local Audit

Commands:

```bash
rg "@repo/typescript-config" apps packages
rg 'service.json' -n --glob '!legacy/**' .
pnpm --filter @repo/typescript-config typecheck
```

Findings:

- Package is widely consumed by apps and packages.
- Latest registry metadata is current.
- `service.json` is not actively consumed.
- Package typecheck passes with the current config package.

## Decision

Verdict: keep core and delete stale service preset.

Reason:

- It is already aligned with strict TypeScript and current TypeScript version.
- No broad compiler option change is justified in this phase; changing compiler strictness/module behavior would create unrelated churn.
- `service.json` is an active-package artifact from the removed service layer and has no active consumers.

## Refactor Checklist

- [x] Public config files are intentional.
- [x] No provider SDKs.
- [x] Latest registry metadata checked.
- [x] Active consumers searched.
- [x] MADR-082 created.
- [x] Delete unused `service.json`.
- [x] Package typecheck passes after deletion.
- [x] Full active package typecheck not required because no compiler behavior changed and no active consumer referenced `service.json`.

## Validation

```bash
pnpm --filter @repo/typescript-config typecheck
pnpm --filter "./packages/*" typecheck
```

Latest validation:

- Pre-change `@repo/typescript-config` typecheck passed on 2026-05-27.
- Post-delete `@repo/typescript-config` typecheck passed on 2026-05-27.
- Active non-doc `service.json` reference check returned no matches.

## Open Risks

- Shared `nextjs.json` still contains app/package path aliases. Moving those aliases out of the shared preset should be evaluated later, not during P1.1.
- Explicit package `exports` for JSON config presets may be useful, but should be tested across TS/Next consumers before adoption.
