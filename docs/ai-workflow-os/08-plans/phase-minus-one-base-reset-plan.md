# Phase -1 Base Reset Plan

Date: 2026-05-23

Purpose: clean the repo into a reliable fresh project base before workflow kernel, redesign, or major feature coding.

## Verdict

Yes, the codebase should be cleaned first.

The missing phase is a mandatory "Phase -1 Base Reset" before Phase 0A security hardening and before the `.flow` kernel. The current repo is salvageable, but it is too broad, too stale in places, and too dependency-drifted to treat as a clean foundation.

Do not interpret this as "delete everything and start over." The right move is a controlled base reset:

```text
inventory
-> classify keep/archive/delete
-> freeze target workspace
-> normalize package versions
-> remove stale CI/deploy/server references
-> make baseline typecheck/build/test meaningful
-> then start security hardening and workflow kernel
```

Update 2026-05-24: the legacy Manus-style `services/*` tree and `packages/service-utils` are now removed from the active pnpm/Turbo workspace and moved to `legacy/manus-clone`. They remain on disk only as reference until app-facing proxy routes are replaced or deleted. See [`../07-madr/MADR-033-deactivate-legacy-services-from-active-workspace.md`](../07-madr/MADR-033-deactivate-legacy-services-from-active-workspace.md).

Update 2026-05-24: the redundant standalone `apps/api` app was moved to `legacy/deactivated-apps/api`, and old root service compose files were moved to `legacy/manus-clone/docker`. Active Docker is now infrastructure-only through `docker-compose.infra.yml`. See [`../07-madr/MADR-034-deactivate-redundant-api-app-and-legacy-compose.md`](../07-madr/MADR-034-deactivate-redundant-api-app-and-legacy-compose.md).

Update 2026-05-25: the earlier `tools/*` move for docs, email preview, Storybook, and Drizzle Studio is now superseded by [`../07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md`](../07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md). The current tree may still contain `tools/docs`, `tools/email`, `tools/storybook`, and `tools/studio` as an intermediate cleanup state, but the target is to restore runnable app surfaces under `apps/*` with explicit ownership, env, build, and deploy/dev status.

## Current Evidence

Local inventory found:

- 2 active app packages currently under `apps/*`: `apps/app`, `apps/web`.
- 4 runnable app surfaces currently in an intermediate `tools/*` location: `tools/docs`, `tools/email`, `tools/storybook`, `tools/studio`.
- 1 deactivated app package: `legacy/deactivated-apps/api`.
- 24 active workspace packages under `packages`.
- 16 legacy service package files moved to `legacy/manus-clone/services`.
- 15 service Dockerfiles.
- stale `services/agent` residue with only Python bytecode discovered locally and no tracked source files.
- CI/deploy references to `services/agent` and `jeriko-agent-*`.
- E2B template package files outside the pnpm workspace under `e2b-templates`.

Official Next.js upgrade docs checked on 2026-05-23:

- `https://nextjs.org/docs/app/getting-started/upgrading`
- `https://nextjs.org/docs/app/guides/upgrading/version-16`
- `https://nextjs.org/blog/next-16-2`

Important Next guidance:

- current Next projects can use `pnpm next upgrade`;
- manual upgrade path is `next@latest`, `react@latest`, `react-dom@latest`, and `eslint-config-next@latest`;
- Next 16 requires Node.js `20.9.0+` and TypeScript `5.1.0+`;
- Turbopack is default in Next 16;
- the codemod can migrate config, lint, `middleware` to `proxy`, stabilized API names, and PPR config.

The repo already meets Node `>=20.9.0`, but dependency alignment is not clean.

## Registry Snapshot

`pnpm outdated -r` was run on 2026-05-23. Key target versions reported:

