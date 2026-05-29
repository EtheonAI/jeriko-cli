# Storage, KV Cache, Artifacts, and State

## Storage layers

### Postgres

Stores:

- workflows
- workflow_versions
- workflow_files metadata
- workflow_triggers
- workflow_runs
- run_tasks
- workflow_events
- task_reports
- issue_cards
- approvals
- usage_events
- billing
- worker metrics

### Object storage

Stores large content:

- `.flow` source snapshots
- imported `.md` files
- generated scripts
- artifacts
- images
- CSVs
- reports
- stdout/stderr logs
- screenshots

### KV cache

Use for ephemeral/fast state:

- compiled spec cache
- trigger due-set cache
- tool manifest cache
- worker registry cache
- model capability cache
- artifact metadata cache
- idempotency/dedupe keys
- rate limit counters
- session run-state snippets
- hot event routing indexes

Never store permanent workflow truth only in KV.

## Cache keys

```text
compiled:{workflowVersionId}
tool-manifest:{toolName}
worker-registry:{orgId}
event-dedupe:{source}:{externalEventId}
rate:{orgId}:{source}:{minute}
artifact-meta:{artifactId}
```

## Artifact model

Artifact fields:

- id
- org_id
- workflow_id
- run_id
- task_id
- path
- type
- mime_type
- storage_url
- hash
- size
- metadata
- visibility
- retention_policy

## File model

Workflow files:

- `workflow.flow`
- `memory.md`
- `rules.md`
- `instructions/*.md`
- `scripts/*.py`
- `scripts/*.ts`
- `verifiers/*.json`
- `state.json`
- `events.jsonl`

## State model

Use:

- `workflow_runs.state` for run state
- `run_tasks.state` for task state
- `workflow_events` for event history
- object artifacts for outputs
- memory files for long-term behavioral memory

## Source of truth

- workflow definition: Postgres workflow_versions
- artifacts: object storage + DB metadata
- event timeline: workflow_events
- durable execution progress: Inngest + DB mirror
- hot cache: KV only
