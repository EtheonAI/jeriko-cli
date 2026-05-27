# AI SDK v6 Reference Notes

Date: 2026-05-26

Purpose: durable internal reference for how Jeriko should use Vercel AI SDK v6 while building a custom product UI.

## Primary Documentation

| Area              | Source                                                                            | Platform Takeaway                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM-readable docs | `https://ai-sdk.dev/llms.txt`                                                     | Use targeted docs/search and markdown pages; do not rely on memory for AI SDK changes.                                                                                 |
| Introduction      | `https://ai-sdk.dev/docs/introduction`                                            | AI SDK is the provider-agnostic TypeScript toolkit. Core owns generation/tools/agents; UI owns framework hooks.                                                        |
| Cookbook guides   | `https://ai-sdk.dev/cookbook/guides`                                              | Cookbook covers RAG agents, multi-modal agents, computer use, custom memory, human-in-the-loop, custom body, visual UI, tools, MCP, token usage, and caching patterns. |
| Advanced index    | `https://ai-sdk.dev/docs/advanced`                                                | Advanced topics include stopping streams, backpressure, caching, rate limiting, rendering UI, model routers, multistep interfaces, and sequential generations.         |
| Migration guide   | `packages/ai/node_modules/ai/docs/08-migration-guides/24-migration-guide-6-0.mdx` | Installed AI SDK v6 docs mark `generateObject` and `streamObject` as deprecated; new structured output should use `generateText`/`streamText` with `Output.*`.         |

## Custom UI Rule

We build our own UI.

Use:

- `@ai-sdk/react` `useChat` directly inside `apps/app` when building the chat surface.
- `DefaultChatTransport` for authenticated/session/workflow request metadata.
- AI SDK `UIMessage.parts` as the canonical rendering contract.
- `@repo/design-system` primitives for visual controls.

Do not use:

- assistant-ui;
- AI Elements as a runtime dependency;
- `@ai-sdk/rsc` streamable React components for the primary product UI.

AI Elements and RSC generative UI are useful references, but Jeriko needs workflow/artifact/sandbox-specific state and must own the UI.

## Feature Notes

### Chat State

Sources:

- `https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat`
- `https://ai-sdk.dev/docs/ai-sdk-ui/transport`

Rules:

- App owns input state; AI SDK v6 `useChat` no longer manages input state internally.
- Use `DefaultChatTransport`.
- Use `prepareSendMessagesRequest` for session ID, workflow ID, run ID, branch ID, active `.flow` file, and route metadata.
- Keep request transformation in app route-local code, not `@repo/ai`.
- Use `resume` only when we are not exposing stop/abort for that stream, because abort and stream resumption conflict.

### Messages And Rendering

Sources:

- `https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat`
- `https://ai-sdk.dev/docs/reference/ai-sdk-ui/convert-to-model-messages`
- `https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data`

Rules:

- Render from `message.parts`; never depend on flattened text.
- Persist `UIMessage` with metadata and parts when storing conversation state.
- Use custom data parts for artifacts, workflow progress, file context, sandbox status, issue cards, and tool progress.
- Use transient data parts for toasts/live notifications that should not enter durable message history.
- Convert custom data parts on the server using `convertToModelMessages({ convertDataPart })`.

### Uploads, Downloads, And Files

Sources:

- `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot`
- `https://ai-sdk.dev/docs/reference/ai-sdk-ui/convert-to-model-messages`

Rules:

- Use `sendMessage({ text, files })` for image/text files that AI SDK can convert.
- For PDFs, archives, spreadsheets, code folders, or large files, upload first through app storage and send `FileUIPart` or typed `data-*` parts.
- Store file metadata separately: owner, workspace, content type, byte size, checksum, storage key, scan status, and model-visibility policy.
- Convert only the parts the model should see.

### Tools And Approvals

Sources:

- `https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`
- `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage`
- `https://ai-sdk.dev/cookbook/next/human-in-the-loop`

Rules:

