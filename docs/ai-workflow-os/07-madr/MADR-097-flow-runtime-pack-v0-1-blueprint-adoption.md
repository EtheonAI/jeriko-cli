# MADR-097: Adopt Flow Runtime Pack v0.1 As Blueprint, Not Active Runtime Code

Status: Accepted

Date: 2026-05-27

Package: `@repo/flow`

## Context

The downloaded `flow_language_runtime_pack_v0_1` contains a coherent research pack for `.flow`, including language docs, examples, schemas, parser/compiler/runtime sketches, prompts, an SQL migration, and a minimal test.

The pack is valuable because it covers the full platform shape:

- `.flow` source language;
- compiler pipeline;
- symbol table and semantic validation;
- Inngest-based durable runtime sketch;
- EventContextPackets;
- TaskReports;
- issue cards;
- reflection packets;
- FlowPatch;
- permissions;
- billing;
- storage/cache;
- database tables.

The pack is not acceptable as active code in this repo because it mixes concerns that our package strategy deliberately separates.

Current repo decisions already require:

- custom `.flow` parser, not YAML-backed parser;
- `@repo/flow` as provider-neutral package;
- `@repo/ai` for AI SDK v6 primitives and platform tools;
- `@repo/connectors` for Composio/direct integrations;
- `@repo/sandbox` for Vercel Sandbox adapters;
- managed Inngest first behind an adapter;
- durable runs and resumable UI reconnect.

## Decision

Copy the pack into repo docs as source reference:

- `docs/ai-workflow-os/_source/flow-language-runtime-pack-v0-1`

Adopt the pack as a blueprint for concepts and checklists.

Do not copy its runtime implementation into `@repo/flow`.

Supersede the pack's "safe YAML subset parser first" implementation suggestion with the accepted custom `.flow` lexer/CST/parser decision from MADR-095.

Keep `@repo/flow` provider-neutral:

- no `yaml` parser dependency;
- no `inngest` import;
- no `ai` / AI SDK import;
- no `@vercel/sandbox` import;
- no database client;
- no Next.js route handlers;
- no UI components.

## Consequences

Positive:

- We keep the best parts of the research pack without polluting package boundaries.
- The `.flow` language can mature as a real product language, not a disguised YAML dialect.
- Runtime implementation can use Inngest without forcing Inngest into language/compiler code.
- AI SDK v6, connector tools, sandbox execution, DB persistence, and app UI remain independently testable.
- The pack examples can become fixture candidates after cleanup.

Negative:

- More implementation work is required because we are not importing the provided parser/runtime.
- The pack's wide vocabulary must be phased; accepting every task type immediately would overbuild parser/runtime scope.
- JSON Schema files need conversion or alignment with Zod 4 contracts before active use.

## Alternatives Considered

- Import the pack directly as `@repo/flow`.
  - Rejected. It imports YAML and Inngest, contains placeholders, and violates provider-neutral package boundaries.
- Use the pack's YAML-backed parser first and replace later.
  - Rejected. This would make `.flow` a YAML subset in practice and conflicts with MADR-095.
- Keep the pack only in Downloads.
  - Rejected. The source must be versioned locally so future work can cite the exact audited snapshot.
- Split the pack into many packages immediately.
  - Rejected. We need stable contracts first. The active split remains `@repo/flow`, `@repo/ai`, `@repo/connectors`, `@repo/sandbox`, `@repo/database`, and app/runtime adapters.

## Evidence

Local source evidence:

- `docs/ai-workflow-os/_source/flow-language-runtime-pack-v0-1`
- 48 files, 5,226 total lines copied and inventoried.
- [`2026-05-27-flow-language-runtime-pack-v0-1-reverse-engineering.md`](../09-research/2026-05-27-flow-language-runtime-pack-v0-1-reverse-engineering.md)
- `packages/flow/README.md`
- `packages/flow/ARCHITECTURE.md`

Official/current docs checked:

- `https://ai-sdk.dev/llms.txt`
- `https://ai-sdk.dev/docs/agents/building-agents`
- `https://ai-sdk.dev/docs/agents/subagents`
- `https://ai-sdk.dev/docs/agents/loop-control`
- `https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`
- `https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data`
- `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams`
- `https://www.inngest.com/llms.txt`
- `https://www.inngest.com/docs/learn/inngest-steps`
- `https://www.inngest.com/docs/guides/sending-events-from-functions`
- `https://www.inngest.com/docs/guides/concurrency`
- `https://www.inngest.com/docs/features/inngest-functions/cancellation`
- `https://www.inngest.com/docs/reference/typescript/functions/triggers`
- `https://www.inngest.com/docs/usage-limits/inngest`
- `https://vercel.com/docs/vercel-sandbox/sdk-reference`
- `https://json-schema.org/draft/2020-12`

Relevant existing decisions:

- [`MADR-064`](./MADR-064-unified-flow-package.md)
- [`MADR-068`](./MADR-068-vercel-sandbox-adapter-behind-repo-sandbox.md)
- [`MADR-070`](./MADR-070-separate-connectors-from-ai-platform-tools.md)
- [`MADR-073`](./MADR-073-policy-wrap-connector-actions-in-ai-tools.md)
- [`MADR-078`](./MADR-078-flow-orchestrates-ai-sdk-subagents-and-tools.md)
- [`MADR-080`](./MADR-080-prefer-inngest-over-vercel-workflow-for-dynamic-flow-runtime.md)
- [`MADR-095`](./MADR-095-flow-parser-and-compiler-v0.md)
- [`MADR-096`](./MADR-096-resumable-workflow-runs-and-ui-reconnect.md)

## Impacted Files

Added:

- `docs/ai-workflow-os/_source/flow-language-runtime-pack-v0-1`
- `docs/ai-workflow-os/09-research/2026-05-27-flow-language-runtime-pack-v0-1-reverse-engineering.md`
- `docs/ai-workflow-os/08-plans/flow-runtime-pack-v0-1-adoption-checklist.md`
- `packages/flow/FLOW_RUNTIME_PACK_V0_1.md`

Updated:

- `docs/ai-workflow-os/07-madr/README.md`
- `docs/ai-workflow-os/07-madr/madr-decisions.csv`
- `docs/ai-workflow-os/07-madr/madr-decisions.md`
- `docs/ai-workflow-os/09-research/research-index.md`
- `docs/ai-workflow-os/08-plans/package-playbooks/flow.md`
- `packages/flow/README.md`
- `packages/flow/ARCHITECTURE.md`

Future implementation areas:

- `packages/flow/src/lexer`
- `packages/flow/src/cst`
- `packages/flow/src/parser`
- `packages/flow/src/ast`
- `packages/flow/src/compiler`
- `packages/flow/src/runtime`
- `packages/flow/src/events`
- `packages/flow/src/patch`
- `@repo/ai`, `@repo/connectors`, `@repo/sandbox`, `@repo/database`, `apps/app`

## Validation Checklist

- [x] Pack copied into repo source reference folder.
- [x] Pack file inventory and line count recorded.
- [x] Pack docs reviewed for architecture fit.
- [x] Pack examples reviewed for fixture suitability and semantic gaps.
- [x] Pack schemas reviewed for strictness gaps.
- [x] Pack TS parser/compiler/runtime sketches reviewed for package-boundary risks.
- [x] AI SDK v6 docs checked.
- [x] Inngest docs and llms docs checked.
- [x] Vercel Sandbox docs checked.
- [x] JSON Schema Draft 2020-12 docs checked.
- [x] Adoption decision recorded.
- [x] Implementation checklist recorded.
- [ ] Implement custom lexer/parser.
- [ ] Convert cleaned pack examples into valid/invalid fixture cases.
- [ ] Implement semantic validation.
- [ ] Implement provider-neutral execution plan.
- [ ] Implement Inngest adapter outside `@repo/flow`.
