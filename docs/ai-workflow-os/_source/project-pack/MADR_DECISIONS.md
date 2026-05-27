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
