# @repo/ai

Core AI package for Jeriko.

## Owns

- Vercel AI SDK v6 re-export boundary used by the platform.
- Agent exports such as `ToolLoopAgent` and `stepCountIs`.
- Message helpers for AI SDK `UIMessage`, file parts, typed data parts, validation, pruning, and conversion to `ModelMessage`.
- Server helpers for UI streams, text streams, agent UI streams, stream readers, and smooth streaming.
- Media helpers for transcription, image generation, speech generation, and bounded downloads.
- Model/provider helpers for AI Gateway, provider registries, aliases, and model middleware.
- Retrieval helpers for embeddings, batch embeddings, reranking, and cosine similarity.
- Observability helpers for AI SDK telemetry integration and stream consumption.
- Testing helpers for simulated streams and streaming middleware.
- Server-only platform tool policy under `@repo/ai/tools`.
- Connector-to-AI-SDK tool bridge that wraps `@repo/connectors` with permission, risk, and approval policy.
- Schema-only platform tool definitions using AI SDK `inputSchema`.

## Does Not Own

- React chat UI, canvas, workbench, browser panes, or terminal panes.
- Third-party assistant UI adapters.
- Provider SDK/session/OAuth internals for external integrations.
- Sandbox provider implementation.
- Generic design-system primitives.

Product UI belongs in `apps/app` first. Extract reusable primitives to `@repo/design-system`; create a dedicated workbench package only after reuse is proven.

## Public Entry Points

- `@repo/ai`
- `@repo/ai/agents`
- `@repo/ai/media`
- `@repo/ai/messages`
- `@repo/ai/models`
- `@repo/ai/observability`
- `@repo/ai/retrieval`
- `@repo/ai/server`
- `@repo/ai/testing`
- `@repo/ai/tools`

## AI SDK Feature Map

Use these features through AI SDK directly or this package's focused subpaths:

- Chat UI state in apps: `@ai-sdk/react` `useChat` with `DefaultChatTransport`.
- App input state: owned by our UI, because AI SDK v6 does not manage input state internally.
- Message rendering: render `UIMessage.parts`, not flattened message text.
- Attachments: use `sendMessage({ text, files })` for image/text files; upload unsupported files first and send `FileUIPart` or custom data parts.
- Tool rendering: read typed `tool-*` parts, `dynamic-tool` parts, and tool state from `message.parts`.
- Client tool outputs: `addToolOutput`.
- Approval responses: `addToolApprovalResponse`.
- Continuation policy: use `lastAssistantMessageIsCompleteWithToolCalls` or `lastAssistantMessageIsCompleteWithApprovalResponses` only when the flow explicitly wants automatic continuation.
- Server model input: `convertToModelMessages` with `convertDataPart` for workflow/artifact/file context.
- Streams: `createUIMessageStream`, `createUIMessageStreamResponse`, `readUIMessageStream`, and `smoothStream`.
- Agents: `ToolLoopAgent` plus `stepCountIs`.
- Structured output: `generateText`/`streamText` with `Output.object`, `Output.array`, or other AI SDK output helpers. Do not use deprecated `generateObject`/`streamObject` in new code.
- Voice-to-text: `experimental_transcribe` behind a server route with auth, max size, abort signal, and timeout.
- Generated media: `generateImage` and `experimental_generateSpeech` only behind product-specific server APIs.
- Providers: `gateway`, `createProviderRegistry`, `customProvider`, and model middleware for aliases, fallback, reasoning settings, and model policy.
- Retrieval/RAG: `embed`, `embedMany`, `rerank`, and `cosineSimilarity`.
- Observability: AI SDK telemetry settings/integrations plus `consumeStream` when a stream must be fully consumed for callbacks/telemetry.
- Tests: `simulateReadableStream` and `simulateStreamingMiddleware` for package and route tests.
- Advanced streaming: always forward `req.signal`; do not implement eager producer loops that ignore backpressure or cancellation.
- Resume/reconnect: AI SDK resumable chat streams are a transport feature, not the workflow runtime. Durable workflow execution must live behind persisted runs/events and a runtime adapter. Browser disconnect must not be interpreted as run cancellation.

## Flow Integration Plan

Package-local plan:

`packages/ai/FLOW_AI_SDK_INTEGRATION_PLAN.md`

Subagent/model-routing plan:

`packages/ai/SUBAGENTS_GATEWAY_MODEL_ROUTING_PLAN.md`

This package is not the `.flow` runtime. It will provide the flow architect/repair agents, worker router, subagent task runner, model policy, scoped tool resolution, and TaskReport/ECP mapping after `@repo/flow` produces stable execution plans.

## Rules

- Use AI SDK v6 APIs directly where possible.
- Tool schemas use `inputSchema`, not legacy `parameters`.
- `@repo/ai/tools` is server-only.
- Tests live under `packages/ai/tests`.
- Do not add React UI dependencies to this package.
- Do not add a third-party assistant UI abstraction to this package.
- Do not build route-local long-running workflow loops in `@repo/ai`; use `@repo/flow` contracts plus runtime persistence.
