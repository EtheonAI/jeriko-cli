# AI Workflow OS — Full Technical Blueprint

_Date: 2026-05-20_

## 1. Product definition

Build a **prompt-to-workflow platform** where the user never manually edits YAML unless they open Advanced mode.

The user-facing flow:

1. User types: "Make 2 Instagram posts per day for my company."
2. Platform compiles a hidden workflow definition.
3. User sees a simple workflow preview: what it will do, tools needed, approvals, schedule, estimated credits.
4. User connects required apps.
5. Inngest executes the workflow durably.
6. Vercel Sandbox runs generated scripts and file-processing commands.
7. Composio/direct APIs execute tool calls.
8. Approvals pause external actions.
9. Artifacts, logs, and events are saved.
10. The workflow proposes patches after runs.

## 2. Core architecture

```text
Next.js App
  ├─ Prompt UI / Workflow Preview
  ├─ Workflow Cards / Runs / Approvals / Artifacts
  └─ API Routes / Server Actions
       ↓
Workflow Compiler
  ├─ Model Router
  ├─ AST Generator
  ├─ YAML Renderer
  └─ Linter / Validator
       ↓
Postgres + Drizzle
  ├─ workflows
  ├─ workflow_versions
  ├─ workflow_files
  ├─ workflow_triggers
  ├─ workflow_runs
  ├─ run_steps
  ├─ workflow_events
  ├─ task_reports
  ├─ approvals
  ├─ artifacts
  ├─ tool_connections
  ├─ tool_calls
  ├─ usage_events
  ├─ run_reflections
  └─ memory_patches
       ↓
Inngest
  ├─ workflow.scheduler.tick
  ├─ workflow.event_router
  ├─ workflow.run Generic Executor
  ├─ workflow.approval.resume
  ├─ workflow.worker.callback
  ├─ workflow.reflection
  ├─ notification.dispatch
  ├─ usage.rollup
  ├─ watchdog.stuck_runs
  └─ cleanup.old_runs
       ↓
Generic Workflow Executor
       ├─ ai_task → Model Router
       ├─ tool_call → Tool Router → Composio/direct API
       ├─ sandbox_command → Vercel Sandbox
       ├─ verify → Verifier Engine
       ├─ human_review → Approval wait
       ├─ wait/sleep → Inngest step.sleep
       ├─ foreach/parallel → controlled fan-out
       └─ memory_patch → patch proposal
```

## 3. Stack

| Layer          | Choice                            | Why                                                         |
| -------------- | --------------------------------- | ----------------------------------------------------------- |
| App            | Next.js latest App Router         | Strongest path with Vercel, RSC, server actions, API routes |
| Boilerplate    | next-forge or equivalent          | Saves setup time; keep only needed packages                 |
| Auth           | better-auth                       | Modern auth and org-compatible foundation                   |
| ORM            | Drizzle ORM                       | Typed schema and migrations, good for Postgres              |
| DB             | Postgres                          | Reliable relational state + JSONB for AST                   |
| Durable runner | Inngest                           | Event-driven, durable steps, waits, retries, monitoring     |
| Sandbox        | Vercel Sandbox                    | Runs generated code/files safely in Vercel ecosystem        |
| Tools          | Composio + direct APIs            | Broad connectors plus control for critical integrations     |
| AI SDK         | Vercel AI SDK / direct model SDKs | Streaming, model abstraction, Next.js-native                |
| Storage        | Vercel Blob / R2 / S3             | Artifacts, logs, screenshots, generated files               |
| Live updates   | SSE first                         | Simple one-way run event streaming                          |
| UI             | Tailwind + shadcn/ui              | Fast, clean product UI                                      |

## 4. UX sitemap

```text
/
  marketing / waitlist

/app
  /new
    prompt input
    examples
    workflow preview

  /workflows
    workflow cards
    status filters
    search

  /workflows/[id]
    overview
    runs
    files
    artifacts
    approvals
    versions
    settings
    advanced YAML

  /runs/[id]
    live timeline
    step logs
    artifacts
    cost/credits
    approvals

  /approvals
    global approval inbox

  /library
    premade workflows
    categories: Marketing, Sales, Inbox, Research, Operations, Optimization

  /projects
    grouped workflows and artifacts

  /pulse
    global activity feed

  /analytics
    usage, success rate, cost, workflow health

  /connections
    connected apps and scopes

  /billing
    plan and credits

  /settings
    profile, org, members, notifications, security
```

## 5. Workflow file model

```text
.flow                  Hidden readable workflow source
rules.md               User/company instructions
memory.md              Learned preferences
permissions.flow       Automatic / approval / blocked actions
tools.flow             Tool descriptors and connector refs
verifiers.flow         Quality/safety checks
budget.flow            Cost and runtime limits
state.json             Current run state
events.jsonl           Append-only execution events
scripts/generated/*    AI-generated scripts
scripts/approved/*     Promoted stable scripts
artifacts/*            Outputs, drafts, reports, screenshots, CSVs
```

## 6. `.flow` workflow source example

