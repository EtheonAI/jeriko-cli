# AI Workflow OS Operating Memory

Status: canonical working memory for future implementation sessions.

Read this file before coding. Then read [`00-ENGINEERING-STANDARDS.md`](./00-ENGINEERING-STANDARDS.md) before changing code. Together they capture the product intent, audit truth, build order, research rules, engineering standards, and non-goals from the unified documentation set in `docs/ai-workflow-os`.

## 1. Product Definition

AI Workflow OS is a `.flow`-based autonomous workflow runtime.

It is not:

- a Manus clone
- a chatbot product
- a visual node builder as the primary interface
- a generic agent framework
- a raw DAG editor
- a prompt wrapper around E2B

The product primitive is:

```text
user goal
-> AI-authored workflow source
-> `.flow` parser and validator
-> compiled internal runtime JSON / AST
-> durable workflow run
-> scoped workers, tools, sandbox commands, approvals, artifacts, events
-> task reports, issue cards, reflection packets, patches, versions
```

The workflow is the product. Chat is a command and editing surface. The side panel, run timeline, approvals, artifacts, events, and version history are the operational surface.

## 2. Core Thesis

`.flow` is better than exposing graphs, nodes, and DAGs to normal users and AI as the source format.

But `.flow` does not replace compiler/runtime structures.

Correct architecture:

```text
.flow source
-> tokens / CST
-> AST
-> symbol table
-> semantic graph / ASG
-> DAG slices
-> control-flow graph
-> event graph
-> run state machine
-> Inngest runtime execution
-> events, artifacts, approvals, reports, reflection
```

User-facing language:

- goal
- workflow
- tasks
- tools
- permissions
- approval
- failure behavior
- artifacts
- events
- improvement

Internal runtime language:

- tokens
- source spans
- AST nodes
- symbols
- resolved tool manifests
- dependencies
- control paths
- state transitions
- event routing
- durable steps

## 3. Current Truth From The Audit

The existing repo has useful infrastructure, but it is not safe or clean enough to receive the new workflow runtime directly.

Keep/reuse:

- monorepo structure
- Next App Router foundation
- Better Auth package and org plugin direction
- Drizzle/Postgres foundation
- Inngest durable task patterns
- sandbox capability concepts, not the old service implementation
- connector capability concepts, not the old service implementation
- billing/usage ledger ideas
- file/library pieces as artifact foundation
- dense app shell and Manus-like restrained CSS base

Do not build directly on top of current behavior without hardening:

- chat/session model is still the center of the product
- no workflow-native schema exists yet
- orchestrator has unsafe privileged boundaries
- old service auth is optional or inconsistent
- several routes trust path/body user IDs
- E2B assumptions are deep in backend, frontend, CSP, DB, and proxy code
- CI/deploy has stale service references
- UI is still chat-first, not workflow-first

The current concept is viable and worth building, but it is not "easy" yet. It becomes manageable only if security, CI, kernel, schema, sandbox abstraction, executor, and UI are separated into phases.

Additional reset/upgrade findings from the 2026-05-23 surface audit:

- keep the resizable side canvas pattern, but refactor it into a workflow run workbench;
- extract the richer library file preview into a workflow artifact renderer;
- replace the thin canvas file preview that only renders image or raw text;
- keep sandbox shell/browser/file semantics, but route them through a provider-neutral adapter before Vercel Sandbox migration;
- keep search, but fix message search ownership before workflow-wide search;
- keep dynamic connector tools, but never expose the whole tool registry to a task;
- add workflow-native tables instead of overloading chat/session/message tables;
- gate legacy website/device/webrtc/knowledge surfaces unless intentionally active.

Deletion-first cleanup executed 2026-05-23:

- `docs/home_ubuntu_full`, `docs/.manus`, `docs/manus-architecture-docs`, old root docs, `docs/refactor-2026`, `docs/testing`, and `docs/decisions` were removed from the active repo after approval.
- `services/agent` bytecode residue was removed after approval.
- root scripts, CI, deploy waits, Docker Compose, Docker image matrix, contract-gate paths, README test commands, and contract comments no longer reference the missing Python agent service.
- old Phase 8/9 retirement scripts and tests were deleted because they existed only to retire the Python agent / old sandbox flow.
- generated build/test/cache output was removed, including app `.next`, workspace `.turbo`, Playwright reports, untracked package/service `dist`, and generated E2B template payload.
- checked-in E2B desktop/template payload was removed from the active repo; E2B SDK runtime code may remain only as temporary compatibility until Vercel Sandbox parity is proven.
- stale root Markdown docs, repository-local assistant material (`.agents`, `.claude`, `skills`), and app/package/service `CLAUDE.md` files were removed.
- real `.env` files were removed from the repo tree after adding missing service `.env.example` placeholders.
- `@repo/service-utils` now exports workspace source instead of generated `dist`, so targeted service tests do not require checked-in build output.
- root `node_modules` remains installed for verification and is ignored local dependency state.
- first cleanup branch intentionally did not include package upgrades, Vercel Sandbox implementation, UI redesign, or `.flow` parser work.
- non-cleanup AI SDK/Zod/orchestrator type drift is documented as upgrade-phase debt; do not chase it during deletion-first cleanup.
- `apps/email/.react-email` tracked generated/vendor-like preview payload was deleted and ignored; React Email build/dev tooling still needs reset-phase verification because the pre-delete build attempt hung.
- root `dev` now starts only the primary app; full workspace dev startup is explicit as `dev:all`.
- root service dev scripts were removed; local shared dependencies are started through infra-only Docker commands.
- remaining `.env.local` files were removed from active repo paths after confirming matching `.env.example` files exist.
- tracked/local `.DS_Store` files were removed.
- 2026-05-24 monorepo reset: `services/*` and `packages/service-utils` were removed from the active workspace graph and then physically moved to `legacy/manus-clone`. The old service source remains only as legacy reference until app-facing proxy routes are replaced or deleted.
- Root service scripts were removed; Docker commands are now infra-only commands for shared dependencies: `infra:up`, `infra:down`, and `infra:logs`.
- `apps/api` was moved to `legacy/deactivated-apps/api`; active product API work stays in `apps/app/app/api` unless a separate deploy boundary is proven.
- Old root service Docker Compose files were moved to `legacy/manus-clone/docker`; the active root compose file is now `docker-compose.infra.yml`.
- Generated/dependency state inside `legacy/` was removed after the move: no `legacy/**/node_modules`, `.turbo`, or `dist` directories remain.
- The active workspace now contains active `apps/*` and `packages/*`; no active `@jeriko/*` packages, no active `@repo/service-utils`, and no active `apps/api`.
- Active package roles are indexed in `01-architecture/package-ownership-index.md`; use it before moving, deleting, or adding shared packages.
- 2026-05-25 monorepo correction: the earlier `tools/*` move for docs, email preview, Storybook, and Drizzle Studio is superseded by MADR-037. Keep the multi-app monorepo. Target app roots are `apps/app`, `apps/web`, `apps/docs`, `apps/email`, `apps/storybook`, and `apps/studio`; `tools/*` is only for repo-only CLIs/scripts that are not app packages.
- `apps/docs`, `apps/email`, `apps/storybook`, and `apps/studio` are back under `apps/*`; the earlier `tools/*` intermediate state is superseded.
- 2026-05-25 validation after the app-surface correction: `pnpm install`, `pnpm -r list --depth -1`, focused typechecks for `app`, `web`, `@repo/contracts`, `@repo/search`, focused Vitest runs for `@repo/contracts` and `@repo/search`, and `pnpm exec turbo run typecheck --dry` all passed.
- 2026-05-25 package normalization is documented in `09-research/2026-05-25-latest-package-registry-check.md`, `10-audit/package-upgrade-validation-audit-2026-05-25.md`, and `07-madr/MADR-036-active-workspace-latest-package-normalization.md`.
- Active direct workspace dependencies were updated with fresh registry metadata. `pnpm outdated -r --format json` returns `{}` under `pnpm@11.3.0`.
- Keep `next@16.2.6`, `react@19.2.6`, `react-dom@19.2.6`, `typescript@6.0.3`, `eslint@10.4.0`, `vitest@4.1.7`, `@t3-oss/env-nextjs@0.13.11`, `mint@4.2.577`, `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `zod@4.4.3`, `ai@6.0.191`, and `@ai-sdk/react@3.0.193` unless a newer exact registry/package-doc check proves otherwise. `turbo@2.9.15` was the registry latest checked on 2026-05-27; upgrade it only inside the foundation tooling package phase.
- `pnpm typecheck` passes across the active workspace after package normalization. Focused `@repo/contracts` and `@repo/search` Vitest projects pass.
- Historical root build blocker `web -> @repo/cms -> basehub build` was removed in P3.1. `@repo/cms` no longer depends on BaseHub. Do not fix BaseHub as the future CMS; per MADR-092, use Payload later only after placement, DB/schema, auth/admin, storage, preview, and localization decisions.
- `apps/app` production build now has a reset-shell pass on Next `16.2.6` with minimum dummy app env after the authenticated route reset, Better Auth cleanup, auth UI segmentation, and R17 authenticated shell cleanup passes. Do not generalize this to full root build health.
- R13-R17 app reset checkpoints are complete and documented:
  - R13 narrowed auth/sidebar client boundaries and added sign-out/forgot/reset/verify UI coverage.
  - R14 moved forgot/reset/verify into route-owned folders and kept shared auth primitives only where actually shared.
  - R15 added a Resend auth email test harness for rendered reset/verification email and structured transport errors.
  - R16 codified `@repo/*` versus app-local `@/*` imports and moved auth form controls to current `@repo/design-system` primitives before restyling.
- R17 split the authenticated root shell into route-owned app-shell/dashboard/sidebar components, added the sidebar trigger/header, kept `/` as the dashboard, removed the empty stale app-level auth forms bucket, and preserved the no-old-product-routes reset gate.
- R18 cleaned app support files: Proxy public bypasses are explicit for auth, health, flags, and static assets; health route comments match actual paths; support-route tests were added; app-level spinner duplication was removed; skill freshness is now a standards rule.
- Provider boundary correction: apps must not import provider SDK internals when a workspace package owns that provider. `apps/app` auth imports go through `@repo/auth/*`; Better Auth direct imports stay inside `packages/auth`.
- R20 package-first correction: do not keep building integration/config/provider behavior inside `apps/app`. Audit and repair `packages/*` first, expose intentional public `@repo/*` entrypoints, then consume them from apps. Current proof: 24 active packages inventoried; 13 missing package export violations found; `pnpm boundaries:cruise` reports 18 circular dependency errors; package typecheck passes for 23/24 packages and fails in `@repo/ai` because a package test imports removed `apps/app` internals.
- R20 package viability verdict, amended by MADR-067: most added packages were directionally right. Keep package-first architecture. Treat AI SDK, auth, database, design-system, email, security, observability, storage, and future workflow packages as core. Do not keep a central `@repo/contracts` bucket; package-local contracts live with their owning package. Gate AgentMail, Typesense/search infra, notifications, analytics, payments, CMS, collaboration, webhooks, and i18n/SEO by feature/app need. The problem is ownership drift, not package count.
- Flow package decision: use one future `@repo/flow` package with subpath exports such as `@repo/flow/parser`, `@repo/flow/kernel`, and `@repo/flow/runtime` instead of separate early `workflow-kernel` and `workflow-runtime` packages. Keep provider SDKs, database clients, sandbox implementations, and app UI outside `@repo/flow`.
- `@repo/flow` has been scaffolded as an active contract-only package with subpath exports for source, lexer, CST, parser, AST, compiler, kernel, runtime, events, state, patch, and testing. It has no provider SDKs and no app imports. Dependency-cruiser now has a dedicated `no-flow-to-app-or-runtime-sdk` rule blocking `packages/flow` from importing apps or direct runtime/provider SDKs. `pnpm --filter @repo/flow typecheck` and `pnpm --filter "./packages/*" typecheck` pass across 26 active packages. `pnpm boundaries:cruise` still fails only on the known `@repo/ai` renderer cycles and `@repo/database` schema cycles.
- P4.1 correction accepted by MADR-095: `.flow` must use a custom grammar/parser, not the `yaml` npm package and not a YAML-backed parser. YAML.org, YAML spec, YAML grammar/test-suite, `eemeli/yaml`, and GitHub Actions syntax are research inputs only. Current next flow implementation gate is token/CST contracts and fixture corpus after `02-workflow-kernel/flow-grammar-v0.md`.
- Local `yaml-main` reverse-engineering is documented in `09-research/2026-05-27-yaml-main-parser-architecture-reverse-engineering.md`: 151 available files / 27,776 lines were audited as parser architecture input, with empty local submodule directories called out. Use the findings to design lexer/CST/composer/diagnostic/test architecture; do not import YAML parser behavior into `.flow`.
- Manus-style resume is a core requirement under MADR-096. Current app is not resumable end to end. Existing hints are `agent_sessions.activeStreamId`, persisted `messages.parts`, and `@repo/flow` resume contracts, but workflow UI/runtime/API are not wired. Future workflow rebuild must separate durable execution from UI transport: refresh/tab close detaches the stream only, explicit Stop/Cancel emits durable cancellation, and UI reconnects by `runId` plus event cursor.
- Git hook hardening accepted by MADR-096A: keep current `husky@9.1.7` and `lint-staged@17.0.5`; use a minimal root hook that calls local lint-staged with explicit `ACMR` filtering, serial execution, relative paths, and bounded arg length. Do not bypass hooks for normal commits, do not apply lint-staged backup stashes blindly, and never allow `.pnpm-store/` into the index.
- Sandbox package decision: `@repo/sandbox` is a first-class package separate from `@repo/flow`. `@repo/flow` plans sandbox tasks; `@repo/sandbox` owns provider-neutral execution contracts and future Vercel Sandbox adapter implementation.
- `@repo/sandbox` has been scaffolded as an active package with provider-neutral contracts and no provider SDK dependency yet. Dependency-cruiser now blocks apps and unrelated packages from importing Vercel Sandbox or E2B SDKs directly. `pnpm --filter @repo/sandbox typecheck` and `pnpm --filter "./packages/*" typecheck` pass after the scaffold.
- P0 graph health was repaired before the later AI package reset: historical `@repo/ai` renderer type cycles were removed, and `@repo/database` relation-only cycles were removed by moving cross-module `usersRelations` and `agentSessionsRelations` to `packages/database/src/schema/coreRelations.ts`. The later MADR-075/076/077 reset deleted `@repo/ai` renderer/component ownership entirely.
- Latest dependency refresh completed for the stale set reported by `pnpm outdated -r`: `@sentry/nextjs`, `react-email`, AWS S3 SDK packages, PostHog JS/Node packages, and `chromatic`. Official docs were checked and recorded in `09-research/2026-05-26-latest-dependency-refresh.md`; after update, `pnpm outdated -r` reports no outdated dependency output.
- P1 design-system boundary cleanup: `@repo/design-system` no longer imports `@repo/auth/provider` and no longer declares unused `@repo/auth`/`@repo/observability` dependencies. `DesignSystemProvider` now owns only theme, tooltip, and toaster composition. Design-system, app/web typechecks, and dependency-cruiser pass after the change.
- P1 auth boundary cleanup: Better Auth docs and registry metadata checked; `better-auth` is current at `1.6.11`. Removed orphan no-op `@repo/auth/provider` export/file after design-system no longer consumed it. Auth, app/web typechecks, and dependency-cruiser pass after the change.
- P1 observability audit/refactor: Sentry docs and registry metadata checked; `@sentry/nextjs` is current at `10.54.0`. Sentry client/server/edge trace sampling now uses `1` in development and `0.1` outside development instead of sampling every trace everywhere. Observability typecheck passes.
- P2 contracts decision: Zod, Vercel Sandbox, Turborepo internal-package docs, and registry metadata were checked before changing direction. MADR-067 retires the central `@repo/contracts` package because it had no active external consumers and mixed unrelated domains. Rehome contracts into `@repo/flow`, `@repo/sandbox`, `@repo/ai`, future `@repo/connectors`, and future `@repo/artifacts`.
- `packages/contracts` has been deleted from the active workspace. Root `test` no longer delegates to a retired package or `turbo test`; it runs the remaining package Vitest projects directly (`@repo/email`, `@repo/search`) so it avoids this machine's stale `/usr/local/bin/pnpm` Corepack path. Post-delete validation passed: active package typechecks, `pnpm test`, app/web typechecks, and dependency-cruiser.
- P2 storage cleanup: AWS SDK v3, S3 DeleteObjects/ListObjectsV2 docs, Vercel Blob docs, and registry metadata were checked before code changes. `@repo/storage` remains S3-compatible for now; Vercel Blob requires a later MADR. Fixed URL path normalization/encoding, S3 delete batching at 1,000 keys per request, and ListObjectsV2 pagination. Storage, packages, app/web typechecks, `pnpm test`, and dependency-cruiser pass after the change.
- P2 search cleanup: Typesense v30.2 docs and `typesense@3.0.6` registry metadata were checked before code changes. Keep `@repo/search`, but reset it to a generic Typesense boundary. Removed old Manus-era `files/sessions/tasks/projects/actions` schemas and DB sync helpers; future workflow/artifact schemas belong in `@repo/flow`/future `@repo/artifacts`. Search package typecheck/tests, full packages typecheck, root tests, app/web typechecks, and dependency-cruiser pass.
- P3 feature-flags cleanup: Flags SDK and Vercel Flags docs plus `flags@4.0.6`/`@vercel/toolbar@0.2.6` registry metadata were checked before code changes. Keep `@repo/feature-flags`, but only export the active reset-shell beta flag. Removed stale E2B, Composio, and orchestrator rollout flags. `createFlag` is now an explicit boolean helper with metadata/options. Feature-flags typecheck, full package typecheck, root tests, app/web typechecks, and dependency-cruiser pass.
- P2 sandbox implementation: Vercel Sandbox docs, SDK reference, llms-full, installed SDK types, and `@vercel/sandbox@2.0.0` registry metadata were checked before code changes. `@repo/sandbox` now owns provider-neutral contracts, `@repo/sandbox/keys`, `@repo/sandbox/mock`, and `@repo/sandbox/vercel`. Apps and `@repo/flow` still cannot import `@vercel/sandbox` directly. Root `pnpm test` now includes `@repo/sandbox`; package typecheck/tests, full package typecheck, root tests, app/web typechecks, dependency-cruiser, and `pnpm outdated -r` pass.
- P2 AI test cleanup history: AI SDK v6 docs/llms guidance and registry metadata were checked before touching AI package behavior. The earlier UI-heavy `@repo/ai` suite was made passing, but that UI-heavy structure is superseded by the later core package reset.
- Tools/connectors decision: Composio docs and npm metadata were checked on 2026-05-26. Do not create a separate catch-all `@repo/tools` package. Use future `@repo/connectors` for Composio/direct provider connectivity, connector toolkits/actions, API integrations, auth configs, Connect Links, connected accounts, sessions, trigger subscription, and raw connector execution. Install only current packages when implementing connectors: `@composio/core@0.10.0`; add `@composio/vercel@0.9.2` only if an AI SDK connector bridge is needed. Do not use deprecated `composio-core`.
- `@repo/connectors` is now scaffolded and validated. It owns provider-neutral connector contracts, package-local `COMPOSIO_API_KEY` keys, server-only Composio adapter, direct adapter factory, mock adapter, trigger/event normalization, and package-level `tests/`. Composio integration is session-first (`create/use`, `session.authorize`, `session.toolkits`, `session.search`, `session.execute`) with direct execution available only for later policy-wrapped platform tools. Dependency-cruiser blocks direct `@composio/*` imports outside `packages/connectors`.
- AI tools clarification: platform tools live in `@repo/ai/tools`. This server-only subpath owns workflow-visible tool IDs, manifests, permission gates, approval, risk, idempotency, billing, audit, normalized execution, and AI SDK tool adapters. `@repo/ai/tools` may call `@repo/connectors` for external integrations and internal packages such as sandbox/search/storage. App-local tool rendering should consume AI SDK `UIMessage.parts` plus normalized tool manifest metadata; raw connector SDK shapes are not rendered directly.
- `@repo/ai/tools` now has a first connector policy bridge. It defines platform risk/approval/permission contracts, `executeConnectorPlatformTool`, `createConnectorAiSdkTool`, and `createConnectorAiSdkTools`. External-write/destructive connector actions can require AI SDK `needsApproval` and direct server execution throws `PlatformToolApprovalRequiredError` until approval is supplied. This is not yet persisted audit/idempotency/billing.
- Validation after the connector bridge and late patch refresh passed: active package typechecks, root Vitest (`22` files, `487` tests), app/web typechecks, dependency-cruiser, and `pnpm outdated -r --format json` returned `{}`.
- UI ownership decision, superseded and corrected by MADR-075/076: design-system owns primitives/tokens/global styles/generic visual patterns, not all UI. `apps/app` owns the first AI/workflow product UI route-locally and composes design-system primitives. `@repo/ai` is no longer a React UI/domain-component package.
- AI package reset completed 2026-05-26: `@repo/ai` now exposes capability subpaths for `agents`, `messages`, `server`, `media`, `models`, `retrieval`, `observability`, `testing`, and server-only `tools`. Old React UI, canvas/workbench, hooks, providers, assistant-ui adapters, custom stream/cache/transport layers, and old `lib` layout were removed. Deprecated AI SDK `streamObject` is not exposed; structured output uses `generateText`/`streamText` with `Output.*`. Validation passed under repo Node `22.22.1` and pnpm `11.3.0`: `pnpm --filter @repo/ai typecheck`, `pnpm exec vitest run --project @repo/ai`, `pnpm boundaries:cruise --focus packages/ai`, `pnpm --filter "./packages/*" typecheck`, `pnpm test`, `pnpm boundaries:cruise`, and `pnpm outdated -r --format json` returned `{}`.
- `.flow`/AI SDK/Inngest split accepted by MADR-078: `.flow` declares orchestration policy, subagents, tools, approvals, triggers, retries, reporting modes, and cancellation behavior; AI SDK provides primitive model/tool/agent/message/stream/media/retrieval capabilities; Inngest/runtime owns durable schedules, events, retries, waits, and cancellation checks. User stop behavior must handle both active HTTP stream abort and durable workflow cancellation events.
- Durable runtime provider posture accepted by MADR-079: use managed Inngest first for MVP, keep `@repo/flow` provider-neutral, and keep self-hosted Inngest plus Vercel Workflow as documented exit/evaluation paths. Do not import `inngest`, `workflow`, queues, database clients, or provider SDKs into `@repo/flow`. Managed Inngest limits must shape payload/state/artifact/concurrency design; self-hosting is for compliance, data residency, cost, or dedicated-control requirements after real workload data exists.
- Direct runtime comparison accepted by MADR-080: Inngest is preferred over Vercel Workflow for the dynamic `.flow` runtime because our source is data-authored `.flow`, not code-authored durable functions. Vercel Workflow remains a tracked evaluation path for Vercel-native code workflows/agents, but the MVP runtime uses DB-backed triggers plus static Inngest scheduler/event-router/generic executor functions.
- Flow runtime contract pass completed 2026-05-27: `@repo/flow` now defines provider-neutral schedule/app/workflow/webhook trigger contracts, trigger registry records, scheduler decisions, workflow run requests, EventContextPackets, TaskReports, IssueCards, RunReflectionPackets, and cancellation requests. It still does not import Inngest, Vercel Workflow, Drizzle, Next.js, AI SDK, sandbox, or connector SDKs. Tests live in `packages/flow/tests`, and `@repo/flow` is included in the root `pnpm test` suite.
- Apps/app R20 cleanup gate completed 2026-05-27: direct dependencies are current after upgrading docs `mint` to `4.2.578`; `apps/app` typecheck passes; `@repo/notifications` typecheck passes; `apps/app` production build passes on Next `16.2.6`/Turbopack with documented core env (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`, `STRIPE_SECRET_KEY`). Build without env correctly fails T3 Env validation. The scoped app lint issue in `apps/app/scripts/skip-ci.js` was fixed by converting it to ESM, and `pnpm exec eslint apps/app --max-warnings=0` now passes.
- R21 tests cleanup completed 2026-05-27: active Vitest tests were normalized into `tests/` folders for `apps/app`, `packages/email`, `packages/sandbox`, and `packages/search`; root `pnpm test` now runs all configured Vitest projects including `apps/app`; validation passed with 13 files / 45 tests, and `pnpm test:smoke` passed with 4 app files / 15 tests.
- Package no-drift rule accepted by MADR-081: future package cleanup is package-by-package only. Before code changes, each package phase must check latest official docs/llms docs when available, registry metadata, current exports/deps/env/consumers, playbook, MADR/checklist, then validate the package and affected consumers. The canonical package order is `08-plans/package-phase-roadmap-2026-05-27.md`.
- Package phase stubs now exist for all 26 active packages in `08-plans/package-playbooks/`. These stubs are not implementation approval; each package still needs its own fresh docs/registry audit, local consumer audit, MADR update, refactor checklist, and validation before code changes.
- P1.1 `@repo/typescript-config` completed 2026-05-27 under MADR-082. TypeScript official docs and registry metadata were checked. The only package cleanup was deleting unused `packages/typescript-config/service.json`; active non-doc reference search found no consumers, and `@repo/typescript-config` typecheck passed after deletion.
- P1.2 `@repo/next-config` completed as package cleanup on 2026-05-27 under MADR-083. Next.js official config docs, Vercel `llms-full`, and registry metadata were checked. The only code cleanup was deleting unused `ANALYZE` from `packages/next-config/keys.ts`; active non-doc reference search found no consumers and `@repo/next-config` typecheck passed. Affected `apps/app` typecheck passed. Affected `apps/web` typecheck failed on existing contact/i18n/metadata issues; do not fix those inside next-config.
- P1.3 `@repo/testing` completed 2026-05-27 under MADR-084. Vitest/MSW/Faker docs and registry metadata were checked. The package had no active non-doc consumers, so stale Manus-era factories, DB helpers, tRPC helpers, MSW handlers, and app-specific setup mocks were deleted. `@repo/testing` now exports shared Vitest config helpers only. Pinned pnpm install synced dependency state, `@repo/testing` typecheck passed, and root `pnpm test` passed with 13 files / 45 tests.
- P1.4 `@repo/design-system` completed 2026-05-27 under MADR-085. shadcn/Tailwind/Radix docs and registry metadata were checked. Deprecated old toast/use-toast source was removed in favor of Sonner, Radix icons were replaced with Lucide in `ModeToggle`, direct `@radix-ui/react-icons`/`@radix-ui/react-toast` deps were removed, `radix-ui` was pinned to `1.4.3`, and Tailwind v4 font tokens now use literal Geist font stacks. `@repo/design-system`, `apps/app`, `@repo/feature-flags`, and `apps/storybook` typechecks passed; root `pnpm test` passed with 13 files / 45 tests. `apps/web` still fails on existing contact/i18n/metadata issues and must not be fixed inside design-system.
- P2.1 `@repo/auth` completed 2026-05-27 under MADR-086. Better Auth official docs and npm metadata were checked; stable latest `better-auth` is `1.6.11` and stable latest `@t3-oss/env-nextjs` is `0.13.11`. Keep Better Auth in `@repo/auth`; app proxy/UI route policy stays app-local. Removed unused `@repo/auth/middleware`, deleted stale duplicate `packages/auth/lib/validations/auth.ts`, deleted stale `packages/auth/types/index.d.ts`, added `@repo/auth/validations`, fixed email normalization order, and added package-local auth validation tests. Validation passed: `@repo/auth` typecheck, `@repo/auth` tests (1 file / 5 tests), `apps/app` typecheck, root `pnpm test` (14 files / 50 tests), and `apps/app` `next build --webpack` with the existing Sentry/OpenTelemetry warning. Default Turbopack `next build` still stayed silent for several minutes and was terminated; fix that in the Next/app build phase, not inside auth.
- P2.2 `@repo/database` completed 2026-05-27 under MADR-087. Drizzle official docs, Better Auth Drizzle adapter docs, and npm metadata were checked; stable latest versions are `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `@neondatabase/serverless@1.1.0`, and `@paralleldrive/cuid2@3.3.0`. Kept schema files and migrations during cleanup. Removed unused service-era database exports/client files, old connector/device seed scripts, and the one-off billing migration script; marked the active database client `server-only`. Validation passed: `@repo/database`, `@repo/auth`, and `apps/app` typechecks, root `pnpm test` (14 files / 50 tests), and `drizzle-kit check`.
- P2.3 `@repo/email` completed 2026-05-27 under MADR-088. Resend and React Email official docs plus npm metadata were checked; stable latest versions are `resend@6.12.4` and `react-email@6.4.0`. Keep Resend + React Email. Marked the root provider entrypoint `server-only` while keeping `@repo/email/templates` template-only for preview/rendering workflows. Validation passed: `@repo/email` typecheck/tests, `@repo/auth` typecheck, `apps/app` typecheck, and root `pnpm test` (14 files / 50 tests). `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues and is deferred.
- P2.4 `@repo/security` completed 2026-05-27 under MADR-089. Arcjet and Nosecone official docs plus npm metadata were checked; stable latest versions are `@arcjet/next@1.4.0` and `@nosecone/next@1.4.0`. Keep `@repo/security` as provider owner. Removed the unused direct `@arcjet/next` dependency from `apps/web` and added package-local tests for no-key/development skip behavior. Do not add `server-only` to security in P2.4 because it is consumed by Next proxy/middleware. Validation passed: `@repo/security` typecheck/tests (1 file / 2 tests), `apps/app` typecheck, and root `pnpm test` (15 files / 52 tests). `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues and is deferred.
- P2.5 `@repo/rate-limit` completed 2026-05-27 under MADR-090. Upstash Ratelimit/Redis docs and npm metadata were checked; stable latest versions are `@upstash/ratelimit@2.0.8` and `@upstash/redis@1.38.0`. Keep standalone for now instead of merging into security. Marked the root provider entrypoint `server-only`, made Upstash Redis client construction lazy, and added package-local tests so missing Redis env fails at limiter creation, not import. Validation passed: `@repo/rate-limit` typecheck/tests (1 file / 2 tests) and root `pnpm test` (16 files / 54 tests). `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues and is deferred.
- P2.6 `@repo/observability` completed 2026-05-27 under MADR-091. Sentry, Next.js instrumentation, and Better Stack/Logtail docs plus npm metadata were checked; stable latest versions are `@sentry/nextjs@10.54.0` and `@logtail/next@0.3.1`. Keep `@repo/observability` as provider owner. Added the missing root export, package-owned `onRequestError`, app instrumentation re-exports, web global-error package capture, current `withBetterStack` naming, and package-local tests. Removed direct unused Sentry/Sentry-support dependencies from `apps/web`. Validation passed: `@repo/observability` typecheck/tests (1 file / 4 tests), `apps/app` typecheck, and root `pnpm test` (17 files / 58 tests). `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues and is deferred.
- P3.1A `@repo/cms` BaseHub retirement completed 2026-05-27 under MADR-092. BaseHub dependency, scripts, env, generated types, config, and component wrappers were removed. `@repo/cms` now exposes provider-neutral content contracts plus a static content helper. Validation passed: `@repo/cms` typecheck/tests (1 file / 2 tests), root `pnpm test` (18 files / 60 tests), and `pnpm outdated --filter @repo/cms --format json` returned `{}`. `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues and is deferred.
- P3.1B `@repo/cms` Payload package implementation completed 2026-05-27 under MADR-092A after reading Payload `https://payloadcms.com/llms-full.txt`, official storage/email docs, T3 Env docs, and fresh registry metadata. Payload is now the approved CMS provider. `@repo/cms` owns Payload schema/config/access/content API and `apps/web` owns required Payload App Router convention files. Use `PAYLOAD_DATABASE_URL`, keep Payload migrations separate from `@repo/database`, keep Payload admin auth separate from Better Auth initially, and use matching Payload `3.85.0` packages. Implemented exports: `@repo/cms/access`, `collections`, `content`, `globals`, `keys`, `next-config`, and `payload`. Validation passed: `pnpm install`, `@repo/cms` typecheck/test/build, root `pnpm test` (20 files / 66 tests), and `pnpm outdated --filter @repo/cms --format json` returned `{}`. Remaining CMS work is migration workflow, live preview, localization, and web rendering.
- P3.1C `apps/web` Payload route integration completed 2026-05-27 under MADR-092A. `apps/web` now owns the thin `payload.config.ts`, `@payload-config` path, Payload `(payload)` App Router convention files, local CSS module declaration, and `withCMS` Next config composition. Payload domain/schema/access/storage/email/content code remains in `@repo/cms`. Validation passed for `@repo/cms` typecheck/test/build, root `pnpm test` (20 files / 66 tests), `pnpm outdated --filter web --format json`, and `git diff --check`. `apps/web` typecheck no longer reports Payload-specific errors, but still fails on existing contact/i18n/calendar/metadata issues outside CMS.
- P3.2 `@repo/internationalization` completed 2026-05-27 under MADR-093 after checking `next-intl` official docs and registry metadata. Keep the package boundary and standardize on `next-intl@4.12.0`; do not reintroduce `next-international`, direct `negotiator`, or generated `@ezy/i18n` references. Package tests were added, stale dependencies removed, web request debug logging removed, `html lang` now uses the resolved locale, and i18n middleware no longer runs on Payload `/api/*` routes. Validation passed: `@repo/internationalization` typecheck/tests (1 file / 3 tests), root `pnpm test` (21 files / 69 tests), package outdated check `{}`, and `git diff --check`. `apps/web` typecheck no longer reports the i18n `getTranslations` root export error; remaining blockers are non-i18n calendar and SEO metadata issues.
- P3.3 `@repo/seo` completed 2026-05-27 under MADR-094 after checking current Next Metadata docs and registry metadata. Keep `@repo/seo` small and shared; `createMetadata` requires `description`, does not read env directly, and uses Jeriko defaults instead of next-forge/Vercel defaults. Removed `lodash.merge`/`@types/lodash.merge`, added metadata and JSON-LD tests, and fixed the web contact page metadata description. Validation passed: `@repo/seo` typecheck/tests (2 files / 4 tests), root `pnpm test` (23 files / 73 tests), package outdated check `{}`, and `git diff --check`. `apps/web` typecheck no longer reports SEO metadata errors. The non-SEO contact `Calendar initialFocus` DayPicker issue found at the end of P3.3 was resolved in P3.3A.
- P3.3A `apps/web` contact Calendar unblock completed 2026-05-27 under MADR-094A after checking DayPicker official docs, `llms.txt` availability, registry metadata, and local wrapper usage. DayPicker v10 removed `initialFocus`; the contact form now uses `autoFocus`. Validation passed: `apps/web` typecheck, `@repo/design-system` typecheck, and root `pnpm test` (23 files / 73 tests). This was intentionally scoped to app usage; a full `react-day-picker` to `@daypicker/react` package-name review remains deferred to a future design-system phase.
- Research rule correction: every future package phase must first look for official `llms.txt`, `llms-full.txt`, or equivalent AI docs index and record that source before package changes.
- Latest drift checkpoint after P2.6: root `pnpm outdated -r --format json` now reports newer versions outside the active package phase: `@vercel/sandbox@2.0.1`, `posthog-js@1.376.3`, `posthog-node@5.35.5`, `chromatic@17.1.0`, and `react-email@6.5.0`. Do not claim all packages are latest until those owning phases run fresh docs/registry gates and update them.
- `pnpm lint` does not pass: after excluding `legacy/**`, active lint still has 873 problems, led by `no-explicit-any`, unused vars, React Compiler hook rules, and `next/image` violations.
- `legacy/**` is intentionally excluded from active ESLint. It remains reference material, not active product code.

External architecture reference added 2026-05-23:

- `kuestcom/prediction-market` is a useful structural reference for one `src` app boundary, route-local `_components`/`_actions`/`_hooks`/`_lib`/`_types`, shared UI primitives, visible tests, and Knip.
- copy the architecture discipline, not its prediction-market/Web3 domain.

## 4. Audit Honesty Rule

Do not lie about audit coverage.

Mandatory engineering behavior now lives in [`00-ENGINEERING-STANDARDS.md`](./00-ENGINEERING-STANDARDS.md). Follow it before every cleanup, refactor, package, env, Next.js, CMS, workflow, sandbox, auth, or UI change.

What is true:

- The unified AI Workflow OS documentation set was read and consolidated.
- The full brief text was read from `AI_Workflow_OS_Full_Brief_for_Codex.txt`.
- The copied project-pack files were compared against the normalized docs and matched.
- The current runtime/source audit documents were read and should be treated as the source-backed audit baseline.
- The audit identifies high-risk runtime files, services, routes, and product seams.

What must not be claimed:

- Do not claim every generated, template, migration, fixture, lockfile, or vendor-like line in the whole monorepo was manually audited.
- Do not claim every security issue is found.
- Do not claim Vercel Sandbox parity until proof tests pass.
- Do not claim Next, Vercel, Inngest, Better Auth, Drizzle, or AI SDK details without checking current official docs before implementation.

## 5. Non-Negotiable Build Order

Do not start with visual redesign, workflow kernel, or dependency churn on top of the messy base.

Correct order:

1. Phase -1: base reset, workspace cleanup, stale server removal, and dependency normalization.
2. Phase 0A: security and CI stabilization.
3. Phase 0B: `.flow` workflow kernel in isolation.
4. Phase 0C: workflow-native database schema.
5. Phase 0D: provider-neutral sandbox interface.
6. Phase 1: generic durable workflow executor.
7. Phase 2: workflow-first frontend.
8. Phase 3: migration and cleanup.

The first serious code should make the repo smaller, cleaner, safer, and verifiable, not repaint the old chat product.

## 6. Phase -1 Base Reset Gates

Before security hardening and workflow feature coding, clean the active base:

- [ ] Classify every app as keep, archive, delete, or dev-only.
- [x] Deactivate redundant `apps/api` until a separate API deploy boundary is proven.
- [x] Classify old services as legacy reference under `legacy/manus-clone`, not active workspace architecture.
- [x] Classify active packages by keep/audit-gate/legacy direction in the package ownership index.
- [x] Choose the primary app strategy: multi-app monorepo with app, web, docs, email, Storybook, and studio as first-class app surfaces; API remains deactivated until a separate boundary is proven.
- [x] Remove stale `services/agent` scripts, CI jobs, deploy waits, and local bytecode residue unless the service is intentionally restored.
- [x] Gate inactive services out of the active pnpm/Turbo workspace and root dev/build/test scripts.
- [x] Normalize the Next/React family across active apps/packages.
- [x] Normalize TypeScript/tooling versions.
- [x] Normalize Zod and Drizzle intentionally instead of relying on root overrides.
- [x] Normalize AI SDK packages only after checking current AI SDK docs.
- [ ] Make active workspace `install`, `typecheck`, `build`, and `test` meaningful. Current proof: install/typecheck/focused tests pass; production build and lint remain blockers.
- [ ] Repair active package boundaries before further app feature cleanup. Current proof: R20 package-first audit found missing exports, package cycles, and an `@repo/ai` test importing app internals.

Reference plan:

- [`08-plans/phase-minus-one-base-reset-plan.md`](./08-plans/phase-minus-one-base-reset-plan.md)
- [`10-audit/reset-upgrade-surface-audit-2026-05-23.md`](./10-audit/reset-upgrade-surface-audit-2026-05-23.md)
- [`10-audit/deletion-first-cleanup-audit-2026-05-23.md`](./10-audit/deletion-first-cleanup-audit-2026-05-23.md)
- [`07-madr/MADR-026-defer-non-cleanup-type-debt-to-upgrade-phase.md`](./07-madr/MADR-026-defer-non-cleanup-type-debt-to-upgrade-phase.md)
- [`07-madr/MADR-033-deactivate-legacy-services-from-active-workspace.md`](./07-madr/MADR-033-deactivate-legacy-services-from-active-workspace.md)
- [`07-madr/MADR-034-deactivate-redundant-api-app-and-legacy-compose.md`](./07-madr/MADR-034-deactivate-redundant-api-app-and-legacy-compose.md)
- [`07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md`](./07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md)
- [`01-architecture/monorepo-target-architecture.md`](./01-architecture/monorepo-target-architecture.md)
- [`01-architecture/package-ownership-index.md`](./01-architecture/package-ownership-index.md)
- [`09-research/2026-05-23-prediction-market-architecture-reference.md`](./09-research/2026-05-23-prediction-market-architecture-reference.md)

## 7. Phase 0A Security And CI Gates

Before workflow feature coding, implement and test:

- [ ] `requireOwnedSession(userId, sessionId)` or equivalent ownership primitive.
- [ ] Use ownership checks in chat page, chat POST, stream, stop, media, IDE, sandbox, deploy, and file routes.
- [ ] Stop accepting body/path `userId` as authority.
- [ ] Protect orchestrator with real service auth.
- [ ] Require gateway secret outside local dev.
- [ ] Replace raw service fetches with shared authenticated service client.
- [ ] Hash API keys and remove API-key validation stubs.
- [ ] Fix webhook fail-open behavior.
- [ ] Add owner-constrained connector queries.
- [ ] Add owner-constrained deployment delete.
- [ ] Fix CI E2E server startup.
- [x] Remove or intentionally restore stale `services/agent` CI/deploy references.

Exit criteria:

- [ ] Cross-user ownership regression tests pass.
- [ ] Protected service calls fail without valid service secret.
- [ ] CI is green and meaningful.

## 8. Known P0 Risk Findings

Treat these as blockers, not polish:

- chat/session IDOR in page/API/stream/stop style paths
- orchestrator raw unauthenticated boundary and body identity trust
- gateway service auth optionality and API-key stub behavior
- knowledge service broad IDOR risk
- search leaking messages or cross-user results
- webhook dispatch public/internal and tenant fanout risk
- connector service owner checks inconsistent
- project tRPC relationship routes skipping access checks
- WebsiteBuilder tRPC file/deploy IDOR risk
- website deployment delete/read/update ownership gaps
- device WebSocket owner check gap
- billing internal routes trusting body/path user fields
- OAuth proxy/server trusting body identity or unverified JWT decode
- AgentMail webhook signature gap
- file upload arbitrary session attachment risk
- sandbox terminal stream proxy missing user/service authority
- `proxy.ts` cookie-presence auth is not enough for high-risk surfaces

## 9. `.flow` Kernel Contract

Use `packages/flow` before wiring runtime into the app.

Minimum kernel:

- `.flow` v0 vocabulary
- custom `.flow` parser/loader
- source diagnostics with path and location
- strict schema validation
- AST types
- symbol table
- semantic validator
- compiled runtime JSON
- fixture tests

Parser rules:

- do not use a YAML parser for `.flow`
- use a custom `.flow` grammar inspired by YAML readability and GitHub Actions workflow shape
- reject YAML anchors
- reject YAML aliases
- reject YAML custom tags
- reject YAML directives
- reject YAML merge keys
- reject multi-document YAML markers
- reject implicit YAML bool/null/date coercion
- reject unknown keys
- reject unbounded loops
- reject external side effects unless permission policy allows them
- preserve source spans for diagnostics and editor UX

Kernel validations:

- duplicate task IDs fail
- unknown tools fail
- missing artifacts fail
- bad permissions fail
- invalid dependency cycles fail
- missing imports fail
- unsafe commands fail before runtime
- external actions require approval unless explicitly and safely allowed

Execution must never run raw `.flow` text. It executes validated compiled runtime JSON.

## 10. `.flow` MVP Vocabulary

Start small:

- `flow`
- `name`
- `goal`
- `imports`
- `permissions`
- `budget`
- `jobs`
- `trigger`
- `tasks`
- `id`
- `type`
- `worker`
- `uses`
- `input`
- `output`
- `depends_on`
- `if`
- `if_fail`
- `requires_approval`
- `emit`

Initial task types:

- `ai_task`
- `tool_call`
- `sandbox_command`
- `verify`
- `human_review`
- `wait_for_event`
- `emit_event`
- `memory_patch`

Defer complex features until the simple kernel passes:

- public marketplace
- custom tool builder
- enterprise SSO
- arbitrary public scripts
- general visual graph editor
- complex expression language
- unbounded loops
- autonomous external send/post/update without approval

## 11. Runtime Contract

Use one generic executor, not custom code per customer workflow.

Runtime flow:

```text
workflow/run.execute
-> load workflow run
-> load immutable workflow version
-> load compiled runtime JSON
-> resolve runnable steps
-> dispatch by task type
-> persist step state
-> append workflow event
-> persist artifacts/reports/issues/usage
-> wait, resume, retry, fail, or complete
```

Step handlers:

- `ai_task` uses scoped model worker context.
- `tool_call` goes through Tool Router.
- `sandbox_command` uses provider-neutral sandbox runner.
- `verify` checks schemas, claims, safety, and artifacts.
- `human_review` creates approval record and pauses/resumes through durable signal/event.
- `wait_for_event` waits on typed event.
- `emit_event` appends and routes event context.
- `memory_patch` proposes reversible changes; it does not silently mutate active versions.

All step IDs must be stable and derived from workflow version plus task ID.

## 12. Database Contract

Do not overload `agentSessions`, `scheduledTasks`, or `messages` as workflow source of truth.

Add workflow-native tables:

- `workflows`
- `workflow_versions`
- `workflow_files`
- `workflow_runs`
- `workflow_run_steps`
- `workflow_events`
- `workflow_artifacts`
- `workflow_approvals`
- `workflow_tool_calls`
- `workflow_sandbox_sessions`
- `workflow_issues`
- `workflow_memory_patches`
- `workflow_permissions`

Rules:

- workflow versions are immutable after publish
- runs reference a workflow version ID
- running runs keep their original version
- events are append-only
- artifact records link to workflow, run, and step
- tool calls store idempotency keys and permission decisions
- usage events link to workflow, run, and step where possible

## 13. Sandbox Contract

Migrate from E2B through a provider-neutral interface. Do not delete E2B first.

Provider interface must cover:

- create
- connect
- run command
- write files
- read file
- list files
- get port URL
- stop
- status/capabilities

Migration order:

1. Create sandbox provider interface.
2. Move E2B code behind an E2B provider.
3. Add fake provider tests.
4. Add provider-neutral DB fields.
5. Add Vercel Sandbox provider behind env-gated proof.
6. Update frontend hooks to generic names while keeping temporary E2B wrappers.
7. Remove E2B only after parity and old session expiration.

Sandbox security rules:

- no OAuth/API tokens inside sandbox files or env unless explicitly safe and scoped
- network disabled unless allowed by task policy
- command timeout required
- output size cap required
- dangerous command scanner required
- file access limited to workflow workspace
- external side effects must use typed tools, not shell scripts

## 14. Tool Router Contract

Never expose all tools to the model.

Tool execution flow:

```text
step requests tool
-> retrieve relevant tool manifest
-> check user/org connection
-> check workflow permissions
-> check approval state
-> validate args
-> execute via Composio or direct API
-> store result artifact/report
-> append tool_call event
-> record usage
```

Required tool metadata:

- name
- provider
- scopes
- input schema
- output schema
- risk tier
- permission category
- approval behavior
- idempotency requirement

External send/post/publish/update actions require approval by default.

Blocked by default:

- delete data
- transfer money
- expose secrets
- change security settings
- create fake accounts
- bypass bot protection

## 15. Event And Reflection Contract

Events are the runtime truth.

Minimum event taxonomy:

- `workflow.created`
- `workflow.version.published`
- `run.started`
- `step.started`
- `step.completed`
- `step.failed`
- `artifact.created`
- `tool.called`
- `sandbox.command.started`
- `sandbox.command.completed`
- `approval.requested`
- `approval.approved`
- `approval.rejected`
- `issue.created`
- `run.completed`
- `run.failed`
- `reflection.proposed`

Event records need:

- correlation ID
- causation ID
- workflow ID
- run ID
- task/step ID when applicable
- event type
- severity
- structured payload
- created timestamp

Main AI should not receive every event. It receives compressed reflection when rules trigger:

- run completed with issues
- repeated failure
- verifier failed
- approval rejected
- user edited output heavily
- cost exceeded estimate
- workflow stuck
- weekly improvement cycle

## 16. Frontend Contract

The app must become workflow-first.

Primary navigation:

- Workflows
- Runs
- Approvals
- Artifacts
- Issues
- Integrations / Connections
- Sandboxes
- Analytics
- Settings

Core routes:

- `/app/new`
- `/app/workflows`
- `/app/workflows/[workflowId]`
- `/app/runs/[runId]`
- `/app/approvals`
- `/app/artifacts`
- `/app/issues`
- `/app/connections`
- `/app/billing`
- `/app/settings`

Main screens:

- new workflow prompt
- workflow preview
- workflow list
- workflow detail
- run detail timeline
- approval inbox
- artifact viewer
- `.flow` source diagnostics
- connection manager
- billing/credits

Chat should become:

- workflow command center
- run conversation
- workflow editor assistant

It must not remain the main product object.

Implementation rules:

- `@repo/*` is for workspace packages only.
- Each app keeps its local `@/*` alias for app-owned imports that cross route, app-boundary, or shared app folders.
- Short relative imports are acceptable inside one tightly colocated route folder.
- Check `@repo/design-system` before creating local UI controls.
- Use current design-system primitives first; restyle later through the design system.
- Local route wrappers may exist only for route-specific semantics and should compose design-system primitives.
- Blazity `next-enterprise` is a governance/performance reference, not a template to copy. Borrow its categories: Renovate, graph checks, testing layers, Storybook, observability, health checks, and performance budgets.
- Do not add Blazity packages blindly. This repo already uses Renovate, dependency-cruiser, Changesets, T3 Env, Storybook, LHCI config, and `packages/design-system`; repair/reuse these before adding duplicates.
- Treat `patch-package` as exception-only, semantic-release as rejected while Changesets owns releases, and `@next/bundle-analyzer` as non-default while Next `experimental-analyze` exists.
- Route cleanup must include a performance pass: LCP asset, client boundary, image/font/script behavior, Suspense/loading stability, rendering/caching strategy, and dependency impact.

## 17. Design Contract

The desired style is Manus-like restraint plus material-inspired operational UI.

Use:

- dense app shell
- layered surfaces
- restrained elevation
- clear hover/focus/active state layers
- semantic status colors
- stable dimensions for rows, cards, toolbars, timelines, and counters
- icons for tool buttons
- compact workflow cards and timelines
- material-like surface roles

Avoid:

- marketing hero as app entry
- decorative gradient/orb backgrounds
- oversized landing-page composition inside the app
- nested cards
- raw node canvas as default UX
- visible instructional text explaining every feature
- one-note monochrome or over-purple theme
- text overflow in buttons/cards/sidebar rows

Needed tokens:

- `surface`
- `surface-container-low`
- `surface-container`
- `surface-container-high`
- `outline`
- `outline-variant`
- `primary`
- `secondary`
- `tertiary`
- `success`
- `warning`
- `error`
- `approval`
- `running`
- `blocked`
- `artifact`
- `sandbox`
- `event`

## 18. Billing And Limits Contract

Autonomous workflows cannot be unlimited.

Meter:

- model tokens
- image generation
- tool calls
- sandbox seconds
- search calls
- storage/artifacts
- event volume above limits
- run/step counts

Every workflow needs:

- max credits per run
- max credits per day/month
- max runtime
- max tool calls
- max sandbox seconds
- max AI tasks
- on-exceed behavior

Budget exceed behavior should pause and ask, or fail safely according to workflow policy.

## 19. MVP Proof Workflow

Use social content operator as first proof.

Steps:

1. Research topics.
2. Draft posts.
3. Generate or mock visual brief.
4. Validate with sandbox command.
5. Ask for approval.
6. Mock publish.
7. Record artifacts.
8. Produce task reports.
9. Create issue card on optional failure.
10. Generate reflection packet.

Required proofs:

- [ ] `.flow` source compiles to AST.
- [ ] invalid `.flow` returns diagnostics.
- [ ] AST compiles to deterministic runtime JSON.
- [ ] runtime JSON persists as workflow version.
- [ ] Inngest executor runs compiled tasks.
- [ ] approval pauses and resumes execution.
- [ ] sandbox command writes and reads an artifact.
- [ ] tool permission can auto/ask/block.
- [ ] event log reconstructs the run timeline.
- [ ] UI shows run timeline and artifacts.

## 20. What To Do

- Read this memory before implementation.
- Run the Phase -1 base reset before workflow kernel work.
- Check `10-audit` before touching current routes/services.
- Check `10-audit/reset-upgrade-surface-audit-2026-05-23.md` before resetting, deleting, moving, or redesigning current canvas/files/search/tools/sandbox code.
- Check `09-research` and current official docs before implementing external APIs.
- Add workflow kernel in isolation.
- For dynamic triggers, use `workflow_triggers` rows plus static scheduler/event-router functions. Do not create one cron/function per user trigger.
- Normalize app/tool/worker/workflow events into internal EventContextPackets.
- Store TaskReports for worker outputs and wake main AI through Run Reflection Packets only when reflection rules require.
- Add focused tests before wiring app routes.
- Preserve existing useful app/service code until replacement has parity.
- Keep changes scoped by phase.
- Use source-backed findings.
- Add new MADRs when changing architecture decisions.

## 21. What Not To Do

- Do not start with a full rewrite.
- Do not start with a visual redesign.
- Do not run one broad latest-dependency sweep across the whole monorepo.
- Do not delete E2B templates or runtime paths before provider parity.
- Do not execute generated code in the production process.
- Do not let raw `.flow` text execute.
- Do not use chat/session/message tables as workflow truth.
- Do not create one Vercel Cron, route, or Inngest function per user `.flow` trigger.
- Do not use freeform worker-to-worker chat as the default context path.
- Do not wake the main AI on every event.
- Do not expose all tools to the model.
- Do not let external send/post/update bypass approval.
- Do not trust body/path `userId`.
- Do not rely on cookie presence alone as authorization.
- Do not make broad dependency upgrades in the same branch as auth, sandbox, and UI rewrites.
- Do not claim a source, framework, pricing, SDK, or platform behavior without checking current primary docs.

## 22. Research Rule

Before implementing anything dependent on modern external products, verify current official docs.

Must verify before implementation:

- Next.js 16.2 upgrade behavior
- Vercel Sandbox API and limits
- Vercel Workflow/Functions details if used
- Inngest steps, waits, signals, cancellation, and concurrency
- Better Auth org/session/API-key behavior
- Drizzle migration patterns
- Vercel AI SDK structured output/tool calling behavior
- Composio connector/auth behavior
- GitHub Actions syntax only as inspiration, not as a copied DSL
- Material Design 3 tokens/elevation/interaction guidance

Record findings in `09-research` with date, source URL, claim, evidence, implementation impact, and open questions.

## 23. Evidence Index

Primary memory inputs:

- [`README.md`](./README.md)
- [`_source/full-brief/AI_Workflow_OS_Full_Brief_for_Codex.txt`](./_source/full-brief/AI_Workflow_OS_Full_Brief_for_Codex.txt)
- [`00-product/product-brief.md`](./00-product/product-brief.md)
- [`01-architecture/architecture-map.md`](./01-architecture/architecture-map.md)
- [`01-architecture/technical-blueprint.md`](./01-architecture/technical-blueprint.md)
- [`01-architecture/scale-triggers-events-ecp.md`](./01-architecture/scale-triggers-events-ecp.md)
- [`02-workflow-kernel/compiler-stack.md`](./02-workflow-kernel/compiler-stack.md)
- [`02-workflow-kernel/flow-kernel-plan.md`](./02-workflow-kernel/flow-kernel-plan.md)
- [`03-backend/backend-segmentation.md`](./03-backend/backend-segmentation.md)
- [`03-backend/database-schema.md`](./03-backend/database-schema.md)
- [`04-frontend/frontend-segmentation.md`](./04-frontend/frontend-segmentation.md)
- [`04-frontend/sitemap-routes.csv`](./04-frontend/sitemap-routes.csv)
- [`05-design/design-direction.md`](./05-design/design-direction.md)
- [`06-security-billing/security-billing-plan.md`](./06-security-billing/security-billing-plan.md)
- [`07-madr/README.md`](./07-madr/README.md)
- [`07-madr/madr-decisions.md`](./07-madr/madr-decisions.md)
- [`07-madr/MADR-020-flow-source-language-compiler-ir-stack.md`](./07-madr/MADR-020-flow-source-language-compiler-ir-stack.md)
- [`07-madr/MADR-021-workflow-kernel-before-ui-rewrite.md`](./07-madr/MADR-021-workflow-kernel-before-ui-rewrite.md)
- [`07-madr/MADR-022-provider-neutral-sandbox-before-vercel-migration.md`](./07-madr/MADR-022-provider-neutral-sandbox-before-vercel-migration.md)
- [`07-madr/MADR-023-service-auth-contract.md`](./07-madr/MADR-023-service-auth-contract.md)
- [`07-madr/MADR-027-db-backed-trigger-registry.md`](./07-madr/MADR-027-db-backed-trigger-registry.md)
- [`07-madr/MADR-028-static-inngest-functions-for-runtime.md`](./07-madr/MADR-028-static-inngest-functions-for-runtime.md)
- [`07-madr/MADR-029-internal-event-context-packets.md`](./07-madr/MADR-029-internal-event-context-packets.md)
- [`07-madr/MADR-030-reflection-gated-main-ai.md`](./07-madr/MADR-030-reflection-gated-main-ai.md)
- [`08-plans/build-checklist.md`](./08-plans/build-checklist.md)
- [`08-plans/phase-minus-one-base-reset-plan.md`](./08-plans/phase-minus-one-base-reset-plan.md)
- [`08-plans/phase-zero-checklist.md`](./08-plans/phase-zero-checklist.md)
- [`08-plans/project-plan.csv`](./08-plans/project-plan.csv)
- [`09-research/research-index.md`](./09-research/research-index.md)
- [`09-research/2026-05-23-platform-research.md`](./09-research/2026-05-23-platform-research.md)
- [`09-research/2026-05-23-flow-source-language-vs-graphs.md`](./09-research/2026-05-23-flow-source-language-vs-graphs.md)
- [`09-research/2026-05-23-reset-upgrade-research.md`](./09-research/2026-05-23-reset-upgrade-research.md)
- [`09-research/2026-05-23-scale-triggers-events-ecp-validation.md`](./09-research/2026-05-23-scale-triggers-events-ecp-validation.md)
- [`10-audit/audit-index.md`](./10-audit/audit-index.md)
- [`10-audit/full-platform-audit-2026-05-23.md`](./10-audit/full-platform-audit-2026-05-23.md)
- [`10-audit/exhaustive-runtime-source-audit-2026-05-23.md`](./10-audit/exhaustive-runtime-source-audit-2026-05-23.md)
- [`10-audit/reset-upgrade-surface-audit-2026-05-23.md`](./10-audit/reset-upgrade-surface-audit-2026-05-23.md)
- [`10-audit/security-auth-audit.md`](./10-audit/security-auth-audit.md)
- [`10-audit/backend-services-audit.md`](./10-audit/backend-services-audit.md)
- [`10-audit/frontend-design-audit.md`](./10-audit/frontend-design-audit.md)
- [`10-audit/database-workflow-model-audit.md`](./10-audit/database-workflow-model-audit.md)
- [`10-audit/ci-deployment-dependency-audit.md`](./10-audit/ci-deployment-dependency-audit.md)
- [`10-audit/e2b-to-vercel-sandbox-migration-surface.md`](./10-audit/e2b-to-vercel-sandbox-migration-surface.md)
- [`10-audit/refactor-readiness-roadmap.md`](./10-audit/refactor-readiness-roadmap.md)
- [`10-audit/phase-zero-current-state-audit.md`](./10-audit/phase-zero-current-state-audit.md)
- [`11-validation/validation-index.md`](./11-validation/validation-index.md)
- [`11-validation/platform-viability-validation.md`](./11-validation/platform-viability-validation.md)

The copied project-pack source files under [`_source/project-pack`](./_source/project-pack) were checked against their normalized copies and matched.

## 24. Final Operating Decision

Build the platform, but do it in hard phases.

The winning direction is:

```text
AI writes and repairs `.flow`.
Humans review workflow previews, approvals, runs, artifacts, and patches.
The platform compiles source into strict internal structures.
Durable execution handles long-running work.
Permissions, ownership, events, and billing make autonomy safe.
```

The immediate next implementation phase is not branding, UI polish, or workflow features. It is Phase -1 base reset, then phase-zero hardening, then the isolated `.flow` kernel.
