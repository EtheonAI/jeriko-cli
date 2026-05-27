# Architecture Map

## Target Shape

```text
Next.js App
  -> Workflow Compiler
  -> Parser and Validator
  -> Compiled Runtime JSON / AST
  -> Trigger Registry + EventContextPacket Router
  -> Postgres + Object Storage
  -> Static Inngest Scheduler/Event Router
  -> Inngest Generic Executor
      -> AI task worker
      -> Tool router
      -> Vercel Sandbox runner
      -> Human approval runner
      -> Verifier
      -> Reflection / patch worker
  -> Event log + Side panel
```

## Core Runtime Rule

The runtime executes compiled structured data, not raw `.flow` text. `.flow` is a readable, versionable source contract; the compiled AST/runtime JSON is the execution contract.

## Dynamic Trigger Rule

Do not create one Vercel Cron, one API route, or one Inngest function per user workflow trigger.

`.flow` triggers compile into `workflow_triggers` rows. A small static scheduler/event-router layer claims due triggers, normalizes app/webhook events into EventContextPackets, and emits `workflow/run.requested` for the generic executor.

See [`scale-triggers-events-ecp.md`](./scale-triggers-events-ecp.md).

## Existing Jeriko Implication

The current app already contains many useful concepts: Next.js App Router, Better Auth, Drizzle/Postgres, Inngest, Composio, E2B sandbox, tool rendering, SSE, artifacts, and agent UI. The redesign should audit and selectively salvage these parts instead of assuming a clean rewrite.

## Architectural Risks To Validate

- Next.js 16.2 upgrade impact on current app routes, `proxy.ts`, async request APIs, and build config
- Replacing E2B with Vercel Sandbox without losing desktop/browser/file capabilities
- Inngest generic executor feasibility for dynamic user-authored workflows
- DB-backed trigger registry and event router correctness under load
- EventContextPacket routing without waking main AI for every event
- Safe `.flow` parser constraints versus YAML compatibility
- Tool permission enforcement outside the model
- Artifact and event storage volume costs

## Source References

- [`technical-blueprint.md`](./technical-blueprint.md)
- [`scale-triggers-events-ecp.md`](./scale-triggers-events-ecp.md)
- [`../07-madr/madr-decisions.md`](../07-madr/madr-decisions.md)