```flow
flow: "0.1"
name: daily_social_content
goal: "Create two Instagram posts per day and ask before publishing."

trigger:
  type: schedule
  times: ["10:00", "16:00"]

workspace:
  rules: rules.md
  memory: memory.md
  state: state.json
  events: events.jsonl
  artifacts: artifacts/
  scripts: scripts/

permissions:
  automatic:
    - read_public_web
    - create_drafts
    - write_internal_files
    - run_sandbox_code
  approval_required:
    - publish_social_post
    - send_email
    - update_external_system
  blocked:
    - delete_data
    - transfer_money
    - change_security_settings

budget:
  max_cost_usd_per_run: 2
  max_runtime_minutes: 45
  max_tool_calls: 100

steps:
  - id: research_topics
    type: ai_task
    worker: researcher
    tools: [web_search, website_reader]
    outputs: [artifacts/topic_candidates.json]

  - id: write_posts
    type: ai_task
    worker: writer
    inputs: [artifacts/topic_candidates.json, rules.md, memory.md]
    outputs: [artifacts/post_drafts.json, artifacts/visual_briefs.json]

  - id: validate_posts
    type: sandbox_command
    run: "python scripts/generated/validate_posts.py"
    inputs: [artifacts/post_drafts.json, rules.md]
    outputs: [artifacts/validation_report.json]

  - id: approval
    type: human_review
    inputs: [artifacts/post_drafts.json, artifacts/validation_report.json]

  - id: publish
    type: tool_call
    tool: instagram.publish
    requires_approval: true

  - id: improve
    type: memory_patch
    inputs: [user_edits, artifacts/analytics_report.json]
```

## 7. Inngest execution model

One generic executor interprets compiled AST. Dynamic user triggers do not create new functions.

```ts
export const runWorkflow = inngest.createFunction(
  { id: "run-workflow" },
  { event: "workflow/run.requested" },
  async ({ event, step }) => {
    const run = await step.run("load-run", () => loadRun(event.data.runId));
    const ast = await step.run("load-ast", () => loadCompiledAst(run.workflowVersionId));

    for (const wfStep of resolveExecutableSteps(ast, run.state)) {
      await executeStep(step, wfStep, run);
    }
  }
);
```

Step mapping:

| YAML step type    | Executor                                             |
| ----------------- | ---------------------------------------------------- |
| `ai_task`         | model worker                                         |
| `tool_call`       | Tool Router                                          |
| `sandbox_command` | Vercel Sandbox                                       |
| `verify`          | Verifier Engine                                      |
| `human_review`    | Inngest waitForEvent/waitForSignal + approval record |
| `wait`            | Inngest sleep                                        |
| `foreach`         | controlled fan-out                                   |
| `parallel`        | controlled parallel group                            |
| `memory_patch`    | AI patch generator                                   |

## 7.1 Scale, triggers, events, and ECP

`.flow` trigger definitions are product data. They compile into `workflow_triggers` rows.

```text
.flow trigger definitions
-> workflow_triggers
-> workflow.scheduler.tick / workflow.event_router
-> workflow/run.requested
-> workflow.run generic executor
```

Static Inngest functions:

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

Events from app webhooks, tools, workers, workflows, and scheduler ticks normalize into internal EventContextPackets. The Context Router decides whether an event updates UI, wakes a waiting task, starts another workflow, creates an issue card, or contributes to a Run Reflection Packet.

Default rule:

```text
main AI does not wake for every event
main AI wakes through reflection gates or direct user questions
```

See [`scale-triggers-events-ecp.md`](./scale-triggers-events-ecp.md).

## 8. Tool Router

Tool call flow:

```text
step requests tool
→ retrieve tool manifest
→ check connected account
→ check workflow permissions
→ check approval status
→ validate arguments
→ execute via Composio/direct API
→ store result artifact
→ log tool_call event
```

Never expose all tools to the model. Expose only tools needed by the current step.

## 9. Vercel Sandbox execution

Sandbox command flow:

```text
create sandbox
→ stage input files
→ stage generated script
→ run policy scanner
→ execute command
→ capture stdout/stderr
→ read declared output files
→ upload artifacts
→ destroy sandbox
```

Security rules:

- no OAuth secrets in sandbox
- network disabled unless explicitly allowed
- timeout and output size limits
- file access limited to workflow workspace
- dangerous commands blocked
- external actions use typed tools, not shell scripts

## 10. Frontend concept

The UX should be simple:

- One prompt input
- Simple workflow preview card
- Workflow cards like CI-style status cards
- Run timeline
- Approval cards
- Artifact viewer
- Library of premade workflows
- Pulse feed showing what happened

Do not lead with YAML. YAML is Advanced mode only.

## 11. MVP scope

MVP must support:

1. User authentication and org.
2. Prompt-to-workflow compile.
3. Hidden YAML + AST validation.
4. Workflow preview and create.
5. Generic Inngest executor.
6. ai_task, sandbox_command, verify, human_review, tool_call.
7. Vercel Sandbox script execution.
8. Composio/direct mocked tools.
9. Approval inbox.
10. Artifacts.
11. Run timeline.
12. Credit metering.

MVP templates:

- Social content workflow
- Inbox draft workflow
- Lead research workflow

## 12. Non-goals for MVP

- public workflow marketplace
- arbitrary skill/plugin marketplace
- enterprise SSO
- autonomous external actions without approval
- desktop control
- complex visual node canvas
- full CRM suite
- unlimited free credits
