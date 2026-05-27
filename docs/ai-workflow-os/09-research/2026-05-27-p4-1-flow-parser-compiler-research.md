# P4.1 Flow Parser and Compiler Research

Date: 2026-05-27

Package: `@repo/flow`

Status: corrected after no-YAML decision; completed before parser implementation

## Decision Correction

P4.1 must **not** use the `yaml` npm package as the `.flow` parser.

The product source language is `.flow`, not YAML. `.flow` may keep an indentation-based, AI-friendly surface inspired by YAML and GitHub Actions, but it must have its own grammar, tokenizer, parser, diagnostics, formatter path, and semantic layer.

YAML is research input only:

- study its syntax choices;
- study its parser pipeline;
- study its test-suite discipline;
- intentionally avoid YAML features that do not belong in `.flow`.

## Official Docs Checked

Primary official sources:

- https://zod.dev/llms.txt
- https://zod.dev/llms-full.txt
- https://zod.dev/basics
- https://zod.dev/packages/zod
- https://yaml.org/
- https://yaml.org/spec/1.2.2/
- https://github.com/yaml/yaml-grammar
- https://github.com/yaml/yaml-test-suite
- https://eemeli.org/yaml/
- https://github.com/eemeli/yaml
- https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax

Official `llms.txt` / `llms-full.txt` check:

- Zod provides both `https://zod.dev/llms.txt` and `https://zod.dev/llms-full.txt`; both were checked.
- YAML.org and `eemeli/yaml` docs were checked for `llms.txt` / `llms-full.txt`; no usable official `llms` source was found.
- GitHub Actions docs were checked directly as the workflow syntax inspiration source.

## Local Downloads Checked

Sources read:

- `/Users/khaleelmusleh/Downloads/AI_Workflow_OS_Full_Brief_for_Codex.docx`
- `/Users/khaleelmusleh/Downloads/ai_workflow_os_docs_v3_scale_triggers_ecp/IDEA_MEMORY.md`
- `/Users/khaleelmusleh/Downloads/ai_workflow_os_docs_v3_scale_triggers_ecp/SCALE_TRIGGER_EVENT_ECP_ARCHITECTURE.md`
- `/Users/khaleelmusleh/Downloads/ai_workflow_os_project_pack/TECHNICAL_BLUEPRINT.md`
- `/Users/khaleelmusleh/Downloads/ai_workflow_os_project_pack/MADR_DECISIONS.md`
- `/Users/khaleelmusleh/Downloads/ai_workflow_os_project_pack/BUILD_CHECKLIST.md`

Important local evidence:

- The full brief defines `.flow` as a restricted YAML-like instruction file that the platform parses, validates, and compiles to runtime JSON.
- The full brief explicitly rejects unsafe YAML features: anchors, aliases, custom tags, multi-document YAML, unknown keys, unbounded loops, and external actions without approval.
- The v3 idea memory states the long-term direction more clearly: `.flow` is a custom instruction language with restricted YAML-like syntax and its own parser.
- The v3 trigger/ECP architecture says `.flow` defines logical triggers; the compiler extracts trigger definitions into DB rows; static scheduler/event-router/executor functions execute compiled specs.
- Older project-pack MADRs mention "safe YAML subset"; P4.1 supersedes that wording with "custom `.flow` grammar inspired by YAML, not YAML parser/runtime dependency."

## External Source Findings

