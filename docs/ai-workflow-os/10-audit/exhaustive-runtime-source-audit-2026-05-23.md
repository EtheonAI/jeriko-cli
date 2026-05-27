# Exhaustive Runtime Source Audit - 2026-05-23

## Audit Status

This is the corrected audit baseline after the user challenged the earlier pass.

The earlier audit was a critical-path audit. This report expands it into a runtime-platform audit across the first-party app, packages, services, gateway, auth, storage, search, billing, connector, sandbox, task, media, and CI surfaces.

Scope is explicit:

- Audited as runtime platform source: `apps/*`, `packages/*`, `services/*`, root CI/config, and the unified concept docs in `docs/ai-workflow-os`.
- Inventoried but not manually line-reviewed as product logic: generated/cache/vendor/template bundles such as `apps/email/.react-email/**` and the 9,310-file `e2b-templates/**` tree.
- Read/copied concept source material: `docs/ai-workflow-os/_source/project-pack/**` and `docs/ai-workflow-os/_source/full-brief/AI_Workflow_OS_Full_Brief_for_Codex.*`.

I will not claim every generated/template line has been manually reviewed. I can claim the runtime application architecture and security boundaries now have a concrete source-backed audit baseline.

## Inventory

Runtime source inventory, excluding `node_modules`, `dist`, `.next`, `.turbo`, and `.react-email`:

| Area                     | Files |
| ------------------------ | ----: |
| `apps/app`               |   421 |
| `packages/ai`            |   154 |
| `services/orchestrator`  |    74 |
| `packages/design-system` |    67 |
| `apps/storybook`         |    54 |
| `packages/database`      |    45 |
| `apps/web`               |    40 |
| `packages/service-utils` |    31 |
| `services/connector`     |    28 |
| `services/task`          |    22 |
| `packages/contracts`     |    22 |
| `services/device`        |    21 |
| `packages/testing`       |    21 |
| `apps/api`               |    17 |
| `services/gateway`       |    16 |
| `services/billing`       |    16 |
| `services/webrtc-media`  |    16 |
| `services/sandbox`       |    15 |
| `services/website`       |    13 |
| `packages/auth`          |    13 |
| `packages/search`        |    13 |
| `services/webhook`       |    12 |
| `services/notification`  |    12 |
| `services/knowledge`     |    12 |
| `services/file`          |    11 |
| `services/search`        |    10 |
| `services/project`       |    10 |

TypeScript/JavaScript runtime LOC excluding generated `.react-email`: `216,250`.

Largest runtime files reviewed or classified:

| File                                                               |   LOC | Audit meaning                                                |
| ------------------------------------------------------------------ | ----: | ------------------------------------------------------------ |
| `packages/ai/components/canvas/views/web-dev-ide-view.tsx`         | 3,100 | UI is still webdev/IDE centered, not workflow-first.         |
| `services/orchestrator/src/routes/webdev.ts`                       | 2,442 | High-risk route surface, shell/GitHub token/deploy coupling. |
| `packages/ai/components/canvas/use-canvas.ts`                      | 1,741 | Large chat/canvas state, no workflow graph/source model.     |
| `services/sandbox/src/index.ts`                                    | 1,463 | E2B-coupled sandbox service; owner checks mostly present.    |
| `apps/app/app/(authenticated)/chat/test-ide/page.tsx`              | 1,444 | Test page exists inside authenticated production routes.     |
| `services/billing/src/index.ts`                                    | 1,204 | User-facing billing plus internal metering endpoints mixed.  |
| `apps/app/lib/trpc/routers/connectors.router.ts`                   | 1,130 | Token storage and connector ownership surface.               |
| `services/orchestrator/src/lib/tools/executor/sandbox-executor.ts` | 1,053 | Agent tool execution still bound to E2B/runtime assumptions. |

Generated/template inventory:

