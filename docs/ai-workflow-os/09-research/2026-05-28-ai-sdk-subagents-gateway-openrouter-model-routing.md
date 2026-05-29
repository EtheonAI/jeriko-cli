# AI SDK Subagents, Gateway, OpenRouter, and Model Routing Research

Date researched: 2026-05-28

Scope: `@repo/ai`, `.flow` AI tasks, subagents, model policy, Vercel AI Gateway, OpenRouter, and direct provider keys.

This note is research only. It does not claim the AI package is fully implemented.

## Question

What should power the AI layer for an autonomous `.flow` platform?

- AI SDK subagents or custom subagent code?
- Vercel AI Gateway, OpenRouter, direct provider API keys, or a mix?
- How should the orchestrator choose models for text, tools, code, image, voice, and video tasks?
- How should subagents stream progress and report back to the main orchestrator without bloating context?

## Sources Checked

| Source                                                                                           | Type                    | Claim Used                                                                                                                                            |
| ------------------------------------------------------------------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://ai-sdk.dev/llms.txt`                                                                    | Official docs index     | AI SDK publishes a docs index and recommends targeted pages before full-doc loading.                                                                  |
| `https://ai-sdk.dev/docs/agents/subagents`                                                       | Official docs           | Subagents are parent-agent tool delegation: each subagent has its own model, instructions, tools, and context; `toModelOutput` controls parent input. |
| `https://ai-sdk.dev/docs/agents/loop-control`                                                    | Official docs           | `ToolLoopAgent` stops on non-tool finish, missing execute, approval requirement, or stop condition; `prepareStep` can switch models/tools/messages.   |
| `https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`                                     | Official docs           | Tools use `inputSchema`; approval should be configured with `toolApproval`; preliminary tool results stream partial progress.                         |
| `https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data`                                 | Official docs           | AI SDK v6 structured output uses `generateText`/`streamText` with `Output.object` or other `Output.*` helpers.                                        |
| `https://ai-sdk.dev/docs/ai-sdk-core/image-generation`                                           | Official docs           | `generateImage` handles image models; some language models can produce image files through `generateText`.                                            |
| `https://ai-sdk.dev/docs/ai-sdk-core/transcription`                                              | Official docs           | `experimental_transcribe` supports bounded downloads, abort signals, headers, and warnings.                                                           |
| `https://ai-sdk.dev/docs/ai-sdk-core/speech`                                                     | Official docs           | `experimental_generateSpeech` supports abort signals, headers, and warnings.                                                                          |
| `https://ai-sdk.dev/docs/ai-sdk-core/video-generation`                                           | Official docs           | AI SDK has a video generation model abstraction; video jobs are longer-running and should be workflow/artifact tasks, not chat-only tasks.            |
| `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams`                                       | Official docs           | Resumable streams require app-owned storage, Redis, POST/GET endpoints, and active stream tracking.                                                   |
| `https://vercel.com/docs/ai-gateway`                                                             | Official docs           | AI Gateway provides one endpoint for hundreds of models, budgets, usage monitoring, load balancing, and fallbacks.                                    |
| `https://vercel.com/docs/ai-gateway/pricing`                                                     | Official docs           | AI Gateway uses pay-as-you-go credits with no markup; paid tier is zero markup including BYOK; rates are based on provider list price.                |
| `https://vercel.com/docs/ai-gateway/models-and-providers/model-fallbacks`                        | Official docs           | Gateway supports fallback model arrays through `providerOptions.gateway.models`.                                                                      |
| `https://vercel.com/docs/ai-gateway/models-and-providers/provider-filtering-and-ordering`        | Official docs           | Gateway supports provider `order` and `only`; default routing uses recent uptime and latency.                                                         |
| `https://vercel.com/docs/ai-gateway/capabilities/observability`                                  | Official docs           | Gateway observability includes TTFT, token counts, spend, request summaries, logs, export, and per-request cost.                                      |
| `https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway`                                       | Official AI SDK docs    | Plain `creator/model-name` strings use AI Gateway; `gateway.getAvailableModels()` exposes current models and pricing metadata.                        |
| `https://ai-gateway.vercel.sh/v1/models`                                                         | Official model API      | Current model list includes IDs, type, tags, context windows, pricing, and capabilities such as `tool-use`, `vision`, `file-input`, `web-search`.     |
| `https://github.com/vercel/ai/blob/main/skills/use-ai-sdk/references/ai-gateway.md`              | Official repo reference | The Vercel AI repo skill explicitly says to fetch current model IDs and not use model IDs from memory.                                                |
| `/Users/khaleelmusleh/Downloads/ai-main/content/docs/03-agents/06-subagents.mdx`                 | Local official source   | Local source matches official subagent docs, including preliminary results and context isolation caveats.                                             |
| `/Users/khaleelmusleh/Downloads/ai-main/content/providers/01-ai-sdk-providers/00-ai-gateway.mdx` | Local official source   | Local source documents Gateway auth, dynamic model discovery, credits, generation lookup, tools, and spend reporting.                                 |
| `/Users/khaleelmusleh/Downloads/ai-main/architecture/provider-abstraction.md`                    | Local architecture      | AI SDK separates model types: language, embedding, image, reranking, transcription, speech, and video.                                                |
| `/Users/khaleelmusleh/Downloads/ai-main/architecture/stream-text-loop-control.md`                | Local architecture      | Multi-step streams execute tools, inject results, run stop gates, handle aborts, and stitch step streams.                                             |
| `https://openrouter.ai/pricing`                                                                  | Official docs           | OpenRouter pay-as-you-go has a 5.5% platform fee when purchasing credits; token pricing is per model; failed fallback attempts are not billed.        |
| `https://openrouter.ai/docs/faq`                                                                 | Official docs           | OpenRouter says inference pricing is pass-through with no inference markup, but credit purchases have a fee and BYOK has a fee after free limits.     |
| `https://openrouter.ai/docs/guides/routing/provider-selection`                                   | Official docs           | OpenRouter supports provider routing by price/latency/throughput, provider ordering, fallback control, and BYOK prioritization.                       |
| `https://openrouter.ai/docs/guides/overview/auth/byok`                                           | Official docs           | OpenRouter BYOK lets users attach provider keys while keeping the unified router; provider responses can be inspected for debugging.                  |