- Tool definitions use `inputSchema`.
- `execute` is optional; omit it for tools that must be queued, policy-gated, or executed by the workflow runtime.
- Use `needsApproval` for sensitive tools.
- App UI renders tool parts and approval states.
- App UI uses `addToolOutput` for client-handled tools.
- App UI uses `addToolApprovalResponse` for human approval.
- `@repo/ai/tools` owns platform tool policy; `@repo/connectors` owns Composio/direct provider execution.
- Both internal platform tools and connector tools must produce renderable AI SDK tool parts. The UI registry should key off the AI SDK tool part name/state plus our platform tool manifest metadata.
- Approval, risk, idempotency, audit, and billing metadata belongs in our tool manifest/runtime layer, not in React components.

### Structured Output

Sources:

- `packages/ai/node_modules/ai/docs/08-migration-guides/24-migration-guide-6-0.mdx`
- `packages/ai/node_modules/ai/src/generate-text/output.ts`

Rules:

- Do not expose or use deprecated `generateObject` or `streamObject` in new platform code.
- Use `generateText` or `streamText` with `Output.object`, `Output.array`, `Output.choice`, or `Output.json`.
- For streaming structured data, consume `partialOutputStream` or `elementStream` from `streamText`.
- Keep schemas close to the owning route/package contract and validate external/untrusted data separately with Zod.

### Tool Rendering Contract

Sources:

- `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage`
- `https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data`
- `https://ai-sdk.dev/cookbook/next/human-in-the-loop`

Rules:

- Render all tools from `UIMessage.parts`.
- Support states: `input-streaming`, `input-available`, `approval-requested`, `output-available`, `output-error`, and denied outputs.
- Render connector tools and platform tools through one app-local typed registry.
- The registry receives normalized metadata from `@repo/ai/tools`, not raw Composio SDK shapes.
- Use data parts for progress that is not naturally a tool output, such as run status, artifact patch status, or scheduled trigger status.
- Keep renderers app-local until a second consumer proves a separate workbench package is needed.

### Agents

Sources:

- `https://ai-sdk.dev/docs/agents/overview`
- `https://ai-sdk.dev/docs/agents/workflows`
- `https://ai-sdk.dev/docs/agents/memory`
- `https://ai-sdk.dev/docs/agents/subagents`
- `https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent`

Rules:

- Use `ToolLoopAgent` for model-driven tool loops.
- Use `stepCountIs` and explicit stop conditions.
- Use subagents only when context isolation, parallel work, or tool isolation justifies latency/complexity.
- For deterministic workflow control, prefer `.flow` compilation/runtime and AI SDK core calls over giving the model full loop control.
- Memory should be explicit platform state or tool-mediated; do not hide memory in chat UI state.
- The main orchestrator agent can route to subagents, but `.flow` controls which subagents are allowed, their permissions, reporting mode, and trigger behavior.
- Subagent reporting modes must be explicit: no-report, final-summary-only, milestone-summary, every-step-visible, or full-trace-visible.
- Subagent outputs can be summarized back to the main agent using `toModelOutput`; the user can still see the full subagent trace when policy allows it.
- Subagent streaming should be enabled only when the UX needs live progress because the AI SDK docs call out added complexity.
- Every subagent call must forward `abortSignal`.
- Scheduled/cron/event-triggered subagent work must run through Inngest/runtime orchestration, not a browser-held chat stream.

### `.flow` And Inngest Orchestration

Sources:

- `https://ai-sdk.dev/docs/agents/workflows`
- `https://ai-sdk.dev/docs/advanced/multistep-interfaces`
- `https://ai-sdk.dev/docs/advanced/sequential-generations`

Rules:

- `.flow` is the source-of-truth authoring layer for workflow tasks, triggers, subagents, permissions, approval policy, retry/failure behavior, and reporting policy.
- AI SDK workflow patterns are implementation primitives, not the product source format.
- Inngest owns durable execution, cron/schedule triggers, event triggers, retries, sleeps/waits, and run state.
- AI SDK calls happen inside runtime steps with explicit model/tool/subagent contracts.
- The AI orchestrator may classify, route, or propose subagent/task selection, but the compiled `.flow` and policy layer must validate allowed choices.
- Main-agent update cadence should be configured in `.flow`, for example:
  - `report: none`
  - `report: final`
  - `report: every_task`
  - `report: on_milestone`
  - `report: on_failure`
  - `report: cron("*/15 * * * *")`
