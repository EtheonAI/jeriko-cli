# `.flow` Grammar v0 Design

Date: 2026-05-27

Status: draft design gate for `@repo/flow`; no parser implementation yet

## Decision Boundary

`.flow` is a custom workflow source language.

It is not YAML, and it must not be parsed by a YAML parser. YAML is useful research because it proves that indentation, mappings, sequences, comments, block text, source spans, and parser fixture suites matter. The `.flow` language should borrow those lessons and intentionally reject YAML features that make workflow authoring ambiguous or unsafe.

## Evidence Checked

- Zod official AI docs: `https://zod.dev/llms-full.txt`
- YAML official root: `https://yaml.org/`
- YAML 1.2.2 spec: `https://yaml.org/spec/1.2.2/`
- YAML grammar repository: `https://github.com/yaml/yaml-grammar`
- YAML test suite repository: `https://github.com/yaml/yaml-test-suite`
- `eemeli/yaml` parser docs/source: `https://eemeli.org/yaml/` and `https://github.com/eemeli/yaml`
- Local `yaml-main` source audit: [`2026-05-27-yaml-main-parser-architecture-reverse-engineering.md`](../09-research/2026-05-27-yaml-main-parser-architecture-reverse-engineering.md)
- GitHub Actions workflow syntax: `https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax`
- Local full brief: `/Users/khaleelmusleh/Downloads/AI_Workflow_OS_Full_Brief_for_Codex.docx`
- Local v3 scale/trigger/ECP notes: `/Users/khaleelmusleh/Downloads/ai_workflow_os_docs_v3_scale_triggers_ecp`
- Local project pack: `/Users/khaleelmusleh/Downloads/ai_workflow_os_project_pack`

## Design Goals

- AI can write and repair it reliably.
- Humans can read it in advanced mode.
- The parser returns diagnostics with source spans instead of opaque exceptions.
- The CST preserves comments, order, and formatting for editor repair, diffs, and formatting.
- The AST is small enough to validate with Zod and compile into internal structures.
- The language is domain-specific: workflows, jobs, tasks, permissions, tools, artifacts, triggers, events, approvals, and failure behavior.

## Non-Goals

- Do not implement full YAML.
- Do not expose AST/ASG/DAG/CFG/state-machine JSON to normal users.
- Do not allow arbitrary JavaScript.
- Do not run raw `.flow` text.
- Do not import runtime providers, SDKs, databases, AI SDK, Inngest, Vercel Workflow, or Vercel Sandbox inside `@repo/flow`.

## Borrow From YAML

- Indentation-based structure.
- `key: value` readability.
- `- item` repeated values.
- `#` line comments.
- Literal block text for long goals/instructions.
- Source locations and spans.
- A separate tokenizer, parser/CST, composer/AST, and validator pipeline.
- A fixture test suite that covers valid source, invalid source, and diagnostics.

## Parser Architecture Lessons From `yaml-main`

The local `yaml-main` audit covered the 151 available files and 27,776 lines in `/Users/khaleelmusleh/Downloads/yaml-main`. The external submodule directories for YAML fixtures, JSON fixtures, and docs were empty locally, so only the checked-in harnesses and available files were read.

Architecture to copy:

- Lexer, parser/CST, composer/AST, schema validation, semantic validation, and stringifier are separate concerns.
- Parser errors should become diagnostics or error tokens, not generic thrown exceptions.
- Source spans must exist before AST validation so every later error can point back to source.
- CST should preserve comments, raw values, indentation, field order, and source spans.
- AST should be domain-specific and smaller than the CST.
- Fixture tests must cover valid source, invalid source, unsupported syntax, source spans, CRLF, comments, bad indentation, duplicate keys, and hostile inputs.

Architecture to avoid:

- Do not copy YAML's generic schema system.
- Do not copy anchors, aliases, merge keys, directives, tags, custom tags, multi-document streams, or version-dependent scalar behavior.
- Do not build a broad formatter before parser and semantic validation are stable.

## Reject From YAML

Reject these outside quoted strings and literal block text:

- anchors: `&name`
- aliases: `*name`
- tags: `!tag`
- directives: `%YAML`
- document markers: `---` and `...`
- merge keys: `<<`
- arbitrary flow maps
- custom schemas
- implicit bool/null/date coercion
- multi-document streams

## Canonical Shape

