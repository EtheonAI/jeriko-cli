# MADR Decision Records

## MADR-001: Use hidden YAML + compiled AST for workflow definitions

**Status:** Accepted

### Context

We need readable, versionable workflow definitions but safe execution.

### Decision

AI generates a typed AST; system validates; YAML is rendered for storage/export/advanced view; runtime executes AST, not raw Markdown.

### Consequences

Combines GitHub Actions-like readability with schema safety.

### Alternatives considered

Raw JSON only; Markdown skills only; visual nodes only.

## MADR-002: Use Inngest as durable orchestrator

**Status:** Accepted

### Context

Workflows need retries, waits, approval pauses, events, monitoring, and cancellation.

### Decision

Use Inngest for durable step orchestration while keeping our own workflow interpreter.

### Consequences

Avoids building low-level workflow infra from scratch.

### Alternatives considered

Vercel Workflows; Temporal; custom queue.

## MADR-003: Use Next.js + Vercel deployment

**Status:** Accepted

### Context

Solo/bootstrapped developer needs fast full-stack deployment and Vercel Sandbox compatibility.

### Decision

Use Next.js App Router hosted on Vercel.

### Consequences

Fast iteration and tight sandbox/deployment integration.

### Alternatives considered

AWS-only; custom Node server; Remix.

## MADR-004: Use Postgres + Drizzle ORM

**Status:** Accepted

### Context

Need relational consistency, JSONB AST storage, versioning, audit logs.

### Decision

Use Postgres with Drizzle migrations and typed schema.

### Consequences

Good balance of typing, SQL, JSONB, and speed.

### Alternatives considered

Prisma; Supabase-only client; MongoDB.

## MADR-005: Use better-auth for auth and organizations

**Status:** Accepted

### Context

Need modern auth with org/team extension path.

### Decision

Use better-auth, extend with org/membership tables if needed.

### Consequences

Avoids building auth from scratch.

### Alternatives considered

NextAuth/Auth.js; Clerk; Supabase Auth.

## MADR-006: Use Vercel Sandbox for code/file execution

**Status:** Accepted

### Context

AI needs to create/run scripts safely without touching production server.

### Decision

Execute generated .py/.js/.sh only in Vercel Sandbox.

### Consequences

Keeps code execution isolated and compatible with Vercel stack.

### Alternatives considered

E2B; Modal; Daytona; local Docker.

## MADR-007: Use Composio plus direct APIs for tools

**Status:** Accepted

### Context

Need broad app access but also control for critical tools.

### Decision

Use Composio for breadth; implement direct APIs for high-value integrations if needed.

### Consequences

Accelerates connector coverage while preserving platform-level policy.

### Alternatives considered

Build all connectors; only MCP; only direct APIs.

## MADR-008: Approval required for external actions

**Status:** Accepted

### Context

Trust is core; autonomous send/post/update can cause harm.

### Decision

All send/post/publish/update external actions require approval by default.

### Consequences

Reduces risk and improves user trust.

### Alternatives considered

Allow auto actions from day one.

## MADR-009: Append-only event log as execution truth

**Status:** Accepted

### Context

Need debuggability, replay, timeline, audit, pulse feed.

### Decision

Every run emits events into workflow_events and optional events.jsonl.

### Consequences

Enables live timeline and support debugging.

### Alternatives considered

Only store final statuses.

## MADR-010: Use SSE for live run updates first

**Status:** Accepted

### Context

Run events are one-way from server to client; SSE is simpler than WebSockets.

### Decision

Use SSE endpoint per run; polling fallback.

### Consequences

Lower complexity and sufficient for MVP.

### Alternatives considered

WebSockets; hosted realtime; polling only.

## MADR-011: Simple UX first, Advanced YAML second

**Status:** Accepted

### Context

Users should not face YAML unless they choose advanced mode.

### Decision

Prompt, preview, cards, approvals, artifacts are primary UI.

### Consequences

Avoids n8n/Beam complexity.

### Alternatives considered

YAML editor first; node canvas first.

## MADR-012: Use model router with cheap/strong roles

**Status:** Accepted

### Context

Costs must be controlled for bootstrap economics.

### Decision

Route compiler/hard reasoning to stronger model; routine tasks to cheap model; scripts for deterministic work.

### Consequences

Cheaper than broad single-agent execution.

