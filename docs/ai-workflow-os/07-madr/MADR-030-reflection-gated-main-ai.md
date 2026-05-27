# MADR-030: Wake Main AI Only Through Reflection Gates

Status: Accepted

## Context

If the main AI watches every task, event, and worker output live, the platform recreates a high-token Manus-style orchestration loop. The product needs autonomy, but routine execution should be deterministic and event-driven.

## Decision

The main AI wakes by default only for:

- workflow creation
- user questions
- user-requested edits
- repeated task failure
- verifier failure
- approval rejection
- heavy user edits
- cost overrun
- stuck workflow
- scheduled improvement review

Runtime emits TaskReports and EventContextPackets. Reflection compresses those into Run Reflection Packets when configured conditions fire.

## Consequences

- Recurring workflows stay cheaper.
- UI still shows live work through event streams.
- Main AI focuses on repair, explanation, and improvement.
- Reflection packet quality becomes critical.

## Alternatives Considered

- Main AI orchestrates every step: rejected; expensive and unnecessary for deterministic steps.
- No reflection loop: rejected; platform would not improve or explain failures well.
- User-only debugging: rejected; issue cards and reflection should reduce user effort.

## Validation Checklist

- [ ] reflection rules exist in `.flow` runtime JSON.
- [ ] completed runs can produce Run Reflection Packets.
- [ ] main AI is not invoked for routine successful events.
- [ ] issue cards can trigger reflection.
- [ ] user can ask "what happened?" and receive a source-backed summary.