| Area                         | Files | Treatment                                                                        |
| ---------------------------- | ----: | -------------------------------------------------------------------------------- |
| `e2b-templates/**`           | 9,310 | Migration artifact and sandbox attack surface; inventoried, not fully line-read. |
| `apps/email/.react-email/**` |   181 | Generated React Email output; inventoried, excluded from runtime logic audit.    |

## Verdict

The platform is achievable and the `.flow` idea is viable, but this codebase is not ready for new workflow-kernel coding until phase-zero security and ownership refactors are done.

The current platform is still a Manus/Jeriko chat-plus-sandbox clone:

- Chat/session is the product center.
- E2B and webdev are deeply embedded.
- Many service routes trust `x-user-id`, path `userId`, or body `userId`.
- There is no workflow source language, parser, compiler IR, workflow symbol table, approval model, or event/state-machine runtime yet.
- The app has useful assets to keep: Better Auth, Drizzle/Postgres, service skeletons, gateway/proxy pattern, design-system base, AI SDK work, file/storage foundations, sandbox streaming concepts, tasks/scheduled tasks, and connector integration work.

## Critical Findings

### EX-SEC-001 - Chat/session IDOR

Evidence:

- `apps/app/app/(authenticated)/chat/[id]/page.tsx:37-43` loads messages by `messages.sessionId = id`.
- `apps/app/app/(authenticated)/chat/[id]/page.tsx:27` reads the user session but does not use it to verify session ownership.
- `apps/app/app/api/chat/route.ts:584-588` reads an existing `agentSessions` row by ID only.
- `apps/app/app/api/chat/route.ts:601-612` updates existing session metadata by ID only.

Impact:

Any authenticated user who can guess or obtain a session ID can load or mutate another user's chat/session metadata.

Required fix:

- Every chat read/write must join or filter `agentSessions.userId = auth.user.id`.
- Do not create or reuse caller-supplied session IDs until ownership is proven.
- Add regression tests for cross-user session reads, chat POST, stream resume, stop, media start/stop, file upload attachment, and share boundaries.

### EX-SEC-002 - Orchestrator is a raw unauthenticated service boundary

Evidence:

- `services/orchestrator/src/index.ts` does not use `createService`.
- Many route modules accept `userId`, `sandboxId`, or `sessionId` from body/query.
- `services/orchestrator/src/routes/oauth.ts:87-121` issues OAuth authorization codes from body `userId`.
- `services/orchestrator/src/routes/media.ts:20-58` proxies media start/get/stop without ownership checks.

Impact:

The orchestrator is the most privileged system in the repo, yet it is not enforcing the same gateway contract as the other services.

Required fix:

- Move orchestrator onto `createService` or equivalent service auth.
- Remove body-supplied identity. Use verified gateway/auth context only.
- Create route-level ownership guards before sandbox, OAuth, deploy, media, file, and connector operations.

### EX-SEC-003 - Gateway/service auth is incomplete and sometimes disabled

Evidence:

- `packages/service-utils/src/factory/index.ts:130-146` only registers gateway-secret auth if `GATEWAY_SECRET` exists.
- If missing, it logs a warning and trusts `x-user-id`.
- `packages/service-utils/src/auth/index.ts:62-81` has a stub API-key validator that accepts `jeriko_<userId>_<keyId>` and returns wildcard scopes.
- `services/gateway/src/plugins/auth.ts:15-21` uses that shared `extractAuth`.

Impact:

Service authorization has two modes: production-like gateway secret and dev-like trusted headers. The API key path is not production-safe.

Required fix:

- Fail closed when `GATEWAY_SECRET` is absent outside local test.
- Replace API-key stub with hash lookup, status checks, scope checks, rotation, and last-used tracking.
- Add contract tests proving every service rejects missing/invalid gateway secret.

### EX-SEC-004 - Knowledge service has broad IDOR

Evidence:

- `services/knowledge/src/index.ts:133-141` deletes a knowledge group by group ID only.
- `services/knowledge/src/index.ts:152-177` inserts into any `groupId` without verifying the group belongs to the requester.
- `services/knowledge/src/index.ts:190-207` reads an item by item ID only.
- `services/knowledge/src/index.ts:210-223` lists items by group ID only.
- `services/knowledge/src/index.ts:226-242` deletes an item by item ID only.
- `services/knowledge/src/index.ts:246-285` query accepts body `userId` and searches that user's rows.
- `services/knowledge/src/index.ts:289-301` reads chunks by item ID only.

Impact:

Knowledge groups, items, chunks, query results, processing, and delete operations can cross tenants.

Required fix:

- Make `request.userId` authoritative.
- Enforce group/item ownership on every route.
- For `/query`, remove body `userId`; derive it from auth.
- Add tests for cross-user group/item/chunk/query access.

### EX-SEC-005 - Search leaks messages across users

Evidence:

- `services/search/src/index.ts:198-200` checks body `userId` for universal search.
- `services/search/src/index.ts:263-270` falls back to DB message search with no session/user join.
- Dedicated message search has the same pattern in the rest of `services/search/src/index.ts`: message filtering is by content/session only, not session owner.

Impact:

Search can return message content from other users.

Required fix:

- Join `messages -> agentSessions` and filter `agentSessions.userId = request.userId`.
- For optional `sessionId`, also require owned session.
- Add search leakage tests for universal and `/search/messages`.

### EX-SEC-006 - Webhook dispatch can fan out one user's event to all users' webhooks

Evidence:

- `services/webhook/src/index.ts:43-47` declares `/internal/` as public.
- `services/webhook/src/index.ts:229-247` accepts `userId` and `organizationId` in the dispatch body.
- `services/webhook/src/index.ts:250-259` selects active webhooks by event type only, not by event owner.
- `services/webhook/src/index.ts:262-271` queues deliveries to every matching webhook.

Impact:

One event payload can be delivered to unrelated external webhook URLs across tenants.

Required fix:

- `/internal/dispatch` must require signed service auth, not public-prefix bypass.
- Match `webhooks.userId = event.userId` or `webhooks.organizationId = event.organizationId`.
- Encrypt webhook secrets at rest or store in a managed secret store.

### EX-SEC-007 - Connector service has IDOR across integrations and sync

Evidence:

- `services/connector/src/routes/integrations.ts:8-28` lists integrations for path `userId` without comparing to `request.userId`.
- `services/connector/src/routes/integrations.ts:38-70` deletes an integration by ID only.
- `services/connector/src/routes/sync.ts:8-34` starts sync by integration ID only.
- `services/connector/src/routes/sync.ts:57-81` returns sync status by integration ID only.
- `services/connector/src/routes/sync.ts:89-100` lists sync logs by integration ID only.
- `services/connector/src/routes/tools.ts:99-153` lists tools for an integration by ID only.

Impact:

Any authenticated caller who can reach the connector service through the gateway can inspect, sync, or delete another user's integrations if they know IDs or path user IDs.

Required fix:

- Use `request.userId`; do not trust path `userId`.
- Add `userConnectors.userId = request.userId` to all integration/sync/tool routes.
- Add project access checks for project-scoped connectors.

### EX-SEC-008 - Project tRPC relationship routes skip access checks

Evidence:

- `apps/app/lib/trpc/routers/projects.router.ts:391-410` lists project members after loading project by ID but without owner/member check.
- `apps/app/lib/trpc/routers/projects.router.ts:414-449` adds a session to a project without proving project access or session ownership.
- `apps/app/lib/trpc/routers/projects.router.ts:452-470` removes a project session relation without proving access.

Impact:

Project membership and session relationship metadata can be read or mutated across users.

Required fix:

- Introduce shared `requireProjectAccess(projectId, userId, minRole)`.
- For `addSession`, also prove `agentSessions.userId = ctx.user.id`.
- Add tests for non-member list/add/remove denial.

### EX-SEC-009 - Website builder tRPC file/deploy IDOR

Evidence:

- `apps/app/lib/trpc/routers/websiteBuilder.router.ts:380-392` reads `projectFiles` by file ID only.
- `apps/app/lib/trpc/routers/websiteBuilder.router.ts:434-456` updates `projectFiles` by file ID only.
- `apps/app/lib/trpc/routers/websiteBuilder.router.ts:459-471` deletes `projectFiles` by file ID only.
- Existing audit found `deployList` and `deployGet` read deployment records without owner proof.

Impact:

Website project files and deployments can be read or mutated across users.

Required fix:

- Join `projectFiles -> websiteProjects` and filter `websiteProjects.userId = ctx.user.id`.
- Add tests for cross-user file get/update/delete and deployment read.

### EX-SEC-010 - Website deployment service IDOR

Evidence:

- `services/website/src/routes/deploy.ts:175-198` gets deployment by deployment ID only.
- `services/website/src/routes/deploy.ts:212-224` lists deployments by website ID only.

Impact:

Deployment records can be read across users.

Required fix:

- Verify `websites.userId = request.userId` before deployment get/list.
- Prefer a single helper used by preview, deploy, domain, and deployment routes.

### EX-SEC-011 - Device WebSocket ownership is not verified

Evidence:

- `services/device/src/routes/websocket.ts:18-29` accepts `x-user-id` and query `deviceId`, then registers the connection.
- `services/device/src/routes/websocket.ts:31-39` marks the device online by device ID only.
- `services/device/src/routes/websocket.ts:62-65` updates command results by command ID only.
- `services/device/src/routes/devices.ts:180-187` unregisters a connection and ends sessions before verifying device ownership.

Impact:

Device status/command channels can be hijacked or disrupted if a caller can spoof headers or knows IDs.

Required fix:

- Before WebSocket registration, query `devices` with `id` and `userId`.
- Update commands by joining/scoping to the device/user.
- In delete, verify ownership before unregistering or ending sessions.

### EX-SEC-012 - Billing internal endpoints trust body/path users

Evidence:

- `services/billing/src/index.ts:718-723` checks credits for body `userId`.
- `services/billing/src/index.ts:728-772` meters step/tool/vm usage for body `userId`.
- `services/billing/src/index.ts:781-784` returns plan limits for path `userId`.
- `services/billing/src/index.ts:801-816` initializes/refreshes credits for body `userId`.
- `services/billing/src/index.ts:821+` seeds plans through an admin route with no explicit admin role check.

Impact:

Billing and credit accounting can be read or manipulated if the route is reachable through a weak gateway/service-auth path.

Required fix:

- Split internal service endpoints from user endpoints.
- Require signed internal auth for metering and initialization.
- Require admin role or deploy-only script for seed plans.

### EX-SEC-013 - OAuth proxy and OAuth server trust body identity

Evidence:

- `apps/app/app/api/oauth-proxy/route.ts:34-44` allows unauthenticated requests if payload contains `userId`.
- `apps/app/app/api/oauth-proxy/route.ts:46-50` forwards that payload to orchestrator.
- `services/orchestrator/src/routes/oauth.ts:87-121` issues an authorization code from body `userId`.
- `services/orchestrator/src/routes/oauth.ts:243-303` decodes a JWT without verifying it and returns user info from untrusted claims plus DB lookup.

Impact:

The webdev OAuth bridge can issue or hydrate user identity without a verified Better Auth session.

Required fix:

- OAuth authorize must require platform session and verified app/client ownership.
- Validate redirect URI against a registered client.
- Remove unauthenticated payload identity allowance.
- Do not decode unverified JWTs for identity.

### EX-SEC-014 - AgentMail webhook has no signature verification

Evidence:

- `apps/app/app/api/webhooks/agentmail/route.ts:13-15` has signature verification TODO commented out.
- `apps/app/app/api/webhooks/agentmail/route.ts:17-60` processes events and logs mailbox/user relationships from unsigned input.

Impact:

Any caller can forge AgentMail events. Current impact appears mostly logging, but this becomes critical if later hooked to notifications/tasks.

Required fix:

- Fail closed when webhook secret is configured.
- Add signature tests and replay protection if provider supports timestamps.