### Alternatives considered

One expensive model for all tasks.

## MADR-025: Remove checked-in E2B template payload from active base

**Status:** Accepted

### Context

The repo is moving to Vercel Sandbox behind a provider-neutral interface, while checked-in E2B desktop templates preserve old Manus assumptions.

### Decision

Delete checked-in E2B templates and local-template scripts. Keep E2B runtime code only as temporary compatibility.

### Consequences

Reduces repo noise and prevents the old E2B desktop image from becoming the new foundation.

## MADR-096: Require durable runs and resumable UI reconnect

**Status:** Accepted

### Context

The platform must continue active work after browser refresh, tab close, network loss, or user return. Current code has only partial resume hints.

### Decision

Separate durable workflow execution from browser streams. Reconnect UI by durable `runId` and event cursor. Browser disconnect is not cancellation; only explicit Stop/Cancel emits a durable cancellation event.

### Consequences

Workflow rebuild must include persisted runs, events, artifacts, snapshots, replay, and cancellation tests before claiming Manus-style resume parity.

### Alternatives considered

Keep long-running work in one app route stream; rely only on AI SDK resumable chat streams; treat browser close as cancellation.

## MADR-033: Deactivate legacy services from active workspace

**Status:** Accepted

### Context

The old `services/*` tree was built to copy Manus-style decomposition and now conflicts with the workflow-first reset.

### Decision

Remove `services/*` and `packages/service-utils` from the active workspace graph. Keep them temporarily on disk as legacy reference until app-side replacement boundaries are complete.

### Consequences

The active monorepo no longer builds or tests `@jeriko/*` service packages, and backend work can be redesigned around the workflow kernel, contracts, app route handlers, and provider-neutral adapters.

### Alternatives considered

Keep fixing services; delete services immediately; move services under packages/backend.

### Alternatives considered

Keep templates; rename them as Vercel templates; delete all E2B code immediately.

## MADR-026: Defer non-cleanup type debt to upgrade phase

**Status:** Accepted

### Context

Cleanup verification exposed AI SDK, Zod, and orchestrator type drift that is not caused by deleted files and will move again during package upgrades.

### Decision

Do not chase non-cleanup type debt during deletion-first cleanup. Document it and fix it during package-family upgrades.

### Consequences

Keeps cleanup focused and avoids stabilizing old APIs before reset.

### Alternatives considered

Fix all type errors now; ignore verification; upgrade packages during cleanup.

## MADR-031: Use route-local Next 16 app structure

**Status:** Accepted

### Context

The app has route groups but mixed ownership, global component buckets, broad client boundaries, and unclear app ownership.

### Decision

Use a primary `apps/app/src/app` boundary, route groups, route-local `_components`, `_actions`, `_hooks`, `_lib`, `_types`, shared UI primitives, and server-first pages.

### Consequences

Clarifies ownership and reduces client bundle risk before workflow UI work.

### Alternatives considered

Keep current global buckets; global features folder only; copy prediction-market exactly.

## MADR-027: Use DB-backed trigger registry

**Status:** Accepted

### Context

User workflows can define many schedules and event triggers. Creating one Vercel Cron, route, or Inngest function per logical trigger would not scale or stay maintainable.

### Decision

Store user-defined triggers in `workflow_triggers`. Use static scheduler/event-router functions to emit `workflow/run.requested`.

### Consequences

Dynamic triggers become auditable product data with rate limits, dedupe, jitter, misfire policy, and plan controls.

### Alternatives considered

One Vercel Cron per user trigger; one Inngest function per workflow; external scheduler SaaS per trigger.

## MADR-028: Use static Inngest functions for runtime execution

**Status:** Accepted

### Context

The runtime needs durable waits, retries, approvals, callbacks, event routing, and observability, while workflows and triggers are dynamic.

### Decision

Use a small static function inventory: scheduler tick, event router, generic executor, approval resume, worker callback, reflection, notifications, usage rollup, watchdog, and cleanup.

### Consequences

User workflows stay data/compiled specs and runtime code stays testable.

### Alternatives considered

Generate functions dynamically; put all work in one scheduler; build a custom queue first.

## MADR-029: Use internal EventContextPackets

**Status:** Accepted

### Context

Workers, tools, apps, and workflows need to pass context without expensive freeform worker chat or raw log forwarding.

### Decision

