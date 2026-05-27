# Active Package Viability Verdict

Date: 2026-05-26

Scope: active `packages/*` and major feature packages added during the Manus-clone phase.

Question: were the added packages/features directionally right for AI Workflow OS?

## Short Verdict

Yes, mostly.

The package choices were directionally right. The mistake was not adding packages. The mistake was letting old Manus-era concepts, provider SDK details, and optional integrations leak into active app/build paths before the platform architecture was clean.

Keep the package-first monorepo. Do not flatten everything into `apps/app`.

## Evidence Checked

Local evidence:

- Active workspace has 24 packages and 6 app surfaces.
- Full active package typecheck now passes.
- Export-boundary scan now reports zero `@repo/*` missing export violations after the R20 public API repair.
- Dependency-cruiser still reports package cycles in `@repo/ai` and `@repo/database`; those must be fixed before claiming graph health.

Current source evidence:

- Vercel AI SDK docs describe LLM calls, tool definitions, multi-step agent loops, and monitoring as first-class AI app patterns.
- AgentMail docs describe API-first agent inboxes with inboxes, threads, messages, and attachments.
- Typesense docs support typo-tolerant search plus vector/semantic/hybrid search.
- Vercel Sandbox docs support isolated Firecracker microVMs for untrusted code execution.

## Package Verdicts

