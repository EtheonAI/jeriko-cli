# Backend Services Audit

Date: 2026-05-23

Scope: service map, orchestrator, sandbox, task/Inngest, gateway, connector, media, deployment, and service boundary readiness for AI Workflow OS.

## Service Inventory

Current service folders include:

- `billing`
- `connector`
- `device`
- `file`
- `gateway`
- `knowledge`
- `notification`
- `orchestrator`
- `project`
- `sandbox`
- `sandbox-proxy`
- `search`
- `task`
- `webhook`
- `webrtc-media`
- `website`

There is no healthy tracked `services/agent` service even though CI and deploy still reference one.

## Backend Verdict

The backend has useful building blocks, but service boundaries are not clean enough for an autonomous workflow runtime. The largest architectural issue is that orchestrator is acting as a privileged coordinator while not enforcing service auth or resource ownership.

## Orchestrator

Current role:

- Chat completion bridge.
- Active stream manager.
- Sandbox session manager.
- Webdev/deploy controller.
- Media proxy coordinator.
- Legacy session CRUD.

Problems:

- Too many responsibilities.
- No shared auth hook.
- Trusts request body identity.
- Mixes product concepts: chat sessions, sandbox runtime, webdev project, Neko, deploy, proxy tokens.
- E2B lifecycle assumptions are centralized in `e2b-manager.ts`.

Required actions:

- Split product orchestration from provider lifecycle.
- Put orchestrator behind service auth.
- Delete or lock unauthenticated legacy session routes.
- Move sandbox operations behind a provider-neutral sandbox client.
- Move deploy/webdev shell operations to validated command handlers.

## Sandbox Service

Current strengths:

- Has a clear ownership helper around sandbox owner checks.
- Provides lifecycle, shell, file, browser, stream, and resource endpoints.
- Is closer to a reusable runtime service than orchestrator.

Current problems:

- Imports E2B directly.
- Requires `E2B_API_KEY`.
- Stores E2B IDs in DB-facing model.
- Public internal webhook is fail-open if signature secret is absent.
- Provider-specific host/port model leaks through callers.

Required actions:

- Extract provider interface.
- Move E2B SDK calls into `e2b-provider`.
- Add fake provider for tests.
- Add Vercel Sandbox provider after interface tests pass.
- Keep E2B compatibility until workflow runtime parity is proven.

## Task Service / Inngest

Current strengths:

- Uses Inngest durable step patterns.
- Has a clear `task/execute` event.
- Wraps external work with `step.run`.
- Writes execution status.

Current problems:

- Task model is scheduled-prompt/session based.
- It calls orchestrator completions, not compiled workflow steps.
- It does not yet understand `.flow`, task symbols, approvals, artifacts, or workflow events.

Required actions:

- Add new workflow event, for example `workflow/run.execute`.
- Create executor for compiled workflow JSON.
- Keep old scheduled task executor until migration is complete.
- Use stable step IDs derived from workflow version and task IDs.

## Gateway

Current strengths:

- Central proxy pattern exists.
- JWT and API key extraction exist.
- Gateway can stamp `x-user-id`.

Current problems:

- API key validation is a stub.
- Service auth depends on optional `GATEWAY_SECRET`.
- Service map includes stale `agents`.

Required actions:

- Fix API key validation before public API exposure.
- Require gateway secret outside local dev.
- Remove stale service aliases.
- Add route-level authorization metadata for service proxy routes.

## Connector Service

Current strengths:

- Uses `createService()`.
- Has Composio OAuth, tools, triggers, sync scaffolding.
- Webhook route captures raw body for signature verification.

Current problems:

- Several routes use path `userId` or resource ID only.
- Integration delete, tools, and sync endpoints do not consistently constrain by verified caller.
- Webhook signature verification is optional if env missing.
- Token columns are labeled encrypted, but schema alone does not prove encryption.

Required actions:

- Use verified `request.userId` everywhere.
- Add ownership constraints to all integration queries.
- Fail closed for missing webhook secret in staging/production.
- Audit actual token encryption path before using connectors in workflows.

## WebRTC Media Service

Current strengths:

- Media session persistence exists.
- Neko auth and WS proxy are isolated.

Current problems:

- Auth and WebSocket proxy are keyed by session ID only.
- Service does not use shared `createService()` auth.
- Neko passwords are cached and returned by session ID.

Required actions:

- Add verified owner checks.
- Issue scoped short-lived media tokens.
- Tie WS upgrade to token and session.
- Do not expose Neko admin password as a generic session lookup.

## Deployment Routes

Current strengths:

- Static deploy pipeline can build, gather files, upload to S3, and record deployments.
- Deployment records are already possible in DB.

Current problems:

- Routes accept `userId` from body or path.
- Delete site by deployment ID does not check owner.
- Build and path values are shell-interpolated.
- Deployment domain/proxy logic is E2B-shaped.

Required actions:

- Derive user from verified context.
- Query deployments by `{ id, userId }`.
- Replace arbitrary build command input with allowed build profiles.
- Validate project path and output directory.

## Backend Refactor Sequence

1. Service auth contract.
2. Session/sandbox/deploy/media/connector ownership checks.
3. API key hash validation.
4. Orchestrator split and protected routes.
5. Sandbox provider interface.
6. Workflow kernel package.
7. Inngest workflow executor.
8. Connector tool manifest and permission integration.
9. Deployment as workflow artifact action, not ad hoc webdev command.

## Backend Acceptance Checklist

- [ ] All protected services reject unauthenticated direct calls.
- [ ] All cross-service calls include gateway secret through shared client.
- [ ] No protected route accepts body `userId` as authority.
- [ ] Orchestrator cannot create/read/stop another user's session or sandbox.
- [ ] Connector routes are owner-constrained.
- [ ] Deploy delete is owner-constrained.
- [ ] Media auth is tokenized and owner-constrained.
- [ ] Sandbox provider interface has fake-provider tests.
- [ ] Inngest workflow executor can run a mocked compiled flow.
