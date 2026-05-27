# .flow As Source Language, Not A Raw Graph UI

Date researched: 2026-05-23

Status: researched architecture note.

## Final Verdict

`.flow` is the right authoring and product interface. It should not replace compiler/runtime structures. The correct architecture is:

```text
.flow source
  -> lexer/tokens
  -> CST / parse tree
  -> AST
  -> schema validation
  -> symbol table
  -> semantic validation
  -> semantic graph / ASG
  -> execution graph slices / DAG
  -> control-flow + event graph + run state machine
  -> Inngest runtime execution
  -> events, artifacts, task reports, issue cards, reflection packets
```

This gives the product a clean AI/user-facing language while keeping serious internal representations for validation, planning, execution, observability, and repair.

## Sources Checked

| Source                                                                                                             | Type                    | Relevant evidence                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tree-sitter basic parsing: https://tree-sitter.github.io/tree-sitter/using-parsers/2-basic-parsing.html            | Parser docs             | Tree-sitter stores syntax nodes with byte and row/column positions, produces concrete syntax trees, and distinguishes named/anonymous nodes so tools can use CST-like or AST-like traversal. |
| Tree-sitter advanced parsing: https://tree-sitter.github.io/tree-sitter/using-parsers/3-advanced-parsing.html      | Parser docs             | Syntax trees can be edited/reparsed incrementally, which supports editor workflows, source spans, and repair UX.                                                                             |
| TypeScript Compiler API: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API                       | Compiler docs           | TypeScript represents each source file with text and an AST; compiler APIs traverse AST nodes and produce diagnostics with line/character positions.                                         |
| Rust compiler HIR: https://rustc-dev-guide.rust-lang.org/hir.html                                                  | Compiler docs           | Rust lowers AST into a compiler-friendly high-level intermediate representation after parsing, macro expansion, and name resolution.                                                         |
| Rust compiler MIR: https://rustc-dev-guide.rust-lang.org/mir/index.html                                            | Compiler docs           | Rust lowers further into MIR with basic blocks, statements, terminators, locals, and control-flow successors.                                                                                |
| GitHub Actions workflow syntax: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax | Workflow syntax docs    | Jobs, steps, env, permissions, timeouts, and dependency concepts are source-level workflow vocabulary.                                                                                       |
| GitHub Actions jobs: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs  | Workflow docs           | Jobs are independent by default and can be ordered with dependencies, which maps to DAG slices.                                                                                              |
| Inngest steps: https://www.inngest.com/docs/learn/inngest-steps                                                    | Runtime docs            | Steps are discrete durable units with IDs, retries, saved state, sleep, wait-for-event, invoke, and send-event primitives.                                                                   |
| Inngest wait for event: https://www.inngest.com/docs/features/inngest-functions/steps-workflows/wait-for-event     | Runtime docs            | Runs can pause until events arrive, making event/state-machine behavior a first-class runtime concern.                                                                                       |
| n8n nodes: https://docs.n8n.io/workflows/components/nodes/                                                         | Competitor/product docs | n8n describes nodes as workflow building blocks, with triggers/actions and node controls on a canvas. This validates that raw node UI is a different category.                               |
| Gumloop docs: https://docs.gumloop.com/                                                                            | Competitor/product docs | Gumloop describes visual drag-and-drop automations with prebuilt nodes and integrations. This validates the product distinction if `.flow` stays source/AI-first.                            |

## Why `.flow` Is Better As The Top Layer

Graphs and node canvases force users to think in implementation mechanics:

```text
node
edge
mapping
input
output
condition
retry
debug
```

The desired product language is higher-level:

```text
goal
workflow
tasks
tools
permissions
approval
failure behavior
artifacts
events
improvement
```

This is the main product difference. n8n and Gumloop intentionally expose visual node workflows. AI Workflow OS should expose a workflow operating file that the AI can write and users can inspect in advanced mode.

## Why `.flow` Is Not Enough Internally

Directly executing raw `.flow` would be fragile. The runtime needs separate internal layers with different responsibilities:

| Layer                    | Purpose                                                                        |                      Persist? |        User-facing? |
| ------------------------ | ------------------------------------------------------------------------------ | ----------------------------: | ------------------: |
| `.flow` source           | AI/human-readable workflow contract                                            |                           Yes |       Advanced mode |
| Tokens                   | Formatting and lexical units                                                   |                      Optional |                  No |
| CST / parse tree         | Source spans, comments, field order, editor errors, repair prompts             |            Optional or cached |   Editor/debug only |
| AST                      | Clean structural workflow tree                                                 | Yes, as compiled version data |      Advanced/debug |
| Symbol table             | Resolve task IDs, imports, artifacts, tools, workers, events, permissions      |     Yes, in compiled metadata |                  No |
| ASG / semantic graph     | Resolved meaning: which tool, which permission, which approval, which artifact |     Yes, in compiled metadata |       Debug/explain |
| DAG slices               | Dependency ordering and parallel execution within bounded acyclic runs         |             Yes, runtime plan | Optional visual map |
| CFG                      | Failure, retry, branch, timeout, approval reject behavior                      |             Yes, runtime plan |       Debug/explain |
| Event graph              | Events that wake tasks, workflows, approvals, reflections, and cross-run logic |                           Yes |      Timeline/pulse |
| Run state machine        | queued/running/waiting/succeeded/failed/degraded/cancelled lifecycle           |                           Yes |                 Yes |
| DOM/composite view model | Render workflow/job/task/artifact/issue hierarchy                              |                       Derived |                 Yes |
| Expression tree          | Limited conditions and substitutions                                           |     Yes, if expressions exist |                  No |

## Compiler Stack

### 1. `.flow` Source

This is what AI writes and what advanced users can review. It should be readable, versionable, patchable, and strict.

Example shape:

```yaml
flow: "0.1"
name: social_manager
goal: Create daily social posts and ask before publishing.

permissions:
  auto: [read_public_web, create_drafts, run_sandbox_code]
  ask: [publish_social_post, send_email]
  block: [delete_data, transfer_money, expose_secrets]

jobs:
  daily_content:
    trigger:
      type: schedule
      cron: "0 10 * * MON-FRI"
    tasks:
      - id: research
        type: ai_task
        worker: researcher
        uses: [web.search]
        output: [artifacts/research.json]
        if_fail: continue_degraded
      - id: publish
        type: tool_call
        uses: instagram.publish
        requires_approval: true
```

### 2. Lexer / Tokenizer

Tokens let us distinguish source formatting from workflow meaning:

```text
KEY
VALUE
LIST_ITEM
INDENT
DEDENT
STRING
NUMBER
BOOL
EXPR
NEWLINE
EOF
```

MVP may use a strict YAML parser plus validator first, but the target architecture should still preserve token/source-span information for editor diagnostics and repair.

### 3. CST / Parse Tree

The CST keeps:

- line/column spans,
- comments,
- original field order,
- indentation,
- raw text values.

Tree-sitter is evidence for why this matters: parser output with source ranges supports syntax tools, incremental editing, highlighting, and diagnostics.

### 4. AST

The AST is the clean workflow tree:

```ts
interface WorkflowAst {
  flow: "0.1";
  name: string;
  goal: string;
  permissions: PermissionBlock;
  jobs: JobAst[];
}

interface JobAst {
  id: string;
  trigger: TriggerAst;
  tasks: TaskAst[];
}
```

The AST answers structural questions:

- What jobs exist?
- What tasks exist?
- Which fields exist on each task?

It does not prove that the workflow is semantically valid.

### 5. Symbol Table

The symbol table maps names and paths to definitions:

```text
tasks["daily_content.research"]
artifacts["artifacts/research.json"]
tools["instagram.publish"]
imports["brand.md"]
workers["researcher"]
events["research.completed"]
permissions["publish_social_post"]
```

It catches:

- duplicate task IDs,
- missing imports,
- unknown tools,
- artifact inputs with no producer,
- invalid worker names,
- unknown event names,
- conflicting permissions.

### 6. ASG / Semantic Graph

The semantic graph resolves meaning:

```text
publish task
  uses instagram.publish
  -> tool manifest InstagramPublishTool
  -> risk external_action
  -> permission publish_social_post
  -> approval required
  -> idempotency required
```

This is where `.flow` becomes policy-aware. The ASG is the layer that lets the platform explain "why this needs approval" or "why this task cannot run."

### 7. Execution Graph / DAG Slices