| Package                    |             Current examples |      Latest reported | Notes                                                                                                                  |
| -------------------------- | ---------------------------: | -------------------: | ---------------------------------------------------------------------------------------------------------------------- |
| `next`                     | `16.1.5`, `16.0.0`, `15.5.4` |             `16.2.6` | Mixed versions across apps/packages; later normalized.                                                                 |
| `@next/bundle-analyzer`    |    stale/invalid reset entry |              removed | Next 16 apps now use `next experimental-analyze`; the old package path is Webpack-only unless explicitly reintroduced. |
| `@next/eslint-plugin-next` |                     `16.1.6` |             `16.2.6` | Root dev dependency.                                                                                                   |
| `react`                    |                     `19.2.3` |             `19.2.6` | Must update with `react-dom`.                                                                                          |
| `react-dom`                |                     `19.2.3` |             `19.2.6` | Must update with `react`.                                                                                              |
| `@types/react`             |       `19.2.13` and `19.1.5` |            `19.2.14` | Mixed type versions.                                                                                                   |
| `@types/react-dom`         |        `19.2.3` and `19.1.5` | not fully normalized | Align with React type package.                                                                                         |
| `ai`                       |                     `6.0.77` |            `6.0.191` | Root override initially pinned an old patch; later removed and normalized.                                             |
| `@ai-sdk/react`            |                     `3.0.29` |            `3.0.193` | App and `@repo/ai`; later normalized.                                                                                  |
| `drizzle-orm`              | `0.38.4`, `0.44.2`, `0.45.1` |             `0.45.2` | Root override currently hides drift.                                                                                   |
| `drizzle-kit`              |                     `0.30.6` |            `0.31.10` | Database package.                                                                                                      |
| `zod`                      |      `3.x`, `4.1.x`, `4.3.6` |              `4.4.3` | Mixed major versions; later normalized to latest.                                                                      |
| `@e2b/code-interpreter`    |                      `1.5.1` |              `2.4.2` | Do not invest further unless maintaining compatibility adapter.                                                        |

The registry snapshot proved the repo needed dependency normalization, not random latest upgrades. Post-upgrade verification normalized active Next packages to `16.2.6`, React packages to `19.2.6`, AI SDK packages to current checked registry releases, Drizzle to `0.45.2`, Drizzle Kit to `0.31.10`, Zod to `4.4.3`, and React Email to the supported `react-email@6.3.2` package.