```flow
flow: "0.1"
name: social_manager

goal: |
  Create daily social posts, ask before publishing,
  track analytics, and improve weekly.

permissions:
  auto:
    - read_public_web
    - create_drafts
  ask:
    - publish_social_post
  block:
    - delete_data
    - transfer_money

jobs:
  daily_content:
    trigger:
      type: schedule
      cron: "0 10 * * MON-FRI"
      timezone: UTC
    tasks:
      - id: research
        type: ai_task
        worker: researcher
        uses: [web.search]
        output: [artifacts/research.json]
        if_fail: continue_degraded
      - id: approval
        type: human_review
      - id: publish
        type: tool_call
        uses: [instagram.publish]
        requires_approval: true
```

## Lexical Rules

- Source text is UTF-8.
- Parser normalizes CRLF to LF for location tracking.
- Tabs are forbidden for indentation.
- Canonical formatter emits two spaces per indentation level.
- v0 parser should require indentation to be a multiple of two spaces.
- Blank lines are allowed.
- Comments start with `#` outside quoted strings and literal blocks.
- Keys use lower snake case: `requires_approval`.
- Identifiers use current kernel rules: `/^[a-zA-Z_][a-zA-Z0-9_-]*$/`.
- Event names use current kernel rules: `/^[a-zA-Z0-9_.:/-]+$/`.
- Bare scalars are strings unless the schema for the field explicitly accepts a boolean or number token.
- Dates and timestamps remain strings unless a future schema says otherwise.
- Inline lists are allowed only for simple scalar lists: `[web.search, instagram.publish]`.
- Inline maps are not part of v0.

## String Rules

Supported scalar forms:

- bare scalars: `researcher`
- double-quoted strings: `"0 10 * * MON-FRI"`
- single-quoted strings: `'literal value'`
- literal blocks: `goal: |`

Literal block rules:

- `key: |` starts a literal block.
- The block continues while following nonblank lines are more indented than the key line.
- Common leading indentation is removed.
- Text is preserved with newlines.
- YAML chomping/folding modifiers are not supported in v0.

## Structural Rules

Top-level keys:

- `flow`
- `name`
- `goal`
- `imports`
- `permissions`
- `budget`
- `jobs`
- `reflection`

Current implemented AST requires:

- `flow`
- `name`
- `goal`
- `jobs`

Current implemented AST defaults:

- `permissions.auto`
- `permissions.ask`
- `permissions.block`

Future vocabulary can be listed in docs before implementation, but parser/AST changes must land behind tests and MADR updates.

## Job Rules

Canonical job form:

```flow
jobs:
  daily_content:
    trigger:
      type: schedule
    tasks:
      - id: research
        type: ai_task
```

Rules:

- Each job key becomes `job.id`.
- Job IDs must be unique.
- Each job must define exactly one `trigger`.
- Each job must define `tasks`.
- Empty task lists are invalid unless a future planning phase introduces declarative-only jobs.

## Trigger Rules

Current trigger types:

- `manual`
- `schedule`
- `event`
- `app_event`
- `workflow_event`
- `webhook`

Trigger-specific required fields:

- `schedule` requires `cron`.
- `event` requires `event`.
- `app_event` requires `event`.
- `workflow_event` requires `event`.
- `webhook` requires `path`.

Shared trigger policy fields:

- `min_interval_seconds`
- `jitter_seconds`
- `max_runs_per_day`
- `concurrency_key`
- `dedupe_key`
- `misfire_policy`
- `config`

The parser can accept snake case source fields and AST normalization maps them to camel case kernel fields where the package schemas use camel case.

## Task Rules

Canonical task form:

```flow
tasks:
  - id: research
    type: ai_task
    worker: researcher
    uses: [web.search]
    input: [brand.md]
    output: [artifacts/research.json]
    emits: [research.done]
    if_fail: continue_degraded
```

Current task types:

- `ai_task`
- `tool_call`
- `sandbox_command`
- `human_review`
- `wait_for_event`
- `subflow`

Current task fields:

- `id`
- `type`
- `description`
- `worker`
- `uses`
- `depends_on`
- `input`
- `output`
- `emits`
- `listens_to`
- `requires_approval`
- `if_fail`
- `config`

Rules:

- Task IDs must be unique inside a job.
- `depends_on` references task IDs in the same job unless a future cross-job syntax is approved.
- `uses` values are symbolic tool names resolved later by the symbol table.
- `input` and `output` values are artifact/import references resolved later by semantic validation.
- External side-effect tools require permission/approval validation after symbol resolution.

## Permissions Rules

Canonical form:

```flow
permissions: auto: -read_public_web;
ask: -publish_social_post;
block: -transfer_money;
```