### EX-SEC-015 - File upload attaches arbitrary `sessionId`

Evidence:

- `apps/app/app/api/files/upload/route.ts:24-29` reads authenticated user but accepts form `sessionId`.
- `apps/app/app/api/files/upload/route.ts:47-61` writes that `sessionId` to the file row without proving session ownership.

Impact:

Files can be associated with other users' sessions if a session ID is known.

Required fix:

- If `sessionId` is present, require `agentSessions.id = sessionId AND userId = auth.user.id`.

### EX-SEC-016 - Sandbox terminal stream proxy omits service auth headers

Evidence:

- `apps/app/app/api/sandbox/[id]/terminal/stream/route.ts:31-34` calls the sandbox service with no `x-user-id` and no `x-gateway-secret`.
- `services/sandbox/src/index.ts:1338-1348` verifies sandbox owner before returning terminal stream URL.

Impact:

This route likely fails under real service auth or encourages disabling service auth to make terminal streaming work.

Required fix:

- Send `x-user-id` and `x-gateway-secret` through a shared internal service client.
- Add an integration test for terminal stream ownership.

### EX-SEC-017 - Middleware/proxy checks cookie existence, not session validity

Evidence:

- `apps/app/proxy.ts:61-63` treats a request as logged in if `better-auth.session_token` cookie exists.

Impact:

This is not sufficient as an auth boundary. It may only guard page redirects, but authenticated pages and APIs must do real session verification.

Required fix:

- Keep this only as UX routing.
- Confirm every authenticated route/page/API calls Better Auth or server-side DAL authorization.
- Consider using Better Auth middleware/session verification where performance permits.

### EX-SEC-018 - Search/webhook/connector/project issues are not isolated bugs, they show missing ownership primitives

Evidence:

Multiple services repeat the same pattern: fetch row by ID/path user/body user, then act.

Impact:

The platform needs a shared authorization model before introducing `.flow`, because workflows will amplify these operations across tools, files, connectors, billing, sandboxes, and publish actions.

Required fix:

- Add shared ownership guards for `session`, `project`, `sandbox`, `file`, `connector`, `knowledge`, `device`, `website`, and `workflow`.
- Require route tests for every guard.
- Make workflow runtime depend on these guards, not route-local ad hoc checks.

## Architecture Findings

### EX-ARCH-001 - No workflow kernel exists yet

Current code has chat sessions, messages, agents, tasks, scheduled tasks, tools, projects, files, sandboxes, and connectors. It does not have:

- `.flow` source model
- parser/lexer/CST/AST
- schema validator and semantic validator
- symbol table
- artifact dependency model
- workflow event graph
- workflow state machine
- workflow versioning/diffs/patches
- approval gates as first-class runtime objects
- workflow run/job/task tables
- typed tool manifests and permission manifests

Required direction:

Build `.flow` as the authoring layer and compile to internal AST/ASG/DAG/event/state-machine structures. The previous research note is correct: `.flow` should not replace compiler/runtime data structures.

### EX-ARCH-002 - Current task/scheduled-task service is useful but not enough

Evidence:

- `services/task/src/routes/tasks.ts` mostly scopes tasks through `agentSessions.userId`.
- `services/task/src/routes/scheduled-tasks.ts` mostly scopes scheduled tasks by `scheduledTasks.userId`.
- `services/task/src/routes/tasks.ts:371-383` emits `task:continue` without verifying task ownership.

Assessment:

Keep this service as inspiration, but a workflow runtime needs stronger semantics:

- task input/output artifacts
- run attempts
- retry/fallback policy
- approval and denial states
- event wait states
- idempotency keys
- billing boundaries
- deterministic replay/audit logs

### EX-ARCH-003 - E2B coupling is deep

Evidence:

- `services/sandbox/src/index.ts` imports `@e2b/code-interpreter` directly.
- `packages/ai/package.json` exports `use-e2b-stream` and `use-e2b-terminal`.
- `services/orchestrator/src/lib/e2b-manager.ts`, `sandbox-executor.ts`, `webdev.ts`, and templates assume E2B URLs/ports.
- `e2b-templates/**` contains 9,310 files.

Required direction:

Create provider-neutral sandbox interfaces before a Vercel Sandbox migration:

- `SandboxProvider`
- `SandboxInstance`
- `SandboxFilesystem`
- `SandboxProcess`
- `SandboxBrowser`
- `SandboxStream`
- `SandboxArtifactStore`

Then implement E2B adapter and Vercel adapter behind the same contract.

### EX-ARCH-004 - `.flow` is a better product interface than node graphs, but only if compiled

Validation:

- Better for users/AI: source control, patching, review, readable goals/tasks/permissions/artifacts.
- Better than exposed node graphs for product UX: avoids n8n-style manual node/edge mapping.
- Not enough by itself: needs internal AST, symbol table, ASG, DAG slices, event graph, and state machine.

Required MVP:

1. `workflow.flow` source.
2. parser and CST with line spans.
3. AST and Zod schema.
4. semantic validator.
5. compiler to execution plan.
6. interpreter over plan.
7. UI renderer from compiled model.

## Frontend And Design Findings

### EX-FE-001 - Product information architecture is still chat-first

Evidence:

- Main authenticated chat routes and test chat pages dominate `apps/app`.
- Large state files exist in `apps/app/lib/store`, `packages/ai/components/canvas`, and chat hooks.
- No workflow route, workflow editor, `.flow` editor, workflow run view, or workflow artifact explorer exists.

Required direction:

- Make workflows the first screen, not chat.
- Chat becomes a workflow copilot/editor panel, not the product root.
- Add `Workflows`, `Runs`, `Artifacts`, `Approvals`, `Connectors`, `Templates`, and `Settings`.

### EX-FE-002 - Production test routes should be gated or removed

Evidence:

- `apps/app/app/(authenticated)/chat/test/page.tsx`
- `apps/app/app/(authenticated)/chat/test-stream/page.tsx`
- `apps/app/app/(authenticated)/chat/test-ide/page.tsx`

Required fix:

- Remove from production build or gate behind explicit development flag and admin role.

### EX-FE-003 - Design can keep Manus-like material feel but must shift domain

Keep:

- dense panels
- restrained material surfaces
- high-quality tool/canvas controls
- sidebar + inspector rhythm
- existing design-system primitives

Replace:

- chat-only center
- webdev IDE as default mental model
- brand copy tied to Jeriko/Manus clone
- raw sandbox/terminal as primary product affordance

Target:

- workflow workspace
- source editor plus visual compiled preview
- artifact tree
- task timeline
- approval inbox
- run observability

## Backend Service Coverage Matrix

