# Full Platform Audit

Date: 2026-05-23

Status: full-platform architectural, security, migration, and readiness audit across the current monorepo. This is not a claim that every line of every file was manually audited. It is a deep pass over the critical build, auth, app, service, database, sandbox, CI, and workflow-readiness surfaces needed before starting the AI Workflow OS rebuild.

## Executive Verdict

The AI Workflow OS idea is achievable and viable, but the current codebase is not ready for new workflow-product coding until the phase-zero blockers below are fixed.

The repo is salvageable. It already has a Next App Router app, Better Auth, Drizzle/Postgres, Inngest, a service mesh, billing primitives, sandbox execution concepts, connector routes, file/artifact UI, and many reusable UI components. The problem is that the product and runtime center of gravity is still Manus-style chat sessions plus E2B sandboxes, not versioned workflows.

The correct approach is phased:

1. Stabilize authorization, service boundaries, CI, and sandbox ownership.
2. Add a workflow kernel package with `.flow` parsing, validation, compilation, and tests.
3. Add workflow-native database tables and a generic executor.
4. Provider-neutralize sandbox runtime before replacing E2B with Vercel Sandbox.
5. Redesign the frontend around workflows, runs, approvals, artifacts, issues, and observability.
6. Delete old Manus/chat/E2B surfaces only after parity gates pass.

Do not start with a full visual redesign or a blind E2B removal. That would build on unsafe ownership assumptions and break runtime behavior.

## Critical Blockers

### C1. Chat/session IDOR in authenticated app routes

Evidence:

- `apps/app/app/(authenticated)/chat/[id]/page.tsx` loads the authenticated session, but message loading filters only by `messagesTable.sessionId = id` and does not verify the session belongs to the user.
- `apps/app/app/api/chat/route.ts` accepts a user-supplied `sessionId` from `chatId`, `body.id`, or `metadata.sessionId`, looks up existing sessions by ID only, then updates metadata and forwards the same ID to orchestrator.
- `apps/app/app/api/chat/[id]/stream/route.ts` validates auth, then resumes an active stream by route `chatId` only.
- `apps/app/app/api/chat/[id]/stop/route.ts` validates auth, then stops a route `sessionId` through orchestrator without ownership verification.

Why it matters:

A logged-in user who knows or guesses another session ID can read messages, attach to streams, stop sessions, or cause orchestrator work against another user's session metadata. This is a phase-zero security issue.

Required fix:

- Add a shared session ownership resolver.
- Every route that accepts a session/chat ID must query `agentSessions` with both `id` and `userId`.
- Return 404 for unauthorized or missing sessions.
- Add regression tests for cross-user access on page data, chat POST, stream resume, stop, media, IDE, and deployment routes.

### C2. Orchestrator is not an authenticated service boundary

Evidence:

- `services/orchestrator/src/index.ts` builds raw Fastify routes and does not use the shared `createService()` auth hook.
- `services/orchestrator/src/routes/completions.ts` accepts `userId` from request body, `x-user-id`, or `"anonymous"`.
- `services/orchestrator/src/routes/sessions.ts` exposes create/list/get/delete/messages/events behavior with no user ownership boundary.
- `services/orchestrator/src/routes/media.ts`, `sandbox-manager.ts`, `deploy.ts`, and `webdev.ts` accept `userId`/`sandboxId` from bodies or params.

Why it matters:

The app currently depends on the app layer to enforce identity, but several app routes forward user-controlled IDs. If orchestrator is reachable internally or externally without strong gateway auth, it becomes an authority-confusion layer.

Required fix:

- Put orchestrator behind `createService()` or equivalent gateway-secret verification.
- Remove body-supplied `userId` trust. User identity must come from verified gateway context.
- Require ownership checks for every `sessionId`, `sandboxId`, `deploymentId`, `integrationId`, and media session.
- Add service-to-service integration tests with and without `GATEWAY_SECRET`.

### C3. Service auth contract is inconsistent

Evidence:

- `packages/service-utils/src/factory/index.ts` enforces `x-gateway-secret` only when `GATEWAY_SECRET` exists. Without it, services trust `x-user-id`.
- `packages/service-utils/src/factory/auth-hook.ts` accepts `x-user-id` after secret validation.
- `services/orchestrator/src/lib/e2b-manager.ts` and `services/orchestrator/src/lib/sandbox-helpers.ts` call the sandbox service with `x-user-id` but generally do not include `x-gateway-secret`.
- `services/task/src/routes/inngest.ts` has explicit gateway-secret header support, which shows the intended pattern.

Why it matters:

With `GATEWAY_SECRET` enabled, some orchestrator-to-sandbox calls should fail. With it disabled, services trust spoofable headers. Both states are bad for production readiness.

