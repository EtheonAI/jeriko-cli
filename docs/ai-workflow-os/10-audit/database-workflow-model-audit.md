# Database And Workflow Model Audit

Date: 2026-05-23

Scope: existing Drizzle schema, current session/task/sandbox models, and required workflow-native schema for `.flow`.

## Verdict

The database has useful primitives, but there is no first-class workflow model. The new platform should not overload `agentSessions`, `scheduledTasks`, or chat `messages` as workflow records.

## Existing Useful Tables

### Agent Sessions

Current use:

- Chat/agent sessions.
- Session metadata.
- User ownership.

Use in new platform:

- Keep for legacy chat and possible run conversation threads.
- Do not use as workflow or run source of truth.

### Messages

Current use:

- Chat messages tied to sessions.

Use in new platform:

- Keep for assistant conversation around a run or workflow edit.
- Do not use for task reports or event logs.

### Documents / Files

Current use:

- User files and generated documents.

Use in new platform:

- Can seed artifact storage and library UI.
- Needs workflow-run and run-step associations.

### Scheduled Tasks

Current use:

- Recurring, cron, one-time, webhook, and trigger-based prompt tasks.
- Task execution history.
- Composio trigger fields.

Use in new platform:

- Good reference for trigger and execution modeling.
- Not rich enough for `.flow` source versions, compiled IR, semantic validation, artifact dependencies, approval gates, retry policy, or state machine behavior.

### Sandboxes

Current use:

- E2B-specific sandbox records.
- Session-scoped runtime.

Use in new platform:

- Keep only after adding provider-neutral fields.
- Associate with workflow runs and run steps, not only sessions.

### Billing / Usage Ledger

Current use:

- Usage event types already include AI/tool/VM-like concepts.

Use in new platform:

- Reuse for workflow run cost accounting.
- Add workflow/run/step dimensions.

## Missing Workflow Tables

Minimum schema set:

- `workflows`
- `workflow_versions`
- `workflow_files`
- `workflow_runs`
- `workflow_run_steps`
- `workflow_events`
- `workflow_artifacts`
- `workflow_approvals`
- `workflow_tool_calls`
- `workflow_sandbox_sessions`
- `workflow_issues`
- `workflow_memory_patches`
- `workflow_permissions`

## Suggested Table Responsibilities

### workflows

Owns the stable workflow identity.

Fields:

- `id`
- `organizationId`
- `projectId`
- `ownerUserId`
- `name`
- `slug`
- `description`
- `status`
- `createdAt`
- `updatedAt`

### workflow_versions

Stores immutable `.flow` versions.

Fields:

- `id`
- `workflowId`
- `versionNumber`
- `source`
- `sourceHash`
- `compiledJson`
- `astJson`
- `diagnostics`
- `status`
- `createdByUserId`
- `publishedAt`
- `createdAt`

Rules:

- Runs reference a version ID.
- Published versions are immutable.
- Drafts can be edited.

### workflow_files

Stores additional files imported by `.flow`.

Fields:

- `id`
- `workflowId`
- `path`
- `content`
- `contentHash`
- `kind`
- `createdAt`
- `updatedAt`

### workflow_runs

Stores one execution instance.

Fields:

- `id`
- `workflowId`
- `versionId`
- `triggerType`
- `triggerPayload`
- `status`
- `startedAt`
- `completedAt`
- `cancelledAt`
- `cost`
- `createdByUserId`

### workflow_run_steps

Stores normalized step state.

Fields:

- `id`
- `runId`
- `taskId`
- `taskType`
- `status`
- `attempt`
- `inputJson`
- `outputJson`
- `errorJson`
- `startedAt`
- `completedAt`
- `sandboxSessionId`

### workflow_events

Append-only event log.

Fields:

- `id`
- `runId`
- `stepId`
- `eventType`
- `payload`
- `severity`
- `createdAt`

Rules:

- UI timeline should be reconstructible from events.
- Events should be append-only.

### workflow_artifacts

Stores outputs.

Fields:

- `id`
- `workflowId`
- `runId`
- `stepId`
- `path`
- `kind`
- `mimeType`
- `storageKey`
- `metadata`
- `createdAt`

### workflow_approvals

Stores human review gates.

Fields:

- `id`
- `runId`
- `stepId`
- `status`
- `risk`
- `requestedBy`
- `assignedTo`
- `decisionBy`
- `decisionReason`
- `createdAt`
- `decidedAt`

### workflow_tool_calls

Stores external tool invocation attempts.

Fields:

- `id`
- `runId`
- `stepId`
- `toolName`
- `permission`
- `status`
- `requestJson`
- `responseJson`
- `errorJson`
- `idempotencyKey`
- `createdAt`

### workflow_sandbox_sessions

Provider-neutral runtime association.

Fields:

- `id`
- `workflowId`
- `runId`
- `stepId`
- `provider`
- `providerSandboxId`
- `runtime`
- `status`
- `capabilities`
- `ports`
- `metadata`
- `createdAt`
- `stoppedAt`

## Provider-Neutral Sandbox Migration

Add to existing `sandboxes` first:

- `provider`
- `providerSandboxId`
- `runtime`
- `providerState`
- `capabilities`
- `portUrls`
- `workflowRunId`
- `runStepId`

Then backfill:

- `provider = 'e2b'`
- `providerSandboxId = e2bSandboxId`

Do not drop E2B columns until all code paths read provider-neutral fields.

## Required Constraints And Indexes

- Unique `(workflowId, versionNumber)`.
- Unique `(workflowId, path)` for workflow files.
- Index `workflow_runs(workflowId, createdAt)`.
- Index `workflow_run_steps(runId, taskId)`.
- Index `workflow_events(runId, createdAt)`.
- Index `workflow_artifacts(runId, path)`.
- Index `workflow_approvals(status, assignedTo)`.
- Index `workflow_tool_calls(idempotencyKey)`.
- Index `workflow_sandbox_sessions(provider, providerSandboxId)`.
- Owner/org/project indexes on top-level workflow records.

## Database Checklist

- [ ] Add workflow schema files.
- [ ] Add migrations through Drizzle.
- [ ] Add typed query helpers for owned workflow lookup.
- [ ] Add append-only event helper.
- [ ] Add immutable version write path.
- [ ] Add compiled JSON validation before insert.
- [ ] Add artifact storage helper with run/step association.
- [ ] Add approval decision transaction.
- [ ] Add usage event relation to workflow/run/step.
- [ ] Backfill sandbox provider-neutral fields.

## Decision

Build workflow-native tables. Do not mutate chat/session tables into workflow infrastructure.
