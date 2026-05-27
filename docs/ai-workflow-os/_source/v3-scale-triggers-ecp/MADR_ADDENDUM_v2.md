# MADR Addendum — New Ideas

## MADR-019: Use side panel as live workflow surface

**Status:** Accepted

### Context

The main chat should not be woken for every subtask update because that would recreate high-token orchestrator loops.

### Decision

Add a workflow side panel that streams runtime events, task reports, artifacts, approvals, issue cards, and cost without waking the main AI.

### Consequences

Users see live work transparently while the main AI only wakes for reflection, repair, user questions, and patch proposals.

---

## MADR-020: Add per-chat/workflow notifications

**Status:** Accepted

### Context

Each workflow/chat can have different urgency, risk, and notification requirements.

### Decision

Notifications are configured per chat/workflow. Important event types include approvals, issues, completions, cost warnings, patch suggestions, tool disconnects, and workflow pauses.

### Consequences

Users can segment workflows and avoid global notification noise.

---

## MADR-021: Add version control per chat/workflow

**Status:** Accepted

### Context

Manual edits, AI patches, instruction changes, and memory changes can break workflows if not versioned.

### Decision

Every workflow/chat has version history, diffs, revert, fork, share, named checkpoints, and dry-run before activation.

### Consequences

Users can safely experiment and roll back.

---

## MADR-022: Use FlowPatch for all workflow edits

**Status:** Accepted

### Context

Manual UI edits, natural-language edits, and AI improvement suggestions all need safe validation.

### Decision

All edits become typed FlowPatch objects before being applied to `.flow`.

### Consequences

Every change can be validated, diffed, versioned, and reverted.

---

## MADR-023: Use event context instead of freeform worker chat

**Status:** Accepted

### Context

Subagents need to pass context to each other, but freeform agent-to-agent chat is expensive and hard to debug.

### Decision

Workers emit EventContextPackets and TaskReports. Context Router sends relevant context to dependent tasks and to main AI only when reflection rules require.

### Consequences

The system is cheaper, more observable, and safer.
