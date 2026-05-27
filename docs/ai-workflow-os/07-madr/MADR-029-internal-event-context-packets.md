# MADR-029: Use Internal EventContextPackets

Status: Accepted

## Context

Workers, tools, apps, and workflows need to pass useful context without turning the platform into freeform agent-to-agent chat. Raw logs are too large, too expensive, and too hard to route safely.

## Decision

Normalize app, workflow, task, and worker outputs into internal EventContextPackets.

Start internal only. Do not publish ECP as an external protocol until the schema, auth, signing, replay, and privacy model are proven.

## Consequences

- Events become routeable, queryable, auditable, and billable.
- UI can update from events without waking main AI.
- Downstream tasks get minimal typed context instead of whole logs.
- Main AI receives compressed reflection packets only when rules require.

## Alternatives Considered

- Freeform worker-to-worker chat: rejected; expensive, hard to debug, and hard to secure.
- Raw log forwarding to the main AI: rejected; token-heavy and privacy-risky.
- Public ECP from day one: rejected; premature protocol design.

## Validation Checklist

- [ ] ECP schema is defined with versioning.
- [ ] ECP includes org/workflow/run/task identifiers.
- [ ] ECP includes correlation and causation IDs.
- [ ] ECP stores artifact references instead of large bodies.
- [ ] router can send ECP to UI, waiting tasks, workflows, or reflection.
- [ ] external webhook payloads are signed/verified before normalization.
