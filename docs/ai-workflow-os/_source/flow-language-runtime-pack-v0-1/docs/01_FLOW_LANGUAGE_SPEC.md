# `.flow` Language Specification v0.1

## 1. Philosophy

`.flow` is a **restricted YAML-like instruction language** for AI-authored autonomous workflows.

It is not full YAML. It borrows YAML readability but rejects unsafe/ambiguous features.

`.flow` is:

- AI-friendly
- human-readable
- machine-parseable
- versioned
- permission-aware
- event-aware
- failure-aware
- artifact-aware
- subworker-aware
- patchable

## 2. Execution principle

`.flow` is never executed directly.

```text
workflow.flow
→ parse
→ structural validate
→ semantic validate
→ compile runtime JSON
→ execute runtime JSON
```

## 3. Safe subset rules

Allowed:

- mappings
- lists
- block strings
- quoted and plain strings
- numbers
- booleans
- null
- nested objects
- arrays
- comments

Rejected:

- YAML anchors
- YAML aliases
- custom tags
- multi-document YAML
- arbitrary object constructors
- flow-style objects in complex sections
- unknown top-level keys
- unknown task fields
- unbounded foreach/parallel
- external action without approval
- blocked action categories

## 4. Top-level structure

Required:

```yaml
flow: "0.1"
name: social_media_manager
goal: |
  Create daily content and publish only after approval.
```

Recommended:

```yaml
mode: supervised
imports: {}
files: {}
permissions: {}
tools: []
workers: {}
budgets: {}
triggers: []
jobs: {}
reflection: {}
notifications: {}
```

## 5. Top-level keys

| Key | Required | Purpose |
|---|---:|---|
| `flow` | yes | language version |
| `name` | yes | workflow name |
| `goal` | yes | high-level purpose |
| `mode` | no | `draft_only`, `supervised`, `auto`, `live_orchestration` |
| `imports` | no | instruction files and data files |
| `files` | no | memory/state/artifacts/scripts paths |
| `permissions` | no | auto/ask/block policy |
| `tools` | no | allowed tools |
| `workers` | no | worker registry/policies |
| `budgets` | no | credit/runtime/tool limits |
| `triggers` | no | workflow-level triggers |
| `jobs` | yes | jobs and tasks |
| `reflection` | no | rules for main AI reflection |
| `notifications` | no | notification routing |
| `exports` | no | artifacts/events visible to other workflows |
| `metadata` | no | tags, owners, descriptions |

## 6. Modes

```yaml
mode: supervised
```

Allowed:

- `draft_only`: creates outputs but never external actions
- `supervised`: default; external actions require approval
- `auto`: can run low-risk approved actions automatically
- `live_orchestration`: main AI can be awake during execution; expensive/premium

## 7. Imports

Imports point to instruction/data files.

```yaml
imports:
  brand: brand.md
  writer: instructions/writer.md
  image: instructions/image.md
  platform_instagram: instructions/platforms/instagram.md
```

Rules:

- imports are read-only unless a patch updates them
- imported `.md` files carry prose instructions
- imported `.json` files carry structured state/data
- imported scripts must live under `scripts/`

## 8. Files

```yaml
files:
  memory: memory.md
  state: state.json
  events: events.jsonl
  artifacts: artifacts/
  scripts: scripts/
```

## 9. Permissions

```yaml
permissions:
  auto:
    - read_public_web
    - create_drafts
    - write_internal_files
    - run_sandbox_code
    - analyze_metrics

  ask:
    - publish_social_post
    - send_email
    - post_slack_message
    - update_crm
    - submit_external_form

  block:
    - delete_data
    - transfer_money
    - expose_secrets
    - change_security_settings
    - bypass_captcha
```

Default policy:

- unknown external action = ask
- unknown destructive action = block
- sending/publishing/updating = ask
- deleting/transferring/security = block

## 10. Tools

```yaml
tools:
  - web.search
  - web.read
  - gmail.send
  - slack.post
  - instagram.publish
  - google_analytics.query
  - sandbox.python
```

