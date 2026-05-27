# TypeScript Config P1.1 Audit

Date: 2026-05-27

Package: `@repo/typescript-config`

Scope:

- shared TSConfig package;
- current config files;
- active consumers;
- package registry/doc evidence.

Out of scope:

- changing all package compiler options;
- introducing TypeScript project references;
- app `tsconfig.json` alias redesign;
- root lint cleanup.

## Current Files

- `packages/typescript-config/base.json`
- `packages/typescript-config/nextjs.json`
- `packages/typescript-config/react-library.json`
- `packages/typescript-config/service.json`
- `packages/typescript-config/reset.d.ts`
- `packages/typescript-config/tsconfig.json`
- `packages/typescript-config/package.json`

## Current Consumers

Active `extends` consumers:

- many apps/packages consume `@repo/typescript-config/nextjs.json`;
- `@repo/ai`, `@repo/connectors`, `@repo/flow`, `@repo/rate-limit`, `@repo/sandbox`, and `@repo/storage` consume `base.json`;
- no active consumer uses `service.json`.

Command evidence:

```bash
rg 'typescript-config/(base|nextjs|react-library|service)|@repo/typescript-config' -n --glob 'package.json' --glob 'tsconfig*.json' --glob '!legacy/**' .
rg 'service.json' -n --glob '!legacy/**' .
```

## Findings

### P1.1-1: `service.json` Is A Legacy Preset With No Active Consumers

`service.json` was useful for the removed service layer, but active services were moved under `legacy/` and active package/app configs do not extend it.

Decision:

- delete `packages/typescript-config/service.json`;
- do not preserve a service preset in the active config package until a new deployable backend service package is intentionally added.

Risk:

- low for active workspace because `rg` found no active consumers.

### P1.1-2: Broad Compiler Option Changes Would Create Unrelated Churn

`base.json` and `nextjs.json` are shared by most packages/apps. Changing strictness, module settings, lib targets, or alias behavior would affect the whole repo.

Decision:

- keep broad compiler options unchanged in P1.1;
- document future questions for P1.2/P1.4 instead of changing them now.

Risk:

- lower short-term cleanup velocity, but avoids hiding package-specific errors inside a config churn phase.

## Checklist

- [x] Official TypeScript docs checked.
- [x] Turborepo internal package docs checked.
- [x] `typescript` latest registry metadata checked.
- [x] `@total-typescript/ts-reset` latest registry metadata checked.
- [x] Current config files listed.
- [x] Active consumers searched.
- [x] Env/provider ownership confirmed as none.
- [x] Keep/refactor/delete verdict written.
- [x] MADR-082 created.
- [x] Package playbook updated.
- [x] Delete unused `service.json`.
- [x] Run package typecheck after deletion.
- [x] Confirm active package typecheck is not required because no active non-doc consumer referenced `service.json`.

## Validation Commands

```bash
pnpm --filter @repo/typescript-config typecheck
pnpm --filter "./packages/*" typecheck
```

## Current Validation

Pre-change and post-change package typecheck passed:

```bash
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs --filter @repo/typescript-config typecheck
```

Active non-doc reference check after deletion:

```bash
rg 'service.json' -n --glob '!legacy/**' --glob '!docs/**' .
```

Result:

- no active non-doc references found.
