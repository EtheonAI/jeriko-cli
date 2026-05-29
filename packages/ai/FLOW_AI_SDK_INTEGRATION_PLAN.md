# `@repo/ai` `.flow` AI SDK Integration Plan

Date: 2026-05-27

Status: pending after `@repo/flow` execution plan shape stabilizes.

Related detailed plan: `packages/ai/SUBAGENTS_GATEWAY_MODEL_ROUTING_PLAN.md`

Central decision: `docs/ai-workflow-os/07-madr/MADR-099-ai-sdk-subagents-and-gateway-first-model-routing.md`

## Role

`@repo/ai` owns AI SDK primitives, model/provider policy, flow architect/repair agents, worker/subagent runners, task report mapping, and platform tool adapters.

It must not own React workflow UI, database persistence, Inngest provider integration, or sandbox provider implementation.

## Current State

Implemented:

- AI SDK v6 package boundary.
- `ToolLoopAgent` and `stepCountIs` exports.
- server/message/media/model/retrieval/observability helpers.
- server-only `@repo/ai/tools`.
- connector-to-AI-SDK policy bridge.

Missing:

- flow architect agent;
- flow repair agent;
- worker registry;
- worker router;
- model policy resolver;
- Gateway-first model metadata resolver;
- OpenRouter secondary adapter evaluation;
- direct provider escape-hatch adapter shape;
- scoped tool resolver;
- `ai_task` runner;
- subagent reporting adapter;
- TaskReport/ECP mapper.

## Model Routing Decision

Use Vercel AI Gateway first behind `@repo/ai` model aliases. Keep OpenRouter as a secondary adapter and direct provider keys as an escape hatch.

Do not hardcode one orchestrator model. Resolve aliases such as:

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

Each alias must include backend, model ID, model type, capabilities, cost tier, latency tier, context window, fallback policy, provider routing, and data policy.

## Build Checklist

- [ ] Define `FlowArchitectAgent` output schema.
- [ ] Generate `.flow` source, not AST JSON.
- [ ] Add diagnostics-to-repair prompt helper.
- [ ] Define worker registry types.
- [ ] Define worker routing score inputs.
- [ ] Define model alias and capability policy types.
- [ ] Add Gateway-first model resolver.
- [ ] Add static model metadata fixtures for tests.
- [ ] Defer OpenRouter adapter until Gateway resolver tests pass.
- [ ] Keep direct provider SDK imports package-local when needed.
- [ ] Resolve task worker/tool scopes from compiled plan metadata.
- [ ] Create AI SDK `ToolLoopAgent` per worker policy.
- [ ] Support fixed worker and dynamic `worker_policy`.
- [ ] Map agent output to `FlowTaskReport`.
- [ ] Map progress to EventContextPackets.
- [ ] Forward abort signal for active model calls.
- [ ] Do not treat abort signal as durable run cancellation.
- [ ] Add tests with mock model/tool execution.

## Five-Subagent Target

The first integration fixture should cover:

- researcher;
- writer;
- image worker;
- code worker;
- verifier.

Each subagent must receive only its scoped tools and instructions.
