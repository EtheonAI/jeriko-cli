# MADR-082: Keep TypeScript Config As Strict Shared Baseline

Status: Accepted

Date: 2026-05-27

## Context

`@repo/typescript-config` is a foundation package consumed by nearly every active app and package. Broad compiler option changes can create workspace-wide failures that do not belong to a single package phase.

Current package configs:

- `base.json`
- `nextjs.json`
- `react-library.json`
- `service.json`
- `reset.d.ts`
- package `tsconfig.json`

The active workspace has no consumer of `service.json`.

## Decision

Keep `@repo/typescript-config` as the strict shared baseline and make only one cleanup change in P1.1:

- remove the unused legacy `service.json` preset.

Do not change shared strictness, module settings, library targets, declaration behavior, or path aliases in this phase.

Future work may evaluate:

- explicit package `exports` for JSON presets;
- moving `@/*` and `@repo/*` path aliases out of the shared Next preset;
- adding server-library/browser-library presets;
- TypeScript project references after package APIs are stable.

## Evidence

- TypeScript TSConfig docs define config inheritance and compiler options as TSConfig concerns.
- TypeScript project reference docs recommend centralized common compiler options for larger workspaces and solution references only when the project graph is intentionally modeled.
- TypeScript module resolution docs distinguish `Bundler` from `NodeNext`; this repo currently uses both in appropriate presets.
- TypeScript `noEmit` docs support using TypeScript as checker while SWC/bundlers emit runtime code.
- TypeScript `strict` docs warn future TypeScript versions may add stricter checks under `strict`, so broad strictness changes should be deliberate.
- Registry checks on 2026-05-27 show `typescript@6.0.3` and `@total-typescript/ts-reset@0.6.1`, matching the active package.
- Local active-consumer search found no `service.json` consumer outside docs.

## Consequences

Positive:

- removes stale service-era config from the active package;
- avoids broad config churn;
- preserves passing package typecheck behavior;
- creates a clear future decision list for config hardening.

Negative:

- leaves current broad Next preset aliases for a later phase;
- does not introduce project references or compiled package output yet.

## Impacted Files

- `packages/typescript-config/service.json`
- `docs/ai-workflow-os/08-plans/package-playbooks/typescript-config.md`
- `docs/ai-workflow-os/10-audit/typescript-config-p1-1-audit-2026-05-27.md`

## Validation Checklist

- [x] Official docs checked.
- [x] Registry metadata checked.
- [x] Active consumers searched.
- [x] Package playbook updated.
- [x] Remove `service.json`.
- [x] `@repo/typescript-config` typecheck passes.
- [x] Active package typecheck not required because behavior did not change for active consumers.
