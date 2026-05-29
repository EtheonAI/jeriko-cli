# Codex Brief: What To Build

Build a `.flow` autonomous workflow runtime.

## The product layer

`.flow` is a custom AI-native workflow instruction language. It looks like a restricted YAML subset but uses our own semantics.

The AI writes `.flow`; users rarely see raw `.flow`.

## The runtime layer

The app compiles `.flow` into runtime JSON. One generic Inngest executor runs every workflow. No custom Inngest function per customer workflow.

## Main architecture

```text
.flow source
→ parser
→ CST/AST
→ JSON schema validation
→ symbol table
→ semantic graph
→ runtime execution plan
→ Inngest generic executor
→ task handlers
→ ECP events
→ side-panel UI
→ reflection/patching
```

## Main static functions

- `workflow.scheduler.tick`
- `workflow.event_router`
- `workflow.run`
- `workflow.approval.resume`
- `workflow.worker.callback`
- `workflow.reflection`
- `notification.dispatch`
- `usage.rollup`
- `watchdog.stuck_runs`
- `cleanup.old_runs`

## Main runtime task types

- `ai_task`
- `tool_call`
- `sandbox_command`
- `human_review`
- `wait_for_event`
- `sleep`
- `foreach`
- `parallel`
- `condition`
- `verify`
- `emit_event`
- `invoke_workflow`
- `memory_patch`
- `flow_patch`
- `issue_card`

## Do not build

- one cron per user trigger
- one Inngest function per workflow
- freeform agent-to-agent chat by default
- raw user code execution outside sandbox
- direct execution from `.flow` text without validation
- unlimited foreach/parallel
- unlimited free schedules/events
