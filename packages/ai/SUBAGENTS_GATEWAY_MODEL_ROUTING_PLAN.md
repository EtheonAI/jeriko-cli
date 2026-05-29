# `@repo/ai` Subagents, Gateway, and Model Routing Plan

Date: 2026-05-28

Status: package-local plan with Phase B model registry contracts implemented.

Central decision: [`MADR-099`](../../docs/ai-workflow-os/07-madr/MADR-099-ai-sdk-subagents-and-gateway-first-model-routing.md)

Research: [`2026-05-28-ai-sdk-subagents-gateway-openrouter-model-routing.md`](../../docs/ai-workflow-os/09-research/2026-05-28-ai-sdk-subagents-gateway-openrouter-model-routing.md)

## Package Role

`@repo/ai` owns model/tool/agent primitives for `.flow` execution.

It does not own:

- durable runtime;
- database persistence;
- app UI;
- connector SDK internals;
- sandbox provider implementation.

## Decision Summary

Use Vercel AI Gateway first.

Keep OpenRouter as a secondary adapter.

Keep direct provider keys as a controlled escape hatch.

Use AI SDK subagents when context isolation, parallelism, or tool isolation justify the latency/complexity.

## Required Public Concepts

### Model Policy

Add model aliases for:

- `flow.architect.strong`
- `flow.architect.fast`
- `flow.repair`
- `worker.research`
- `worker.writer`
- `worker.code`
- `worker.image`
- `worker.voice.transcribe`
- `worker.voice.speech`
- `worker.video`
- `worker.verifier`

Each alias needs:

- backend: `gateway`, `openrouter`, or `direct`;
- model ID;
- model type;
- required capabilities;
- cost tier;
- latency tier;
- context window;
- fallback models;
- provider routing options;
- data policy.

### Subagent Policy

Each subagent needs:

- worker ID;
- capability list;
- model alias;
- instructions;
- scoped tools;
- allowed artifact outputs;
- step limit;
- budget;
- reporting mode;
- approval boundary;
- failure behavior.

### Reporting

Use preliminary tool results for progress only.

Use final subagent output for `FlowTaskReport`.

Use `toModelOutput` to summarize subagent output for parent-agent context.

## Gateway-First Checklist

- [x] Add model metadata types.
- [x] Add alias registry.
- [ ] Add Gateway metadata resolver.
- [x] Add static resolver for tests.
- [ ] Normalize Gateway model type/tags/pricing/context.
- [x] Validate required capabilities.
- [x] Expose static model policy resolver.
- [ ] Add cost/usage/generation metadata shape.
- [ ] Capture Gateway generation IDs where available.

Current implementation:

- `packages/ai/src/models/index.ts` owns model policy schemas, default aliases, static resolution,
  and capability validation.
- `packages/ai/tests/models/model-registry.test.ts` covers required aliases, Gateway-first backend
  choices, direct-provider audio caveats, unknown aliases, duplicate aliases, and capability checks.
- Live Gateway model discovery, pricing normalization, and generation metadata are Phase C.

## OpenRouter Checklist

Gate: do not implement before Gateway-first tests pass.

- [ ] Re-check OpenRouter docs and pricing before adding code.
- [ ] Decide SDK versus OpenAI-compatible fetch.
- [ ] Add backend adapter behind the same policy interface.
- [ ] Normalize OpenRouter model metadata.
- [ ] Document platform fee and BYOK fee behavior.
- [ ] Keep OpenRouter imports out of apps.

## Direct Provider Checklist

Gate: implement only for a named provider feature or enterprise contract.

- [ ] Add direct provider adapter interface.
- [ ] Add package-owned env contract.
- [ ] Keep provider SDK imports package-local.
- [ ] Add tests per direct provider adapter.
- [ ] Add data retention/logging policy.

## Subagent Build Checklist

- [ ] Define `FlowWorkerDefinition`.
- [ ] Define `FlowWorkerRegistry`.
- [ ] Define `FlowWorkerRouter`.
- [ ] Create `ToolLoopAgent` factory from worker policy.
- [ ] Scope tools by compiled `.flow` plan.
- [ ] Forward active abort signals.
- [ ] Use explicit stop conditions.
- [ ] Keep approval-required external actions outside subagent direct execution.
- [ ] Map output to `FlowTaskReport`.
- [ ] Map progress to EventContextPackets.
- [ ] Add five-worker fixture.

## Validation

Run after package implementation:

```bash
pnpm --filter @repo/ai typecheck
pnpm exec vitest run --project @repo/ai
pnpm boundaries:cruise --focus packages/ai
pnpm --filter @repo/flow typecheck
pnpm test
```
