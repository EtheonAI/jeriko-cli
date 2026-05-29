# Compiler Pipeline

## Purpose

The compiler converts `.flow` into a safe runtime plan.

## Pipeline

```text
source .flow
→ parseDocument
→ safe YAML subset check
→ raw object
→ JSON Schema validation
→ AST
→ symbol table
→ semantic validation
→ ASG / semantic graph
→ execution plan
→ stored runtime JSON
```

## 1. Parse

The first implementation may use the `yaml` npm package to parse a restricted YAML-like subset.

Future implementation can replace this with a custom lexer/parser.

## 2. Safe subset check

Reject:

- anchors
- aliases
- custom tags
- multi-doc
- unsupported scalar types
- unknown root keys
- unknown task fields

## 3. Structural schema validation

Use `schemas/flow.schema.json`.

Validates:

- task types
- required fields
- enum values
- common task shape
- budgets
- triggers
- permissions
- workers

## 4. Symbol table

Build maps:

- jobs
- tasks
- artifacts
- imports
- tools
- workers
- events
- triggers
- scripts
- permissions

## 5. Semantic validation

Passes:

1. duplicate id check
2. artifact producer/consumer check
3. import existence check
4. tool existence check
5. tool connection check
6. permission policy check
7. external action approval check
8. blocked action check
9. bounded foreach/parallel check
10. cycle detection
11. event trigger validation
12. budget sanity
13. sandbox policy check
14. expression validation
15. cross-workflow permission check

## 6. Compile

The compiler outputs a `CompiledFlow` runtime object:

```ts
type CompiledFlow = {
  id: string;
  version: string;
  sourceHash: string;
  jobs: CompiledJob[];
  triggers: CompiledTrigger[];
  workers: WorkerRegistry;
  permissions: PermissionPolicy;
  budgets: BudgetPolicy;
  semantic: SemanticSummary;
};
```

## 7. Store

Store:

- `flow_source`
- `compiled_json`
- `source_hash`
- `schema_version`
- `semantic_summary`
- `workflow_files`
- trigger rows