2026-05-25 latest check: [`../09-research/2026-05-25-latest-package-registry-check.md`](../09-research/2026-05-25-latest-package-registry-check.md) records the current package evidence. Active direct workspace dependencies were updated with `pnpm update --latest -r --config.prefer-offline=false`. The repo now keeps `next@16.2.6`, `react@19.2.6`, `react-dom@19.2.6`, `turbo@2.9.14`, `typescript@6.0.3`, `eslint@10.4.0`, `vitest@4.1.7`, `@t3-oss/env-nextjs@0.13.10`, `mint@4.2.3`, `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `zod@4.4.3`, `ai@6.0.191`, and `@ai-sdk/react@3.0.193`. `pnpm outdated -r --format json` reports documented metadata conflicts for `@t3-oss/env-nextjs` and `mint`; exact public npm resolution for the reported latest versions fails for those package names. Production build and lint are still not green; see [`../10-audit/package-upgrade-validation-audit-2026-05-25.md`](../10-audit/package-upgrade-validation-audit-2026-05-25.md).

## Base Reset Goals

Phase -1 should produce:

- a smaller, intentional workspace
- a known primary app
- a known service set
- package versions normalized by dependency family
- stale agent references removed
- generated/cache artifacts ignored or deleted safely
- CI that starts what it tests
- build/typecheck/test commands that represent the real base
- documented keep/archive/delete decisions

## Reset Surface Decisions Added 2026-05-23

Reference: [`../10-audit/reset-upgrade-surface-audit-2026-05-23.md`](../10-audit/reset-upgrade-surface-audit-2026-05-23.md)
Additional deletion-first reference: [`../10-audit/deletion-first-cleanup-audit-2026-05-23.md`](../10-audit/deletion-first-cleanup-audit-2026-05-23.md)
External structure reference: [`../09-research/2026-05-23-prediction-market-architecture-reference.md`](../09-research/2026-05-23-prediction-market-architecture-reference.md)

Do not reset blindly. Preserve useful primitives and change their product center.

- [ ] Keep the resizable side canvas pattern, but refactor it into a workflow run workbench.
- [ ] Extract the richer library preview modal renderer into an artifact renderer.
- [ ] Replace the thin canvas file preview that only handles image/raw text.
- [ ] Keep sandbox shell/browser/file semantics, but move them behind a provider-neutral adapter before Vercel Sandbox migration.
- [ ] Keep search, but fix message search ownership before enabling workflow-wide search.
- [ ] Keep dynamic connector tools, but replace broad model exposure with `.flow`-compiled tool subsets.
- [ ] Add workflow-native artifact, approval, event, issue, run, and version tables instead of overloading chat/session tables.
- [ ] Keep `web`, docs, email preview, Storybook, and studio as app surfaces with explicit ownership; gate only stale Manus-specific website/device/webrtc/knowledge service surfaces.
- [ ] Treat `services/orchestrator` as a source of patterns to split, not as the final workflow runtime.
- [ ] Do not use the root `clean` script as a reset mechanism without explicit destructive-command approval.

## Deletion-First Findings Added 2026-05-23

The first cleanup branch should remove obvious residue before package upgrades:

- [x] Delete or move `docs/home_ubuntu_full` after approval because it is untracked and contains `.env` plus `.secrets/sandbox_api_token`.
- [x] Delete or archive `docs/.manus` after useful source material is summarized into `docs/ai-workflow-os`.
- [x] Archive/summarize then delete `docs/manus-architecture-docs`; it is 919M of old Manus reference material.
- [x] Delete untracked `services/agent` Python bytecode after approval.
- [x] Remove root `test:agent` and update `test:all`.
- [x] Remove `services/agent` CI/deploy/contract-gate references unless the Python service is intentionally restored.
- [x] Gate legacy services out of the active workspace entirely; root `dev:services` and `dev:services:all` were removed.
- [x] Gate root `dev` to the primary app; full workspace dev startup is now explicit as `dev:all`.
- [x] Gate legacy services before further app reset work.
- [x] Add active package ownership index before moving or deleting more package code.
- [ ] Add dead-code tooling after scope is reduced, likely Knip or equivalent.
- [x] Remove generated cache/build output while preserving source and installed dependencies.
- [x] Remove generated E2B template `node_modules`/build output.
- [x] Remove checked-in E2B desktop/template payload from the active repo while keeping temporary E2B runtime compatibility code.
- [x] Remove tracked generated `dist` output from services that still had committed build artifacts.
- [x] Add missing service `.env.example` files before removing real local `.env` files.
- [x] Remove tracked and local real `.env` files from the active repo tree.
- [x] Exclude `@repo/service-utils` from the active workspace because it is legacy service infrastructure.
- [ ] Keep remaining orchestrator AI SDK/Zod type drift for the package-family upgrade phase instead of this cleanup branch.

Do not include broad package upgrades, Vercel Sandbox implementation, UI redesign, or `.flow` parser work in the first deletion branch.

Reference: [`../07-madr/MADR-026-defer-non-cleanup-type-debt-to-upgrade-phase.md`](../07-madr/MADR-026-defer-non-cleanup-type-debt-to-upgrade-phase.md)

## Clean Architecture Reference Added 2026-05-23

`kuestcom/prediction-market` is a useful structural reference because it shows a focused Next.js app with:

- one `src` application boundary;
- route-local `_components`, `_actions`, `_hooks`, `_lib`, `_providers`, `_types`, and `_utils`;
- shared UI primitives in `src/components/ui`;
- shared data/domain code in `src/lib`;
- visible `tests`;
- `knip.config.ts` for unused-file/dependency control;
- current Next/React family versions.

Use that discipline for Jeriko's reset. Do not copy its prediction-market/Web3 domain.

## Keep, Archive, Delete Decision Rules

Use these labels before removing anything:

| Label         | Meaning                                            | Action                                            |
| ------------- | -------------------------------------------------- | ------------------------------------------------- |
| Keep          | Needed for AI Workflow OS MVP or security baseline | Keep in workspace and CI.                         |
| Archive       | Useful later but not needed for MVP base           | Move out of active workspace or gate from CI/dev. |
| Delete        | Stale, untracked, generated, or harmful            | Remove after confirming it is not user work.      |
| Compatibility | Needed temporarily during migration                | Keep behind adapter/wrapper and add delete gate.  |

Do not delete tracked product code just because it looks old. First prove it is unused, duplicated, or replaced.

## App Classification

Initial classification:

| App                           | Initial decision    | Reason                                                                                                       |
| ----------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/app`                    | Keep                | Primary authenticated app candidate.                                                                         |
| `apps/web`                    | Keep                | Marketing/content app. Fix build/env ownership instead of deleting it.                                       |
| `apps/docs`                   | Keep as app surface | Documentation site/content app. Current intermediate path may be `tools/docs`.                               |
| `apps/email`                  | Keep as app surface | React Email template preview/build app. Current intermediate path may be `tools/email`.                      |
| `apps/storybook`              | Keep as app surface | Design-system workshop app. Current intermediate path may be `tools/storybook`.                              |
| `apps/studio`                 | Keep as app surface | Database/admin studio app. Current intermediate path may be `tools/studio`.                                  |
| `legacy/deactivated-apps/api` | Deactivated         | It overlaps with App Router/API routes and payment webhooks. Reintroduce only with a proven deploy boundary. |