- User-visible progress should be emitted as events/data parts/artifacts from the durable runtime, not only as transient chat stream text.

### Streams

Sources:

- `https://ai-sdk.dev/docs/advanced/stopping-streams`
- `https://ai-sdk.dev/docs/advanced/backpressure`
- `https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data`
- `https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol`

Rules:

- Forward `req.signal` to AI SDK calls.
- Implement `onAbort` cleanup/persistence where partial outputs matter.
- Do not create eager producer loops; respect backpressure and cancellation.
- Use `createUIMessageStream` and `createUIMessageStreamResponse` for mixed text/data/tool streams.
- Use text stream protocol only for simple text-only routes; Jeriko chat/workflow routes need data streams.
- User stop action must abort the active AI SDK stream and signal the runtime/subagent execution where possible.
- For durable Inngest work, "stop" must become a cancellation event checked by workflow steps, not only an HTTP abort.
- Abort handling must persist partial output when configured by `.flow` run policy.

### Rate Limiting And Cost Control

Sources:

- `https://ai-sdk.dev/docs/advanced/rate-limiting`
- `https://ai-sdk.dev/docs/ai-sdk-core/telemetry`

Rules:

- Rate limit AI routes by user/workspace/session and tool risk.
- Track token usage and model metadata through AI SDK telemetry.
- Include workflow/run metadata in telemetry settings.
- Keep billing/audit decisions outside UI code.

### Model And Provider Management

Sources:

- `https://ai-sdk.dev/docs/ai-sdk-core/provider-management`

Rules:

- Prefer AI Gateway for provider access and routing.
- Use `createProviderRegistry`/`customProvider` for aliases and allowed model sets.
- Use model middleware for default settings, reasoning effort, prompt/context transforms, and guardrails.
- Do not scatter raw model strings across app routes.

### Retrieval

Sources:

- `https://ai-sdk.dev/cookbook/guides`
- `https://ai-sdk.dev/docs/ai-sdk-core/embeddings`
- `https://ai-sdk.dev/docs/ai-sdk-core/reranking`

Rules:

- Use `embed`, `embedMany`, `rerank`, and vector/search packages for RAG.
- Keep document ingestion/indexing in search/storage/database packages.
- `@repo/ai` can expose AI SDK retrieval primitives; it should not own indexes.

### Voice And Generated Media

Sources:

- `https://ai-sdk.dev/docs/ai-sdk-core/transcription`
- `https://ai-sdk.dev/docs/ai-sdk-core/speech`
- `https://ai-sdk.dev/docs/ai-sdk-core/image-generation`

Rules:

- Voice-to-text lives behind authenticated server routes.
- Enforce audio byte limits, abort signals, timeouts, and media type checks.
- Generated images/speech belong behind product-specific APIs with billing, safety, and artifact storage.

### Testing

Sources:

- `https://ai-sdk.dev/docs/ai-sdk-core/testing`

Rules:

- Use AI SDK stream simulators for route/component tests.
- Test tool approval branches, tool output branches, custom data parts, abort handling, and message conversion.
- Keep tests in package-level `tests` folders.

## Package Mapping

Current `@repo/ai` subpaths:

- `@repo/ai/agents`: `ToolLoopAgent`, stop conditions, agent types.
- `@repo/ai/messages`: `UIMessage`, parts, file conversion, validation, pruning, model conversion.
- `@repo/ai/server`: UI streams, text streams, stream readers, smooth streams.
- `@repo/ai/media`: transcription, downloads, image generation, speech generation.
- `@repo/ai/models`: AI Gateway, provider registries, aliases, model middleware.
- `@repo/ai/retrieval`: embeddings, reranking, cosine similarity.
- `@repo/ai/observability`: telemetry and stream consumption.
- `@repo/ai/testing`: stream simulation helpers.
- `@repo/ai/tools`: platform tool policy and AI SDK tool adapters.

## Open Follow-Ups

- Build app-local custom chat UI.
- Add server upload route and file artifact model.
- Add server transcription route.
- Add model registry package code once model policy is decided.
- Add app-local typed tool renderer registry.
- Add stream persistence/resume design before enabling durable chat streams.
