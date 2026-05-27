# AI Workflow OS — Permanent Idea Memory

_Date: 2026-05-22_

## 0. Core product thesis

We are building a **.flow-based autonomous workflow runtime**, not a chatbot, not a node-builder, not an agent marketplace.

The user describes work once. The platform creates a persistent workflow operating file, runs it with scoped workers, passes typed event context between tasks, shows progress in a structured side panel, asks approval for risky actions, and improves the workflow over time.

Core sentence:

> User prompt → AI writes `.flow` → runtime executes → workers report → events route context → issues surface → reflection improves future runs.

## 1. The `.flow` idea

`.flow` is our AI-native workflow instruction file.

It is:

- YAML-like for AI fluency.
- Restricted and validated for runtime safety.
- Our own vocabulary and semantics.
- Compiled into runtime JSON before execution.
- Not shown to normal users by default.
- Available in Advanced mode for power users.

A `.flow` file defines:

- goal
- mode
- triggers
- jobs
- tasks
- tools/apps
- imports
- instruction files
- permissions
- approvals
- scripts
- outputs/artifacts
- event emissions
- context routing
- failure behavior
- budgets
- reflection rules
- patch rules

## 2. Main AI versus workers

The main AI is the **workflow architect**.

Main AI handles:

- user goal understanding
- `.flow` creation
- task decomposition
- permissions and security rules
- failure policies
- event routing rules
- worker policies
- workflow repair
- workflow improvement
- reflection and patch proposals

Workers/subagents handle:

- research
- writing
- image prompting/generation
- code/script generation
- sandbox execution
- tool calls
- verification
- analytics
- memory patch proposals
- report generation

Default rule:

> The main AI should not wake up for every step. It wakes for creation, repair, reflection, user questions, and important exceptions.

## 3. Deterministic runtime

The runtime is deterministic where possible.

Non-AI/deterministic tasks:

- trigger schedules
- webhook ingestion
- event routing
- dependency checks
- permission checks
- budget checks
- tool calls with known args
- sandbox commands
- human approval waits
- retries
- waits
- foreach/parallel orchestration
- artifact save/load
- event log writes

AI tasks:

- initial workflow creation
- task writing/research/analysis
- script generation
- ambiguous classification
- content generation
- strategy recommendations
- workflow repair
- memory/workflow patches

This keeps recurring runs cheaper than a Manus-style orchestrator loop.

## 4. Event Context Layer

This is a core differentiator.

Workers and app events do not just produce raw outputs. They emit **Event Context Packets**.

Events connect:

- app → workflow
- workflow → workflow
- task → task
- worker → worker
- worker → main AI only when needed
- workflow run → reflection packet

Example event types:

- `post.draft.ready`
- `artifact.image.generated`
- `validation.completed`
- `approval.requested`
- `approval.approved`
- `tool.completed`
- `sandbox.command.completed`
- `task.failed`
- `issue.created`
- `memory.patch.proposed`
- `workflow.patch.proposed`
- `gmail.email_received`
- `stripe.invoice_paid`
- `shopify.inventory_low`

EventContextPacket includes:

- event id
- type
- workflow id
- run id
- job id
- task id
- worker id
- source
- correlation id
- causation id
- summary
- payload
- artifact refs
- quality signals
- cost
- routing hints

## 5. Worker communication rule

Workers should not free-chat with each other by default.

Bad:

- image worker directly chats with scheduler worker
- every worker sends full logs to main AI
- main AI watches all steps live

Good:

- worker emits typed event
- event is stored
- Context Router finds dependent tasks
- dependent tasks receive minimal relevant context
- UI updates through event stream
- main AI receives reflection packet only when needed

## 6. Context routing modes

We support three modes:

### Mode 1 — Runtime-only mode

- The run executes.
- Events update the side panel.
- Main AI does not wake.
- Good for deterministic tasks and low-cost workflows.

### Mode 2 — Reflection mode

- Default mode.
- Main AI wakes at checkpoints or when configured triggers fire.
- Used for improvement and patch proposals.

### Mode 3 — Live orchestration mode

- Expensive / premium mode.
- Main AI is involved during execution.
- Useful for debugging, novel workflows, high-complexity runs, or user-selected premium mode.

## 7. Reflection packets

The main AI should receive compressed context, not raw logs.

Route reflection to main AI when:

- run completed with issues
- task failed repeatedly
- verifier failed
- user rejected output
- user edited output heavily
- cost exceeded estimate
- workflow got stuck
- same issue repeated
- weekly improvement cycle fires
- user asks the chat what happened

Reflection packet includes:

- run summary
- task outcomes
- issues
- fallbacks used
- artifacts created
- approvals
- cost breakdown
- worker performance
- patch opportunities

## 8. Task Reports

Every worker returns a Task Report.

Task report includes:

- task id
- worker id
- status
- summary
- inputs used
- outputs created
- emitted events
- tools used
- model used
- token/cost usage
- confidence
- issues
- suggested patches

This lets the system adapt without sending everything back to the main AI.

## 9. Issue Cards

Failures become user-visible issue cards.

Issue card contains:

- issue title
- failed task
- impact
- reason
- fallback used
- whether workflow continued
- suggested actions
- retry / skip / use fallback / patch workflow / ask AI

This replaces “workflow failed at node X” with operational intelligence.

## 10. Side panel of workflow

Every chat/workflow should have a right-side workflow panel.

It shows:

- current workflow
- current run
- jobs
- tasks/subtasks
- live status
- events
- task reports
- issue cards
- approvals
- artifacts
- cost meter
- reflection summary
- worker activity

The side panel lets the user watch work happen without waking the main AI constantly.

## 11. Notifications per chat

Each chat/workflow should have its own notification settings.

Notification types:

- approval needed
- run completed
- run completed with issues
- issue created
- cost warning
- tool disconnected
- patch suggested
- workflow paused
- event received
- subworkflow finished
- artifact created
- scheduled run missed
- worker failed

Notification channels:

- in-app
- email
- Slack
- SMS/Twilio later
- webhook/API later
- mobile push later

Each chat/workflow can have:

- notification rules
- quiet hours
- escalation rules
- digest mode
- realtime mode

## 12. Version control on top of each chat

Each chat/workflow should support version control.

Versioned objects:

- workflow.flow
- compiled runtime JSON
- imported instruction files
- memory files
- scripts
- permissions
- tool config
- reflection rules
- UI-generated patches

User can:

- view versions
- see diffs
- revert to previous version
- create named checkpoints
- compare current versus previous
- share a version
- fork a version
- restore after bad change

Chat UX:

- top bar version selector
- “Current version: v7”
- “Revert”
- “Share”
- “Fork”
- “View changes”
- “Dry run version”

Important rule:

- running runs keep their original workflow version.
- new runs use the active version.

## 13. Sharing

Users can share:

- workflow template
- workflow version
- run report
- artifact
- issue card
- approval request
- read-only public link
- team-only link
- export package

Sharing controls:

- redact secrets
- hide tool tokens
- hide private artifacts
- share only summary
- share full workflow source for team/admin
- share template without connected accounts

Future:

- private workflow library
- team workflow recipes
- curated public templates only after security maturity

## 14. Manual editing

Users should not edit raw `.flow` by default.

Editing modes:

1. Natural-language edit
2. Visual card/inspector editor
3. Advanced raw `.flow` editor

Every change becomes a FlowPatch.

FlowPatch types:

- add_task
- update_task
- remove_task
- update_trigger
- add_trigger
- update_permission
- update_tool
- update_import
- update_budget
- update_failure_policy
- update_worker_policy
- update_reflection_rules
- update_event_routing
- add_subworkflow

Patch flow:

- user edit
- create FlowPatch
- validate patch
- apply to parsed workflow
- render updated `.flow`
- compile runtime JSON
- run semantic validation
- show diff
- save new version
- activate if approved

## 15. Chat as control surface

Chat should continue, but it should not be the always-on executor.

Chat is for:

- creating workflows
- asking what happened
- approving or rejecting suggestions
- requesting edits
- pausing/resuming/canceling
- asking for explanations
- debugging issues
- generating patches

The side panel is for live execution state.

## 16. Feature ideas to preserve

- `.flow` custom instruction language.
- Restricted YAML-like syntax.
- Own parser eventually.
- Strict semantic validation.
- Compile `.flow` to runtime JSON.
- Main AI writes `.flow`.
- Subworkers execute scoped tasks.
- Event context packets for context sharing.
- Task reports for every worker.
- Issue cards for failures.
- Reflection packets to main AI only when needed.
- Side panel for live workflow visibility.
- Notifications per chat/workflow.
- Version control on each chat/workflow.
- Shareable workflow versions and run reports.
- Visual workflow renderer/editor.
- Advanced raw `.flow` editor.
- FlowPatch engine.
- Worker performance routing.
- Modes: runtime-only, reflection, live orchestration.
- Budget and credit controls.
- Event storm controls.
- Cross-workflow dependencies.
- Sub-workflows.
- Artifact viewer.
- Script execution with Vercel Sandbox.
- App/tool calls via Tool Router.
- Approval gates for risky actions.
- Future voice/calling/text-to-voice.
- Future sales/calling workflows.
- Future API for external apps to trigger workflows.
- Future internal ECP-style Event Context Protocol.

## 17. Final product definition

> A workflow-aware autonomous AI runtime where the workflow is a living `.flow` operating contract. It can run, monitor, route context, recover, notify, show work, ask approval, and improve itself over time.

---

# 18. Scale, triggers, and ECP update

The platform uses a DB-backed dynamic trigger registry. It does not create one Vercel Cron or one Inngest function per user workflow trigger.

Architecture:

```text
.flow trigger definitions
→ workflow_triggers table
→ Inngest scheduler tick
→ workflow/run.requested
→ generic Inngest executor
```

Events from apps, tools, workers, and workflows are normalized into EventContextPackets. The Event Context Layer routes context between workers, tasks, subworkflows, UI, and the main AI only when rules require.

Static platform functions:

- workflow.scheduler.tick
- workflow.event_router
- workflow.run
- workflow.approval.resume
- workflow.worker.callback
- workflow.reflection
- notification.dispatch
- usage.rollup
- watchdog.stuck_runs
- cleanup.old_runs

The main AI is not woken on every event. The UI side panel shows events live. The main AI receives Run Reflection Packets only for issues, repeated failures, rejected approvals, heavy edits, cost overruns, stuck workflows, scheduled improvement cycles, or direct user questions.

Cost control:

- credits per run
- credits per AI task
- credits per tool call
- credits per sandbox second
- credits per image generation
- credits per reflection
- event volume limits
- active trigger limits
- concurrency limits

This lets the system handle many workflows, crons, events, subworkers, and app integrations without exploding cost.
