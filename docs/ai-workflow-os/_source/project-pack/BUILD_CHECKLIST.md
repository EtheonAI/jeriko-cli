# Build Checklist

## Phase 0 — Architecture

- [ ] Approve product primitive: prompt → hidden workflow.yaml → AST → execution.
- [ ] Approve MVP non-goals.
- [ ] Approve workflow folder model.
- [ ] Approve step primitives.
- [ ] Approve MADRs 001–018.

## Phase 1 — Foundation

- [ ] Bootstrap Next.js / next-forge app.
- [ ] Configure Tailwind/shadcn UI.
- [ ] Configure better-auth.
- [ ] Configure Drizzle/Postgres migrations.
- [ ] Provision object storage.
- [ ] Add Inngest function route.
- [ ] Add Vercel Sandbox adapter.
- [ ] Add Composio/direct tool adapter.
- [ ] Add model router.

## Phase 2 — Workflow Engine

- [ ] Define Workflow AST types.
- [ ] Define YAML schema.
- [ ] Implement safe YAML parser.
- [ ] Implement YAML renderer.
- [ ] Implement workflow linter.
- [ ] Implement compiler prompt and compile API.
- [ ] Implement workflow create API.
- [ ] Implement generic Inngest executor.
- [ ] Implement step executors: ai_task, tool_call, sandbox_command, verify, human_review.
- [ ] Implement event log.
- [ ] Implement artifacts.
- [ ] Implement run cancellation.
- [ ] Implement dry run.

## Phase 3 — UX

- [ ] App shell and sidebar.
- [ ] New workflow prompt UI.
- [ ] Workflow preview card.
- [ ] Workflow cards/list.
- [ ] Workflow detail page.
- [ ] Live run timeline.
- [ ] Approval inbox.
- [ ] Artifact viewer.
- [ ] Connections page.
- [ ] Billing/credits page.

## Phase 4 — Templates

- [ ] Social content workflow.
- [ ] Inbox reply workflow.
- [ ] Lead research workflow.

## Phase 5 — Billing and beta

- [ ] Credit ledger.
- [ ] Free trial grants.
- [ ] Plan limits.
- [ ] Stripe integration.
- [ ] Usage alerts.

## Phase 6 — Security and QA

- [ ] Org authorization middleware.
- [ ] OAuth token encryption.
- [ ] Command policy scanner.
- [ ] Approval safety tests.
- [ ] Compiler tests.
- [ ] Executor integration tests.
- [ ] E2E UX tests.

## Phase 7 — Launch

- [ ] Private beta onboarding.
- [ ] User docs.
- [ ] Internal engineering docs.
- [ ] Admin dashboard.
- [ ] Support triage process.