| Source                                            | Type                         | Evidence Used                                                                                                                                                                                                      |
| ------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Zod `llms.txt` / `llms-full.txt`                  | Official AI docs             | Zod 4 is the current schema validation/type-inference layer after parsing; use it for AST/schema validation, not for lexing.                                                                                       |
| Zod basics and package docs                       | Official docs                | `.parse` throws, `.safeParse` returns a discriminated union, and `z.infer` extracts TypeScript types from schemas.                                                                                                 |
| YAML.org root                                     | Official docs                | YAML is a human-friendly data serialization language; we should learn from it, not call `.flow` YAML.                                                                                                              |
| YAML 1.2.2 spec                                   | Official spec                | YAML separates character stream, syntax, loading failure points, and representation. `.flow` should likewise separate source, tokens/CST, AST, semantic validation, and runtime plan.                              |
| YAML collections section                          | Official spec                | Indentation, `- ` sequences, `: ` mappings, and `#` comments are readable primitives worth borrowing selectively.                                                                                                  |
| YAML loading failure points                       | Official spec                | A processor can recover but must report errors. `.flow` should return diagnostics with spans instead of throwing opaque exceptions.                                                                                |
| `yaml/yaml-grammar`                               | Official YAML project repo   | Full YAML grammar is large and hard; custom `.flow` must be smaller and domain-specific rather than trying to implement full YAML.                                                                                 |
| `yaml/yaml-test-suite`                            | Official YAML project repo   | Parser quality needs fixture-based tests with input, tokens/events/AST expectations, and error cases. `.flow` needs its own versioned test corpus.                                                                 |
| `eemeli/yaml` docs and repo                       | Official package docs/source | The mature package separates parse/stringify, Document AST, and Lexer/Parser/Composer layers. `.flow` should copy that architectural separation, not the dependency.                                               |
| GitHub Actions workflow syntax                    | Official docs                | Workflows use readable files with triggers, permissions, jobs, job IDs, and steps; `.flow` can use similar concepts while owning richer semantics for tools, approvals, artifacts, reflection, and runtime policy. |
| `pnpm view zod ...`                               | Registry                     | `zod@4.4.3` is current latest stable.                                                                                                                                                                              |
| `pnpm view yaml ...`                              | Registry                     | `yaml@2.9.0` is current latest stable, but it is **not** an approved dependency for `@repo/flow`.                                                                                                                  |
| `pnpm outdated --filter @repo/flow --format json` | Registry/local proof         | Existing direct dependency state reports `{}`.                                                                                                                                                                     |
| Local package audit                               | Source                       | `@repo/flow` has public subpaths and runtime contracts, but parser/compiler implementation is still missing.                                                                                                       |

## What To Borrow From YAML

Borrow concepts:

- indentation-based nested blocks;
- line comments with `#`;
- mapping-like `key: value`;
- sequence-like `- item`;
- block strings for goals/instructions;
- source spans and line/column diagnostics;
- token stream -> CST -> AST separation;
- fixture-driven parser test suite;
- explicit loading failure points.

Do not borrow features:

- anchors;
- aliases;
- custom tags;
- directives;
- multi-document streams;
- merge keys;
- arbitrary schema resolution;
- implicit bool/null/date coercion;
- arbitrary flow collections as a core requirement;
- unbounded alias expansion or recursive structures.

## Proposed `.flow` Compiler Stack

```text
.flow source
-> FlowLexer tokens
-> FlowCST with comments, indentation, spans, and field order
-> FlowAST normalized to package schemas
-> Zod structural validation
-> symbol table
-> semantic validation
-> execution plan / DAG slice
-> runtime adapter outside @repo/flow
```

## Version Verdict

- Keep `zod@4.4.3`.
- Do not add `yaml`.
- Do not add parser-generator/runtime dependencies yet.
- Continue to keep Inngest, Vercel Workflow, Next.js, Drizzle, AI SDK, Vercel Sandbox, Composio, and other provider SDKs out of `@repo/flow`.

## P4.1 Implementation Direction

This phase should not jump straight into a broad parser implementation.

Implement first:

- a `.flow` grammar design document: `docs/ai-workflow-os/02-workflow-kernel/flow-grammar-v0.md`;
- token and CST contracts;
- parser diagnostic contracts;
- a tiny hand-written lexer for the v0 syntax surface;
- parser fixtures for valid/invalid `.flow` examples;
- tests that prove YAML-only features are rejected;
- no runtime provider dependency.

Defer:

- complete parser;
- formatter;
- LSP/autocomplete;
- expression parser;
- full semantic graph / ASG;
- runtime interpreter;
- provider/runtime adapters;
- database persistence.

## Open Questions

- Exact `.flow` v0 grammar: whether job/task collections use explicit `job <id>:` / `task <id>:` headers or YAML-like maps/lists.
- Whether sequence syntax should remain `- item` or use a more domain-specific block form.
- Whether block strings should copy YAML `|` behavior or use `.flow`-specific heredoc-like blocks.
- How tolerant the editor parser should be while AI is actively generating incomplete files.

## Validation Plan

After the corrected research/docs pass:

```bash
pnpm --filter @repo/flow typecheck
pnpm exec vitest run --config packages/flow/vitest.config.ts
pnpm test
pnpm boundaries:cruise --focus packages/flow
pnpm outdated --filter @repo/flow --format json
git diff --check
```