Tool names are resolved against the Tool Registry.

## 11. Workers

Workers define subagent capabilities and routing.

```yaml
workers:
  researcher:
    type: ai
    capabilities: [research, summarize, cite_sources]
    model_policy: balanced

  writer:
    type: ai
    capabilities: [write_content, brand_voice]
    model_policy: quality

  image_worker:
    type: image
    capabilities: [image_prompt, image_generation]
    model_policy: quality

  code_worker:
    type: code
    capabilities: [write_python, write_typescript, debug_script]
    model_policy: strong

  verifier:
    type: verifier
    capabilities: [schema_check, content_check, policy_check]
    model_policy: cheap

  tool_executor:
    type: tool
    capabilities: [api_call]
    model_policy: none

  sandbox_runner:
    type: sandbox
    capabilities: [run_python, run_node, process_files]
    model_policy: none
```

Allowed worker types:

- `ai`
- `image`
- `voice`
- `code`
- `tool`
- `sandbox`
- `verifier`
- `analytics`
- `memory`
- `router`
- `system`

## 12. Worker policy

Tasks can specify direct worker or routing policy.

```yaml
worker: writer
```

or:

```yaml
worker_policy:
  require: [write_content, brand_voice]
  optimize_for: quality
  max_credits: 15
  fallback: writer_fast
```

Allowed optimize values:

- `cost`
- `quality`
- `speed`
- `reliability`
- `balanced`

## 13. Budgets

```yaml
budgets:
  max_credits_per_run: 50
  max_credits_per_day: 200
  max_runtime_minutes: 45
  max_tool_calls: 100
  max_ai_tasks: 20
  max_sandbox_seconds: 300
  max_events_per_minute: 100
  on_exceed: pause_and_ask
```

Allowed `on_exceed`:

- `pause_and_ask`
- `stop_run`
- `continue_degraded`
- `notify_only`

## 14. Triggers

Supported trigger types:

- `manual`
- `schedule`
- `app_event`
- `workflow_event`
- `webhook`
- `approval_event`

Example:

```yaml
triggers:
  - id: weekday_morning
    type: schedule
    cron: "0 10 * * MON-FRI"
    timezone: "America/Los_Angeles"
    jitter: "5m"
    misfire: run_once

  - id: gmail_go
    type: app_event
    event: gmail.email_received
    match:
      from: boss@example.com
      subject_regex: "^go$"
```

## 15. Jobs

Jobs group tasks and can be triggered independently.

```yaml
jobs:
  daily_content:
    trigger: weekday_morning
    tasks:
      - id: research
        type: ai_task
```

A job can:

- reference a trigger
- contain tasks
- emit events on completion
- have budgets
- have concurrency limits

## 16. Task model

All tasks share common fields:

| Field | Purpose |
|---|---|
| `id` | unique task id inside job |
| `type` | task type |
| `purpose` | natural language task purpose |
| `worker` | explicit worker |
| `worker_policy` | dynamic worker selection |
| `input` | artifact/import/event inputs |
| `output` | produced artifacts |
| `uses` | tools used |
| `run` | sandbox command |
| `after` | dependencies |
| `required` | required vs optional |
| `requires_approval` | human approval gate |
| `if_fail` | failure policy |
| `timeout` | max task wait/runtime |
| `retries` | retry policy |
| `emit` | emitted events |
| `notify` | context routing |
| `verify` | checks |
| `budget` | task-level limits |

## 17. Task types

### `ai_task`

Calls a scoped AI worker.

```yaml
- id: draft_posts
  type: ai_task
  worker: writer
  input:
    - artifacts/research.json
    - brand.md
  output:
    - artifacts/posts.json
```

### `tool_call`

Calls an external/internal tool.

```yaml
- id: publish
  type: tool_call
  uses: instagram.publish
  requires_approval: true
  input:
    - artifacts/posts/instagram.json
```

### `sandbox_command`