Normalize app, workflow, task, and worker outputs into internal EventContextPackets.

### Consequences

Events become routeable, queryable, auditable, and billable while UI can update without waking main AI.

### Alternatives considered

Freeform worker chat; raw logs to main AI; public ECP protocol from day one.

## MADR-030: Wake main AI only through reflection gates

**Status:** Accepted

### Context

Waking main AI on every event recreates a high-token Manus-style orchestration loop.

### Decision

Routine execution emits EventContextPackets and TaskReports. Main AI wakes by default only for creation, user questions, edits, failures, rejections, cost/stuck conditions, or scheduled improvement.

### Consequences

Recurring workflows stay cheaper and observable while main AI focuses on repair, explanation, and improvement.

### Alternatives considered

Main AI orchestrates every step; no reflection loop; user-only debugging.

## MADR-013: Use safe YAML subset

**Status:** Accepted

### Context

YAML can contain unsafe/custom constructs and ambiguity.

### Decision

Parse restricted YAML, reject custom tags/unknown keys, validate schema.

### Consequences

Prevents unsafe execution and weird parser behavior.

### Alternatives considered

Trust arbitrary YAML.

## MADR-014: Use workflow credits for billing

**Status:** Accepted

### Context

Autonomous workflows have variable model/tool/sandbox costs.

### Decision

Meter usage events and charge workflow credits with hard caps.

### Consequences

Prevents free/low-tier abuse and surprise costs.

### Alternatives considered

Flat unlimited $20 plan.

## MADR-015: No public workflow marketplace in MVP

**Status:** Accepted

### Context

Public arbitrary workflows/scripts create security risk.

### Decision

Start with private workflows and curated internal templates only.

### Consequences

Reduces supply-chain and abuse risk.

### Alternatives considered

Open public marketplace immediately.

## MADR-016: Use templates as starting points, not product core

**Status:** Accepted

### Context

Templates help onboarding, but core is prompt-to-workflow compiler.

### Decision

Library contains premade workflows; users can prompt from scratch.

### Consequences

Balances simplicity and capability.

### Alternatives considered

Template-only product.

## MADR-017: Use tool router instead of exposing all tools

**Status:** Accepted

### Context

All-tool context is expensive and risky.

### Decision

Expose only relevant tool schemas per step after permission filtering.

### Consequences

Reduces token cost and wrong tool calls.

### Alternatives considered

Dump all tools into model context.

## MADR-018: Build three proof workflows for MVP

**Status:** Accepted

### Context

Need prove engine with concrete value without overbuilding.

### Decision

Social content, inbox drafts, lead research.

### Consequences

Covers research, files, tools, approvals, schedules, memory.

### Alternatives considered

Attempt universal workflows on day one.

## MADR-032: Use T3 Env as the env contract

**Status:** Accepted

### Context

The repo needs typed validated env access, but the current app env aggregator can require unrelated integration secrets during builds.

### Decision

Use T3 Env as the validation/type contract, Next/Vercel as app env loaders, `@next/env` only for standalone scripts, and scoped app env files.

### Consequences

Keeps build validation and server/client safety while avoiding optional integration coupling.

### Alternatives considered

Use `process.env` directly; use `dotenv`; use `@next/env` as validation; keep one huge app env aggregator.

## MADR-034: Deactivate redundant API app and legacy compose services

**Status:** Accepted

### Context

`apps/api`, root service compose files, and the old/deprecated Vitest workspace config still referenced active boundaries that no longer match the reset.

### Decision

Move `apps/api` to `legacy/deactivated-apps/api`, move old service compose files to `legacy/manus-clone/docker`, and keep active Docker as infrastructure only.

### Consequences

The active graph is smaller, and API/server work stays in `apps/app/app/api` until a separate deploy boundary is justified.

### Alternatives considered

Keep `apps/api` active; delete it immediately; keep old service compose files in root.

## MADR-039: Use docs.json as the single Mintlify docs config

**Status:** Accepted

### Context

Latest Mintlify CLI generated `docs.json` from legacy `mint.json` and warned about legacy config while docs lint exposed stale starter links.

### Decision

Use `apps/docs/docs.json` as the only Mintlify config; delete `mint.json` and update stale links/text.

### Consequences

Removes duplicate config state and makes docs broken-link lint clean.

### Alternatives considered