## Evidence

### AI SDK Subagents

AI SDK subagents are not a separate runtime. They are a parent-agent delegation pattern implemented as a tool call. The parent agent receives a tool that invokes another `ToolLoopAgent`. The subagent gets its own model, instructions, tools, and context window.

This fits `.flow` because `.flow` can compile:

```text
.flow worker/task policy
-> scoped subagent definition
-> scoped AI SDK tool set
-> ToolLoopAgent execution
-> TaskReport + EventContextPacket
```

The key advantage is context isolation. The subagent can spend many tokens doing research/code/image planning, while the parent only receives a summary through `toModelOutput`.

The key cost is latency and complexity. Use subagents for context-heavy, parallel, tool-isolated, or specialist work. Do not use subagents for simple single-step prompts.

### Preliminary Tool Results

Preliminary tool results are useful for UI progress and parent-agent visibility. An async generator tool can `yield` interim output. Each yield replaces the prior output, so the implementation must accumulate the full UI message before yielding.

For this platform:

- preliminary results are UI/progress signals;
- final `TaskReport` is the durable source of truth;
- preliminary output must not unblock downstream `.flow` tasks unless the compiled plan explicitly allows streaming dependencies;
- `toModelOutput` should summarize final output for the parent agent and avoid feeding the full trace into the orchestrator by default.

### Tool Approval Caveat

AI SDK docs now say approval should be configured with `toolApproval` on generation/agent calls. Older `needsApproval` still works but is deprecated.

Important caveat: AI SDK subagent docs say subagent tools cannot use approval flows. For our product, approval must sit outside the subagent:

```text
subagent proposes action
-> TaskReport/tool proposal
-> runtime policy checks approval
-> human approval task/event
-> approved connector/sandbox/platform tool executes through runtime
```

Do not let subagents directly execute high-risk external actions that require user approval.

### AI Gateway Cost And Fit

Vercel AI Gateway official pricing says:

- no markup on paid-tier model usage;
- rates are based on provider list price;
- BYOK has no Gateway markup/fee;
- every Vercel team starts with monthly free credits until paid credits are purchased;
- after paid credits are purchased, the monthly free credit no longer applies.

This means AI Gateway is not automatically cheaper than direct provider billing for every path, but it is economically acceptable as a default because it does not add model markup and it reduces integration/build cost.

Gateway is especially strong for this repo because:

- the app is Vercel/Next/AI SDK centered;
- plain `provider/model` strings work through AI SDK;
- OIDC can remove long-lived provider keys on Vercel deployments;
- Gateway exposes model/pricing metadata, generation IDs, credits, and spend reports;
- provider fallback/order policy is first-class;
- observability lives in the Vercel dashboard.

### OpenRouter Cost And Fit

OpenRouter official docs say:

- no inference markup on provider token pricing;
- pay-as-you-go credit purchase has a 5.5% platform fee with a minimum;
- BYOK has 1M free requests/month, then a 5% fee of equivalent OpenRouter cost;
- broad model catalog and provider routing are strong differentiators;
- OpenRouter is OpenAI-compatible and supports provider selection/fallback/routing.

OpenRouter is useful as a secondary adapter, especially for:

- models not available through AI Gateway;
- experimental free/open-source model routing;
- provider/latency/price experimentation;
- broader model discovery and benchmarking.

But OpenRouter should not be the primary MVP path if the production app is deployed on Vercel and already uses AI SDK v6, because Gateway is a native default path with OIDC, zero-markup paid credits, built-in Vercel observability, and less integration surface.

### Direct Provider Keys

Direct provider keys are valuable when:

- a provider feature is not available through Gateway/OpenRouter;
- enterprise contracts, data-processing agreements, private models, or custom deployments require direct use;
- a provider-specific SDK exposes tools/options not proxyable through a gateway;
- latency, data residency, or compliance requires direct provider routing.

Direct keys should not be the default for MVP because they multiply:

- env keys;
- provider SDK dependencies;
- auth/rotation work;
- rate-limit/billing dashboards;
- fallback logic;
- cost attribution;
- compliance review.

Use direct keys as an escape hatch behind the same model policy interface, not as app-level ad hoc imports.

## Recommended Direction

Use **Vercel AI Gateway first** behind a provider-neutral model registry inside `@repo/ai`.

Keep **OpenRouter as a secondary provider adapter**, not the default. Add it after the Gateway-first model registry is real and tests prove we can swap provider backends without changing `.flow`.

Keep **direct provider keys as an enterprise/provider-specific escape hatch**. Direct provider code should live behind `@repo/ai/models` or a dedicated provider adapter, not inside app routes.

## Model Policy Shape

Do not hardcode one permanent orchestrator model. Store policy aliases and resolve them at runtime:

```text
flow.architect.strong
flow.architect.fast
flow.repair
worker.research
worker.writer
worker.code
worker.image
worker.voice.transcribe
worker.voice.speech
worker.video
worker.verifier
```

Each alias should resolve to:

```text
provider backend: gateway | openrouter | direct
model id
model type: language | embedding | image | speech | transcription | video | rerank
capabilities: tool-use, vision, file-input, web-search, structured-output, image-generation, speech, transcription, video
cost tier
latency tier
context window
fallback models
provider ordering/filtering
data policy requirements
```

The `.flow` compiler should not allow arbitrary model IDs from user source without policy validation. Users can request quality/cost/capability intent; the runtime resolves the actual model through policy.

## Orchestrator Recommendation

The orchestrator should be a strong reasoning/tool-use model selected by policy, not hardcoded in source.

For MVP, use a `flow.architect.strong` alias and resolve it through Gateway's current model list. Candidate characteristics:

- language model;
- tool-use;
- reasoning;
- file input and vision if workflow authoring may inspect uploaded files/screenshots;
- large enough context for user goal + repo/platform docs + tool manifests;
- strong structured output behavior for `.flow` draft/repair loops;
- affordable enough to use for planning, but not every task.

The orchestrator's job:

- interpret user goal;
- propose `.flow` source;
- choose worker roles from a registry;
- request missing permissions/connections;
- repair diagnostics;
- summarize run state;
- decide when to wake reflection, not run every low-level task.

It should not:

- directly execute external side effects;
- hold the entire workflow run as chat context;
- bypass `.flow` semantic validation;
- replace Inngest/runtime durability.

## Subagent Capability Model

Subagents should be declared/compiled as capabilities, not as freeform chat personas.

Initial capabilities:

- `research`: web/search/retrieval/read-only connectors.
- `writer`: text generation, style/brand application, summarization.
- `code`: sandbox/file/code execution, tests, patches, package docs.
- `image`: image prompt generation plus image model/tool routing.
- `voice_transcribe`: audio to text through `experimental_transcribe`.
- `voice_speech`: text to speech through `experimental_generateSpeech`.
- `video`: long-running video generation through AI SDK video/gateway/direct adapter, persisted as an artifact task.
- `verifier`: validation, critique, policy checks, citations, tests.

Each subagent needs:

- scoped tool list;
- budget;
- step limit;
- allowed output artifact types;
- reporting mode;
- approval policy;
- allowed model aliases;
- data policy;
- failure behavior.

## `.flow` Impact

`.flow` should express the product intent:

```flow
worker researcher {
  capabilities = ["research", "web_search"]
  model = "worker.research"
  report = "milestone"
}

task gather_sources {
  type = "ai_task"
  worker = researcher
  tools = ["web.search", "storage.read"]
  output = ["artifacts/sources.json"]
}
```

Compiler/runtime layers resolve this into:

```text
worker symbol
-> capability policy
-> model alias
-> Gateway/OpenRouter/direct adapter
-> scoped AI SDK ToolSet
-> TaskReport schema
-> run event stream
```

## Integration With Runtime

AI SDK stream abort and workflow cancellation are separate:

- `abortSignal` cancels the active model/tool stream.
- `.flow` durable cancellation is a run event checked by the runtime between steps and before side effects.
- browser refresh/tab close must not cancel durable workflow work.
- AI SDK resumable streams help UI reconnect, but workflow run truth is the database event log.

## Open Questions

- Which exact model aliases should be default after querying `gateway.getAvailableModels()` in the implementation phase?
- Do Gateway video APIs cover all video modes we need, or do we need direct provider/fal/Replicate adapters for v1?
- Do Gateway built-in search tools replace part of our internal search stack, or are they only AI research tools?
- Which user-facing plans get which model aliases and budgets?
- Should OpenRouter be added in MVP or kept as a post-MVP model-provider adapter?

## Implementation Checklist

- [ ] Add `@repo/ai/models` model registry types.
- [ ] Add model alias config for orchestrator, repair, researcher, writer, code, image, voice, video, verifier.
- [ ] Add Gateway resolver that validates aliases against live model metadata or a cached snapshot.
- [ ] Add cost/capability policy fields: model type, capabilities, context window, cost tier, data policy, fallback models.
- [ ] Add OpenRouter adapter only after Gateway resolver is tested.
- [ ] Add direct-provider adapter interface without adding direct provider SDKs to app routes.
- [ ] Add `FlowArchitectAgent` that emits `.flow` source, not AST JSON.
- [ ] Add subagent runner that maps `.flow` worker policy to `ToolLoopAgent`.
- [ ] Use preliminary tool results only for progress.
- [ ] Map final agent output to `FlowTaskReport`.
- [ ] Persist generation ID/cost/usage metadata when Gateway is used.
- [ ] Add tests for model alias resolution, capability filtering, fallback policy, and subagent reporting.
