# Versioning and Migrations

## Versioned objects

- workflow.flow
- compiled runtime JSON
- imported instruction files
- scripts
- permissions
- triggers
- worker policies
- memory
- reflection rules

## Rules

- running runs keep their original version
- new runs use active version
- every manual/AI edit creates a new draft version
- activation requires validation
- rollback restores previous version
- patches are recorded

## FlowPatch

All edits become FlowPatch objects.

Patch types:

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
- update_instruction_file

## Migration

Each `.flow` has:

```yaml
flow: "0.1"
```

Compiler supports:

- parse v0.1
- migrate v0.1 → v0.2
- keep old interpreter until migration
- warn users before breaking changes

## Compatibility

Do not break existing workflows silently.

Deprecation path:

1. support old field
2. warn
3. auto-migrate where safe
4. require user approval for risky migration
5. remove in major version