Keep both configs; keep only `mint.json`; delete docs app.

## MADR-040: Defer BaseHub fixes and evaluate Payload as the CMS replacement

**Status:** Accepted

### Context

The current web CMS is BaseHub-backed and blocks root build, but the product direction no longer requires preserving BaseHub.

### Decision

Do not fix BaseHub as the future CMS; isolate/remove the active BaseHub build dependency and evaluate Payload later after CMS boundaries are decided.

### Consequences

Avoids wasting reset time on a CMS likely to be replaced while keeping build gates truthful.

### Alternatives considered

Fix BaseHub now; delete web; install Payload immediately; ignore CMS build failures.

## MADR-041: Keep feature flags while lazy-loading product auth

**Status:** Accepted

### Context

`apps/web` should keep feature flags, but module-level auth/database imports made web build require `DATABASE_URL`.

### Decision

Keep feature flags and T3 Env; lazy-load product auth/analytics inside flag evaluation.

### Consequences

Preserves feature flags while removing product DB coupling from marketing build.

### Alternatives considered

Remove feature flags; use `process.env`; require `DATABASE_URL` for web builds.

## MADR-042: Adopt canonical engineering standards before further cleanup

**Status:** Accepted

### Context

Cleanup and refactor work needs one mandatory rulebook to prevent package/env/Next.js drift.

### Decision

Adopt `docs/ai-workflow-os/00-ENGINEERING-STANDARDS.md` as the read-first engineering standard.

### Consequences

Reduces assumptions and makes future cleanup/refactor decisions reproducible.

### Alternatives considered

Keep rules spread across docs/chat; rely only on generic instructions; add standards after cleanup.

## MADR-043: Require package-specific playbooks before critical refactors

**Status:** Accepted

### Context

Repo-level standards are necessary but not enough for package-specific env/runtime/provider behavior.

### Decision

Require playbooks before P0 package/app refactors and P1 architecture changes, using the package best-practices registry.

### Consequences

Prevents package drift while avoiding exhaustive docs for every transitive dependency.

### Alternatives considered

Document every dependency before continuing; rely only on repo-level standards; write playbooks after code changes.

## MADR-072: Build @repo/connectors around current Composio sessions

**Status:** Accepted

### Context

The old Tool Router beta idea is now GA and implemented through Composio sessions; app connections, tools, direct execution, and triggers need a package boundary.

### Decision

Create `@repo/connectors` with session-first Composio integration, provider-neutral contracts, mock/direct adapters, package-local env, and trigger/event normalization.

### Consequences

Keeps Composio SDK/auth/session internals out of apps and lets `@repo/ai/tools` wrap side effects with platform policy.

### Alternatives considered

Copy beta Tool Router API; put Composio directly in apps; expose raw connector tools to workflows.

## MADR-073: Policy-wrap connector actions in @repo/ai/tools

**Status:** Accepted

### Context

AI SDK tools with `execute` run automatically and connector actions can produce external side effects.

### Decision

Add a server-only `@repo/ai/tools` connector bridge with manifests, risk/permission metadata, approval policy, AI SDK conversion, and delegation to `@repo/connectors`.

### Consequences

Prevents raw provider actions from being model-callable without platform policy while preserving Composio/direct connector isolation.

### Alternatives considered

Expose raw Composio tools directly; put policy in `@repo/connectors`; require only app-local approval.

## MADR-074: Modernize @repo/ai by deleting the dead runtime layer

**Status:** Accepted

### Context

The old AI package mixed AI SDK v6 dependency surface with removed agent-service assumptions, E2B naming, custom stream/agent wrappers, local execution registries, and source-local tests.

### Decision

Delete the dead runtime layer and use current AI SDK v6 primitives directly for agents, tools, model messages, and stream helpers while keeping server-only platform tool policy under `@repo/ai/tools`.

### Consequences

The package stops preserving fake runtime compatibility and can be validated as a real package boundary.

### Alternatives considered

Keep compatibility exports; patch the local agent wrapper; delete all AI UI immediately during the first runtime cleanup.

## MADR-075: Keep @repo/ai as a core AI SDK and platform-tool package

**Status:** Accepted

### Context

After runtime cleanup, `@repo/ai` still carried old Manus workbench UI, canvas, chat components, hooks, providers, assistant-ui adapters, and browser/terminal/code panes with no active app consumers.

