# Deletion-First Cleanup Audit

Date: 2026-05-23

Scope: identify what should be deleted, archived, gated, or kept before upgrading packages or building the `.flow` workflow platform.

## Audit Honesty

This is not a claim that every line in the monorepo was manually read.

This is a deletion-first audit based on local filesystem inventory, `git ls-files`, route/service/package discovery, source searches, and targeted file reads. It is enough to decide the first cleanup branch. Every destructive deletion still needs approval and a focused diff.

## Executive Verdict

Yes, the codebase should be cleaned first.

You are right: the repo is too dirty to start by adding `.flow`, Vercel Sandbox, auth rewrite, new design, or latest-package upgrades. The first engineering move should be to reduce the active base.

The rule:

```text
delete obvious untracked/sensitive/generated junk
-> remove stale references
-> gate legacy services/apps
-> choose active app shape
-> normalize packages
-> verify build/test
-> then build workflow kernel
```

## Execution Status

First cleanup pass completed on 2026-05-23:

- [x] Removed `docs/home_ubuntu_full`, including `.env` and `.secrets/sandbox_api_token`.
- [x] Removed `docs/.manus`.
- [x] Removed `docs/manus-architecture-docs`.
- [x] Removed old untracked root docs and old refactor/testing docs, leaving `docs/ai-workflow-os` as the canonical docs folder.
- [x] Removed stale `services/agent` bytecode residue.
- [x] Removed root `test:agent` and updated `test:all`.
- [x] Removed Python agent CI job.
- [x] Removed `agent` from the Docker image matrix and production Compose file.
- [x] Removed deploy waits for `jeriko-agent-*`.
- [x] Removed `services/agent/**` from contract-gate path filters.
- [x] Deleted old Phase 8/9 retirement scripts and their tests.
- [x] Moved contract docs/snapshot outputs from `docs/refactor-2026` to `docs/ai-workflow-os/10-audit/contracts`.
- [x] Removed generated build/test/cache output: app `.next`, workspace `.turbo`, Playwright reports, untracked package/service `dist`, and ignored generated E2B template payload.
- [x] Kept root `node_modules` installed for verification; it remains ignored local dependency state and can be removed at the final handoff if a fully cold checkout is desired.
- [x] Replaced the root README with a current AI Workflow OS reset README.
- [x] Removed stale root Markdown docs: `MANUS_PARITY_VERIFICATION.md`, `PRE_REFACTOR_CLEANUP_AUDIT.md`, and `Redux-State-Slice-Explanations.md`.
- [x] Removed repository-local assistant material: `.agents`, `.claude`, `skills`, and app/package/service `CLAUDE.md` files.
- [x] Removed checked-in `e2b-templates/**` payload and local-template-only orchestrator scripts.
- [x] Removed tracked generated service build output from `services/gateway/dist`, `services/search/dist`, and `services/website/dist`.
- [x] Removed tracked and local `.DS_Store` OS metadata files.
- [x] Added service `.env.example` files for connector, orchestrator, and sandbox so real `.env` files can be removed.
- [x] Removed real `.env` files from `packages/auth`, `packages/database`, `services`, `services/connector`, `services/orchestrator`, and `services/sandbox`.
- [x] Removed remaining `.env.local` files from `apps/api`, `apps/app`, `apps/web`, `packages/cms`, and `packages/internationalization`; matching `.env.example` files exist.
- [x] Updated `@repo/service-utils` exports to workspace source so targeted tests do not require checked-in generated `dist`.
- [x] Removed tracked `apps/email/.react-email` React Email preview-server payload, added an ignore rule, and removed it from `turbo.json` build outputs.
- [x] Gated root `dev` to the primary app and moved full workspace dev startup to `dev:all`.
- [x] Removed root service dev scripts after services were moved to `legacy/manus-clone`; local dependencies now use infra-only Docker commands.

Deferred:

- [ ] Gate broader legacy apps/services from default build/test.
- [ ] Normalize package versions by family.
- [ ] Add dead-code tooling after the active scope is reduced.
- [ ] Create provider-neutral sandbox interface before deleting live E2B runtime code.
- [ ] Delete E2B source only after Vercel Sandbox parity passes.
- [ ] Fix remaining source-level type drift during package-family upgrades, not during cleanup.

## Proven Immediate Problems

### 1. Untracked Sensitive/Old Dumps In `docs`

Local size inventory:

| Path                           | Size |        Git tracked files |
| ------------------------------ | ---: | -----------------------: |
| `docs`                         | 2.1G | mixed/new docs untracked |
| `docs/.manus`                  | 1.1G |                        0 |
| `docs/manus-architecture-docs` | 919M |                        0 |
| `docs/home_ubuntu_full`        |  68M |                        0 |
| `docs/ai-workflow-os`          | 552K |       new canonical docs |

Sensitive files found:

```text
docs/home_ubuntu_full/.env
docs/home_ubuntu_full/.secrets/sandbox_api_token
```

Decision:

- Delete or move `docs/home_ubuntu_full` out of the repo immediately after approval. It contains secrets and is untracked.
- Delete or archive `docs/.manus` after confirming no unique source material remains needed.
- Archive/summarize then delete `docs/manus-architecture-docs`; it is old Manus reference material, not the new product plan.
- Keep `docs/ai-workflow-os`; it is the canonical planning/audit folder.

### 2. Stale `services/agent`

Evidence:

- `git ls-files services/agent` returns 0 tracked files.
- Existing files are Python bytecode only.

Files found:

```text
services/agent/src/__pycache__/*.pyc
services/agent/src/runtime/__pycache__/*.pyc
services/agent/src/tools/__pycache__/*.pyc
```

Stale references found:

```text
package.json: "test:agent"
package.json: "test:all" includes "pnpm test:agent"
.github/workflows/ci.yml references services/agent
.github/workflows/deploy.yml waits for jeriko-agent-staging and jeriko-agent-production
.github/workflows/contract-gate.yml watches services/agent/**
docker-compose.prod.yml references services/agent/Dockerfile
packages/contracts docs/comments reference services/agent event/tool schemas
```

Decision:

- Delete `services/agent` bytecode residue after approval.
- Remove or rewrite CI/deploy/package references.
- Update contract docs/comments to point to current TypeScript contract owners.
- Do not restore the Python agent unless explicitly chosen as part of the architecture. Current evidence says it is dead residue.

### 3. Old Manus/E2B/Rubic/Neko Material Is Still Dominant

Search evidence found many live references to:

```text
Manus
E2B
Neko
WebRTC
noVNC
rubic
```

High-impact examples:

- root `README.md` still documents E2B/Neko/Manus-style platform behavior;
- `services/orchestrator/src/routes/apiproxy.ts`, `deploy.ts`, `webdev.ts`, `sandbox-runtime.ts` contain Manus/E2B route assumptions;
- `services/orchestrator/src/lib/e2b-manager.ts` is the old sandbox lifecycle center;
- `services/sandbox/src/index.ts` imports and manages E2B directly;
- `packages/ai/hooks/use-e2b-stream.ts` and `use-e2b-terminal.ts` expose E2B-specific frontend hooks;
- `e2b-templates/**` contains 9,310 files and 260M of template/runtime material.

Decision:

- Delete old reference dumps and generated/vendor-like template material only after classification.
- Do not delete live E2B runtime code before a provider-neutral adapter and Vercel Sandbox proof exist.
- Rename public API/UI surfaces from E2B/Manus only after behavior is behind generic sandbox/workflow names.

### 4. Apps And Services Are Too Broad For A Fresh Base

Current app packages:

```text
apps/api
apps/app
apps/docs
apps/email
apps/storybook
apps/studio
apps/web
```

Current service package files:

```text
services/billing
services/connector
services/device
services/file
services/gateway
services/knowledge
services/notification
services/orchestrator
services/project
services/sandbox
services/sandbox-proxy
services/search
services/task
services/webhook
services/webrtc-media
services/website
```

Decision:

- Keep `apps/app` as the primary product app unless a split strategy is explicitly chosen.
- Gate `apps/web`, `apps/api`, `apps/docs`, `apps/storybook`, and noncritical dev apps from default build/test until intentionally needed.
- Gate or archive `website`, `device`, `webrtc-media`, and `knowledge` for the first base reset unless a concrete MVP workflow requires them.
- Treat `orchestrator` as source material to split, not the final runtime.

### 5. Dependency Versions Are Mixed

Initial local examples:

| Package           |                            Initial local | Registry/latest checked during initial audit |
| ----------------- | ---------------------------------------: | -------------------------------------------: |
| `next`            |          initial active apps at `16.1.5` |                   later upgraded to `16.2.6` |
| `react`           |          initial active apps at `19.2.3` |                   later upgraded to `19.2.6` |
| `react-dom`       |          initial active apps at `19.2.3` |                   later upgraded to `19.2.6` |
| `ai`              |                   root override `6.0.77` |                                    `6.0.191` |
| `@ai-sdk/react`   |          active packages around `3.0.19` |                                    `3.0.193` |
| `@vercel/sandbox` | not installed in checked active packages |                                      `2.0.0` |

Post-upgrade note: active Next packages are normalized to `16.2.6`, React packages to `19.2.6`, AI SDK packages to the latest checked registry releases, and Zod to `4.4.3`. The orchestrator compatibility pass is complete and recursive workspace typecheck passes.

Initial root overrides pinned:

```text
@types/react
@types/react-dom
ai
drizzle-orm
zod
```

Decision:

- Do not run broad `bump-deps` before cleanup.
- Upgrade by dependency family after inactive apps/services stop blocking the baseline.
- Post-upgrade state removed those root version overrides; the remaining pnpm config is package-extension/peer-rule metadata only.

## Delete / Archive / Gate / Keep Classification

### Delete After Approval

These are high-confidence deletion candidates:

- `docs/home_ubuntu_full` because it is untracked and contains `.env` plus `.secrets/sandbox_api_token`.
- `services/agent` bytecode residue because it has no tracked source files.
- `.DS_Store` files in docs.
- stale CI/deploy references to `services/agent` if the service is not intentionally restored.

### Archive Or Move Out Of Active Workspace

These should not be active project memory:

- `docs/.manus`
- `docs/manus-architecture-docs`
- old root/reference docs such as:
  - `docs/COMPLETE_MANUS_ARCHITECTURE_FROM_STATE.md`
  - `docs/IMPLEMENTATION_ROADMAP.md`
  - `docs/MANUS_VS_RUBIC_COMPLETE_ANALYSIS.md`
  - `docs/PRODUCTION_DEPLOYMENT.md`
  - `docs/e2b-filepath.md`
  - `docs/e2b-sandbox-parity.md`
  - `docs/missing-slices.md`
  - `docs/refactor-2026`
  - `docs/testing`

Before archive/delete, summarize anything still useful into `docs/ai-workflow-os`.

### Gate From Default Dev/Build/Test

Gate these unless a proof workflow needs them:

- `apps/web`
- `apps/api`
- `apps/docs`
- `apps/email` or at minimum its checked-in `.react-email` preview-server payload
- `apps/storybook`
- `services/website`
- `services/device`
- `services/webrtc-media`
- `services/knowledge`
- `services/notification`
- `services/sandbox-proxy` after preview migration is decided

Gating means:

- remove from default turbo tasks;
- remove from default docker compose startup;
- keep explicit legacy/dev commands if needed;
- prevent stale services from blocking Next/package upgrade confidence.

Current execution:

- `pnpm dev` starts only the primary app.
- `pnpm dev:all` exists for intentional all-workspace dev startup.
- Root service dev scripts were removed after `services/*` moved to `legacy/manus-clone`.
- `pnpm infra:up` starts local shared dependencies from `docker-compose.infra.yml`.
- Old service compose files were moved to `legacy/manus-clone/docker`.
- build/test gating is still pending and should happen after the active app/package set is finalized.

### Generated/Vendor-Like Payload Removed: `apps/email/.react-email`

Evidence from 2026-05-23 scan:

- `git ls-files apps/email/.react-email` reports 181 tracked files.
- the folder is about 3.5M.
- it contains React Email preview-server internals, scripts, fonts, snapshots, generated app files, and vendor-like docs (`CHANGELOG.md`, `license.md`, `readme.md`).
- `apps/email/package.json` already depends on `react-email` and uses `email build/dev/export` commands.

Decision:

- Delete it from the active repo.
- Add `.gitignore` coverage so React Email preview artifacts are not recommitted.
- Remove `.react-email/**` from Turbo build outputs.
- Treat `apps/email` as dev-only until email package versions are normalized.

Verification note:

- `pnpm --filter email build` was attempted before deletion but hung after `Starting build process...`; it was stopped with `SIGTERM`.
- No app/email build output was created by that stopped run.
- This means React Email remains a reset-phase tooling check, not a blocker for deleting tracked generated preview-server payload.

### Keep And Refactor

Keep the capabilities, not the old clone framing:

- browsing/browser automation;
- sandbox command execution;
- file operations;
- artifact preview/rendering;
- side opening canvas/workbench;
- terminal/log stream concept;
- connector tools;
- search;
- task execution;
- file service/storage;
- billing usage ledger ideas.

## Manus Feature Decision

You are right that only the useful Manus-like capabilities should survive.

Keep:

- browsing and browser automation;
- code/shell execution;
- file read/write/list/upload/download;
- side workbench/canvas for previews and artifacts;
- task timeline/tool event rendering;
- approval before external actions;
- artifact rendering;
- sandbox isolation;
- dense, restrained app shell feel.

Delete or replace:

- Manus clone copy;
- Manus route naming as product architecture;
- old Manus reference dumps;
- Rubic residues;
- Neko/WebRTC as a required MVP surface unless Vercel Sandbox cannot cover the needed preview path;
- all-tool autonomous agent loops;
- chat/session as the product center;
- raw E2B names in public UI/API once provider abstraction exists.

## External Reference Impact

The `kuestcom/prediction-market` reference supports a cleaner target shape:

- use one primary app boundary;
- use route-local `_components`, `_actions`, `_hooks`, `_lib`, `_types`;
- keep reusable UI primitives separate;
- put domain logic in `src/lib` or packages;
- keep tests visible;
- add Knip/dead-code tooling.

See: `../09-research/2026-05-23-prediction-market-architecture-reference.md`.

## Phase -1 Deletion Checklist

### D0: Freeze And Protect

- [ ] Confirm current branch and dirty worktree.
- [ ] Keep `docs/ai-workflow-os` untouched except planned doc updates.
- [ ] Do not run root `clean`; it uses destructive `git clean -xdf node_modules`.

### D1: Remove Sensitive Untracked Material

- [x] Delete or move `docs/home_ubuntu_full` after approval.
- [x] Confirm no `.env`, token, key, or secret files remain under docs.
- [ ] Add ignore rules if needed to prevent these dumps returning.

### D2: Remove Dead Agent Residue

- [x] Delete untracked `services/agent` bytecode after approval.
- [x] Remove root `test:agent`.
- [x] Update `test:all` to not call the missing agent.
- [x] Remove Python agent CI job.
- [x] Remove deploy waits for `jeriko-agent-*`.
- [x] Remove `services/agent/**` from contract-gate path filters.
- [x] Update contract comments/docs to current TypeScript owners.

### D3: Gate Legacy Apps And Services

- [x] Mark active apps in docs.
- [x] Mark active services in docs: none active in `services/*`; old services are legacy reference.
- [x] Remove `dev:services` instead of maintaining service profiles in the active root.
- [x] Remove inactive services from default compose startup.
- [x] Keep explicit legacy commands for archived surfaces only if needed: none kept in root.

### D4: Clean Old Docs

- [ ] Summarize useful old Manus/E2B material into `docs/ai-workflow-os`.
- [x] Archive/delete `docs/.manus`.
- [x] Archive/delete `docs/manus-architecture-docs`.
- [ ] Replace root README old Manus clone content with a short pointer to `docs/ai-workflow-os` after product direction is approved.

### D5: Prepare Upgrade Surface

- [ ] Add dead-code tooling plan, likely Knip.
- [ ] Snapshot active dependency versions.
- [ ] Normalize Next/React on active apps.
- [ ] Normalize AI SDK after current official docs are checked.
- [ ] Normalize Zod/Drizzle after active packages are reduced.

### D6: Sandbox Migration Gate

- [ ] Keep E2B as compatibility provider.
- [ ] Create provider-neutral sandbox interface.
- [ ] Add Vercel Sandbox proof for command execution, file IO, ports, logs, timeout, cleanup.
- [ ] Delete E2B template/runtime code only after parity and session expiration plan.

## First Cleanup Branch Recommendation

First cleanup branch should contain only:

- docs updates;
- deletion of untracked sensitive docs dump;
- deletion of untracked `services/agent` bytecode;
- removal of stale `services/agent` scripts/CI/deploy references;
- no package upgrade;
- no Vercel Sandbox implementation;
- no UI redesign;
- no `.flow` parser yet.

Exit criteria:

- no sensitive docs dump remains;
- no CI/deploy/package script references missing `services/agent`;
- active docs state what is kept, archived, gated, or deleted;
- next branch can gate legacy apps/services.
