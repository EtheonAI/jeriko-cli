# Reset And Upgrade Surface Audit

Date: 2026-05-23

Scope: current Jeriko codebase reset planning for AI Workflow OS, covering workspace cleanup, package upgrade order, Vercel Sandbox migration, file rendering, search/tools, side canvas/workbench, data model, and service/app classification.

## Audit Honesty

This is a source-backed surface audit of the high-impact runtime, frontend, service, database, CI, and package areas that determine whether the repo can be reset and upgraded safely.

Do not claim this is a manual line-by-line audit of every generated file, fixture, migration, lockfile line, or inactive template. It is enough to guide the reset plan, but implementation still needs proof commands and focused diffs.

## Executive Verdict

Yes, the codebase must be cleaned first.

The current repo has valuable parts, but the active product is still a chat/session Manus-style clone. The new AI Workflow OS needs a workflow-native base. A direct redesign on top of the current app would preserve the wrong center of gravity.

The correct reset direction:

```text
classify apps/services/packages
-> remove stale server and CI references
-> gate legacy services out of default dev/build/test
-> normalize dependency families
-> harden auth/service boundaries
-> create `.flow` kernel in isolation
-> introduce provider-neutral sandbox contract
-> migrate provider implementation to Vercel Sandbox
-> refactor chat/canvas/files/search/tools around workflow runs
```

## Keep, Refactor, Move, Delete

| Area                                | Decision                               | Why                                                                        |
| ----------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| `apps/app` authenticated shell      | Keep, refactor                         | Best primary app base, but currently chat-first.                           |
| Chat split/canvas layout            | Keep pattern, refactor product meaning | Resizable side canvas is useful for a workflow run workbench.              |
| `packages/ai/components/canvas`     | Keep as compatibility, move later      | Good workbench primitives, but E2B/Neko/Manus assumptions are embedded.    |
| `LibraryPreviewModal` renderers     | Keep and extract                       | Better file rendering base than current canvas preview.                    |
| `FilePreviewView`                   | Replace                                | Declares PDF/markdown/html support but only renders image or raw pre text. |
| E2B sandbox service                 | Compatibility only                     | Useful behavior surface, but provider assumptions are deep.                |
| `IE2BAdapter` interface             | Refactor and rename                    | Good method shape; name and types must become provider-neutral.            |
| Orchestrator agent loop             | Split/replace                          | Too privileged, chat/session/E2B shaped, exposes too many tools.           |
| Search service                      | Keep concept, fix ownership            | Search is needed, but message search has cross-user leak risk.             |
| Connector tools                     | Keep concept, restrict exposure        | Dynamic tools are useful, but must be permissioned by `.flow` task scope.  |
| File DB schema                      | Keep as base                           | Useful file library schema, but needs workflow artifact tables.            |
| Sandbox DB schema                   | Refactor                               | Still named and shaped around E2B fields.                                  |
| Agent/session schema                | Compatibility                          | Useful ideas, not workflow source of truth.                                |
| `services/agent` references         | Delete or restore intentionally        | Root/CI/deploy reference a service with no tracked source.                 |
| `website`, `device`, `webrtc-media` | Archive/gate unless needed             | Legacy surfaces add risk and build weight before MVP.                      |
| Root `clean` script                 | Treat as dangerous                     | It runs `git clean -xdf node_modules`; do not use casually during reset.   |

## Evidence Map