### Decision

Reset `@repo/ai` to core AI SDK primitives, server helpers, provider/model helpers, platform tools, schema-only tool definitions, and connector bridge code. Product AI UI belongs in `apps/app` route-local folders first; generic primitives belong in `@repo/design-system`.

### Consequences

Old `@repo/ai/components`, `@repo/ai/hooks`, and `@repo/ai/providers` imports intentionally break. The product UI must be rebuilt deliberately on top of AI SDK message parts and design-system primitives.

### Alternatives considered

Keep salvage UI in the AI package; move old UI to design-system; keep assistant-ui as the main abstraction.

## MADR-076: Build custom AI UI on Vercel AI SDK

**Status:** Accepted

### Context

The platform needs workflow-native uploads, downloads, files, voice-to-text, tool rendering, approvals, artifacts, sandbox views, and `.flow` editing. Generic assistant UI packages do not own those product semantics.

### Decision

Use Vercel AI SDK as the protocol/runtime layer and build app-local custom UI. Use `@ai-sdk/react` in `apps/app` when the chat UI is implemented, render from `UIMessage.parts`, and treat AI Elements as reference/copyable patterns rather than a required dependency.

### Consequences

The platform keeps full UI control, but must implement and test its own composer, scrolling, uploads, tool cards, approval cards, artifact panes, and voice UX.

### Alternatives considered

Keep assistant-ui; adopt AI Elements wholesale; build a package-level UI before app requirements are proven.

## MADR-077: Segment @repo/ai by AI SDK capability

**Status:** Accepted

### Context

The cleaned AI package needs to expose the advanced AI SDK capabilities the platform will use without becoming a UI dumping ground again.

### Decision

Segment `@repo/ai` into capability subpaths: `agents`, `messages`, `server`, `media`, `models`, `retrieval`, `observability`, `testing`, and server-only `tools`.

### Consequences

Each feature has an intentional import path, public API tests can guard the contract, and React/assistant UI dependencies stay out of the core AI package.

### Alternatives considered

One root barrel only; keep the old `lib/components/hooks/providers` layout; split every feature into separate packages before real consumers exist.

## MADR-078: .flow orchestrates AI SDK subagents, tools, and reporting

**Status:** Accepted

### Context

The platform needs internal tools, connector tools, subagents, tool rendering, human approvals, abort/stop behavior, cron jobs, event triggers, and configurable subagent reporting.

### Decision

Use `.flow` as the orchestration policy layer, AI SDK as the model/tool/agent primitive layer, and Inngest/runtime execution for durability, triggers, retries, waits, and cancellation.

### Consequences

Subagent reporting modes, tool permissions, and cancellation policy become compiler/runtime concepts instead of implicit chat behavior. UI renders normalized tool parts and runtime events rather than raw connector SDK shapes.

### Alternatives considered

Let the main chat agent orchestrate everything; expose raw connector tools directly; model cancellation as only a client stream abort.

## MADR-079: Use managed Inngest first behind a provider-neutral runtime boundary

**Status:** Accepted

### Context

`.flow` needs durable execution for schedules, dynamic events, approvals, retries, waits, connector callbacks, subagent callbacks, cancellation, observability, and concurrency. We may later self-host Inngest or use Vercel Workflow, but choosing an operations-heavy runtime too early would slow product proof.

### Decision

Use managed Inngest first for MVP workflow execution. Keep durable execution behind a provider-neutral runtime adapter so `@repo/flow` does not import Inngest, Vercel Workflow, queues, database clients, or provider SDKs.

### Consequences

We get durable execution primitives without operating runtime infrastructure, while preserving a self-hosted Inngest or Vercel Workflow exit path. Managed limits must shape payload, state, concurrency, and artifact design.

### Alternatives considered

Self-host Inngest from day one; use Vercel Workflow as the default now; build a custom durable queue/runtime.

## MADR-080: Prefer Inngest over Vercel Workflow for the dynamic `.flow` runtime

**Status:** Accepted

### Context

The runtime needs dynamic user schedules, external connector events, approvals, callbacks, event fan-out, cancellation, concurrency, observability, and a provider-neutral `.flow` interpreter. Vercel Workflow is durable and Vercel-native, but is optimized around code-authored workflows using `"use workflow"` and `"use step"` directives.

### Decision