| Package                              |           Was It Right? |                            Keep? | Reason                                                                                                                                                                                        |
| ------------------------------------ | ----------------------: | -------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/auth` / Better Auth           |                     Yes |                        Keep core | Auth belongs in a package. Apps consume `@repo/auth/*`; Better Auth internals stay in package.                                                                                                |
| `@repo/database` / Drizzle/Postgres  |                     Yes |                        Keep core | Workflow, users, runs, artifacts, events, and billing need Postgres. Fix schema cycles.                                                                                                       |
| `@repo/design-system`                |                     Yes |                        Keep core | Shared UI primitives and theme belong here. Material redesign should start here, not app-local.                                                                                               |
| `@repo/next-config`                  |                     Yes |                        Keep core | Shared Next config belongs in a package. App configs should be thin composition files.                                                                                                        |
| `@repo/ai` / Vercel AI SDK           |       Yes, but refactor |        Keep core/gated by module | Right for streaming, tool schemas, model calls, UI message parts. Wrong if treated as the durable workflow engine. Split UI, server streaming, tool definitions, and future runtime concerns. |
| `@repo/contracts`                    |              Superseded |              Deleted by MADR-067 | Central contract bucket had no active consumers and mixed unrelated domains; contracts now live with owning packages.                                                                         |
| `@repo/search` / Typesense           | Yes, but optional infra |                       Keep gated | Good for workflow/artifact/file search. Convert old session/task schemas to workflow-native indexes. Do not require Typesense for the app boot path.                                          |
| `@repo/email` / Resend + React Email |                     Yes | Keep core for auth/transactional | Correct for password reset, verification, transactional product email. Different from AgentMail.                                                                                              |
| `@repo/agentmail`                    |    Right idea, not base |              Keep optional/gated | Good for agent-owned inboxes and workflow email tools. Not needed for auth email or initial shell. Keep lazy and feature-scoped.                                                              |
| `@repo/notifications` / Knock        |             Maybe later |                             Gate | Useful for in-app notifications/approvals later. Not core until notification UX is designed.                                                                                                  |
| `@repo/payments` / Stripe            |              Yes, later |                       Keep gated | Billing/usage will matter. Keep package; do not let it block reset shell.                                                                                                                     |
| `@repo/security`                     |                     Yes |                        Keep core | Security headers/rate/security checks belong in package.                                                                                                                                      |
| `@repo/observability`                |                     Yes |                        Keep core | Sentry/logging/status belong in package. Keep optional env behavior.                                                                                                                          |
| `@repo/analytics`                    |       Yes, but optional |                       Keep gated | Product analytics is useful; avoid requiring secrets or heavy client code at boot.                                                                                                            |
| `@repo/feature-flags`                |                     Yes |                       Keep gated | Feature flags are useful during reset/migration. Keep package-owned toolbar/config exports.                                                                                                   |
| `@repo/storage`                      |                     Yes |                   Keep core soon | Artifacts/files need object storage. Package is correct.                                                                                                                                      |
| `@repo/webhooks`                     |              Yes, later |                       Keep gated | Workflow triggers and external events will need webhooks.                                                                                                                                     |
| `@repo/rate-limit`                   |                     Yes |                        Keep/gate | Useful for public forms/auth/API. May later merge with security if too thin.                                                                                                                  |
| `@repo/internationalization`         |            App-specific |           Keep for web if needed | Good for marketing web; not core to workflow app MVP.                                                                                                                                         |
| `@repo/seo`                          |                Web-only |                     Keep for web | Correct package for marketing SEO, not app core.                                                                                                                                              |
| `@repo/cms` / BaseHub                |            No long-term |               Gate/replace later | Current BaseHub path is not target. Keep isolated until Payload/CMS decision.                                                                                                                 |
| `@repo/collaboration` / Liveblocks   |             Maybe later |                             Gate | Could be useful for collaborative workflow editing, but not core yet.                                                                                                                         |
| `@repo/testing`                      |          Yes, but stale |                    Keep/refactor | Shared factories are useful; remove Manus fixtures as reset proceeds.                                                                                                                         |

## Feature Verdicts

### AI SDK

Correct to add.

Use it for:

- model calls;
- streaming;
- tool calling schema integration;
- UI message streams;
- chat/workflow authoring surface;
- AI Gateway compatibility.

Do not use it as:

- the `.flow` compiler;
- the durable workflow runtime;
- the state machine;
- the sandbox boundary;
- the whole orchestration layer.

The correct architecture is `@repo/ai` for AI interaction primitives, then future `@repo/workflow-kernel` and `@repo/workflow-runtime` for compiler/runtime logic.

### AgentMail

Correct idea, wrong if treated as core boot dependency.

Use Resend for transactional auth/product emails.

Use AgentMail later for agent-owned workflow inboxes:

- receive replies;
- monitor external email events;
- send from workflow-specific addresses;
- attach artifacts;
- let workflows have first-class email identities.

Keep `@repo/agentmail`, but gate it.

### Typesense

Correct for this product.

Search in AI Workflow OS should eventually cover:

- workflows;
- runs;
- tasks;
- artifacts;
- files;
- approvals;
- tool outputs;
- events;
- docs/memory.

Typesense is a good fit for fast typo-tolerant search and later hybrid search. But for the bare reset shell, Postgres can be enough. Keep `@repo/search` optional until workflow-native schemas exist.

### Vercel Sandbox

Correct target.

The old E2B/service code should not define the new architecture. Build a provider-neutral `@repo/sandbox` later, then add Vercel Sandbox behind that interface. Do not wire sandbox directly into app routes.

## What Was Not Right

- Keeping old Manus names and E2B assumptions in active packages.
- Letting package tests import `apps/app` internals.
- Letting apps import package internals like `@repo/feature-flags/lib/*`.
- Treating optional integrations as required base dependencies.
- Keeping AI UI, tool runtime, canvas, and future workflow runtime tangled together in `@repo/ai`.
- Leaving database schema cycles and AI renderer cycles in the active graph.

## Next Package Order

1. Finish package boundary cleanup.
2. Fix `@repo/ai` renderer cycles.
3. Fix `@repo/database` schema cycles.
4. Gate optional packages so they do not block app boot/build.
5. Split future workflow packages:
   - `@repo/workflow-kernel`
   - `@repo/workflow-runtime`
   - `@repo/sandbox`
   - `@repo/tools`
   - `@repo/artifacts`
6. Continue `apps/app` cleanup only after package graph is sane.

## Final Answer

You were right to add most of these packages for the target platform.

The cleanup problem is not "too many packages." The cleanup problem is package ownership drift.

The senior path is to keep the package-first architecture, gate optional integrations, repair public APIs, and then rebuild the app as a thin workflow shell that consumes packages.