Required fix:

- Make `GATEWAY_SECRET` mandatory outside local development.
- Move all raw `fetch()` service calls to a shared authenticated service client.
- Add startup failure if a protected service runs without `GATEWAY_SECRET` in staging/production.

### C4. API key model is unsafe and inconsistent

Evidence:

- `apps/app/lib/trpc/routers/apiKeys.router.ts` generates and inserts full API keys.
- `packages/database/src/schema/apiKeys.ts` stores `key` as plaintext unique text.
- `packages/service-utils/src/auth/index.ts` has `validateApiKey()` as a TODO/stub. It accepts a `jeriko_<userId>_<keyId>` shape and returns wildcard scopes without DB lookup.
- App-generated keys use a different visible prefix from the gateway validator.

Why it matters:

Leaked database rows are live credentials. Gateway API key validation does not match generated keys and can grant wildcard scopes to format-valid keys.

Required fix:

- Store only hashed API keys.
- Keep a short public prefix/key ID for lookup.
- Validate against DB, user status, key status, expiration, and scopes.
- Remove wildcard stub behavior.

### C5. Sandbox/deploy/webdev command execution takes unsafe inputs

Evidence:

- `services/orchestrator/src/routes/webdev.ts` interpolates `body.gitUrl`, `body.templateUrl`, `projectPath`, token values, and feature data into shell commands.
- `refresh-github-token` writes `body.token` through `echo "${body.token}" | gh auth login` and into `.git-credentials`.
- `services/orchestrator/src/routes/deploy.ts` interpolates `projectPath`, `buildCommand`, `outputDir`, `versionId`, and other request fields into shell commands.

Why it matters:

These routes run commands in sandboxes, but the commands can affect user projects, leak secrets, and create persistent credentials. They must still be treated as sensitive execution surfaces, especially once AI-generated `.flow` files can trigger sandbox commands.

Required fix:

- Forbid arbitrary shell fragments in product-level deploy APIs.
- Pass arguments as structured command arrays where provider APIs allow it.
- Strictly validate project paths, output dirs, git refs, URLs, and allowed commands.
- Never interpolate OAuth tokens into shell strings. Use files/stdin mechanisms with escaping and cleanup.

### C6. CI is not reliable enough for a rebuild

Evidence:

- `.github/workflows/ci.yml` builds the app for E2E, sets `PLAYWRIGHT_BASE_URL=http://localhost:3000`, but does not start a server.
- `apps/app/playwright.config.ts` disables `webServer` on CI.
- CI has a `test-agent` job for `services/agent`, but the service is not present as a real tracked service.
- Docker matrix includes `agent`, but no `services/agent/Dockerfile` exists.
- Deploy workflow still references stale `jeriko-agent-*` waits.

Why it matters:

Before a large refactor, CI must tell the truth. Right now it can fail for stale services or miss runtime failures.

Required fix:

- Remove or restore stale agent jobs.
- Start the Next app server for E2E in CI.
- Align Docker matrix with actual service Dockerfiles.
- Add workflow-kernel tests before frontend work begins.

## High-Risk Findings

### H1. Sandbox proxy is public and provider-specific

Evidence:

- `services/sandbox-proxy/src/index.ts` derives upstreams from `{port}-{sandboxId}` host/path patterns.
- It has no ownership lookup, signed URL, allowlist, or auth boundary.
- It sets wildcard CORS with credentials intent.

Recommendation:

Replace with a provider-neutral preview URL broker that issues signed, scoped, expiring preview URLs and checks ownership.

### H2. WebRTC media service has no user ownership checks

Evidence:

- `services/webrtc-media/src/routes/sessions.ts` upserts, reads, and deletes media sessions by `sessionId` only.
- `services/webrtc-media/src/routes/auth.ts` returns Neko auth by `sessionId` only.
- `services/webrtc-media/src/routes/ws-proxy.ts` upgrades WebSockets with only `?session=...`.

Recommendation:

Media auth must be tied to verified user/session ownership. Auth tokens should be short-lived and scoped to one media session.

### H3. Connector service has multiple IDOR-style route patterns

Evidence:

- `services/connector/src/routes/integrations.ts` lists integrations by path `userId` and deletes by integration ID without checking the caller user.
- `services/connector/src/routes/tools.ts` gets all tools by path `userId` and gets integration tools by integration ID without caller ownership verification.
- `services/connector/src/routes/sync.ts` starts sync and reads sync history by integration ID only.

Recommendation:

All connector routes should use verified `request.userId` from service auth and constrain DB queries by both resource ID and owner.