Use Inngest as the preferred MVP runtime for dynamic `.flow` execution. Keep Vercel Workflow as a tracked evaluation path, not the default runtime.

### Consequences

Dynamic triggers remain DB rows handled by a small static Inngest scheduler/event-router/executor inventory. `@repo/flow` stays provider-neutral. Vercel Workflow can be re-evaluated after GA maturity and after proving interpreter fit.

### Alternatives considered

Use Vercel Workflow now; use both Inngest and Vercel Workflow in MVP; self-host Inngest from day one; build a custom durable runtime.

## MADR-096A: Harden Husky and lint-staged for large reset commits

**Status:** Accepted

### Context

A failed commit attempt staged local pnpm store files and exposed a real Storybook React Hooks violation. lint-staged protected the working tree with its backup/revert behavior, but the hook path needed hardening before pushing the large reset.

### Decision

Keep current Husky and lint-staged, use a minimal local-only pre-commit hook, explicitly filter staged files to `ACMR`, run serially, use relative paths, bound command length, ignore `.pnpm-store/`, and keep repo-aware lint-staged chunking/filtering in `.lintstagedrc.mjs`.

### Consequences

Large reset commits become more deterministic, generated local store files cannot enter the index, and real active-code lint failures still block commits.

### Alternatives considered

Bypass hooks; disable lint-staged stash/revert; run full repo lint in pre-commit; replace local tooling during the commit fix.

## MADR-097: Adopt Flow Runtime Pack v0.1 as blueprint, not active runtime code

**Status:** Accepted

### Context

The downloaded `flow_language_runtime_pack_v0_1` is a valuable end-to-end research pack for `.flow`, compiler stages, semantic validation, Inngest runtime sketches, ECP, TaskReports, FlowPatch, permissions, storage, billing, and database tables. Its implementation also mixes YAML parsing, Inngest, runtime placeholders, and provider concerns inside one package.

### Decision

Copy the pack into `docs/ai-workflow-os/_source/flow-language-runtime-pack-v0-1`, adopt its concepts and checklists, and do not import its active implementation into `@repo/flow`.

`@repo/flow` remains provider-neutral and must not import YAML, Inngest, AI SDK, Vercel Sandbox, database clients, Next.js, or UI code.

### Consequences

The repo keeps the pack as stable evidence while implementation proceeds through the existing package boundaries: `@repo/flow`, `@repo/ai`, `@repo/connectors`, `@repo/sandbox`, `@repo/database`, app/server runtime adapters, and `apps/app`.

### Alternatives considered

Import the pack directly; use the pack's YAML parser first; leave the pack only in Downloads; split the pack into many packages immediately.

## MADR-098: Build `.flow` end-to-end runtime through package phases

**Status:** Accepted

### Context

The target platform needs prompt-to-`.flow` generation, compiler semantics, workflow persistence, durable runtime execution, AI SDK workers, policy-wrapped tools/connectors/sandbox, and resumable app UI. Current code has only foundations.

### Decision

Finish `@repo/flow` first, then `@repo/database`, runtime adapter/Inngest, `@repo/ai`, tools/connectors/sandbox, and finally `apps/app` workflow UI/API.

### Consequences

Prevents app routes from becoming the runtime and keeps provider boundaries testable before product UI work.

### Alternatives considered

Build app UI first; import the runtime pack directly; put Inngest inside `@repo/flow`; let main chat orchestrate everything.

## MADR-099: Use AI SDK subagents with Gateway-first model routing

**Status:** Accepted

### Context

The platform needs a model and subagent architecture for `.flow` that supports orchestration, worker delegation, text/research/code/image/voice/video work, streaming progress, durable reports, cost control, and provider flexibility.

### Decision

Use Vercel AI Gateway first behind `@repo/ai` model aliases and policy. Use AI SDK subagents for scoped worker execution when context isolation or specialist tools justify the overhead. Keep OpenRouter as a secondary adapter and direct provider keys as a controlled escape hatch.

### Consequences

Model choice becomes policy-driven instead of hardcoded. Gateway gives native AI SDK/Vercel integration and zero-markup paid-tier economics. OpenRouter/direct providers remain available without leaking provider SDKs into app routes.

### Alternatives considered

Gateway only; OpenRouter first; direct provider keys everywhere; custom subagent loop without AI SDK.
