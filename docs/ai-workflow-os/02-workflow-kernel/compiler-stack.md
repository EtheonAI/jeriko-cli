# .flow Compiler Stack

Date: 2026-05-23

## Core Decision

`.flow` is the authoring layer. Compiler/runtime structures are internal.

```text
.flow source
  -> tokens
  -> CST / parse tree
  -> AST
  -> schema validation
  -> symbol table
  -> semantic validation
  -> ASG / semantic graph
  -> DAG slices
  -> CFG + event graph + run state machine
  -> Inngest generic executor
  -> durable run state
  -> events, task reports, artifacts, issue cards, reflection packets
  -> resumable UI snapshot + event stream
```

## Layer Responsibilities

| Layer              | Responsibility                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Source             | Human/AI-readable workflow contract.                                                                 |
| Tokens             | Lexical units and indentation.                                                                       |
| CST                | Preserve source shape for editor errors, formatting, comments, diffs, repair prompts.                |
| AST                | Clean structural model of workflow, jobs, tasks, triggers, permissions, budgets.                     |
| Symbol table       | Name resolution for tasks, imports, artifacts, tools, workers, events, scripts, permissions.         |
| ASG                | Resolved semantic meaning, policies, tool manifests, approval requirements, worker routing.          |
| DAG slices         | Dependency ordering, parallelism, artifact dependency checks.                                        |
| CFG                | Retry, fallback, branch, timeout, approval reject, degraded behavior.                                |
| Event graph        | Event-driven waits, cross-task/workflow routing, reflection triggers.                                |
| State machine      | Run and step lifecycle.                                                                              |
| Durable run store  | Persist run state, event cursors, task events, artifacts, cancellation requests, and replay history. |
| UI composite model | Workflow/job/task/artifact/issue rendering.                                                          |

## MVP Compiler Outputs

`compileFlow()` should return:

```ts
interface CompiledFlow {
  schemaVersion: "0.1";
  sourceHash: string;
  ast: WorkflowAst;
  symbols: FlowSymbolTable;
  semanticGraph: FlowSemanticGraph;
  executionPlan: FlowExecutionPlan;
  diagnostics: FlowDiagnostic[];
}
```

The runtime must execute `executionPlan`, not raw `.flow` text.

## Minimum Validation Gates

- [ ] Syntax validity.
- [ ] Unknown top-level keys rejected.
- [ ] Unknown task keys rejected.
- [ ] Duplicate IDs rejected.
- [ ] Missing imports rejected.
- [ ] Artifact inputs resolve to imports, previous outputs, or declared external inputs.
- [ ] Tool names resolve to a manifest.
- [ ] Worker names resolve to a supported worker type.
- [ ] Permissions resolve to known permission vocabulary.
- [ ] External side effects require approval by default.
- [ ] Dependency cycles rejected for DAG slices.
- [ ] Event waits declare timeout behavior.
- [ ] Failure policies are from an allowlist.
- [ ] Expressions use only the safe expression subset.

## Parser Strategy

Phase 1:

- Build a custom `.flow` grammar and parser.
- Use YAML only as syntax and parser-architecture research.
- Preserve source spans, comments, field order, and indentation in a CST.
- Reject YAML-only features before AST normalization.
- Validate the AST with Zod after parsing.

Phase 2:

- Add tolerant editor-mode recovery, formatter behavior, and repair prompts after the strict parser and fixture corpus are stable.

Do not add a YAML parser dependency for `.flow` unless a future MADR reverses MADR-095.

## User Interface Rule

The user should see:

- workflow goal,
- tasks,
- approvals,
- artifacts,
- events,
- issues,
- version history,
- advanced `.flow` source when requested.

The user should not need to edit:

- raw DAG edges,
- internal AST JSON,
- ASG,
- CFG,
- state-machine tables,
- Inngest step IDs.

Optional visual maps are allowed only as derived views from compiled data.

## Resume And Reconnect Rule

Workflow execution must not depend on an open browser tab.

Browser refresh, tab close, and network loss detach the UI stream only. They must not cancel the workflow run.

The runtime must persist:

- `workflow_runs`;
- `run_events`;
- task events;
- artifacts;
- message parts where chat is involved;
- active stream/run mapping;
- cancellation requests.

The UI must reconnect by `runId` and event cursor, load a snapshot, replay missed events, and then subscribe to live events.

Only an explicit Stop/Cancel command emits a durable cancellation event.
