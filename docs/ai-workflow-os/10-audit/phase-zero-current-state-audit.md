# Phase Zero Current State Audit

Date: 2026-05-23

Status: first-pass codebase audit. This report records evidence-backed findings only. It is not a complete line-by-line audit of every file.

## Executive Finding

The repo is a large monorepo with enough useful infrastructure to avoid starting over, but the current product center of gravity is still Manus-style chat sessions, scheduled prompts, E2B sandboxes, and file/library UI. The AI Workflow OS concept requires a new workflow kernel and runtime data model.

The right approach is additive: create workflow primitives beside the current app, migrate surfaces in phases, and delete old Manus/E2B code only after proof.

## Repo Shape

Evidence:

- Workspace packages are defined in `pnpm-workspace.yaml` lines 1-4 as `apps/*`, `packages/*`, and `services/*`.
- Root package is `jeriko` with Turbo scripts for build, dev, service startup, tests, boundaries, and dependency updates (`package.json` lines 10-41).
- Root runtime baseline is Node `>=20.9.0` and `pnpm@10.19.0` (`package.json` lines 68-71).
- Apps present: `app`, `web`, `docs`, `api`, `email`, `studio`, `storybook`.
- Service packages present: billing, connector, device, file, gateway, knowledge, notification, orchestrator, project, sandbox, sandbox-proxy, search, task, webhook, webrtc-media, website.

Recommendation:

- Keep monorepo structure.
- Add a new package for workflow kernel, likely `packages/workflow`, before editing app routes deeply.
- Add workflow service responsibility either to `services/task` first or a new `services/workflow` only if boundaries become too crowded.

Risk:

- The worktree is currently very dirty with many unrelated changes. Do not run broad cleanup or destructive git commands during planning.

## Next.js App State

Evidence:

- Initial audit state: `apps/app/package.json` used Next `16.1.5`, React `19.2.3`, React DOM `19.2.3`, Vercel AI SDK `ai ^6.0.77`, and Tailwind `4.1.7` (`apps/app/package.json` lines 55-83 and 99-101 at audit time). Post-upgrade package state is tracked in `ci-deployment-dependency-audit.md`.
- `apps/app/proxy.ts` exists and exports `proxy`, matching the Next 16 convention (`apps/app/proxy.ts` line 19).
- The proxy treats a Better Auth session cookie as login proof (`apps/app/proxy.ts` lines 61-63).
- The shared Next config enables React Compiler, workspace transpilation, security headers, CSP, and image config (`packages/next-config/index.ts` lines 53-120).

Keep:

- Next App Router foundation.
- `proxy.ts` convention.
- Existing test hooks and Playwright setup for app-level verification.

Modify:

- Upgrade app from Next `16.1.5` to selected `16.2.x`.
- Audit auth proxy behavior. Cookie presence is not enough for high-confidence route security.
- Update CSP once Vercel Sandbox preview domains are confirmed; current CSP explicitly allows E2B domains (`packages/next-config/index.ts` lines 42-43).

Risk:

- Medium. The app is already on v16, but auth and sandbox CSP are launch-critical.

## Auth And Org State

Evidence:

- Better Auth is configured in `packages/auth/src/server.ts`.
- Email/password is enabled, requires email verification, and uses 12-128 character passwords (`packages/auth/src/server.ts` lines 44-50).
- Google and GitHub social providers are configured if env vars exist (`packages/auth/src/server.ts` lines 89-101).
- The Better Auth organization plugin is installed with create-org, membership limit, and invite email behavior (`packages/auth/src/server.ts` lines 104-127).
- Session cookie cache is enabled for 5 minutes (`packages/auth/src/server.ts` lines 130-136).
- A default API key is created for every new user in a database hook (`packages/auth/src/server.ts` lines 156-179).

Keep:

- Better Auth and org plugin.
- Existing email verification and invite email paths.

Modify:

- Rename app/user-facing brand strings from Jeriko to the new platform name when the name is final.
- Separate API keys for user API access from internal sandbox proxy tokens.
- Add org-scoped workflow authorization policies and approval authority checks.

Risk:

- High for production if proxy/session validation and org-scoped access are not audited before workflow data is exposed.

## Database State

Evidence:

- Database package exposes Drizzle scripts: `db:generate`, `db:migrate`, `db:push`, `db:studio`, `db:drop` (`packages/database/package.json` lines 28-33).
- Existing schema files cover sessions, scheduled tasks, sandboxes, files, projects, connectors, billing, user secrets, websites, and related domains.
- Scheduled tasks table supports recurring/cron/trigger tasks and Composio trigger fields (`packages/database/src/schema/scheduledTasks.ts` lines 35-117).
- Task execution history exists but is tied to scheduled tasks and sessions (`packages/database/src/schema/scheduledTasks.ts` lines 134-158).
- Sandboxes table stores `e2bSandboxId` and `templateId` as first-class fields (`packages/database/src/schema/sandboxes.ts` lines 35-38).
- Usage ledger exists and includes step/tool/vm usage event types (`packages/database/src/schema/billing.ts` lines 408-435).

Keep:

- Drizzle/Postgres.
- Billing and usage ledger concepts.
- Files/artifacts foundation where reusable.
- Projects/org ownership concept.

Modify:

- Add workflow-native tables from the source schema: workflows, workflow_versions, workflow_files, workflow_runs, run_steps, workflow_events, approvals, artifacts, tool_calls, sandbox_sessions, usage_events, memory_patches.
- Do not overload `agentSessions` or `scheduledTasks` as workflow tables.
- Provider-neutralize sandbox schema: add provider/providerSandboxId/runtime/capabilities/ports metadata rather than relying on `e2bSandboxId`.

Risk:

- High. Without new workflow tables, `.flow` will collapse into chat metadata and become hard to debug or version.

## Inngest And Task Orchestration

Evidence:

- Task service depends on Inngest (`services/task/package.json` line 22).
- Existing `executeTask` Inngest function listens to `task/execute` (`services/task/src/routes/inngest.ts` lines 24-115).
- The task execution flow creates or reuses an agent session, writes messages, marks executions running, and calls the orchestrator (`services/task/src/routes/inngest.ts` lines 155-260).
- This model is prompt/session based, not `.flow` compiled-JSON based.

Keep:

- Inngest as durable runner.
- The pattern of wrapping external work in `step.run`.
- Wait-for-approval pattern.

Modify:

- Add generic workflow executor: `workflow/run.execute`.
- Dispatch by normalized task type: `ai_task`, `tool_call`, `sandbox_command`, `human_review`, `verify`, `wait`, `emit`, `reflection`.
- Store each task result as a task report plus workflow event.

Risk:

- Medium-high. Inngest can support the model, but only if the `.flow` compiler produces stable IDs and bounded execution plans.

## Sandbox State

Evidence:

- Sandbox service imports `@e2b/code-interpreter` at `services/sandbox/src/index.ts` line 2.
- Sandbox service stores active E2B instances in memory (`services/sandbox/src/index.ts` lines 14-18).
- It uses E2B `getHost` for terminal server URLs (`services/sandbox/src/index.ts` lines 34-41).
- It requires `E2B_API_KEY` (`services/sandbox/src/index.ts` line 167).
- Orchestrator has an `e2b-manager` with Manus-pattern assumptions: one sandbox per session, E2B hibernation/resume, proxy token injection, Neko, code-server, and E2B retention windows (`services/orchestrator/src/lib/e2b-manager.ts` lines 1-21 and 84-98).
- An adapter interface already exists but is named E2B (`services/sandbox/src/lib/adapters/e2b-adapter.interface.ts` lines 1-6 and 33-91).

Keep:

- The adapter idea.
- The execution result shape: stdout, stderr, exit code, error.
- File IO, shell execution, lifecycle, and status capabilities.

Modify:

- Rename the adapter contract to provider-neutral.
- Add Vercel Sandbox adapter.
- Move E2B-specific port URL and hibernation logic behind provider capabilities.
- Update DB schema and CSP for provider-neutral previews.

Risk:

- Very high. This is the deepest migration surface.

## Frontend State

Evidence:

- Authenticated routes include actions/automations, applications, chat, files/library, projects, search, webhooks, and settings.
- `packages/ai/package.json` exports E2B-specific hooks (`./hooks/use-e2b-stream` and `./hooks/use-e2b-terminal`, lines 39-46).
- Current UI has many reusable pieces for prompts, chat, files, approvals/tool renderers, canvas, terminal/browser views, and settings.

Keep:

- Sidebar/header layout patterns.
- Prompt composer pieces.
- File/library components where they can become workflow artifacts.
- AI tool renderer patterns for live run timeline.

Modify:

- Add workflow-first routes: `/workflows`, `/workflows/[id]`, `/runs/[id]`, `/approvals`, `/connections`, `/library`, `/analytics`.
- Rename E2B hooks to generic sandbox hooks before Vercel-specific UI is added.
- Reframe chat as "command and edit workflow" rather than the whole product primitive.

Risk:

- Medium. There is a lot to salvage, but route/product vocabulary must change.

## Design/CSS State

Evidence:

- Shared design CSS defines neutral OKLCH tokens and Manus/Jeriko-specific variables (`packages/design-system/styles/globals.css` lines 9-65).
- Dark mode keeps Manus-like sidebar and canvas variables (`packages/design-system/styles/globals.css` lines 67-122).
- App CSS explicitly contains "Manus-matching markdown rendering" (`apps/app/app/styles.css` lines 5-9).

Keep:

- Tailwind v4 setup.
- Manus-like density and restrained surfaces.
- Existing dark/light token support.

Modify:

- Introduce Material-inspired token roles: surface, surface-container-low/high, outline, outline-variant, primary/secondary/tertiary, error, success, warning, state layers, and elevation.
- Keep cards restrained and avoid marketing-page patterns.
- Build a workflow workbench visual language: timeline, task rows, approvals, artifact shelves, issue cards, version chips.

Risk:

- Medium. The current neutral palette is usable, but the redesign needs more structure and a distinct product identity.

## Phase-Zero Decision

Proceed, but with this sequence:

1. Document current state and migration surfaces.
2. Implement `.flow` parser/compiler in isolation.
3. Add workflow DB schema and generated migrations.
4. Execute one mock workflow without real tools.
5. Add Vercel Sandbox adapter.
6. Build workflow UI shell.
7. Migrate E2B-dependent UI/service behavior after provider-neutral proof.

Do not start by deleting E2B templates, replacing the design system, or rewriting all routes.
