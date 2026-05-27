# Security And Authorization Audit

Date: 2026-05-23

Scope: app route authorization, service-to-service auth, API keys, sandbox ownership, media, connectors, webhooks, and secret handling. This file is the phase-zero security gate before workflow work starts.

## Severity Legend

- Critical: cross-user data/action access or production credential boundary failure.
- High: likely exploitable once deployed or once AI-triggered workflows exist.
- Medium: serious hardening gap that should be fixed before public beta.
- Low: cleanup or defense-in-depth.

## Critical Findings

### SEC-001: Chat page reads messages without ownership check

Evidence:

- `apps/app/app/(authenticated)/chat/[id]/page.tsx` gets auth/session, then queries messages by `sessionId = id` without verifying the session row belongs to `user.id`.

Impact:

Any authenticated user can read another user's messages if they know the session ID.

Fix:

- Query `agentSessions` by `{ id, userId }` before loading messages.
- Return 404 when not found.
- Add cross-user test.

### SEC-002: Chat POST can attach to another user's session

Evidence:

- `apps/app/app/api/chat/route.ts` accepts session ID from `chatId`, body `id`, or `metadata.sessionId`.
- Existing session lookup is by ID only.
- Session metadata updates and sandbox prewarm updates are by session ID only.
- Request is forwarded to orchestrator with that `sessionId`.

Impact:

Cross-user session takeover, message injection, sandbox metadata access, and incorrect billing/usage attribution are possible.

Fix:

- If client supplies a session ID, fetch by `{ id: sessionId, userId }`.
- If not found, reject instead of creating or reusing silently.
- Never reuse metadata from a session that was not owner-verified.

### SEC-003: Stream and stop routes lack ownership checks

Evidence:

- `apps/app/app/api/chat/[id]/stream/route.ts` resumes by route ID only.
- `apps/app/app/api/chat/[id]/stop/route.ts` stops by route ID only.

Impact:

Cross-user stream resume and denial-of-service against active sessions.

Fix:

- Add `requireOwnedSession(requestUserId, sessionId)` to both routes.
- Stop orchestrator streams by `{ sessionId, userId }`, not session ID only.

### SEC-004: Orchestrator trusts body/header identity

Evidence:

- `services/orchestrator/src/routes/completions.ts` accepts `userId` from body, header, or anonymous fallback.
- `services/orchestrator/src/routes/sessions.ts` has unauthenticated session CRUD.
- `services/orchestrator/src/routes/sandbox-manager.ts` creates, returns, and destroys sandbox cache entries by body/query session ID.
- `services/orchestrator/src/index.ts` does not install the shared service auth hook.

Impact:

Orchestrator cannot be treated as a trusted backend authority. Any reachable route can be driven with spoofed identity.

Fix:

- Use shared service auth.
- Remove anonymous/default user behavior from protected routes.
- Derive identity only from verified auth context.
- Add per-resource ownership checks.

### SEC-005: API key validator is a stub and stored keys are plaintext

Evidence:

- `packages/service-utils/src/auth/index.ts` TODO validator returns wildcard scopes for format-valid `jeriko_*` keys.
- `packages/database/src/schema/apiKeys.ts` stores key text.
- `apps/app/lib/trpc/routers/apiKeys.router.ts` inserts generated keys directly.

Impact:

Gateway API key auth is not reliable. DB compromise leaks live keys.

Fix:

- Hash API keys at creation.
- Store `keyId`, `prefix`, `hash`, `scopes`, `lastUsedAt`, `expiresAt`, and revoked status.
- Validate keys through DB.
- Remove wildcard fallback.

## High Findings

### SEC-006: Gateway-secret contract is optional and inconsistently used

Evidence:

- Shared service auth only enforces `x-gateway-secret` when env is set.
- Orchestrator raw fetch calls usually send `x-user-id` only.
- Some task-service calls include gateway secret, showing a mixed contract.

Impact:

Services either fail against each other when hardened or trust spoofable headers when not hardened.

Fix:

- Mandatory gateway secret for all protected services outside local.
- One service client helper for all service calls.
- Startup checks for required secrets.

### SEC-007: Media/Neko auth is keyed only by session ID

Evidence:

- `services/webrtc-media/src/routes/auth.ts` returns media auth by `sessionId`.
- `services/webrtc-media/src/routes/ws-proxy.ts` accepts `?session=...`.
- CRUD in `services/webrtc-media/src/routes/sessions.ts` reads/deletes by `sessionId`.

Impact:

Known session IDs can expose remote browser streams or Neko credentials.

Fix:

- Add signed, short-lived media tokens.
- Verify user/session ownership before issuing media auth.
- Bind WebSocket upgrade to the token, not only `sessionId`.

### SEC-008: Connector routes use path IDs instead of verified caller ownership

Evidence:

- `/users/:userId/integrations` uses path user ID.
- `/users/:userId/tools` uses path user ID.
- `/integrations/:id`, `/integrations/:id/tools`, `/integrations/:id/sync`, `/integrations/:id/sync/status`, and `/integrations/:id/sync/history` query by integration ID only.

Impact:

Cross-user integration discovery, tool listing, sync triggering, or deletion if service is reachable with spoofed gateway headers.

Fix:

- Use `request.userId` from service auth.
- Add owner constraints to every integration query.

### SEC-009: Shell commands interpolate user-controlled values

Evidence:

- Webdev import runs `git clone ${body.gitUrl} ${projectPath}`.
- Template import runs `curl -L "${body.templateUrl}"`.
- GitHub token refresh echoes token into shell and `.git-credentials`.
- Deploy routes interpolate `projectPath`, `buildCommand`, `outputDir`, and `versionId`.

Impact:

Command injection, credential exposure, persistent token leakage, and corrupted sandbox projects.

Fix:

- Replace shell fragments with structured allowed operations.
- Escape or reject unsafe values.
- Use stdin/file APIs for secrets and delete after use.
- Add allowlists for commands, paths, git refs, and URLs.

### SEC-010: Webhook secrets are optional

Evidence:

- Connector Composio webhook skips verification when `COMPOSIO_WEBHOOK_SECRET` is unset.
- Sandbox E2B webhook verifies only if `E2B_WEBHOOK_SIGNATURE_SECRET` exists.

Impact:

Unsigned external events can mutate internal state if envs are missing.

Fix:

- Allow unsigned only in local dev with explicit flag.
- Fail startup or fail request in staging/production when secret is missing.

## Medium Findings

### SEC-011: Proxy treats cookie presence as login signal

Evidence:

- `apps/app/proxy.ts` checks for Better Auth cookie presence.

Impact:

The authenticated layout may catch invalid sessions, but proxy behavior is optimistic and can hide route assumptions.

Fix:

- Keep proxy as coarse navigation guard only.
- Document that all data/API routes must enforce real auth and ownership.

### SEC-012: tRPC unauthorized logging includes session object

Evidence:

- `apps/app/lib/trpc/init.ts` logs `ctx.session` on unauthorized access.

Impact:

Session internals can leak to logs.

Fix:

- Log user/session presence and request ID only.

### SEC-013: Sandbox environment injection needs workflow permission gates

Evidence:

- Orchestrator builds sandbox env with decrypted user secrets and platform AWS/S3 env values.

Impact:

Once `.flow` can trigger sandbox commands, secrets need explicit policy and audit trails.

Fix:

- Add permission categories for secret access.
- Never inject all available secrets by default.
- Emit audit events for each secret exposed to a run.

## Required Security Acceptance Tests

- [ ] User A cannot GET User B chat page messages.
- [ ] User A cannot POST to User B session ID.
- [ ] User A cannot resume User B stream.
- [ ] User A cannot stop User B session.
- [ ] User A cannot start/read/stop User B media session.
- [ ] User A cannot use User B sandbox ID through IDE route.
- [ ] User A cannot delete User B deployment.
- [ ] User A cannot list/delete/sync User B connector.
- [ ] Protected services reject missing `x-gateway-secret` in staging/prod mode.
- [ ] Protected services reject spoofed `x-user-id`.
- [ ] API keys validate by hash and scope only.
- [ ] Webhooks fail closed without configured secret outside local.

## Security Decision

No new `.flow` execution, Vercel Sandbox execution, publishing tools, or external connector automation should be enabled until these phase-zero security tests pass.
