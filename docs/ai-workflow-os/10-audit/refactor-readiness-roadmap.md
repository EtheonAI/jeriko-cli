# Refactor Readiness Roadmap

Date: 2026-05-23

Purpose: define the order of work before new AI Workflow OS feature coding starts.

## Principle

Do not rebuild everything at once. Keep the repo, harden the dangerous seams, then add the workflow kernel beside the old product.

## Phase -1: Base Reset And Workspace Cleanup

Goal: make the repo a fresh, intentional base before security hardening or workflow feature coding.

Checklist:

- [ ] Classify every app as keep, archive, delete, or dev-only.
- [x] Classify every service as legacy reference under `legacy/manus-clone` for this phase.
- [x] Classify active packages as core, audit/gate, legacy, or missing target packages.
- [x] Choose the app strategy: multi-app monorepo with app, web, docs, email, Storybook, and studio as first-class app surfaces; API remains deactivated until a separate boundary is proven.
- [x] Remove stale `services/agent` scripts, CI jobs, deploy waits, and local bytecode residue unless intentionally restored.
- [x] Gate inactive services out of default dev scripts and Docker Compose.
- [ ] Normalize Next/React versions across active apps/packages.
- [ ] Normalize TypeScript/tooling versions.
- [ ] Normalize Zod and Drizzle intentionally instead of relying on root overrides.
- [ ] Normalize AI SDK packages after checking current AI SDK docs.
- [ ] Make active workspace install, typecheck, build, and test commands meaningful.
- [ ] Preserve/reset specific high-value surfaces according to the reset upgrade audit: side canvas, file renderer, sandbox service, search, and connector tools.

Exit criteria:

- Active workspace scope is documented.
- CI and deploy no longer reference missing services.
- Dependency drift is fixed or explicitly deferred by family.
- The active app and active packages build on the chosen Next/React family.

Reference:

- [`../08-plans/phase-minus-one-base-reset-plan.md`](../08-plans/phase-minus-one-base-reset-plan.md)
- [`./reset-upgrade-surface-audit-2026-05-23.md`](./reset-upgrade-surface-audit-2026-05-23.md)

## Phase 0A: Security And CI Stabilization

Goal: make the current app safe enough to refactor.

Checklist:

- [ ] Add `requireOwnedSession(userId, sessionId)` helper.
- [ ] Use it in chat page, chat POST, stream, stop, media, IDE, sandbox, and deploy routes.
- [ ] Add owner-constrained deployment delete.
- [ ] Add owner-constrained connector queries.
- [ ] Protect orchestrator with service auth.
- [ ] Require gateway secret outside local development.
- [ ] Replace raw service fetches with shared authenticated client.
- [ ] Hash API keys.
- [ ] Remove gateway API-key stub.
- [ ] Fix webhook fail-open behavior.
- [ ] Fix CI E2E server startup.
- [ ] Remove stale agent CI/deploy references.

Exit criteria:

- Cross-user ownership tests pass.
- Protected service calls fail without valid gateway secret.
- CI is green and meaningful.

## Phase 0B: Workflow Kernel In Isolation

Goal: prove `.flow` without touching production runtime.

Create:

- `packages/workflow` or `packages/flow`.

Implement:

- `.flow` v0 schema.
- Parser/loader.
- CST diagnostics or source-span diagnostics.
- AST types.
- Symbol table.
- Semantic validator.
- Compiled runtime JSON.
- Fixture tests.

Checklist:

- [ ] Valid sample compiles.
- [ ] Duplicate task IDs fail.
- [ ] Unknown tool fails.
- [ ] Missing artifact fails.
- [ ] Bad permission fails.
- [ ] Invalid dependency cycle fails.
- [ ] Diagnostics include path and source location.

Exit criteria:

- One sample flow compiles deterministically.
- Invalid flows produce clear errors.

## Phase 0C: Workflow Database

Goal: persist workflows, versions, runs, steps, events, artifacts, approvals, and tool calls.

Checklist:

- [ ] Add workflow schema.
- [ ] Add Drizzle migrations.
- [ ] Add owned workflow query helpers.
- [ ] Add immutable version writes.
- [ ] Add append-only event writes.
- [ ] Add approval transaction helper.
- [ ] Add artifact storage relation.

Exit criteria:

- A compiled `.flow` can be saved as a workflow version.
- A mock run can persist steps and events.

## Phase 0D: Sandbox Provider Interface

Goal: provider-neutral sandbox runtime before Vercel migration.

Checklist:

- [ ] Create sandbox provider interface.
- [ ] Move E2B code behind E2B provider.
- [ ] Add fake provider tests.
- [ ] Add provider-neutral DB fields.
- [ ] Add Vercel Sandbox provider proof behind env flag.
- [ ] Add command timeout, output cap, and cleanup behavior.

Exit criteria:

- Fake provider can run tests.
- E2B provider still works.
- Vercel provider proof passes in a controlled environment.

## Phase 1: Generic Workflow Executor

Goal: run compiled flows through durable steps.

Checklist:

- [ ] Add Inngest `workflow/run.execute`.
- [ ] Add task dispatcher for `ai_task`, `tool_call`, `sandbox_command`, `human_review`, `wait_for_event`, `emit_event`.
- [ ] Persist every step state.
- [ ] Persist every event.
- [ ] Support approval pause/resume.
- [ ] Support retry/failure policy.
- [ ] Emit task reports and artifacts.

Exit criteria:

- Mock social content flow runs end to end with one approval and one mocked publish.

## Phase 2: Workflow-First Frontend

Goal: make the new product visible.

Checklist:

- [ ] Add workflow navigation.
- [ ] Add workflow list.
- [ ] Add workflow detail.
- [ ] Add `.flow` source editor with diagnostics.
- [ ] Add run timeline.
- [ ] Add approval queue.
- [ ] Add artifact shelf and renderer extracted from the current file preview work.
- [ ] Add issue cards.
- [ ] Add sandbox/workbench output panel from the current side canvas primitives.

Exit criteria:

- User can create, validate, run, approve, and inspect a sample workflow.

## Phase 3: Migration And Cleanup

Goal: remove clone residue and old runtime coupling.

Checklist:

- [ ] Rename Jeriko/Manus user-facing strings.
- [ ] Retire chat-first home screen.
- [ ] Move old chat routes behind legacy path or remove.
- [ ] Remove E2B-specific UI names.
- [ ] Remove E2B provider only after Vercel parity and data expiration.
- [ ] Remove stale test pages.
- [ ] Remove stale CI/deploy references.

Exit criteria:

- Product vocabulary is workflow-native.
- Runtime can run on provider-neutral sandbox contract.
- Old clone surfaces are gone or explicitly legacy.

## Build Order Decision

The first code phase should not be visual redesign. It should be:

1. Base reset and workspace cleanup.
2. Security/CI stabilization.
3. Workflow kernel.
4. Workflow persistence.
5. Sandbox provider interface.
6. Durable executor.
7. Workflow UI.
