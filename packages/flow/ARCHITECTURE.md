# @repo/flow Architecture Notes

Date: 2026-05-27

Status: package-local memory for `.flow`, parser research, and resumable runtime requirements

## Package Role

`@repo/flow` owns provider-neutral workflow language and runtime contracts.

It does not own:

- database persistence;
- Inngest or Vercel Workflow SDK integration;
- AI SDK model calls;
- sandbox providers;
- app route handlers;
- React UI.

## `.flow` Source Language

`.flow` is the product authoring layer. It is not YAML.

The compiler stack is:

```text
.flow source
-> tokens
-> CST
-> AST
-> symbol table
-> semantic graph / ASG
-> DAG slices
-> CFG + event graph + run state machine
-> runtime adapter execution
-> events, artifacts, approvals, task reports, issue cards, reflection packets
```

User-facing `.flow` should express:

- goals;
- jobs;
- triggers;
- tasks;
- tools;
- permissions;
- approvals;
- artifacts;
- events;
- failure behavior;
- improvement/reflection behavior.

Internal runtime structures should express:

- source spans;
- resolved symbols;
- resolved tool manifests;
- approval policies;
- artifact dependencies;
- control paths;
- event waits;
- durable run states.

## YAML Reverse-Engineering Result

Local source audit:

- `/Users/khaleelmusleh/Downloads/yaml-main`
- 151 available files
- 27,776 lines
- empty local submodule directories: `tests/yaml-test-suite`, `tests/json-test-suite`, `docs-slate`

Central report:

- `docs/ai-workflow-os/09-research/2026-05-27-yaml-main-parser-architecture-reverse-engineering.md`

Decision:

- Study YAML architecture.
- Do not use a YAML parser for `.flow`.
- Do not add the `yaml` npm package to `@repo/flow` for `.flow` parsing.

Borrow from YAML:

- explicit lexer/parser/composer separation;
- CST before AST;
- source spans and line counters;
- comments and raw source preservation;
- diagnostics instead of opaque exceptions;
- fixture-driven parser tests;
- independent parse/stringify/document concepts.

Reject from YAML:

- anchors;
- aliases;
- tags;
- directives;
- merge keys;
- multi-document streams;
- implicit schema coercion;
- arbitrary extensions.

## Current Implementation Status

Implemented now:

- source contracts;
- token/CST contracts;
- AST schemas;
- compiler contract;
- kernel vocabulary;
- event contracts;
- runtime `start`/`resume`/`cancel` interfaces;
- adapter `requestRun`/`emitEvent`/`resumeWithContext`/`cancelRun` interfaces;
- state contracts;
- patch contracts;
- testing helpers;
- parser fixture corpus.

Not implemented yet:

- full lexer behavior;
- full parser behavior;
- AST normalization from source;
- symbol table builder;
- semantic validation;
- execution planner;
- runtime interpreter;
- provider runtime adapter.

## Resumable Run Requirement

The platform must support Manus-style continuation:

- refresh does not stop work;
- closing the tab does not stop work;
- network disconnect does not stop work;
- explicit Stop/Cancel is the only cancellation path.

`@repo/flow` role:

- define provider-neutral run input/result/state contracts;
- define resume and cancellation contracts;
- define event/context packet contracts;
- keep runtime adapter interfaces provider-neutral.

`@repo/flow` must not:

- persist run rows directly;
- import Drizzle;
- import Inngest;
- import Vercel Workflow;
- import AI SDK;
- implement app SSE route handlers.

Future runtime pipeline:

```text
compiled FlowExecutionPlan
-> runtime adapter requestRun(...)
-> persisted workflow_run
-> persisted run_events/task_events/artifacts
-> UI snapshot + SSE reconnect by runId/cursor
-> resumeWithContext(...) for event-driven continuation
-> cancelRun(...) only for explicit cancellation
```

Related docs:

- `docs/ai-workflow-os/07-madr/MADR-095-flow-parser-and-compiler-v0.md`
- `docs/ai-workflow-os/07-madr/MADR-096-resumable-workflow-runs-and-ui-reconnect.md`
- `docs/ai-workflow-os/08-plans/package-playbooks/flow.md`
- `docs/ai-workflow-os/08-plans/resumable-workflow-runs-checklist.md`
