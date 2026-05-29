# MADR-099: Use AI SDK Subagents With Gateway-First Model Routing

Status: Accepted

Date: 2026-05-28

## Context

The platform needs an AI layer that can:

- generate and repair `.flow` source;
- choose specialized workers/subagents;
- run text, research, code, image, voice, and video work;
- stream progress;
- keep costs controlled;
- preserve durable workflow execution outside browser streams;
- avoid hardcoding one provider/model into the product.

The repo already has `@repo/ai` as the AI SDK boundary and `@repo/flow` as the workflow/compiler boundary, but the flow-aware AI runtime is not implemented yet.

The user asked whether we should use AI SDK subagents, Vercel AI Gateway, OpenRouter, or direct provider API keys.

## Decision

Use **Vercel AI Gateway first** for production model access in `@repo/ai`, behind a provider-neutral model registry and policy resolver.

Use **AI SDK subagents** for scoped worker execution when context isolation, specialist tools, or parallel work justify the overhead.

Keep **OpenRouter as a secondary adapter** for broader model catalog, experimentation, fallback benchmarking, and models not available through Gateway.

Keep **direct provider keys as an escape hatch**, mainly for provider-specific features, enterprise contracts, data residency, private deployments, or missing gateway support.

Do not hardcode one orchestrator model. Define model aliases such as:

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

At runtime, resolve aliases through a policy object that includes provider backend, model ID, model type, capabilities, cost tier, fallback models, provider order/filtering, and data policy.

## Consequences

Positive:

- Fits Vercel + Next.js + AI SDK v6 architecture.
- Avoids app routes importing many provider SDKs.
- Uses Gateway OIDC and Vercel observability for production.
- Keeps the door open for OpenRouter/direct providers without changing `.flow`.
- Makes cost/quality/latency a policy decision instead of scattered constants.
- Supports subagent context isolation while keeping `.flow` as the orchestration source of truth.

Negative:

- Requires a real model registry and resolver before advanced AI tasks are production-ready.
- Gateway model availability/pricing must be checked dynamically or via refreshed metadata.
- OpenRouter/direct provider support must be adapter-based, not ad hoc, which adds initial design work.
- Subagents add latency and complexity; they should not be used for trivial tasks.

## Alternatives Considered

### Use Vercel AI Gateway Only

Rejected as too narrow long term. Gateway should be default, but OpenRouter/direct escape hatches are useful for unsupported models, experiments, contracts, and provider-specific capabilities.

### Use OpenRouter First

Rejected for MVP default. OpenRouter has strong catalog/routing, but this repo is Vercel/AI SDK centered. Gateway provides native AI SDK use, Vercel OIDC, Vercel dashboard observability, and no markup on paid-tier model usage/BYOK. OpenRouter remains valuable as a secondary adapter.

### Use Direct Provider Keys For Every Model

Rejected for MVP default. Direct keys multiply env secrets, SDKs, dashboards, provider-specific billing, rate limits, fallback logic, and app-level integration risk. Direct providers remain a necessary escape hatch behind the model policy boundary.

### Build Custom Subagent Runtime Without AI SDK Subagents

Rejected for now. AI SDK already provides `ToolLoopAgent`, tools, stop conditions, streaming, structured output, and subagent patterns. Our custom logic should be `.flow` policy, durable execution, persistence, permissions, and reporting, not reinvented model/tool loops.

## Evidence

- `https://ai-sdk.dev/docs/agents/subagents`: Subagents are parent-agent tool delegation with isolated model, instructions, tools, context, optional streaming progress, and `toModelOutput`.
- `https://ai-sdk.dev/docs/agents/loop-control`: AI SDK agent loops support stop conditions and `prepareStep` for dynamic settings.
- `https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`: Tools use `inputSchema`; approval policy is now generation/agent-level `toolApproval`.
- `https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway`: AI Gateway is built into AI SDK model strings and supports dynamic model discovery.
- `https://vercel.com/docs/ai-gateway/pricing`: Vercel AI Gateway has no markup in paid tier and no markup/fee for BYOK; rates are based on provider list price.
- `https://vercel.com/docs/ai-gateway/models-and-providers/model-fallbacks`: Gateway supports model fallback arrays.
- `https://vercel.com/docs/ai-gateway/models-and-providers/provider-filtering-and-ordering`: Gateway supports provider order/filter controls and default uptime/latency routing.
- `https://vercel.com/docs/ai-gateway/capabilities/observability`: Gateway exposes TTFT, token counts, spend, request summaries, logs, and cost.
- `https://openrouter.ai/pricing`: OpenRouter pay-as-you-go has a 5.5% platform fee when buying credits, no inference markup, and broad model/provider support.
- `https://openrouter.ai/docs/faq`: OpenRouter states no prompt/completion logging by default, pass-through inference pricing, and BYOK fee after free request limits.
- `https://openrouter.ai/docs/guides/routing/provider-selection`: OpenRouter has strong provider routing controls by price, throughput, latency, and BYOK priority.
- Local `ai-main` files inspected:
  - `content/docs/03-agents/06-subagents.mdx`
  - `content/providers/01-ai-sdk-providers/00-ai-gateway.mdx`
  - `architecture/provider-abstraction.md`
  - `architecture/stream-text-loop-control.md`

## Impacted Packages

- `@repo/ai`: owns model registry, Gateway resolver, subagent runner, FlowArchitectAgent, repair agent, TaskReport mapping.
- `@repo/flow`: owns worker/task policy in AST/semantic validation and execution plan, but does not import AI SDK or Gateway.
- `@repo/database`: persists model usage, generation IDs, cost/usage metadata, run events, task reports.
- `@repo/connectors`: owns external app sessions/tools, not model routing.
- `@repo/sandbox`: owns sandbox execution, not model selection.
- `apps/app`: consumes package APIs for UI/API; does not import provider SDKs directly.

## Validation Checklist

- [ ] `@repo/ai/models` defines provider-neutral model aliases and capability metadata.
- [ ] Gateway resolver can fetch or load model metadata and reject unknown model IDs.
- [ ] Model aliases include cost tier, latency tier, model type, context window, capabilities, and data policy.
- [ ] Orchestrator/worker code uses aliases, not hardcoded provider strings.
- [ ] `.flow` semantic validation can restrict allowed model aliases per task/worker.
- [ ] Subagent runner scopes tools and instructions per compiled worker policy.
- [ ] Preliminary tool results are treated as progress, not durable task completion.
- [ ] Final subagent output maps to `FlowTaskReport` and EventContextPackets.
- [ ] Gateway generation IDs/cost/usage are captured where available.
- [ ] OpenRouter adapter is introduced only after Gateway-first tests pass.
- [ ] Direct provider SDKs are not imported by `apps/app`.