| Evidence                                                                          | What exists                                                                                    | Reset implication                                                                     |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `package.json:13`                                                                 | `dev:services` runs all services with high concurrency.                                        | Split required vs legacy service profiles.                                            |
| `package.json:27`                                                                 | `test:agent` enters `services/agent`.                                                          | Remove unless `services/agent` is restored.                                           |
| `package.json:40`                                                                 | `clean` uses destructive `git clean -xdf node_modules`.                                        | Do not use for reset without explicit approval.                                       |
| `package.json:79-86`                                                              | Root overrides pin React types, AI SDK, Drizzle, Zod.                                          | Normalize manifests; reduce overrides to intentional exceptions.                      |
| `.github/workflows/ci.yml:249-276`                                                | Python agent CI job references `services/agent`.                                               | CI is stale and must be fixed before upgrade confidence.                              |
| `.github/workflows/deploy.yml:216` and `:293`                                     | Deployment waits for `jeriko-agent-*`.                                                         | Deploy scripts are stale.                                                             |
| `apps/app/app/(authenticated)/chat/[id]/components/chat-layout.tsx:42-67`         | Resizable split canvas panel exists.                                                           | Keep layout behavior; rename product surface to workflow workbench.                   |
| `apps/app/app/(authenticated)/chat/[id]/components/chat-client.tsx:84-139`        | Chat client wires chat, SSE, canvas, E2B browser, and E2B terminal.                            | Split into workflow run controller, workbench controller, and chat command surface.   |
| `packages/ai/components/canvas/agent-canvas.tsx:41-60`                            | Lazy views include browser, editor, terminal, file preview, slides, IDE, AI canvas, MapReduce. | Keep the composable view model, remove Manus/E2B naming and route through run events. |
| `packages/ai/components/canvas/agent-canvas.tsx:86-152`                           | Props include sandbox id, Neko URL, E2B stream URL, terminal output, file preview.             | Replace with provider-neutral run/workbench session model.                            |
| `packages/ai/components/canvas/views/file-preview-view.tsx:10-47`                 | File preview declares image/pdf/markdown/text/html but only handles image or raw pre.          | Replace with artifact renderer.                                                       |
| `apps/app/app/(authenticated)/files/components/library-preview-modal.tsx:300-417` | Richer renderer handles markdown, image, PDF, video, audio.                                    | Extract renderer as `ArtifactPreview` and use it in workbench.                        |
| `services/sandbox/src/index.ts:1-17`                                              | Direct E2B SDK import and in-memory E2B sandbox map.                                           | Must be hidden behind provider interface.                                             |
| `services/sandbox/src/index.ts:381-470`                                           | Sandbox creation directly calls `E2BSandbox.create` and stores `e2bSandboxId`.                 | Add provider, external id, runtime, ports, and metadata abstraction.                  |
| `services/sandbox/src/index.ts:883-1048`                                          | Shell and browser actions are E2B terminal-server based.                                       | Preserve command/browser semantics, reimplement provider-specific execution.          |
| `services/orchestrator/src/lib/e2b-manager.ts:1-21`                               | Lifecycle manager explicitly follows Manus/E2B pattern.                                        | Replace with `sandbox-runtime-manager` and provider plugins.                          |
| `packages/ai/hooks/use-e2b-stream.ts:70-82`                                       | Browser stream hook is documented as E2B/noVNC screenshot polling.                             | Rename and abstract to run preview stream.                                            |
| `packages/ai/hooks/use-e2b-terminal.ts:43-48`                                     | Terminal hook is E2B PTY WebSocket specific.                                                   | Rename and route through provider-neutral terminal/log API.                           |
| `services/orchestrator/src/lib/agent-loop.ts:17-18`                               | Imports Manus prompt and E2B manager.                                                          | Split prompt/runtime from old clone assumptions.                                      |
| `services/orchestrator/src/lib/agent-loop.ts:184-226`                             | Creates sandbox per chat session and builds broad tool context.                                | Workflow task should request sandbox only when declared.                              |
| `services/orchestrator/src/lib/agent-loop.ts:464-465`                             | Always creates all tools in `webdev` mode.                                                     | `.flow` compiler must select tool subset per task.                                    |
| `services/orchestrator/src/lib/tools/index.ts:51-110`                             | `createAllTools` exposes large static/dynamic registry by mode.                                | Keep factory, replace with permissioned tool router.                                  |
| `services/search/src/index.ts:263-270` and `:374-379`                             | Message DB fallback searches messages without joining owned sessions.                          | P0 search authorization bug.                                                          |
| `services/search/src/index.ts:528-551`                                            | `/search/messages` only filters by content and optional sessionId.                             | P0 search authorization bug.                                                          |
| `services/connector/src/routes/tools.ts:9-29`                                     | Route fetches tools for path user id.                                                          | Require service auth and assert caller can request that user.                         |
| `services/connector/src/routes/tools.ts:94-149`                                   | Integration tools by id have no visible caller ownership check.                                | Add owner check before returning tool list.                                           |
| `packages/database/src/schema/sessions.ts:6-26`                                   | `agentSessions` is chat/session centered.                                                      | Keep for compatibility, add workflow-native tables.                                   |
| `packages/database/src/schema/files.ts:7-42`                                      | Files are session/user linked and include storage metadata.                                    | Keep as file library base, add artifact provenance tables.                            |
| `packages/database/src/schema/sandboxes.ts:22-37`                                 | Sandbox table says E2B and has `e2bSandboxId`.                                                 | Migrate to provider-neutral schema.                                                   |

