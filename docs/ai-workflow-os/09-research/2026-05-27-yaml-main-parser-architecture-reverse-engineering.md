# Local `yaml-main` Parser Architecture Reverse Engineering

Date: 2026-05-27

Local source: `/Users/khaleelmusleh/Downloads/yaml-main`

Status: completed explicit local line pass as a `.flow` parser research artifact; not a dependency approval

## Scope And Integrity Notes

This report is based on a local source audit of the downloaded `yaml-main` project. The local files were read in explicit chunks and the resulting architecture, tests, coverage ledger, and `.flow` lessons are documented here.

Important limitation:

- `/Users/khaleelmusleh/Downloads/yaml-main/tests/yaml-test-suite` exists but is empty in this local download.
- `.gitmodules` shows it should be a submodule from `https://github.com/eemeli/yaml-test-suite.git`, branch `fixed-data`.
- `/Users/khaleelmusleh/Downloads/yaml-main/tests/json-test-suite` also exists but is empty locally.
- `/Users/khaleelmusleh/Downloads/yaml-main/docs-slate` exists but is empty locally.
- Therefore the local YAML/JSON/docs submodule harnesses were read where present, but the missing submodule fixture/doc files were not present to read.

## Inventory Evidence

Commands run:

```bash
find /Users/khaleelmusleh/Downloads/yaml-main -type f -not -path '*/.git/*' -print
find /Users/khaleelmusleh/Downloads/yaml-main -type f -not -path '*/.git/*' -print | wc -l
find /Users/khaleelmusleh/Downloads/yaml-main -type f -not -path '*/.git/*' -print0 | xargs -0 wc -l | tail -1
du -sh /Users/khaleelmusleh/Downloads/yaml-main
find /Users/khaleelmusleh/Downloads/yaml-main/tests/yaml-test-suite -type f -print
ls -la /Users/khaleelmusleh/Downloads/yaml-main/tests/yaml-test-suite
ls -la /Users/khaleelmusleh/Downloads/yaml-main/tests/json-test-suite
ls -la /Users/khaleelmusleh/Downloads/yaml-main/docs-slate
find /Users/khaleelmusleh/Downloads/yaml-main -type f -exec wc -l {} +
find /Users/khaleelmusleh/Downloads/yaml-main -type f -exec shasum -a 256 {} +
```

Observed:

- Files: 151.
- Lines: 27,776.
- Size: 1.2M.
- Package: `yaml`.
- Version: `3.0.0-1`.
- Runtime dependencies: none.
- Node engine: `^20.19 || ^22.12 || >=24`.
- TypeScript target: `es2023`.
- Build: `rolldown` plus `rolldown-plugin-dts`.
- Test: `vitest`.
- Distribution exports: root package and `./util`.
- Local fixture submodule directories for YAML/JSON external suites and `docs-slate` are configured, but all three directories are empty locally.

SHA-256 anchors:

```text
160c20163fb647215d7ae2185200553615aec4c206032d546189d56374a6c56d package.json
f435f2f73ea378018986ff9d179312f1fb59e6ef01754da6d541d40e3af48504 src/parse/lexer.ts
77a55efefe0888d960175a78623e526616602d1e86d76de8d45dd9246d6122e2 src/parse/parser.ts
85a8616262e7d9c4165d9b49cf4c3a2a578187c433389b335a448d7a652ac2b7 src/compose/composer.ts
665334fc1a17b52490386dd16b6b221a63df0b76ed0e0adb44ee6675c0ed1c5c tests/yaml-test-suite.ts
c3d06817cfc782e04544feb2fb2193096870373d6205f675c34bee707be1ab13 package-lock.json
d5c0d1b87ac66f557cc35d23fb87b2c96405cdee1133c1e09ff6c1b7240df202 tests/doc/YAML-1.2.spec.ts
ede32e6f2ce668f5cfb2ca94c7ab0b469b060c7c422bd29c10baf56dadb64d8b tests/doc/stringify.ts
f3de6355c2fc14f4621e279d8acb383761365d95ecf5c2919aa71ea983cc74a9 tests/doc/comments.ts
fccca167dd307cd5df1aae9ae7b215fcbfc4f1c4a709d4d3aff900b4d5fbdb4f tests/doc/parse.ts
```

## File Coverage Map

Root and package files inventoried:

- `.editorconfig`
- `.gitignore`
- `.gitmodules`
- `.prettierignore`
- `.well-known/funding-manifest-urls`
- `LICENSE`
- `README.md`
- `bin.js`
- `eslint.config.js`
- `jsr.jsonc`
- `package-lock.json`
- `package.json`
- `rolldown.config.js`
- `tsconfig.json`
- `vitest.config.js`

GitHub/CI files inventoried:

- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/vitest.browserstack.config.js`
- `.github/workflows/browsers.yml`
- `.github/workflows/codeql-analysis.yml`
- `.github/workflows/deno.yml`
- `.github/workflows/jsr-publish.yml`
- `.github/workflows/nodejs.yml`
- `.github/workflows/typescript.yml`

Documentation files inventoried/read:

- `docs/01_intro.md`
- `docs/02_parse_stringify.md`
- `docs/03_options.md`
- `docs/04_documents.md`
- `docs/05_content_nodes.md`
- `docs/06_custom_tags.md`
- `docs/07_parsing_yaml.md`
- `docs/08_errors.md`
- `docs/09_cli.md`
- `docs/10_yaml_syntax.md`
- `docs/CONTRIBUTING.md`
- `docs/README.md`
- `docs/SECURITY.md`
- `docs/index.html.md`
- `docs/prepare-docs.js`

Parser/CST source files read:

- `src/parse/lexer.ts`
- `src/parse/parser.ts`
- `src/parse/cst.ts`
- `src/parse/cst-scalar.ts`
- `src/parse/cst-stringify.ts`
- `src/parse/cst-visit.ts`
- `src/parse/line-counter.ts`

Composer source files read:

- `src/compose/composer.ts`
- `src/compose/compose-doc.ts`
- `src/compose/compose-node.ts`
- `src/compose/compose-scalar.ts`
- `src/compose/compose-collection.ts`
- `src/compose/resolve-block-map.ts`
- `src/compose/resolve-block-seq.ts`
- `src/compose/resolve-block-scalar.ts`
- `src/compose/resolve-flow-collection.ts`
- `src/compose/resolve-flow-scalar.ts`
- `src/compose/resolve-props.ts`
- `src/compose/resolve-end.ts`
- `src/compose/util-contains-newline.ts`
- `src/compose/util-empty-scalar-position.ts`
- `src/compose/util-flow-indent-check.ts`

Document/node source files read:

- `src/doc/Document.ts`
- `src/doc/NodeCreator.ts`
- `src/doc/anchors.ts`
- `src/doc/applyReviver.ts`
- `src/doc/directives.ts`
- `src/nodes/Alias.ts`
- `src/nodes/Pair.ts`
- `src/nodes/Scalar.ts`
- `src/nodes/YAMLMap.ts`
- `src/nodes/YAMLSeq.ts`
- `src/nodes/YAMLSet.ts`
- `src/nodes/addPairToJSMap.ts`
- `src/nodes/identity.ts`
- `src/nodes/toJS.ts`
- `src/nodes/types.ts`
- `src/nodes/util-clone-map-or-set.ts`
- `src/visit.ts`

Schema source files read:

- `src/schema/Schema.ts`
- `src/schema/common/map.ts`
- `src/schema/common/null.ts`
- `src/schema/common/seq.ts`
- `src/schema/common/string.ts`
- `src/schema/core/bool.ts`
- `src/schema/core/float.ts`
- `src/schema/core/int.ts`
- `src/schema/core/schema.ts`
- `src/schema/json/schema.ts`
- `src/schema/json-schema.ts`
- `src/schema/tags.ts`
- `src/schema/types.ts`
- `src/schema/util-primitive-key.ts`
- `src/schema/yaml-1.1/binary.ts`
- `src/schema/yaml-1.1/bool.ts`
- `src/schema/yaml-1.1/float.ts`
- `src/schema/yaml-1.1/int.ts`
- `src/schema/yaml-1.1/merge.ts`
- `src/schema/yaml-1.1/omap.ts`
- `src/schema/yaml-1.1/pairs.ts`
- `src/schema/yaml-1.1/schema.ts`
- `src/schema/yaml-1.1/set.ts`
- `src/schema/yaml-1.1/timestamp.ts`

Stringifier/source utility files read:

- `src/stringify/foldFlowLines.ts`
- `src/stringify/stringify.ts`
- `src/stringify/stringifyComment.ts`
- `src/stringify/stringifyDocument.ts`
- `src/stringify/stringifyNumber.ts`
- `src/stringify/stringifyPair.ts`
- `src/stringify/stringifyString.ts`
- `src/cli.ts`
- `src/errors.ts`
- `src/index.ts`
- `src/log.ts`
- `src/options.ts`
- `src/public-api.ts`
- `src/test-events.ts`
- `src/util.ts`

Test harness and tests inventoried/read by category:

- `tests/lexer.ts`
- `tests/cst.ts`
- `tests/yaml-test-suite.ts`
- `tests/json-test-suite.ts`
- `tests/line-counter.ts`
- `tests/cli.ts`
- `tests/directives.ts`
- `tests/collection-access.ts`
- `tests/clone.ts`
- `tests/compat.ts`
- `tests/node-to-js.ts`
- `tests/properties.ts`
- `tests/visit.ts`
- `tests/_setup.ts`
- `tests/_utils.ts`
- `tests/tsconfig.json`
- `tests/doc/YAML-1.1.spec.ts`
- `tests/doc/YAML-1.2.spec.ts`
- `tests/doc/anchors.ts`
- `tests/doc/comments.ts`
- `tests/doc/createNode.ts`
- `tests/doc/errors.ts`
- `tests/doc/foldFlowLines.ts`
- `tests/doc/parse.ts`
- `tests/doc/stringify.ts`
- `tests/doc/types.ts`
- `tests/artifacts/cli-singlequote.js`
- `tests/artifacts/cli-unstyle.cjs`
- `tests/artifacts/prettier-circleci-config.yml`
- `tests/artifacts/pr104/billion-laughs.yml`
- `tests/artifacts/pr104/case1.yml`
- `tests/artifacts/pr104/case2.yml`
- `tests/artifacts/pr104/quadratic.yml`

## Architecture Summary

The project exposes three API levels:

1. Parse/stringify: `parse`, `parseDocument`, `parseAllDocuments`, `stringify`.
2. Document AST: `Document`, `Scalar`, `YAMLMap`, `YAMLSeq`, `YAMLSet`, `Pair`, `Alias`, visitor APIs.
3. Low-level source pipeline: `lex`, `Parser`, `Composer`, `CST`, `LineCounter`.

The internal pipeline is:

```text
source string
-> lex(source): string tokens
-> Parser.parse(source): CST tokens
-> Composer.compose(tokens): Document AST
-> schema/tag resolution
-> JS conversion or YAML stringification
```

The core lesson for `.flow` is not "use YAML". The lesson is "separate source handling, CST, AST, semantic validation, and runtime representation."

## Lexer Findings

File: `src/parse/lexer.ts`

Key facts:

- 537 lines.
- Hand-written state machine.
- States are `stream`, `document`, and `flow`.
- Emits source slices plus sentinel control tokens.
- It should not throw for normal bad YAML input; bad structure is preserved for parser/composer diagnostics.
- Tracks indentation and flow collection nesting itself.

Important lexer state:

- `flowKey`
- `flowLevel`
- `indentNext`
- `indentValue`
- `pos`
- `tokens`

Important token sentinels:

- `DOCUMENT` is `\x02`.
- `FLOW_END` is `\x18`.
- `SCALAR` is `\x1f`.
- BOM is `\u{FEFF}`.

Important lexer methods:

- `stream()`
- `lineStart()`
- `document()`
- `flow()`
- `indicators()`
- `quotedScalar()`
- `blockScalar()`
- `plainScalar()`
- `count()`
- `toIndex()`
- `toLineEnd()`
- `newline()`
- `spaces()`
- `until()`

Lesson for `.flow`:

- Use a smaller hand-written lexer.
- Keep state explicit.
- Do not throw on incomplete editor input.
- Emit tokens with enough information for spans and recovery.
- Use a strict compile mode later, but keep a tolerant parse path for editor/AI repair.

## Parser/CST Findings

Files:

- `src/parse/parser.ts`
- `src/parse/cst.ts`
- `src/parse/cst-visit.ts`
- `src/parse/cst-stringify.ts`
- `src/parse/cst-scalar.ts`
- `src/parse/line-counter.ts`

Key facts:

- `parser.ts` is 968 lines.
- Parser is stack-based.
- Parser converts lexer strings into CST object tokens.
- Parser errors are represented as `{ type: 'error' }` tokens, not thrown exceptions.
- `LineCounter` records new line starts and uses binary search for offset to line/column lookup.
- CST stringification simply concatenates stored `source` fields in logical order.
- CST visitor supports traversal, skipping, breaking, item removal, parent lookup, and path addressing.

Key CST token families:

- `SourceToken`
- `ErrorToken`
- `Directive`
- `Document`
- `DocumentEnd`
- `FlowScalar`
- `BlockScalar`
- `BlockMap`
- `BlockSequence`
- `FlowCollection`

Lesson for `.flow`:

- `@repo/flow` should have a source-preserving CST before AST.
- CST should preserve comments, raw text, indentation, field order, and spans.
- A CST visitor is useful for future FlowPatch, formatter, editor repairs, and AI patch prompts.
- `FlowLineCounter` should exist and should be independent from AST semantics.

## Composer Findings

Files:

- `src/compose/composer.ts`
- `src/compose/compose-doc.ts`
- `src/compose/compose-node.ts`
- `src/compose/compose-scalar.ts`
- `src/compose/compose-collection.ts`
- resolver files

Key facts:

- `composer.ts` is 287 lines.
- Composer consumes CST and emits `Document` AST instances.
- Composer owns higher-level validation and diagnostics.
- It collects errors and warnings using a central error handler.
- It attaches comments and blank lines to AST nodes.
- It resolves scalar values, collection structures, anchors, tags, directives, and schemas.

Lesson for `.flow`:

- Add a `FlowAstBuilder` or `FlowComposer` stage after CST.
- Keep parser-level errors separate from semantic validation errors.
- Do not put provider/runtime behavior in the parser.
- Normalize source field names into internal AST contracts only after CST exists.

## Document And Node Model Findings

Files:

- `src/doc/*`
- `src/nodes/*`
- `src/visit.ts`

Key facts:

- `Document` owns options, schema, directives, value, errors, warnings, comments, and range.
- `NodeBase` carries comments, `range`, `spaceBefore`, `tag`, and optional `srcToken`.
- AST visitor supports replace/remove/skip/break operations.
- `Alias` has explicit anti-resource-exhaustion logic through `maxAliasCount`.
- `YAMLMap`, `YAMLSeq`, and `YAMLSet` provide collection APIs and stringification behavior.

Lesson for `.flow`:

- We should not copy YAML's generic document model.
- We should copy the idea of AST nodes with stable ranges and optional source-token references.
- We should build domain AST nodes: `FlowDocument`, `FlowJob`, `FlowTask`, `FlowTrigger`, `FlowPermissionSet`.
- Visitor/patch support should exist for FlowPatch and editor operations.

## Schema And Tag Findings

Files:

- `src/schema/*`

Key facts:

- YAML schema resolution is powerful and broad.
- It resolves strings into nulls, booleans, integers, floats, binary, timestamps, sets, ordered maps, pairs, merge keys, and more.
- YAML 1.1 and 1.2 differ significantly in implicit scalar behavior.
- Custom tags can add application-specific runtime types.

Lesson for `.flow`:

- This is the main thing to reject.
- `.flow` must not have YAML-style tags, implicit schema coercion, merge keys, custom data tags, or version-dependent scalar meaning.
- Field schemas should be explicit through `@repo/flow` Zod/domain validation.
- Bare scalars should stay strings unless the field schema explicitly says boolean or number.

## Stringifier Findings

Files:

- `src/stringify/*`

Key facts:

- Stringification is a full subsystem, not a trivial `JSON.stringify`.
- It has separate handling for document directives, pairs, comments, block strings, flow folding, line width, scalar styles, collection style, and alias order.
- `CST.stringify()` is intentionally simpler and only concatenates original source fragments.

Lesson for `.flow`:

- Do not implement a broad formatter first.
- First implement source parsing and diagnostics.
- Later implement a `.flow` formatter that is much narrower than YAML stringification.
- Formatter should preserve comments and stable field order, not support arbitrary YAML style variants.

## CLI And Test Harness Findings

Files:

- `src/cli.ts`
- `tests/*`
- `tests/doc/*`

Key facts:

- CLI exposes `lex`, `cst`, `valid`, JSON output, strict mode, merge support, single document enforcement, visitor loading, and YAML version.
- Tests cover:
  - lexer token output;
  - CST traversal/stringification/editing;
  - parser error codes and source positions;
  - comments and blank lines;
  - anchors, aliases, merge, tags, directives;
  - schema/type behavior;
  - stringification styles;
  - resource exhaustion fixtures;
  - browser/build/Node compatibility;
  - YAML test-suite harness;
  - JSON test-suite harness.
- `tests/doc/parse.ts` is 953 lines.
- `tests/doc/stringify.ts` is 1,637 lines.
- `tests/doc/types.ts` is 1,319 lines.
- `tests/doc/comments.ts` is 1,303 lines.
- `tests/doc/YAML-1.2.spec.ts` is 1,866 lines.

Lesson for `.flow`:

- Build parser quality through fixtures, not only unit tests.
- Add both valid and invalid `.flow` fixtures.
- Tests should prove unsupported YAML features fail with specific `.flow` diagnostics.
- Add round-trip tests only after a formatter exists.
- Add resource-exhaustion and deeply nested input tests before accepting user/AI-authored `.flow` at runtime.

## Full Line Pass Addendum

After the initial subsystem audit, an explicit full line pass was completed for the remaining test, artifact, CI/config, hidden, and lock files. The local coverage anchor is:

```text
151 files
27,776 total lines
tests/yaml-test-suite: empty local submodule directory
tests/json-test-suite: empty local submodule directory
docs-slate: empty local submodule directory
```

Additional files and findings from the full pass:

- `tests/cli.ts` covers stream processing, `valid`, `--json`, `--indent`, `--merge`, `--doc`, visitor loading, lexer output, CST output, bad arguments, single-document enforcement, and parser failure behavior. `.flow` should expose debug parser surfaces for lexer/CST/diagnostics without making those the user-facing product.
- `tests/directives.ts` proves how much YAML machinery comes from `%TAG` and `%YAML`; `.flow` should reject directive-like syntax early with a specific unsupported-feature diagnostic.
- `tests/collection-access.ts`, `tests/clone.ts`, `tests/node-to-js.ts`, and `tests/visit.ts` show the cost of a generic mutable document API. `.flow` should expose domain patch operations and AST visitors, not a general YAML document mutation surface.
- `tests/properties.ts` uses property-based stringify/parse checks. `.flow` should eventually add property tests for parser stability and AST round trips, but only after formatter semantics exist.
- `tests/compat.ts` shows compatibility-mode warning and stringification branches. `.flow` should avoid compatibility modes in v0.
- `tests/doc/comments.ts` is a major warning: preserving comments and blank lines is a real subsystem. `.flow` should preserve comments in CST but keep formatter behavior narrow.
- `tests/doc/parse.ts` is where parser security and weird input cases live: resource exhaustion, excessive recursion, alias expansion, duplicate keys, complex keys, CRLF behavior, source tokens, revivers, and string-key validation. `.flow` must include hostile/deep input fixtures before runtime execution.
- `tests/doc/errors.ts` shows diagnostics need stable codes, spans, and pretty messages for tabs, flow/block mistakes, invalid escapes, comments, tags, repeated directives, and invalid options. `.flow` diagnostics should use stable `FLOW_PARSE_*` codes and span data from day one.
- `tests/doc/createNode.ts`, `tests/doc/anchors.ts`, and `tests/doc/types.ts` prove why YAML's generic schema/type model is too broad for `.flow`: anchors, aliases, merge keys, tags, binary, timestamps, sets, ordered maps, custom tags, schema changes, and implicit values all create behavior we do not want.
- `tests/doc/stringify.ts` and `tests/doc/foldFlowLines.ts` prove stringification is a separate product. `.flow` v0 should not try to match YAML formatting breadth.
- `tests/doc/YAML-1.1.spec.ts` and `tests/doc/YAML-1.2.spec.ts` encode spec examples and version differences. `.flow` should not have language-version behavior beyond an explicit `flow: "0.1"` schema contract.
- `tests/artifacts/prettier-circleci-config.yml` is a realistic CI workflow-like YAML file with anchors, aliases, merges, and workflow jobs. It is useful inspiration for workflow readability, but its YAML features must be rejected from `.flow`.
- `tests/artifacts/pr104/*` are resource-exhaustion fixtures. `.flow` should include analogous deep nesting, repeated references, huge scalar, huge list, and pathological indentation tests even though `.flow` will not support YAML aliases.
- `package-lock.json` confirms no runtime dependencies for the YAML package itself and a modern dev stack around TypeScript, Vitest, ESLint, Rolldown, BrowserStack, CodeQL, Deno, and JSR publishing. For `@repo/flow`, the lesson is not dependency parity; it is that parser packages need tight CI and fixture coverage.
- `.github/workflows/*` shows parser-package CI spans Node versions, OSes, browser builds, type tests, dist tests, Deno, publishing, lint, formatting, and CodeQL. For `@repo/flow`, add this gradually through package tests, root tests, typecheck, dependency boundaries, and later browser/editor tests.

## What To Borrow For `.flow`

Borrow:

- Hand-written lexer for v0.
- Explicit token set.
- CST before AST.
- Source spans and line/column diagnostics.
- Error tokens/diagnostics instead of parser throws.
- Source-preserving CST for comments/order/formatting.
- Separate AST builder/composer.
- Fixture corpus discipline.
- Visitor pattern for patching/editing.
- Resource-exhaustion tests.
- Public low-level debug APIs for `lex`, `parseCst`, and diagnostics.

## What To Reject For `.flow`

Reject:

- YAML runtime parser dependency.
- YAML anchors.
- YAML aliases.
- YAML tags.
- YAML directives.
- Multi-document streams.
- Merge keys.
- YAML 1.1 vs 1.2 schema differences.
- Implicit date/null/bool/number coercion outside field schemas.
- Arbitrary flow maps.
- General-purpose custom tags.
- Generic JS object serialization as a source-language goal.

## Concrete `@repo/flow` Design Impact

Recommended source pipeline:

```text
FlowSource
-> FlowLexer
-> FlowCST
-> FlowAstBuilder
-> Zod structural validation
-> FlowSymbolTable
-> FlowSemanticGraph
-> FlowExecutionPlan
```

Recommended parser modes:

- `strict`: used by CI/runtime compile. Invalid source blocks execution.
- `tolerant`: used by editor/AI repair. Returns partial CST plus diagnostics.

Recommended source contracts:

- tokens include offset, line, column, raw source, and token type;
- CST nodes include spans and child nodes;
- diagnostics include code, severity, span, message, and optional repair hint;
- AST nodes use source spans for user-facing errors;
- semantic validation reports tool/artifact/permission/worker resolution failures after AST validation.

Recommended v0 lexer states:

- `root`
- `block`
- `inlineList`
- `quotedString`
- `literalBlock`
- `comment`

Recommended v0 diagnostic equivalents:

- `FLOW_PARSE_BAD_INDENT`
- `FLOW_PARSE_TAB_INDENT`
- `FLOW_PARSE_UNEXPECTED_TOKEN`
- `FLOW_PARSE_UNTERMINATED_STRING`
- `FLOW_PARSE_UNTERMINATED_INLINE_LIST`
- `FLOW_PARSE_YAML_FEATURE_UNSUPPORTED`
- `FLOW_PARSE_EMPTY_DOCUMENT`
- `FLOW_PARSE_DUPLICATE_KEY`

## Checklist

- [x] Local `yaml-main` inventory generated.
- [x] File count recorded.
- [x] Line count recorded.
- [x] Package metadata read.
- [x] CI/build/lint/test config read.
- [x] Docs read by topic.
- [x] Parser source read.
- [x] Composer source read.
- [x] Document/node source read.
- [x] Schema/tag source read.
- [x] Stringifier source read.
- [x] CLI source read.
- [x] Tests inspected by category and major files.
- [x] Empty local `tests/yaml-test-suite` submodule documented.
- [x] Empty local `tests/json-test-suite` submodule documented.
- [x] Empty local `docs-slate` submodule documented.
- [x] Generated lockfile read and recorded.
- [x] Test artifacts read and recorded.
- [x] Hidden config, CI, and issue template files read and recorded.
- [x] Explicit local full line pass completed across the 151 available files.
- [x] `.flow` borrow/reject list updated.
- [x] No decision made to depend on `yaml`.

## Verdict

The downloaded `yaml-main` project validates the compiler-style architecture for `.flow`, but it also proves why `.flow` should not be implemented as YAML.

YAML is mature because it separates lexing, CST parsing, AST composition, schema resolution, document APIs, stringification, and tests. `.flow` should copy that layering.

YAML is also too broad for our product language because it includes anchors, aliases, tags, directives, multi-document streams, merge keys, implicit schema coercion, and historical version differences. `.flow` should reject those features and stay domain-specific.

The next `@repo/flow` parser phase should implement a small hand-written lexer and CST parser first, with strict/tolerant modes and a fixture corpus, before AST normalization, symbol tables, semantic validation, and execution planning.