Runs code in Vercel Sandbox.

```yaml
- id: validate_posts
  type: sandbox_command
  run: python scripts/validate_posts.py
  input:
    - artifacts/posts/
  output:
    - artifacts/validation_report.json
```

### `human_review`

Creates approval card and waits.

```yaml
- id: approval
  type: human_review
  review:
    - artifacts/posts/
    - artifacts/validation_report.json
```

### `wait_for_event`

Waits for event.

```yaml
- id: wait_for_go
  type: wait_for_event
  event: gmail.email_received
  match:
    subject_regex: "^go$"
  timeout: 12h
```

### `sleep`

Durable delay.

```yaml
- id: wait_4_hours
  type: sleep
  duration: 4h
```

### `foreach`

Bounded fan-out.

```yaml
- id: draft_per_platform
  type: foreach
  items: [x, instagram, linkedin]
  as: platform
  max_parallelism: 3
  body:
    - id: draft
      type: ai_task
      worker: writer
```

### `parallel`

Parallel branches.

```yaml
- id: collect_sources
  type: parallel
  max_parallelism: 3
  branches:
    - id: web_research
      tasks: []
    - id: competitor_scan
      tasks: []
```

### `condition`

Branching.

```yaml
- id: alert_if_bad
  type: condition
  if: artifacts.validation.score < 0.75
  then:
    - id: create_issue
      type: issue_card
```

### `verify`

Check output.

```yaml
- id: verify_posts
  type: verify
  checks:
    - schema_valid
    - no_unsupported_claims
    - brand_voice
```

### `emit_event`

Emit event context.

```yaml
- id: emit_ready
  type: emit_event
  event: post.draft.ready
```

### `invoke_workflow`

Run subworkflow.

```yaml
- id: start_outreach
  type: invoke_workflow
  workflow: outreach_sequence
  input:
    leads: artifacts/leads.csv
```

### `memory_patch`

Suggest memory changes.

```yaml
- id: improve
  type: memory_patch
  target: memory.md
  input:
    - artifacts/analytics_report.json
```

### `flow_patch`

Suggest `.flow` changes.

```yaml
- id: patch_flow
  type: flow_patch
  target: workflow.flow
  reason: repeated_failure
```

### `issue_card`

Create user-visible issue.

```yaml
- id: create_issue
  type: issue_card
  title: "LinkedIn image failed validation"
```

## 18. Failure policies

Allowed values:

- `stop`
- `retry`
- `retry_then_stop`
- `retry_then_ask`
- `continue_degraded`
- `use_cached`
- `fallback`
- `create_issue_card`
- `regenerate_once_then_ask`
- `ask_user`
- `skip_optional`

Task example:

```yaml
if_fail: continue_degraded
```

Structured policy:

```yaml
failure:
  policy: retry_then_ask
  retries: 2
  backoff: exponential
  fallback_task: use_cached_topics
```

## 19. Notifications

```yaml
notifications:
  approval_needed:
    channels: [in_app, email]
  completed_with_issues:
    channels: [in_app, slack]
  cost_warning:
    channels: [in_app]
```

## 20. Reflection

```yaml
reflection:
  mode: on_triggers
  send_to_main_ai:
    when:
      - completed_with_issues
      - repeated_failure
      - approval_rejected
      - user_edited_output
      - cost_exceeded
      - weekly_review
  include:
    - run_summary
    - task_reports
    - issue_cards
    - artifact_summaries
    - cost_summary
  exclude:
    - raw_logs
    - hidden_reasoning
```

## 21. Event context routing

```yaml
notify:
  ui: true
  tasks: [approval, schedule_posts]
  workflows: [weekly_report]
  main_ai:
    when: [repeated_failure, verifier_failed]
```

## 22. Versioning

Every `.flow` has:

```yaml
flow: "0.1"
```

Runtime stores:

- source `.flow`
- parsed AST
- compiled JSON
- semantic graph summary
- artifacts
- task reports
- patches
- migrations

Running runs keep their original version.
