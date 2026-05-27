# MADR-095: Build a Custom `.flow` Parser, Not a YAML-Backed Parser

Status: Accepted

Date: 2026-05-27

Package: `@repo/flow`

## Context

`@repo/flow` owns the product language contracts, AST, kernel vocabulary, compiler interfaces, runtime/event/state contracts, patch contracts, and testing helpers. It is still mostly contract-only:

- parser returns an unimplemented diagnostic;
- compiler is only an interface;
- no app/package consumers import it yet;
- the final `.flow` grammar is not written.

The product direction is clear: `.flow` is our own AI-native workflow instruction language. It is YAML-like only for readability and AI fluency. The platform should study YAML and GitHub Actions to learn from proven workflow syntax and parser architecture, but should not use YAML as the runtime parser or call `.flow` YAML.

## Decision

Build a custom `.flow` parser and compiler stack.

Use YAML as research input only.

`@repo/flow` must not depend on the `yaml` npm package for parsing `.flow`.

The P4.1 implementation order is:

```text
grammar design
-> token contracts
-> CST contracts
-> diagnostic model
-> minimal hand-written lexer/parser for v0
-> AST normalization
-> Zod structural validation
-> symbol table and semantic validation
-> execution planning
```

Keep provider/runtime adapters outside `@repo/flow`.

## Consequences

Positive:

- `.flow` remains a product-owned language, not a branded YAML wrapper.
- We avoid YAML ambiguity and unsafe/custom constructs by design.
- Parser diagnostics, source spans, formatter, LSP, and repair prompts can be tailored to workflow authoring.
- The compiler stack remains aligned with the product thesis: `.flow` is the source layer; AST/ASG/DAG/CFG/event/state structures are internal layers.

Negative:

- We take on parser ownership.
- Full parser quality needs a dedicated fixture corpus and grammar discipline.
- We cannot lean on a general YAML parser for edge cases.

## Borrowed Ideas From YAML

Borrow:

- indentation-based blocks;
- mapping-like key/value readability;
- sequence-like repeated items;
- comments;
- block text;
- source spans;
- diagnostics instead of opaque exceptions;
- token/CST/AST separation;
- test-suite discipline.

Reject:

- anchors;
- aliases;
- tags;
- directives;
- multi-document streams;
- merge keys;
- implicit schema coercion;
- arbitrary YAML extensions.

## Alternatives Considered

- Use `yaml@2.9.0` as the first parser.
  - Rejected. It would make `.flow` a YAML dialect in practice, preserve YAML edge cases we do not want, and delay ownership of the product language.
- Keep the old "safe YAML subset" wording.
  - Rejected. It is useful historical context but too imprecise. The corrected posture is a custom `.flow` grammar inspired by YAML.
- Use a parser generator immediately.
  - Deferred. A small hand-written v0 lexer/parser is easier to tailor while the grammar is still stabilizing. Parser-generator evaluation can happen after the grammar document and test corpus exist.

## Evidence

- `/Users/khaleelmusleh/Downloads/AI_Workflow_OS_Full_Brief_for_Codex.docx`: `.flow` is a restricted YAML-like operating file with rejected unsafe YAML features.
- `/Users/khaleelmusleh/Downloads/ai_workflow_os_docs_v3_scale_triggers_ecp/IDEA_MEMORY.md`: `.flow` is a custom instruction language, restricted YAML-like syntax, own parser eventually.
- `/Users/khaleelmusleh/Downloads/ai_workflow_os_docs_v3_scale_triggers_ecp/SCALE_TRIGGER_EVENT_ECP_ARCHITECTURE.md`: `.flow` defines logical triggers; compiler extracts trigger definitions; DB-backed trigger registry/runtime executes compiled specs.
- YAML.org and YAML 1.2.2: YAML separates source, syntax, representation, and loading failure points; these are architectural lessons, not a dependency decision.
- `yaml/yaml-grammar`: full YAML grammar is large and difficult, confirming why `.flow` should be smaller and domain-specific.
- `yaml/yaml-test-suite`: parser quality needs fixture-driven tests.
- `eemeli/yaml`: mature parser packages separate parse/stringify, Document AST, and Lexer/Parser/Composer layers.
- Local `yaml-main` source audit: 151 available files and 27,776 lines were read from `/Users/khaleelmusleh/Downloads/yaml-main`; `tests/yaml-test-suite`, `tests/json-test-suite`, and `docs-slate` were empty local submodule directories. See [`2026-05-27-yaml-main-parser-architecture-reverse-engineering.md`](../09-research/2026-05-27-yaml-main-parser-architecture-reverse-engineering.md).
- Zod official docs and `llms-full`: keep Zod for post-parse AST/schema validation.
- Registry checks:
  - `zod@4.4.3` current latest stable.
  - `yaml@2.9.0` current latest stable but not approved for `@repo/flow`.

## Impacted Files

Current corrected docs:

- `docs/ai-workflow-os/09-research/2026-05-27-p4-1-flow-parser-compiler-research.md`
- `docs/ai-workflow-os/10-audit/flow-p4-1-audit-2026-05-27.md`
- `docs/ai-workflow-os/02-workflow-kernel/flow-grammar-v0.md`
- `docs/ai-workflow-os/08-plans/package-playbooks/flow.md`

Future code phase:

- `packages/flow/src/source/*`
- `packages/flow/src/parser/*`
- `packages/flow/src/ast/*`
- `packages/flow/src/compiler/*`
- `packages/flow/tests/*`

## Validation Checklist

- [x] Official docs checked.
- [x] Official `llms.txt` / `llms-full.txt` availability checked.
- [x] YAML.org/spec/grammar/test-suite checked.
- [x] Local `yaml-main` explicit line pass documented.
- [x] Local Downloads concept docs checked.
- [x] Registry metadata checked.
- [x] No `yaml` dependency in `@repo/flow`.
- [x] `.flow` grammar design document written.
- [x] Token/CST contracts added.
- [x] Parser fixture corpus added.
- [ ] Minimal custom parser implemented.
- [x] `pnpm --filter @repo/flow typecheck` passed for the contract-only package.
- [x] `pnpm test` passed for the current repo test set.
- [x] `pnpm boundaries:cruise --focus packages/flow` passed.
