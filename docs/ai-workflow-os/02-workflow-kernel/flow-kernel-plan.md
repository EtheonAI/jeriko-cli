# .flow Kernel Plan

## Goal

Create a restricted workflow language that is easy for AI to write, readable for humans in advanced mode, and safe for the platform to compile and execute.

## Required Pipeline

```text
.flow source
  -> lexer/tokens
  -> CST / parse tree
  -> AST
  -> schema validator
  -> symbol table
  -> semantic validator
  -> ASG / semantic graph
  -> DAG slices
  -> CFG + event graph + run state machine
  -> safe compiler output
  -> normalized runtime JSON
  -> generic executor
```

Core rule: `.flow` is the authoring/instruction layer. AST, symbol table, ASG, DAG, CFG, event graph, and run state machine are internal compiler/runtime layers.

## v0 Vocabulary

- `flow`
- `name`
- `goal`
- `imports`
- `permissions`
- `budget`
- `jobs`
- `trigger`
- `tasks`
- `type`
- `worker`
- `uses`
- `input`
- `output`
- `required`
- `if_fail`
- `emit`
- `reflection`

## v0 Task Types

- `ai_task`
- `tool_call`
- `sandbox_command`
- `human_review`
- `verify`
- `wait_for_event`
- `foreach`
- `parallel`
- `memory_patch`

## Parser Safety Rules

- Use a custom `.flow` grammar, not a YAML parser.
- Borrow only simple indentation, `key: value`, `- item`, comments, and block text ideas from YAML.
- Reject YAML anchors and aliases.
- Reject YAML custom tags and directives.
- Reject YAML merge keys.
- Reject multi-document YAML markers.
- Reject implicit YAML bool/null/date coercion.
- Reject unknown top-level keys.
- Reject unbounded loops.
- Reject external side effects unless permission policy allows them.
- Treat imported docs and external content as untrusted.

## First Acceptance Test

A manual social content `.flow` compiles to runtime JSON and executes through mocked `ai_task`, mocked `tool_call`, a no-op `human_review`, and an append-only event log.

## Source References

- [`../_source/full-brief/AI_Workflow_OS_Full_Brief_for_Codex.txt`](../_source/full-brief/AI_Workflow_OS_Full_Brief_for_Codex.txt)
- [`../08-plans/project-plan.csv`](../08-plans/project-plan.csv)
- [`compiler-stack.md`](./compiler-stack.md)
- [`flow-grammar-v0.md`](./flow-grammar-v0.md)
- [`../09-research/2026-05-23-flow-source-language-vs-graphs.md`](../09-research/2026-05-23-flow-source-language-vs-graphs.md)
- [`../09-research/2026-05-27-p4-1-flow-parser-compiler-research.md`](../09-research/2026-05-27-p4-1-flow-parser-compiler-research.md)
