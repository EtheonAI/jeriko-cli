# AI Orchestration, Subagents, and Model Routing Phase Plan

Date: 2026-05-28

Status: planning gate for `@repo/ai` flow integration.

Related MADR: [`MADR-099`](../07-madr/MADR-099-ai-sdk-subagents-and-gateway-first-model-routing.md)

Related research: [`2026-05-28-ai-sdk-subagents-gateway-openrouter-model-routing.md`](../09-research/2026-05-28-ai-sdk-subagents-gateway-openrouter-model-routing.md)

## Goal

Build the AI layer for `.flow` without turning the app route into the runtime.

Target shape:

```text
user prompt
-> FlowArchitectAgent drafts .flow source
-> @repo/flow parses/validates/compiles
-> runtime executes durable run
-> @repo/ai resolves model aliases and subagents
-> scoped tools/connectors/sandbox execute through package boundaries
-> TaskReports + EventContextPackets + artifacts persist
-> apps/app renders run state and resumable stream/event progress
```

## Non-Goals

- Do not implement app UI in this phase plan.
- Do not import Inngest, Vercel Workflow, or provider SDKs into `@repo/flow`.
- Do not add OpenRouter before Gateway-first model registry and tests exist.
- Do not let subagents directly perform approval-required external actions.
- Do not hardcode one permanent orchestrator model.

## Phase A: Research And Decision Gate

Status: complete as documentation.

Checklist:

- [x] Read AI SDK `llms.txt`.
- [x] Read AI SDK subagent docs.
- [x] Read AI SDK loop-control docs.
- [x] Read AI SDK tool-calling and structured-output docs.
- [x] Read AI SDK media docs for image, transcription, speech, and video.
- [x] Read Vercel AI Gateway docs, pricing, model fallback, provider filtering, observability.
- [x] Read Gateway model API sample for model metadata shape.
- [x] Read local `ai-main` subagent, gateway, provider abstraction, and stream loop architecture files.
- [x] Research OpenRouter pricing, FAQ, BYOK, and routing.
- [x] Record Gateway-first, OpenRouter-secondary, direct-provider-escape-hatch decision in MADR-099.

Evidence files:

- `docs/ai-workflow-os/09-research/2026-05-28-ai-sdk-subagents-gateway-openrouter-model-routing.md`
- `docs/ai-workflow-os/07-madr/MADR-099-ai-sdk-subagents-and-gateway-first-model-routing.md`
- `packages/ai/SUBAGENTS_GATEWAY_MODEL_ROUTING_PLAN.md`

## Phase B: Model Registry Contracts

Owner: `@repo/ai/models`

Status: complete for static package contracts on 2026-05-28. Live Gateway validation remains Phase C.

Build:

- model alias types;
- model capability enum;
- provider backend enum: `gateway`, `openrouter`, `direct`;
- model type enum: `language`, `embedding`, `rerank`, `image`, `transcription`, `speech`, `video`;
- cost/latency/context/data-policy metadata;
- fallback model policy;
- provider ordering/filtering policy;
- resolver result type with normalized model metadata.

Checklist:

- [x] Define model alias strings through registry entries.
- [x] Define `ModelCapability`.
- [x] Define `ModelBackend`.
- [x] Define `ModelPolicy`.
- [x] Define `ResolvedModelPolicy`.
- [x] Add static default aliases for roles, without hardcoding model IDs in app code.
- [x] Add tests for alias validation.
- [x] Add tests for unknown alias rejection.
- [x] Add tests for capability matching.

Validation:

```bash
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs --filter @repo/ai typecheck
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs --filter @repo/ai test
```

Result: passed `@repo/ai` typecheck and 3 test files / 14 tests. Default shell `pnpm`
still fails through stale Corepack/Node `v22.13.1`, so package validation used the repo's
working Node `v22.22.1` and pinned pnpm `11.3.0`.

## Phase C: Gateway Resolver

Owner: `@repo/ai/models`

Build:

- Gateway metadata fetch/cache interface;
- normalized model metadata adapter;
- current model ID validation;
- support for Gateway `providerOptions.gateway.models`, `order`, `only`, and data-policy options;
- generation metadata capture shape for cost/usage.

Checklist:

- [ ] Add `GatewayModelMetadataProvider` interface.
- [ ] Add live provider and static-test provider.
- [ ] Normalize Gateway model API fields into internal model metadata.
- [ ] Reject aliases whose target model is missing.
- [ ] Match required capabilities against tags/model type.
- [ ] Store fallback models in policy, not scattered in agent code.
- [ ] Add tests with fixture model metadata.
- [ ] Document when live refresh happens and where cache lives.

Validation:

```bash
pnpm --filter @repo/ai typecheck
pnpm exec vitest run --project @repo/ai
```

## Phase D: Flow Architect And Repair Agents

Owner: `@repo/ai/agents`

Build:

- `FlowArchitectAgent`;
- `FlowRepairAgent`;
- prompt/context builders;
- `.flow` source output schema;
- diagnostics-to-repair input mapper;
- no direct AST JSON output as the canonical product artifact.

Checklist:

- [ ] Architect accepts user goal, workspace context, allowed capabilities, and policy.
- [ ] Architect emits `.flow` source plus explanation/assumptions.
- [ ] Repair agent accepts `.flow` source and `@repo/flow` diagnostics.
- [ ] Repair agent emits patched `.flow` source.
- [ ] Use `generateText`/`streamText` with `Output.object` only for wrapper metadata, not as replacement for `.flow`.
- [ ] Add tests with mock model.
- [ ] Add fixtures for invalid `.flow` repair.