Rules:

- Modes are `auto`, `ask`, and `block`.
- Unknown modes fail.
- Duplicate permission strings should warn first, then formatter can dedupe.
- `block` wins over `ask`; `ask` wins over `auto` during semantic resolution.

## Field Normalization

The source language should use snake case. Internal TypeScript contracts can remain camel case where already defined.

Initial mappings:

| Source field           | Internal field       |
| ---------------------- | -------------------- |
| `flow`                 | `version`            |
| `depends_on`           | `dependsOn`          |
| `requires_approval`    | `requiresApproval`   |
| `if_fail`              | `ifFail`             |
| `listens_to`           | `listensTo`          |
| `min_interval_seconds` | `minIntervalSeconds` |
| `jitter_seconds`       | `jitterSeconds`      |
| `max_runs_per_day`     | `maxRunsPerDay`      |
| `concurrency_key`      | `concurrencyKey`     |
| `dedupe_key`           | `dedupeKey`          |
| `misfire_policy`       | `misfirePolicy`      |
| `match_rules`          | `matchRules`         |

## Pipeline

```text
FlowSource
-> FlowLexer token stream
-> FlowCST with comments, indentation, order, and spans
-> FlowAST normalization
-> Zod structural validation
-> symbol table
-> semantic diagnostics
-> execution plan
```

## Token Set v0

- `BOM`
- `NEWLINE`
- `INDENT`
- `DEDENT`
- `KEY`
- `COLON`
- `DASH`
- `SCALAR_BARE`
- `SCALAR_SINGLE_QUOTED`
- `SCALAR_DOUBLE_QUOTED`
- `BLOCK_LITERAL_START`
- `BLOCK_LITERAL_TEXT`
- `INLINE_LIST_START`
- `INLINE_LIST_END`
- `COMMA`
- `COMMENT`
- `EOF`

Reserved/rejected token classes:

- `YAML_DIRECTIVE`
- `YAML_DOCUMENT_MARKER`
- `YAML_TAG`
- `YAML_ANCHOR`
- `YAML_ALIAS`
- `YAML_MERGE_KEY`

## Diagnostic Codes v0

- `FLOW_PARSE_UNEXPECTED_TOKEN`
- `FLOW_PARSE_BAD_INDENT`
- `FLOW_PARSE_TAB_INDENT`
- `FLOW_PARSE_UNTERMINATED_STRING`
- `FLOW_PARSE_UNTERMINATED_INLINE_LIST`
- `FLOW_PARSE_UNKNOWN_TOP_LEVEL_KEY`
- `FLOW_PARSE_DUPLICATE_KEY`
- `FLOW_PARSE_YAML_FEATURE_UNSUPPORTED`
- `FLOW_PARSE_EMPTY_DOCUMENT`
- `FLOW_PARSE_MISSING_REQUIRED_FIELD`
- `FLOW_PARSE_INVALID_FIELD_VALUE`

## Fixture Corpus Plan

Create package tests under `packages/flow/tests/fixtures`.

Valid fixtures:

- minimal manual workflow
- scheduled workflow
- event-triggered workflow
- webhook-triggered workflow
- permissions with all modes
- literal block goal
- inline scalar lists

Invalid fixtures:

- YAML anchor
- YAML alias
- YAML tag
- YAML directive
- YAML document marker
- YAML merge key
- tab indentation
- one-space indentation
- duplicate task ID
- unknown top-level key
- missing `flow`
- missing `jobs`
- invalid task type
- invalid trigger type
- unclosed quoted string
- unclosed inline list

## Implementation Order

1. Add token and CST contracts in `@repo/flow`.
2. Add fixture files and expected diagnostics.
3. Implement a small hand-written lexer.
4. Implement strict parser to CST.
5. Normalize CST to current AST schemas.
6. Use Zod `safeParse` for structural validation and convert failures to `FlowDiagnostic`.
7. Add semantic/symbol-table compilation in a later subphase.

## Acceptance Gate

P4.1 parser work is not complete until:

- `@repo/flow` has no YAML parser dependency;
- valid fixtures parse into the expected AST;
- invalid YAML-only fixtures produce `FLOW_PARSE_YAML_FEATURE_UNSUPPORTED`;
- invalid `.flow` source returns diagnostics with spans;
- `pnpm --filter @repo/flow typecheck` passes;
- package tests pass;
- root tests pass;
- dependency-cruiser shows no app/provider imports from `packages/flow`.