DAGs are useful, but only for bounded dependency slices:

```text
research -> draft -> validate -> approval -> publish
```

Use DAGs for:

- task ordering,
- parallel execution,
- artifact dependency checking,
- foreach expansion,
- build-like execution slices.

Do not define the whole product as a DAG because workflows also have schedules, events, approvals, timeouts, loops, cross-workflow events, reflection, and state across runs.

### 8. CFG + Event Graph + State Machine

The runtime needs behavior, not only order:

```text
validate
  success -> approval
  fail_once -> regenerate
  fail_twice -> issue_card + ask_user

approval
  approved -> publish
  rejected -> stop_or_patch
  timeout -> issue_card
```

Inngest's `step.waitForEvent()` validates this direction: workflow runs can pause and resume from events, so the runtime model must include event and state-machine semantics.

### 9. DOM / Composite UI Model

The UI should render a workflow hierarchy:

```text
Workflow
  Job
    Task
      Inputs
      Outputs
      Permissions
      Events
      Issues
      Artifacts
```

The user can see a timeline, inspector, artifacts, approvals, and issue cards without editing an internal graph.

### 10. Limited Expression Tree

Expressions should be small and safe:

```yaml
if: artifacts.validation.score > 0.8 and approval.status == "approved"
```

MVP should support only a tiny expression grammar:

- field references,
- comparisons,
- `and` / `or`,
- `exists()`,
- `equals()`,
- `contains()`.

Do not allow arbitrary JavaScript in `.flow`.

### 11. FlowPatch Instead Of Macros

Use safe patch objects, not Lisp-like exposed macros:

```json
{
  "type": "update_task",
  "target": "daily_content.generate_images",
  "changes": {
    "if_fail": "continue_degraded"
  }
}
```

FlowPatch is the controlled tree transformation mechanism for AI-driven improvement.

## Comparison Table

| Concept               |           Use it? | Role in AI Workflow OS                                    |
| --------------------- | ----------------: | --------------------------------------------------------- |
| `.flow`               |               Yes | AI/user-facing source language                            |
| Parse tree / CST      |               Yes | Source spans, editor errors, comments, repair prompts     |
| AST                   |               Yes | Clean parsed workflow structure                           |
| Symbol table          |               Yes | Resolve tasks, tools, imports, artifacts, workers, events |
| ASG / semantic graph  |               Yes | Resolved meaning, permissions, policy, tool manifests     |
| DAG                   |    Yes, partially | Task dependency slices and parallel execution             |
| CFG                   |               Yes | Branching, retry, failure, approval reject behavior       |
| Event graph           |               Yes | Task/workflow/app event routing                           |
| State machine         |               Yes | Run lifecycle and waits                                   |
| DOM / composite model |               Yes | UI rendering and inspector                                |
| Expression tree       |      Yes, limited | Conditions and substitutions                              |
| EBNF                  |             Later | Grammar documentation, parser/LSP support                 |
| Shunting-yard         |             Maybe | Small expression parser if needed                         |
| Lisp/macros           | Conceptually only | FlowPatch transformations                                 |
| TreeDL                |    Later/optional | Formal tree schema if TypeScript/Zod is insufficient      |
| Raw node canvas       |       Not primary | Optional advanced visualization only                      |

## Product Conclusion

`.flow` is better than exposing graphs/nodes/DAGs as the main product because it is domain-specific and policy-aware. A plain graph says:

```text
Node A runs before Node B.
```

A `.flow` task can say:

```text
This publishes to an external account.
It uses instagram.publish.
It requires approval.
It emits post.published.
If it fails, create an issue card.
It consumes image.generated.
It charges credits.
It can run only after validation passes.
```

That is the core advantage. The platform should compile `.flow` into internal graph/state-machine structures, but the user and AI should author the workflow through `.flow`.

## Implementation Implications

- `.flow` v0 must be strict and small.
- Parser errors must include source spans.
- AST validation and semantic validation are separate steps.
- Workflow compilation must produce stable task IDs for Inngest step memoization.
- DAG is a runtime planning tool, not the product primitive.
- Event/state-machine behavior is first-class.
- FlowPatch is the safe workflow improvement mechanism.
- Optional visual maps should be derived from compiled data, not used as the primary editing model.
