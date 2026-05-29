# `@repo/database` `.flow` Persistence Plan

Date: 2026-05-27

Status: pending package phase after `@repo/flow` AST/execution plan stabilizes.

## Role

`@repo/database` owns workflow persistence, Drizzle schemas, migrations, indexes, and relations.

It must not own parser/compiler/runtime execution logic.

## Current State

Useful existing pieces:

- users, organizations, projects;
- `agent_sessions.activeStreamId`;
- persisted `messages.parts`;
- connector tables;
- scheduled task reference model;
- sandbox reference model.

Missing workflow-native source of truth:

- workflows;
- versions;
- triggers;
- runs;
- events;
- run steps;
- task reports;
- artifacts;
- approvals;
- tool calls;
- provider-neutral sandbox sessions;
- usage linkage.

## Planned Tables

- [ ] `workflows`
- [ ] `workflowVersions`
- [ ] `workflowFiles`
- [ ] `workflowTriggers`
- [ ] `workflowRuns`
- [ ] `workflowRunSteps`
- [ ] `workflowEvents`
- [ ] `taskReports`
- [ ] `issueCards`
- [ ] `approvalRequests`
- [ ] `artifacts`
- [ ] `toolCalls`
- [ ] `workflowSandboxSessions`
- [ ] `usageEvents` workflow/run/task links
- [ ] `creditLedger` workflow links if missing

## Required Fields

- [ ] `flowSource`, not `yamlSource`.
- [ ] `compiledPlan` JSON.
- [ ] `sourceHash`.
- [ ] `schemaVersion`.
- [ ] diagnostics JSON.
- [ ] event sequence/cursor.
- [ ] correlation and causation IDs.
- [ ] idempotency key for tool calls and run requests.
- [ ] org/workflow/version/run/task dimensions on runtime rows.

## Exit Criteria

- A workflow version can be stored immutably.
- Triggers can be materialized as DB rows.
- A run can be reconstructed from persisted events.
- The UI can replay events after a cursor.
- Browser stream state is optional and not the source of truth.