Validation:

```bash
pnpm --filter @repo/ai typecheck
pnpm exec vitest run --project @repo/ai
pnpm --filter @repo/flow typecheck
```

## Phase E: Worker And Subagent Registry

Owner: `@repo/ai/agents`

Build:

- worker/subagent definitions;
- scoped tool resolver;
- subagent reporting policy;
- task budget/step limit;
- `ToolLoopAgent` factory;
- final output summarization policy with `toModelOutput`.

Checklist:

- [ ] Define `FlowWorkerDefinition`.
- [ ] Define `FlowWorkerCapability`.
- [ ] Define reporting modes: `none`, `final`, `milestone`, `every_task`, `on_failure`, `full_trace`, `scheduled`.
- [ ] Enforce tool scope per worker.
- [ ] Enforce allowed model aliases per worker.
- [ ] Set explicit stop conditions.
- [ ] Forward abort signals for active calls.
- [ ] Do not use subagents for approval-required side effects.
- [ ] Add five-subagent fixture: researcher, writer, image worker, code worker, verifier.

Validation:

```bash
pnpm --filter @repo/ai typecheck
pnpm exec vitest run --project @repo/ai
pnpm boundaries:cruise --focus packages/ai
```

## Phase F: TaskReport And ECP Mapping

Owner: `@repo/ai`, dependent on `@repo/flow`

Build:

- map model/tool/subagent output to `FlowTaskReport`;
- map progress to EventContextPackets;
- map artifacts to runtime artifact references;
- capture model usage/cost metadata.

Checklist:

- [ ] Add `AiTaskRunnerResult`.
- [ ] Map success/failure/degraded states.
- [ ] Map tool calls and tool outputs into report evidence.
- [ ] Map preliminary tool results to progress events only.
- [ ] Capture Gateway generation ID where available.
- [ ] Capture usage, cost estimate, model ID, provider, and fallback route.
- [ ] Add tests against `@repo/flow` TaskReport contracts.

Validation:

```bash
pnpm --filter @repo/ai typecheck
pnpm --filter @repo/flow typecheck
pnpm exec vitest run --project @repo/ai --project @repo/flow
```

## Phase G: Media Capabilities

Owner: `@repo/ai/media`, integrated later by `apps/app`

Build:

- voice transcription policy;
- speech generation policy;
- image generation policy;
- video generation policy;
- artifact metadata mapping.

Checklist:

- [ ] Voice-to-text uses `experimental_transcribe` behind server auth, size limits, and timeout.
- [ ] Text-to-speech uses `experimental_generateSpeech` behind server auth and artifact storage.
- [ ] Image generation uses model policy and persists files as artifacts.
- [ ] Video generation is treated as long-running artifact task, not chat-only output.
- [ ] Media model aliases are separate from language model aliases.
- [ ] Add provider capability checks before enabling a media task.

Validation:

```bash
pnpm --filter @repo/ai typecheck
pnpm exec vitest run --project @repo/ai
```

## Phase H: OpenRouter Adapter Evaluation

Owner: `@repo/ai/models`

Gate: only after Gateway-first registry and tests pass.

Build/evaluate:

- OpenRouter backend adapter shape;
- OpenRouter model metadata normalization;
- OpenRouter routing controls;
- cost/fee documentation;
- whether SDK dependency is needed or OpenAI-compatible fetch is enough.

Checklist:

- [ ] Confirm latest OpenRouter docs and model API before implementation.
- [ ] Confirm pricing/fee model again before adopting.
- [ ] Add adapter behind `ModelBackend = "openrouter"`.
- [ ] Keep OpenRouter out of app routes.
- [ ] Add tests with static metadata fixtures.
- [ ] Do not make OpenRouter the default unless Gateway fails product requirements.

## Phase I: Direct Provider Escape Hatch

Owner: `@repo/ai/models`

Gate: only when a specific provider feature/contract requires it.

Checklist:

- [ ] Add direct provider adapter interface.
- [ ] Document required env keys through `@repo/env`/package env contract.
- [ ] Keep provider SDK imports inside package adapter code.
- [ ] Add provider-specific tests.
- [ ] Add data policy and logging policy per provider.

## Phase J: Runtime And App Wiring

Owner: runtime package/app phase, not `@repo/ai` alone.

Dependencies:

- `@repo/flow` execution planner exists.
- `@repo/database` run/task/event/artifact schema exists.
- Inngest/runtime adapter exists.
- `@repo/connectors` and `@repo/sandbox` integration contracts exist.

Checklist:

- [ ] API route starts a workflow run, not a long-lived app route loop.
- [ ] Runtime invokes `@repo/ai` task runner by compiled plan.
- [ ] UI reconnects by `runId` and event cursor.
- [ ] Stop/Cancel emits durable cancellation event.
- [ ] Browser refresh/tab close only disconnects UI stream.
- [ ] Tool approvals resume durable runtime, not subagent-internal approval.

## Final Acceptance

This AI orchestration layer is ready only when:

- [ ] model aliases are policy-driven;
- [ ] Gateway-first resolver is tested;
- [ ] subagent runner is scoped and tested;
- [ ] `.flow` compiler validates worker/tool/model permissions;
- [ ] TaskReports/ECPs persist;
- [ ] app UI can reconnect to durable runs;
- [ ] Gateway/OpenRouter/direct provider choice is hidden behind `@repo/ai/models`;
- [ ] no app route imports provider SDKs directly.