Base reset decision needed:

- [x] Choose whether AI Workflow OS uses one Next app or split app/marketing/docs/dev apps: keep the multi-app monorepo; the standalone API app is deactivated for now.
- [ ] Remove inactive apps from default `turbo build/test` if not part of the base.
- [ ] Keep archived apps available only through explicit scripts if still useful.
- [x] Deactivate `apps/api` until a separate API deploy boundary is proven.
- [x] Delete tracked `apps/email/.react-email` generated/vendor-like preview-server payload.
- [x] Move docs/email/storybook/studio out of `apps/*` and into `tools/*` as an intermediate cleanup.
- [x] Move docs/email/storybook/studio back into `apps/*` per MADR-037.
- [ ] Fix/verify React Email build/dev tooling during package-family upgrade; the pre-delete `pnpm --filter email build` attempt hung.

## Service Classification

Current decision:

`legacy/manus-clone/services/*` is legacy reference only. It is not part of the active workspace/build/test graph. Do not build new workflow runtime code inside the legacy service tree.

Historical classification for reference:

| Service          | Initial decision                        | Reason                                                                      |
| ---------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| `gateway`        | Keep or simplify                        | Useful only if service boundary remains. Must fix auth.                     |
| `task`           | Keep                                    | Natural place for Inngest workflow executor.                                |
| `sandbox`        | Compatibility                           | Keep behind provider-neutral adapter, then migrate.                         |
| `connector`      | Keep                                    | Tool connections and Composio/direct API boundary.                          |
| `file`           | Keep or merge                           | Artifact/file base, but ownership must be fixed.                            |
| `billing`        | Keep later, possibly gate early         | Needed for credits, but can be delayed after kernel proof.                  |
| `search`         | Keep if web/search tools are MVP        | Must fix access boundaries.                                                 |
| `project`        | Keep if project grouping survives       | Must fix tRPC/relationship auth gaps.                                       |
| `webhook`        | Keep if triggers are MVP                | Must fail closed on signatures.                                             |
| `notification`   | Archive/gate initially                  | Useful later, not a kernel blocker.                                         |
| `website`        | Archive or delete after audit           | Webdev/deploy legacy surface, high IDOR risk.                               |
| `device`         | Archive or delete after audit           | Legacy device/WebSocket surface, not workflow MVP.                          |
| `webrtc-media`   | Archive or delete after audit           | Neko/desktop/media legacy, not core workflow MVP.                           |
| `knowledge`      | Archive or keep behind strict ownership | Useful for RAG later, high IDOR risk now.                                   |
| `orchestrator`   | Split/replace                           | Too privileged and chat/session/E2B shaped.                                 |
| `sandbox-proxy`  | Compatibility                           | Keep only while sandbox preview/proxy migration needs it.                   |
| `services/agent` | Delete stale residue                    | Local folder has no tracked source, only bytecode; CI references are stale. |

