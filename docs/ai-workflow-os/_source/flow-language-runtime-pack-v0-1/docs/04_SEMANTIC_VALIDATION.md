# Semantic Validation

Schema validation proves the shape is valid. Semantic validation proves the workflow makes sense.

## Required passes

### 1. Duplicate ID pass

Detect duplicate job ids and task ids.

### 2. Artifact dataflow pass

Each input artifact must be:

- produced earlier in the same job
- produced by required dependency
- imported file
- event payload field
- cross-workflow artifact with permission

### 3. Tool pass

Each `uses` tool must exist in Tool Registry.

Checks:

- tool exists
- connection exists if required
- scopes are sufficient
- tool risk is known
- external action has approval

### 4. Permission pass

Rules:

- block beats ask
- ask beats auto
- unknown external action defaults to ask
- unknown destructive action defaults to block

### 5. Approval pass

Any task with risk level external/destructive must have `requires_approval: true` or be blocked.

### 6. Cycle pass

Detect cycles in:

- task dependencies
- event triggers
- workflow-to-workflow invocation
- artifact dependency graph

### 7. Bounded fanout pass

Every `foreach` must have:

- bounded `items`
- `max_items`
- `max_parallelism`

### 8. Event pass

Validate:

- emitted event names
- listened event names
- trigger event names
- match rules
- event payload references

### 9. Budget pass

Validate:

- workflow-level budget exists
- task max credits do not exceed run max
- max_runtime exists
- max_tool_calls exists
- max_sandbox_seconds exists

### 10. Sandbox pass

Validate:

- script path under `scripts/`
- outputs declared
- timeout declared
- network policy explicit
- no external secrets inside sandbox

### 11. Reflection pass

Ensure main AI reflection rules are bounded.

### 12. Migration pass

Ensure old `.flow` versions can be parsed or migrated.

## Error format

```json
{
  "code": "MISSING_ARTIFACT_PRODUCER",
  "severity": "error",
  "message": "Task draft_posts reads artifacts/research.json but no previous task produces it.",
  "path": "jobs.daily_content.tasks.draft_posts.input[0]",
  "suggested_fix": "Add dependency on research or change input path."
}
```

## Repair loop

The compiler repair prompt receives all errors at once. It returns a patch or corrected `.flow`.

Never repair dangerous semantic errors silently.