| Service           | Coverage                                                                                 | Result                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `gateway`         | `index.ts`, `plugins/auth.ts`, `routes/proxy.ts`, `routes/websocket.ts`                  | Useful proxy/auth shape, but API-key auth is stubbed and WebSocket allows `session:*` channels without ownership proof. |
| `orchestrator`    | Route inventory plus OAuth/media/webdev/deploy/file/sandbox/tool surfaces                | Must be refactored before reuse. Raw service boundary and body identity are unacceptable.                               |
| `sandbox`         | `src/index.ts` create/read/execute/shell/browser/files/streams/webhook                   | Owner checks mostly present, but E2B coupling is deep and stream proxy from app is wrong.                               |
| `task`            | `tasks.ts`, `scheduled-tasks.ts`                                                         | Mostly owner-scoped; not workflow-native; `continue` route lacks task ownership check.                                  |
| `connector`       | `index.ts`, `integrations.ts`, `sync.ts`, `tools.ts`, route inventory for OAuth/triggers | Several IDORs; token columns are plaintext despite comments saying encrypted.                                           |
| `knowledge`       | `src/index.ts`                                                                           | Broad IDOR across groups/items/chunks/query/process.                                                                    |
| `search`          | `src/index.ts`                                                                           | Message search leaks across tenants.                                                                                    |
| `webhook`         | `src/index.ts`                                                                           | Internal dispatch is public-prefix and cross-tenant fanout.                                                             |
| `billing`         | `src/index.ts`, metering/credit/admin routes                                             | User routes are mostly scoped; internal/admin routes need signed internal/admin auth.                                   |
| `device`          | `routes/devices.ts`, `routes/websocket.ts`                                               | HTTP routes mostly scoped; WebSocket and delete ordering are unsafe.                                                    |
| `file`            | `src/index.ts`                                                                           | Mostly owner-scoped; session association must be verified upstream or in service.                                       |
| `website`         | `routes/websites.ts`, `routes/deploy.ts`                                                 | Website CRUD mostly scoped; deployment get/list IDOR.                                                                   |
| `webrtc-media`    | route inventory and orchestrator proxy                                                   | Media sessions are keyed by chat session ID with weak/no ownership at proxy boundary.                                   |
| `notification`    | `src/index.ts`                                                                           | Mostly owner-scoped. Internal system notification path needs explicit design.                                           |
| `project` service | route read                                                                               | Mostly owner/member scoped. App tRPC project router has worse gaps than service.                                        |

## App API And tRPC Coverage Matrix

| Area                            | Coverage                                  | Result                                                                                                            |
| ------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `app/api/chat`                  | read route and stream persistence         | Critical session ownership gap.                                                                                   |
| `app/(authenticated)/chat/[id]` | page load and client entry                | Critical message load IDOR.                                                                                       |
| `app/api/sandbox`               | create/proxy/terminal/browser/file routes | Proxies rely on downstream auth inconsistently; terminal stream missing headers.                                  |
| `app/api/ide`                   | route inventory                           | Multiplexed privileged orchestrator proxy; must be replaced with typed service calls and sandbox ownership proof. |
| `app/api/oauth-proxy`           | read                                      | Allows unauth identity path; high risk.                                                                           |
| `app/api/webhooks/*`            | Stripe and AgentMail                      | Stripe verifies signature; AgentMail does not.                                                                    |
| `app/api/files/upload`          | read                                      | Session attachment ownership missing.                                                                             |
| `trpc/messages`                 | route scan                                | Mostly owner-scoped through session checks.                                                                       |
| `trpc/projects`                 | targeted read                             | Member/session relationship IDORs.                                                                                |
| `trpc/files`                    | read/scan                                 | Mostly owner-scoped, but file upload route gap remains.                                                           |
| `trpc/connectors`               | targeted read                             | Owner checks mostly present in app router, but token storage is plaintext and project access checks are thin.     |
| `trpc/websiteBuilder`           | targeted read                             | File/deploy IDORs.                                                                                                |
| `trpc/secrets`                  | read                                      | AES-GCM implemented for user secrets; production must require `SECRETS_ENCRYPTION_KEY`.                           |

## Database Findings

Keep:

- Drizzle/Postgres foundation.
- Clear domain tables for sessions, messages, files, projects, billing, connectors, devices, notifications, webhooks, sandboxes.

Fix before workflow kernel:

- Add missing foreign keys and composite indexes around ownership paths.
- Add workflow-native tables:
  - `workflows`
  - `workflow_versions`
  - `workflow_files`
  - `workflow_symbols`
  - `workflow_runs`
  - `workflow_jobs`
  - `workflow_tasks`
  - `workflow_artifacts`
  - `workflow_events`
  - `workflow_approvals`
  - `workflow_issues`
  - `workflow_patches`
  - `tool_manifests`
  - `permission_manifests`
- Encrypt connector tokens and webhook secrets.
- Replace plaintext API keys with hashed keys.

## CI And Upgrade Findings

Evidence:

- Initial audit state: `apps/app/package.json` used Next `16.1.5`. Post-upgrade package state is tracked in `ci-deployment-dependency-audit.md`.
- User target is Next `16.2`.
- `apps/app/playwright.config.ts` disables `webServer` in CI.
- `.github/workflows/ci.yml` runs E2E with `PLAYWRIGHT_BASE_URL=http://localhost:3000`, but the workflow excerpt only builds app before Playwright. If no external service is started elsewhere, E2E cannot connect.

Required before upgrade:

- Run official Next codemod/release notes for 16.2.
- Use the local `nextjs`/Vercel upgrade guidance before editing.
- Fix CI E2E server start or remove CI E2E until environment is provisioned.
- Add service-auth contract tests to CI.
- Add DB ownership regression tests.

## Phase-Zero Checklist

### P0 Security Freeze

- [ ] Add shared `requireOwnedSession(sessionId, userId)`.
- [ ] Patch chat page/API/stream/stop/media/file routes to use owned sessions.
- [ ] Move orchestrator to verified service auth.
- [ ] Remove body/path identity trust from orchestrator, knowledge, search, connector, billing internal routes.
- [ ] Fix webhook dispatch tenant filtering.
- [ ] Fix connector integration/sync/tool IDORs.
- [ ] Fix project tRPC member/session relationship IDORs.
- [ ] Fix websiteBuilder file/deploy IDORs.
- [ ] Fix website deployment get/list IDOR.
- [ ] Fix device WebSocket ownership and delete ordering.
- [ ] Replace API-key stub with hashed DB validation.
- [ ] Encrypt connector tokens and webhook secrets.
- [ ] Add cross-user authorization regression tests.

### P1 Workflow Kernel

- [ ] Define `.flow` v0.1 grammar and schema.
- [ ] Implement lexer/parser/CST.
- [ ] Implement AST and Zod validation.
- [ ] Implement symbol table for jobs/tasks/tools/artifacts/workers/events/permissions.
- [ ] Implement semantic validator.
- [ ] Compile to execution plan: DAG slices plus event/state-machine metadata.
- [ ] Add FlowPatch format.
- [ ] Add workflow tables and migrations.
- [ ] Add workflow run interpreter.
- [ ] Add approval and issue-card primitives.

### P2 Sandbox Migration

- [ ] Create provider-neutral sandbox interfaces.
- [ ] Wrap current E2B implementation as adapter.
- [ ] Add Vercel Sandbox adapter.
- [ ] Move webdev/shell/browser/file operations behind provider interface.
- [ ] Migrate template assumptions into provider capabilities.
- [ ] Remove E2B-specific hooks from `packages/ai` public exports.

### P3 Frontend Redesign

- [ ] Replace chat root with workflow dashboard.
- [ ] Add `.flow` source editor with validation panel.
- [ ] Add compiled workflow preview.
- [ ] Add run timeline and artifact tree.
- [ ] Add approvals inbox.
- [ ] Add workflow settings/permissions panel.
- [ ] Retire production test pages.
- [ ] Audit CSS and rename Jeriko/Manus strings after architecture stabilizes.

## What Is Missing From The Product Idea

The idea is strong, but these pieces are not optional:

- permission manifest and risk classification for every tool
- human approval object model
- artifact store with schema, lineage, and retention policy
- workflow versioning and rollback
- source formatter and repair loop
- validation diagnostics with source spans
- idempotency and replay rules
- tenant-safe event bus
- billing policy per step/tool/sandbox/runtime minute
- connector secret isolation
- workflow import/package system
- migration path from chat sessions to workflow runs
- observability per workflow/job/task/artifact/event

## Buildability Verdict

Achievable: yes.

Viable: yes, if positioned as an AI-native workflow OS, not another node canvas.

Better than exposing node graphs: yes, as the authoring layer.

Easy to build now: no. The current platform has too many authorization and service-boundary issues to safely build the workflow kernel directly on top.

Correct next move:

1. Lock the audit as baseline.
2. Patch P0 ownership/security.
3. Create provider-neutral sandbox contracts.
4. Add workflow DB schema and `.flow` compiler MVP.
5. Redesign frontend around workflows after the kernel shape is real.
