# MADR-020: Treat `.flow` As Source Language And Compile To Internal IRs

Status: Proposed

Date: 2026-05-23

## Context

AI Workflow OS needs a user/AI-facing workflow format that is easier than raw node graphs, while still being safe and rigorous enough for durable execution. The source brief already says the runtime should execute compiled structured data, not raw `.flow` text.

Research confirms mature compiler systems separate source text from syntax trees, semantic representations, control-flow structures, and runtime plans:

- Tree-sitter exposes CST-like syntax trees with source positions.
- TypeScript exposes source files with text and AST nodes.
- Rust lowers AST into HIR and MIR for compiler-friendly analysis and control-flow representation.
- Inngest executes durable steps and can pause on events.
- GitHub Actions uses a readable workflow source format while the platform handles job/step execution.
- n8n and Gumloop expose visual node/graph workflows, which is a different product category.

## Decision

`.flow` is the source language and product authoring layer. It compiles into internal structures:

```text
.flow
  -> tokens
  -> CST
  -> AST
  -> schema validation
  -> symbol table
  -> semantic validation
  -> ASG / semantic graph
  -> DAG slices
  -> CFG + event graph + run state machine
  -> Inngest execution
```

Do not expose raw graphs/nodes/DAGs as the primary product interface. Optional visual maps can be derived from compiled workflow data for power users and debugging.

## Consequences

Positive:

- Users and AI author workflows in domain language: goals, tasks, permissions, approvals, artifacts, events, failures, improvements.
- Runtime keeps strong internal structures for validation and execution.
- Parser/compiler can produce precise diagnostics and repair prompts.
- Product stays distinct from node-canvas tools.
- Workflow UI can render a clean composite hierarchy without leaking implementation details.

Negative:

- Requires real compiler work, not just YAML loading.
- More internal representations to test and maintain.
- Need careful versioning of source, AST, semantic graph, and execution plan.

## Alternatives Considered

1. Expose visual graph editor as primary UI.
   - Rejected for MVP. It makes the product feel like n8n/Gumloop and forces users into node mechanics.

2. Execute raw `.flow` directly.
   - Rejected. Unsafe and hard to validate, repair, audit, version, or explain.

3. Store only JSON AST and hide source.
   - Rejected. Loses human-readable workflow identity and makes AI/user patching harder.

## Acceptance Criteria

- [ ] `.flow` source is stored per immutable workflow version.
- [ ] Parser returns diagnostics with source spans.
- [ ] AST is strict and typed.
- [ ] Symbol table catches duplicate/missing references.
- [ ] Semantic graph resolves tools, permissions, artifacts, workers, imports, events.
- [ ] Execution plan separates DAG slices from CFG/event/state-machine behavior.
- [ ] Runtime executes compiled plan only.
- [ ] UI renders workflow/job/task hierarchy from compiled data.
- [ ] Optional graph visualization is derived, not primary source of truth.

## Evidence

- [`../09-research/2026-05-23-flow-source-language-vs-graphs.md`](../09-research/2026-05-23-flow-source-language-vs-graphs.md)
- [`../02-workflow-kernel/compiler-stack.md`](../02-workflow-kernel/compiler-stack.md)
