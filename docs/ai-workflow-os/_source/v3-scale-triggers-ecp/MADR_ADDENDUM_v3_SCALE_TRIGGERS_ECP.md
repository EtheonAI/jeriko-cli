# MADR Addendum v3 — Scale, Triggers, Events, and ECP

## MADR-024: Use DB-backed trigger registry

**Status:** Accepted

### Context

User workflows can define many schedules and event triggers. Creating one Vercel Cron or Inngest function per trigger would not scale.

### Decision

Store all user-defined triggers in `workflow_triggers`. Use a static Inngest scheduled function as the scheduler tick.

### Consequences

The platform supports many logical triggers without creating many static cron jobs or functions.

---

## MADR-025: Use Inngest for durable execution and platform cron

**Status:** Accepted

### Context

We need schedules, waits, retries, events, approvals, subworkflow invocation, queues, and flow control.

### Decision

Use Inngest for the scheduler tick, generic workflow executor, event routing, approval waits, and worker callbacks. Vercel Cron is optional backup/maintenance only.

### Consequences

Execution is durable and observable while `.flow` remains our product layer.

---

## MADR-026: Use internal ECP-style Event Context Packets

**Status:** Accepted

### Context

Subworkers and apps need to pass context to other tasks and workflows without waking the main AI every time.

### Decision

Normalize app/worker/workflow events into EventContextPackets. Route them through Context Router to dependent tasks, UI, workflows, or main AI reflection.

### Consequences

The platform becomes event-aware and context-aware while staying cheaper than freeform agent-to-agent chat.

---

## MADR-027: Main AI wakes only on reflection triggers

**Status:** Accepted

### Context

Waking the main AI on every task/event would recreate high token burn.

### Decision

Main AI receives Run Reflection Packets only when configured conditions trigger: issues, repeated failures, rejected approvals, heavy edits, cost overruns, stuck runs, scheduled review, or user questions.

### Consequences

Workflow execution stays cheap, observable, and adaptive.