### H4. Webhook signature checks are optional in production-sensitive routes

Evidence:

- Connector webhook skips signature verification when `COMPOSIO_WEBHOOK_SECRET` is unset.
- Sandbox E2B webhook verifies only if `E2B_WEBHOOK_SIGNATURE_SECRET` is set.

Recommendation:

Fail closed in staging/production when webhook secrets are missing.

### H5. Current product model is chat/session-centric

Evidence:

- Authenticated home page still renders Jeriko chat prompt surfaces.
- Sidebar lists `agentSessions` and `ChatItem`.
- Store slices are built around chat, sessions, timeline, tool calls, canvas, web dev, scheduled tasks, billing, and connectors. There is no workflow/workflow-run source of truth.

Recommendation:

Do not overload chat sessions as workflows. Add workflow-native state, routes, DB tables, and executor contracts.

## What To Keep

- Monorepo and Turbo workspace shape.
- Next App Router foundation.
- Better Auth and organization concepts.
- Drizzle/Postgres.
- Inngest durable step model.
- Billing ledger ideas.
- Existing sandbox execution/file IO capabilities.
- AI tool rendering and timeline concepts.
- File/library UI as artifact foundation.
- Dense Manus-like productivity feel.
- Tailwind v4 and shadcn-style component base.

## What To Replace Or Rework

- Chat/session as the primary product object.
- E2B as a hard-coded provider assumption.
- Body-provided user IDs.
- Plaintext API key storage.
- Raw shell interpolation in deploy/webdev routes.
- Public sandbox proxy assumptions.
- Stale CI jobs and agent references.
- Jeriko/Manus hard-coded product vocabulary.

## Workflow OS Readiness

Missing first-class platform pieces:

- `.flow` parser package.
- `.flow` CST/AST types.
- Semantic validator and symbol table.
- Compiled workflow JSON/IR.
- Workflow version tables.
- Workflow run tables.
- Step report/event/artifact tables.
- Approval tables and approval policies.
- Permission model for auto/ask/block tool behavior.
- Provider-neutral sandbox runtime.
- FlowPatch format for safe AI edits.
- Workflow-first frontend route tree.

Existing pieces that can seed the new system:

- `scheduledTasks` and `taskExecutions` can inspire triggers/executions, but should not become workflow tables.
- Inngest `executeTask` can inspire durable executor structure.
- Sandbox service ownership helper can be reused after service auth is fixed.
- Existing file/document tables can inspire artifacts.
- Tool connector routes can become tool manifests after ownership and token storage are corrected.

## Phase-Zero Required Checklist

- [ ] Fix chat/session ownership in page and API routes.
- [ ] Fix stream, stop, media, IDE, deploy, connector, and sandbox-manager ownership checks.
- [ ] Put orchestrator behind verified service auth.
- [ ] Require `GATEWAY_SECRET` in non-local service environments.
- [ ] Move raw service `fetch()` calls to a shared authenticated client.
- [ ] Replace API key plaintext storage with hashes.
- [ ] Remove API key validator stub.
- [ ] Lock webhook signature behavior to fail closed outside local development.
- [ ] Fix CI E2E server startup.
- [ ] Remove or restore stale `services/agent` jobs.
- [ ] Align Docker/deploy service lists with real services.
- [ ] Add `packages/workflow` or `packages/flow` with parser/compiler tests.
- [ ] Add provider-neutral sandbox adapter interface.
- [ ] Add database migrations for workflow-native tables.

## Final Audit Position

The new platform is worth building. The `.flow` idea is stronger than exposing raw graph nodes because it gives users and AI a domain source language while the platform still compiles to AST, semantic graph, DAG slices, control-flow, events, and state machines internally.

But the current app should be treated as a source of reusable infrastructure, not a safe workflow runtime yet. The immediate work is a phase-zero hardening and kernel build, not feature coding.

## Residual Audit Work

This audit intentionally focused on the platform surfaces that decide whether the rebuild is safe: app auth, orchestrator, sandbox, media, connector, deploy/webdev, database shape, CI, dependencies, and workflow readiness.

Still required before production hardening is complete:

- [ ] Line-by-line audit of every `services/orchestrator/src/routes/webdev.ts` command path.
- [ ] Line-by-line audit of every `apps/app/app/api/ide/route.ts` action.
- [ ] Line-by-line audit of connector OAuth callback/token persistence.
- [ ] Line-by-line audit of all billing and usage metering routes.
- [ ] Line-by-line audit of file/storage upload and public URL behavior.
- [ ] Full secret-flow audit from user secrets to sandbox env to logs/artifacts.
- [ ] Full package export audit for E2B and Manus/Jeriko naming residue.