## App Classification

| App                           | Reset decision      | Notes                                                                           |
| ----------------------------- | ------------------- | ------------------------------------------------------------------------------- |
| `apps/app`                    | Keep                | Primary product app. Refactor routes from chat-first to workflow-first.         |
| `apps/web`                    | Keep                | Marketing/content app. Fix CMS/env/build ownership instead of deleting it.      |
| `legacy/deactivated-apps/api` | Deactivated         | Reintroduce only if a standalone API boundary is proven.                        |
| `apps/docs`                   | Keep as app surface | Documentation site/content app. Current intermediate path may be `tools/docs`.  |
| `apps/email`                  | Keep as app surface | React Email preview/build app. Current intermediate path may be `tools/email`.  |
| `apps/storybook`              | Keep as app surface | Design-system workshop app. Current intermediate path may be `tools/storybook`. |
| `apps/studio`                 | Keep as app surface | Drizzle/database studio app. Current intermediate path may be `tools/studio`.   |

## Service Classification

| Service          | Reset decision                              | Notes                                                                              |
| ---------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `task`           | Keep                                        | Natural home for durable workflow execution.                                       |
| `sandbox`        | Compatibility, then refactor                | Keep while creating provider-neutral Vercel Sandbox migration path.                |
| `connector`      | Keep                                        | Needed for user-authorized external tools.                                         |
| `search`         | Keep after ownership fix                    | Needed for web/internal search and artifacts.                                      |
| `file`           | Keep or merge                               | Needed for artifacts, but should not remain chat-only.                             |
| `gateway`        | Keep only if auth boundary is real          | Otherwise simplify for MVP.                                                        |
| `billing`        | Gate early, keep later                      | Credits and sandbox/runtime usage need billing, but kernel proof can happen first. |
| `project`        | Keep if project/workspace grouping survives | Must fix relationship access checks before production.                             |
| `webhook`        | Keep if triggers are MVP                    | Must fail closed and verify signatures.                                            |
| `orchestrator`   | Split/replace                               | Current role is too broad.                                                         |
| `sandbox-proxy`  | Compatibility                               | Keep only while preview/proxy migration is active.                                 |
| `knowledge`      | Archive or harden                           | Useful later, high auth risk now.                                                  |
| `website`        | Archive/gate                                | Legacy webdev/deployment surface, not workflow kernel.                             |
| `device`         | Archive/gate                                | Not MVP workflow runtime.                                                          |
| `webrtc-media`   | Archive/gate                                | Current Neko/media legacy should not block Vercel Sandbox path.                    |
| `services/agent` | Delete references or restore source         | CI/deploy root scripts are stale.                                                  |

## Side Canvas And Workbench

Decision: keep the side opening canvas concept, refactor it into a workflow run workbench.

What to keep:

- resizable chat/workbench split from `chat-layout.tsx`
- lazy-loaded heavy workbench views
- browser view, terminal view, editor view, file/artifact preview view
- event-driven panel opening
- user take-control idea, if provider parity exists
- timeline/run progress concept

What to refactor:

- rename `AgentCanvas` to `RunWorkbench` or `WorkflowWorkbench`
- replace `CanvasState` from chat tool events with `WorkflowRunWorkbenchState`
- route all views from workflow run events and artifacts, not raw message parts
- split `ChatClient` into smaller controllers:
  - command/chat surface
  - workflow run stream
  - workbench state
  - artifact shelf
  - approval panel
- remove Manus/E2B/Neko naming from public components

What to delete/archive:

- test/demo chat routes that only exist to validate old stream/IDE behavior, after confirming they are not used
- noVNC/Neko-specific UI paths after Vercel Sandbox replacement proves preview/control parity

## File Rendering And Artifacts

Decision: add a workflow-native artifact renderer. Do not treat files as only chat attachments.

Current state:

- `FilePreviewView` is too thin. It exposes file types but only renders image or raw text.
- `LibraryPreviewModal` is a better renderer base because it already supports markdown, image, PDF, video, and audio.
- `files` table has user/session/storage metadata and versions. It is useful but not workflow-native.
- `documents` are inline chat artifacts, not workflow artifacts.

Target:

```text
workflow_artifacts
artifact_versions
artifact_previews
artifact_events
artifact_permissions
artifact_provenance
```

Renderer target:

- text/code with syntax highlighting and copy
- markdown with GFM
- image
- PDF
- HTML preview in sandboxed iframe
- JSON/table viewer
- CSV/table viewer
- audio/video
- generated UI preview URL
- raw download fallback

The renderer should live in a shared package such as:

```text
packages/workflow-ui/src/artifacts
```

or, if the design system owns it:

```text
packages/design-system/components/artifact-preview
```

## Vercel Sandbox Migration

Decision: migrate to Vercel Sandbox, but only after provider-neutral abstraction exists.

Current E2B coupling:

- direct SDK import in sandbox service
- E2B sandbox id stored in DB
- terminal server URL is built with E2B host behavior
- Neko/noVNC browser stream metadata is part of frontend state
- orchestrator creates sandbox per chat session by default
- shell, browser, file, and preview tools assume E2B terminal/file APIs

Provider-neutral target:

```ts
interface SandboxProviderAdapter {
  create(input: SandboxCreateInput): Promise<SandboxInstance>;
  resume(id: string): Promise<SandboxInstance>;
  stop(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  runCommand(input: SandboxCommandInput): Promise<SandboxCommandResult>;
  writeFile(input: SandboxWriteFileInput): Promise<void>;
  readFile(input: SandboxReadFileInput): Promise<SandboxFileResult>;
  listFiles(input: SandboxListFilesInput): Promise<SandboxFileEntry[]>;
  exposePort(input: SandboxExposePortInput): Promise<SandboxPort>;
  snapshot?(input: SandboxSnapshotInput): Promise<SandboxSnapshot>;
}
```

Migration stages:

- [ ] Rename `IE2BAdapter` to `SandboxProviderAdapter`.
- [ ] Create E2B adapter implementing the provider-neutral interface.
- [ ] Add Vercel Sandbox adapter behind the same contract.
- [ ] Change DB from `e2bSandboxId` to `provider`, `providerInstanceId`, `runtime`, `snapshotId`, `ports`, and provider metadata.
- [ ] Change frontend hooks from `useE2BStream`/`useE2BTerminal` to `useSandboxPreview`/`useSandboxTerminal`.
- [ ] Prove command/file/preview parity with integration tests.
- [ ] Switch default provider to Vercel Sandbox.
- [ ] Delete E2B compatibility only after parity and data migration.

Open risk:

- Vercel Sandbox docs support command/file/preview/snapshot primitives, but direct Neko/noVNC desktop parity is not proven. MVP should not depend on live desktop control until a Vercel-specific proof test passes.

## Search Upgrade

Decision: keep search, but fix authorization and add workflow search types.

Current issue:

- Universal search filters Typesense projects/sessions/files by user id.
- DB fallback message searches do not join through owned sessions.
- `/search/messages` accepts `sessionId` but does not prove the session belongs to the user.

