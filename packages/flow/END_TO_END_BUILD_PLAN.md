# `@repo/flow` End-To-End Build Plan

Date: 2026-05-27

Status: active package-local plan.

## Role

`@repo/flow` owns `.flow` source language, parser/compiler/runtime-neutral contracts, and mock execution tests.

It must not import provider SDKs, app code, database clients, AI SDK, Inngest, Vercel Sandbox, Composio, Next.js, or React.

## Current State

Implemented:

- source/span contracts;
- lexer;
- CST parser;
- AST schemas;
- kernel vocabulary;
- diagnostics;
- compiler contracts;
- runtime contracts;
- event/report/reflection contracts;
- state contracts;
- patch contracts;
- fixtures and tests.

Missing:

- CST to AST normalization;
- symbol table builder;
- semantic validation;
- execution planner;
- mock interpreter;
- worker/worker_policy support;
- expression parser;
- runtime adapter tests.

## Build Phases

### D: AST Normalization

- [ ] Export `normalizeFlowAst(cst)`.
- [ ] Convert `flow` to `version`.
- [ ] Convert job map keys to `job.id`.
- [ ] Convert source snake case to contract camel case.
- [ ] Preserve source spans.
- [ ] Convert Zod issues to `FlowDiagnostic`.
- [ ] Add valid fixture tests.
- [ ] Add invalid fixture tests.

### E: Symbol Table

- [ ] Build job symbols.
- [ ] Build task symbols.
- [ ] Build scoped task IDs.
- [ ] Build artifact symbols.
- [ ] Build import/file symbols.
- [ ] Build tool symbols.
- [ ] Build worker symbols.
- [ ] Build event symbols.
- [ ] Diagnose duplicates and unknown references.

### F: Semantic Validation

- [ ] Validate artifact producer/consumer flow.
- [ ] Validate task dependencies and cycles.
- [ ] Validate tool manifests through provider-neutral registry input.
- [ ] Validate permission policy.
- [ ] Validate approval requirements.
- [ ] Validate sandbox timeout/IO/network fields.
- [ ] Validate event emit/wait/match rules.
- [ ] Validate budgets.
- [ ] Validate reflection/reporting bounds.

### G: Execution Plan

- [ ] Generate stable node IDs.
- [ ] Generate dependency DAG slices.
- [ ] Add wait/event/approval nodes.
- [ ] Add failure-policy control metadata.
- [ ] Add idempotency key inputs.
- [ ] Add artifact IO refs.
- [ ] Add resume checkpoints.
- [ ] Add cancellation checkpoints.

### H: Mock Interpreter

- [ ] Execute plan with mock task adapters.
- [ ] Emit deterministic ECP events.
- [ ] Persist in-memory run state.
- [ ] Simulate approval wait/resume.
- [ ] Simulate event wait/resume.
- [ ] Simulate cancellation.

## Exit Criteria

- `scheduled-social.flow` compiles to AST, symbols, semantics, and execution plan.
- A five-subagent fixture compiles once worker policy is enabled.
- Invalid files fail with source-spanned diagnostics.
- Package tests pass.
- Dependency-cruiser proves no provider imports.

## Latest Validation

2026-05-27:

- TypeScript check passed for `packages/flow/tsconfig.json`.
- Vitest passed: 5 files, 30 tests.
- Dependency-cruiser focused on `packages/flow` passed with no dependency violations.