Base reset decision needed:

- [x] Define the minimal service set for local development: none in the active workspace for this phase; use app routes/packages first.
- [x] Remove stale `services/agent` references from CI/deploy/scripts.
- [x] Gate archived services out of `dev:services` by removing service scripts from root.
- [ ] Replace or delete app routes that still proxy to legacy service URLs.
- [ ] Decide whether a new backend app is needed after workflow kernel/runtime boundaries are defined.
- [x] Decide whether legacy website/device/webrtc surfaces are archived before workflow work: archived as part of inactive `services/*`.

## Dependency Upgrade Policy

Do not run one broad `bump-deps` and hope.

Upgrade by families:

1. Package manager and workspace tooling:
   - pnpm
   - Turbo
   - TypeScript
   - tsup
   - ESLint stack

2. Next/React family:
   - `next`
   - `react`
   - `react-dom`
   - `@next/eslint-plugin-next`
   - `eslint-config-next` if used
   - `@types/react`
   - `@types/react-dom`

3. Validation/database family:
   - choose one Zod major, preferably Zod 4 unless blocked
   - align `drizzle-orm` and `drizzle-kit`
   - remove or reduce root overrides after package manifests agree

4. AI family:
   - `ai`
   - `@ai-sdk/react`
   - `@ai-sdk/openai`
   - model-provider packages
   - only after checking current AI SDK docs and migration notes

5. Security/observability family:
   - Sentry packages
   - auth packages
   - Arcjet/Nosecone/security middleware
   - webhook/signature packages

6. UI/design family:
   - Tailwind
   - shadcn/radix
   - lucide
   - streamdown/markdown
   - Storybook only if it remains active

7. External services:
   - Stripe
   - AWS SDK
   - Composio
   - Typesense
   - Knock
   - AgentMail

Each family upgrade must have a small verification checklist before moving on.

## Upgrade Do/Do Not

Do:

- [ ] run official Next upgrade/codemod only after the workspace is cleaned enough to verify;
- [ ] normalize Next/React across all active apps/packages;
- [ ] make old packages inactive before removing their dependencies;
- [ ] keep a dependency snapshot in docs before and after upgrade;
- [ ] run typecheck/build/tests after each family;
- [ ] update lockfile intentionally.

Do not:

- [ ] mix Next upgrade, auth rewrite, sandbox migration, UI redesign, and `.flow` kernel in one branch;
- [ ] upgrade major versions of Zod, Drizzle, AI SDK, Sentry, Stripe, Storybook, and Typesense together;
- [ ] trust root `pnpm.overrides` as a real fix;
- [ ] leave inactive apps/services in default CI;
- [ ] keep CI jobs for services that do not exist as tracked packages;
- [ ] delete E2B code before provider-neutral sandbox parity.

## Base Reset Execution Order

### Step -1.1: Freeze Baseline

- [ ] Record `pnpm outdated -r` summary.
- [ ] Record active apps/services/packages.
- [ ] Record failing baseline commands.
- [ ] Record current branch/worktree status.

### Step -1.2: Workspace Target

- [x] Choose primary app strategy: multi-app monorepo with app, web, docs, email, storybook, and studio as first-class app surfaces.
- [x] Classify each app as keep/archive/delete/dev-only.
- [ ] Classify each service as keep/archive/delete/compatibility.
- [ ] Classify each package as keep/archive/delete.

### Step -1.3: Remove Stale References