Required fixes:

- [ ] Make message search join `messages -> agent_sessions` and filter `agent_sessions.userId`.
- [ ] When `sessionId` is provided, prove owned session first.
- [ ] Add regression tests for cross-user search.
- [ ] Add workflow-native result types:
  - workflow
  - workflow_version
  - run
  - task
  - artifact
  - approval
  - issue
  - event
- [ ] Store search result provenance and citations for web search tool outputs.

## Tools And Connector Upgrade

Decision: keep the tool factory and dynamic connector concept, but replace "all tools available" with a `.flow`-compiled permissioned tool router.

Current issue:

- `createAllTools(toolCtx, "webdev", dynamicTools)` exposes broad tool access in the agent loop.
- Dynamic Composio tools are loaded per user and merged into the same broad tool set.
- The connector service has useful app-connection checks at execution time, but listing/fetching routes need explicit ownership/service-auth tightening.

Target tool model:

```text
tool manifest
-> risk classification
-> required permission
-> required connection
-> input schema
-> output schema
-> idempotency key support
-> approval requirement
-> artifact/event outputs
-> runtime executor
```

Task execution should receive only:

- tools declared in `.flow`
- tools allowed by permissions
- tools available for the user's connected accounts
- tools relevant to the current task type

Required fixes:

- [ ] Add tool manifest registry.
- [ ] Add tool permission/risk metadata.
- [ ] Add approval gates for external actions.
- [ ] Add idempotency for publish/send/delete/update tools.
- [ ] Add per-task tool subset selection.
- [ ] Add connector ownership checks for tool listing and integration-specific listing.
- [ ] Add audit log entries for every external tool call.

## Data Model Upgrade

Decision: do not overload `agentSessions` into workflows.

Required tables:

```text
workflows
workflow_versions
workflow_sources
workflow_compilations
workflow_runs
workflow_run_tasks
workflow_run_events
workflow_artifacts
workflow_approvals
workflow_issues
workflow_tool_calls
workflow_permissions
workflow_sandboxes
workflow_reflection_packets
flow_patches
```

Compatibility:

- `agentSessions` can remain during migration as chat sessions.
- Chat may become a command/comment surface attached to workflow runs.
- Existing `files` can back storage, but artifacts need workflow/run/task provenance.
- Existing `sandboxes` must become provider-neutral.

## Dependency And Next Upgrade

Decision: upgrade package families only after workspace scope is reduced.

Current local evidence:

- Root overrides pin `ai`, `drizzle-orm`, `zod`, and React types.
- The repo has mixed Next/React/AI/Drizzle/Zod versions.
- `services/agent` scripts and CI/deploy references are stale.

Upgrade order:

1. Freeze baseline and record current versions.
2. Remove stale service references.
3. Gate inactive apps/services.
4. Upgrade Next/React for active apps.
5. Upgrade TypeScript/tooling.
6. Upgrade Zod/Drizzle.
7. Upgrade AI SDK family.
8. Upgrade security/observability/external clients.
9. Run active typecheck/build/test after each family.

Do not combine:

- Next major upgrade
- sandbox provider migration
- auth rewrite
- workflow DB migration
- UI redesign
- AI SDK upgrade

## Target Directory Architecture

Recommended active project shape after reset:

```text
apps/
  app/                     # primary product app
  web/                     # marketing only if intentionally kept
  studio/                  # dev-only DB tooling

packages/
  workflow/                # .flow parser, AST, validator, compiler
  workflow-runtime/        # execution planner, state machine, event model
  workflow-ui/             # workbench, artifact previews, approvals UI
  sandbox/                 # provider-neutral sandbox types/adapters
  tools/                   # tool manifests, permissions, schemas
  database/                # Drizzle schema/migrations
  auth/                    # Better Auth config
  design-system/           # shadcn/material-ish primitives
  service-utils/           # service auth/client/errors

services/
  task/                    # durable executor/Inngest or workflow runtime host
  sandbox/                 # sandbox API, provider adapters
  connector/               # external app accounts/tools
  file/                    # artifact/file storage if separate
  search/                  # workflow/search indexing
  webhook/                 # external triggers
  billing/                 # usage/credits, gated until needed
```