- [x] Remove root `test:agent` if `services/agent` remains untracked/stale.
- [x] Remove `services/agent` CI job and contract-gate watch path.
- [x] Remove deploy waits for `jeriko-agent-staging` and `jeriko-agent-production`.
- [x] Remove or ignore untracked bytecode residue.

### Step -1.4: Gate Unneeded Services

- [x] Split service startup out of active root scripts by removing service dev commands.
- [x] Make Docker Compose only start required local infrastructure by default.
- [ ] Move legacy website/device/webrtc/knowledge/orchestrator surfaces behind explicit profile if not immediately needed.

### Step -1.5: Normalize Dependencies

- [x] Next/React family critical packages: active Next manifests/lockfile are on `next@16.2.6`, `react@19.2.6`, and `react-dom@19.2.6`.
- [x] TypeScript/tooling family: `turbo@2.9.14`, `typescript@6.0.3`, `eslint@10.4.0`, `typescript-eslint@8.59.4`, `vitest@4.1.7`.
- [x] Zod/Drizzle family: `zod@4.4.3`, `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`.
- [x] AI SDK family: `ai@6.0.191`, `@ai-sdk/react@3.0.193`.
- [x] Security/observability family direct dependencies normalized by `pnpm outdated -r --format json`.
- [x] External service clients direct dependencies normalized by `pnpm outdated -r --format json`.
- [ ] Deprecated transitive dependency warnings reviewed and either accepted or removed through package ownership cleanup.

### Step -1.6: Verify Baseline

- [x] `pnpm install` succeeds.
- [x] focused app/package typechecks succeed for `app`, `web`, `@repo/contracts`, and `@repo/search`.
- [x] full `pnpm typecheck` succeeds after package normalization.
- [x] focused Vitest projects succeed for `@repo/contracts` and `@repo/search`.
- [ ] `pnpm build` succeeds for active apps/packages.
- [ ] `pnpm lint` succeeds for active apps/packages.
- [ ] `pnpm test` succeeds or only fails documented legacy tests.
- [ ] CI no longer references missing services.

### Step -1.7: Advanced Multi-App Directory Cleanup

Reference: [`advanced-monorepo-directory-cleanup-plan.md`](./advanced-monorepo-directory-cleanup-plan.md)

- [x] Move `tools/docs` back to `apps/docs`.
- [x] Move `tools/email` back to `apps/email`.
- [x] Move `tools/storybook` back to `apps/storybook`.
- [x] Move `tools/studio` back to `apps/studio`.
- [x] Update `pnpm-workspace.yaml` so app packages are under `apps/*` and `tools/*` remains only if repo-only tool packages exist.
- [x] Add app-level READMEs for every `apps/*` package.
- [x] Update root scripts for product-only, per-app, and all-app commands.
- [ ] Update Turbo filters and CI paths for each app surface.
- [ ] Verify no workspace package imports an app package.
- [ ] Run install, workspace list, typecheck, targeted app checks, and `git diff --check`.

## Exit Criteria

Phase -1 is complete only when:

- [x] active workspace scope is documented;
- [x] stale `services/agent` references are gone or the service is intentionally restored;
- [x] inactive services are out of default dev/build/test paths;
- [ ] app surfaces are first-class under `apps/*`, with default scripts limited to the intended active product checks and per-app scripts explicit;
- [x] dependency families are normalized or explicitly deferred;
- [x] root overrides are reduced to intentional compatibility exceptions; no `pnpm.overrides` remain after package normalization.
- [ ] active app builds on the target Next/React family;
- [ ] active lint passes or has a documented scoped baseline gate;
- [ ] CI is meaningful enough for Phase 0A security changes.

## Decision

The next engineering phase should be Phase -1 Base Reset.

After Phase -1, continue with:

```text
Phase 0A: security and CI hardening
Phase 0B: isolated `.flow` kernel
Phase 0C: workflow-native database
Phase 0D: provider-neutral sandbox interface
```

This gives the project a fresh base without destroying useful infrastructure.