Legacy/gated:

```text
services/orchestrator      # split into runtime/tools/prompt modules
services/website           # archive unless webdev MVP requires it
services/device            # archive
services/webrtc-media      # archive after sandbox preview decision
services/knowledge         # archive or harden before enabling
apps/storybook             # archive until design QA phase
apps/docs                  # dev-only
apps/email                 # dev-only
```

## Reset Checklist

### Phase -1A: Workspace Scope

- [ ] Decide primary app strategy.
- [ ] Classify every app as keep/archive/delete/dev-only.
- [ ] Classify every service as keep/archive/delete/compatibility.
- [ ] Classify every package as keep/archive/delete.
- [ ] Document active default service set.

### Phase -1B: Stale References

- [ ] Remove root `test:agent` unless source is restored.
- [ ] Remove CI Python agent job unless source is restored.
- [ ] Remove deployment waits for `jeriko-agent-*`.
- [ ] Gate legacy services out of `dev:services`.
- [ ] Avoid root `clean` script unless explicitly approved.

### Phase -1C: Dependency Normalization

- [ ] Record before snapshot.
- [ ] Normalize Next/React active family.
- [ ] Normalize TS/tooling family.
- [ ] Normalize Zod/Drizzle family.
- [ ] Normalize AI SDK family.
- [ ] Normalize security/external service clients.
- [ ] Reduce root overrides.

### Phase 0A: Security Before Features

- [ ] Add owner-check primitives.
- [ ] Fix search message authorization.
- [ ] Fix connector tool listing ownership.
- [ ] Add service auth client.
- [ ] Fix sandbox terminal stream authorization.
- [ ] Add cross-user regression tests.

### Phase 0B: Workflow Kernel

- [ ] Create `packages/workflow`.
- [ ] Define `.flow` v0 grammar/vocabulary.
- [ ] Parse to CST/AST.
- [ ] Validate schema.
- [ ] Build symbol table.
- [ ] Resolve tools/artifacts/permissions.
- [ ] Compile to normalized runtime JSON.
- [ ] Run mocked local sample.

### Phase 0C: Workflow Data Model

- [ ] Add workflow tables.
- [ ] Add artifact tables.
- [ ] Add approval/issue/event tables.
- [ ] Add workflow sandbox table or provider-neutral sandbox fields.

### Phase 0D: Sandbox Migration

- [ ] Add provider-neutral adapter.
- [ ] Wrap existing E2B provider.
- [ ] Add Vercel Sandbox provider.
- [ ] Prove command/file/preview parity.
- [ ] Switch default provider.
- [ ] Remove E2B/Neko/noVNC compatibility after proof.

### Phase 1: Runtime

- [ ] Compile `.flow` into runnable plan.
- [ ] Execute task graph with durable steps.
- [ ] Emit events/artifacts/task reports.
- [ ] Enforce permissions and approvals.
- [ ] Meter tool/sandbox usage.

### Phase 2: Frontend

- [ ] Convert chat route into workflow run route.
- [ ] Create workflow editor/source viewer.
- [ ] Create run timeline.
- [ ] Create workbench from side canvas primitives.
- [ ] Create artifact shelf/preview.
- [ ] Create approvals and issue cards.
- [ ] Keep chat as command/editing surface, not product center.

## Final Reset Rule

The base should be made smaller before it is made smarter.

Keep the good primitives, but do not preserve the old product shape:

- keep the side workbench pattern
- keep file rendering pieces
- keep search/tool/service ideas
- keep durable runtime concepts
- replace chat/session as the source of truth
- replace E2B assumptions with provider-neutral sandbox runtime
- replace all-tools agent execution with `.flow`-compiled permissions
- replace file attachments with workflow artifacts
- replace broad CI/deploy with active-scope verification
