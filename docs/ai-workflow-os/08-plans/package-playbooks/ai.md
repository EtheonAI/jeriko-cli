# AI Package Playbook

Package: `@repo/ai`

Date: 2026-05-26

Status: reset to core AI SDK/platform-tool package

Priority: P1 platform package

## Ownership

`@repo/ai` owns:

- Vercel AI SDK v6 package boundary and selected re-exports;
- agent exports such as `ToolLoopAgent` and `stepCountIs`;
- AI SDK message helpers under `@repo/ai/messages`;
- AI SDK server stream helpers under `@repo/ai/server`;
- AI SDK media helpers under `@repo/ai/media`;
- server-only platform tool policy under `@repo/ai/tools`;
- connector-to-AI-SDK tool bridge that calls `@repo/connectors` without importing Composio directly;
- schema-only platform tool definitions that use AI SDK v6 `inputSchema`.

`@repo/ai` must not own:

- React chat UI;
- canvas/workbench/browser/terminal panes;
- app route handlers;
- sandbox provider implementation;
- Composio sessions/OAuth/toolkit internals;
- database persistence;
- generic design-system primitives;
- third-party assistant UI abstraction layers.

Product UI belongs in `apps/app` first. If reusable product UI is needed later, create a deliberately named package such as `@repo/workbench` after reuse is proven.

## Public Subpaths

- `@repo/ai`
- `@repo/ai/agents`
- `@repo/ai/messages`
- `@repo/ai/server`
- `@repo/ai/media`
- `@repo/ai/models`
- `@repo/ai/observability`
- `@repo/ai/retrieval`
- `@repo/ai/testing`
- `@repo/ai/tools`

## AI SDK Feature Contract

Use these AI SDK features for the platform:

- Chat UI state: app-local `@ai-sdk/react` `useChat`.
- Transport: `DefaultChatTransport` with `prepareSendMessagesRequest` for auth/session/workflow metadata.
- Message rendering: `UIMessage.parts` as the canonical render source.
- File input: `convertFileListToFileUIParts`, `FileUIPart`, and custom upload for non-image/non-text files.
- Custom context: `DataUIPart` plus server-side `convertToModelMessages({ convertDataPart })`.
- Tool calls: AI SDK `tool`, `Tool`, `ToolSet`, typed tool parts, `addToolOutput`, and platform approval policy.
- Approvals: `needsApproval`, `addToolApprovalResponse`, and explicit continuation helpers.
- Streams: `createUIMessageStream`, `createUIMessageStreamResponse`, `readUIMessageStream`, `smoothStream`.
- Agents: `ToolLoopAgent`, `stepCountIs`, and AI SDK stop conditions.
- Subagents: parent-agent delegation, explicit reporting modes, summarized return-to-main-agent output, and optional streamed preliminary progress.
- Structured output: `generateText`/`streamText` with `Output.object`, `Output.array`, or other AI SDK output helpers. Do not use deprecated `generateObject`/`streamObject` in new code.
- Voice-to-text: `experimental_transcribe` behind an authenticated server route with size limits/timeouts.
- Downloads/media: `createDownload`, `generateImage`, and `experimental_generateSpeech` behind product-specific APIs.
- Abort/cancel: forward `req.signal` for active streams; durable workflow cancellation is a runtime event checked by Inngest steps.
- Resume/reconnect: AI SDK resumable chat streams are useful for transport continuity, but durable workflow resume belongs to run/event persistence and the runtime adapter.
- Custom data: stream artifacts, workflow progress, sandbox status, and scheduled trigger status as typed data parts/events.
- Model policy: AI Gateway, provider registry, model aliases, and middleware.
- Retrieval: embeddings, batch embeddings, reranking, and cosine similarity.
- Observability/testing: telemetry, stream consumption, simulated streams, and streaming middleware.

## Sources Checked

| Source                                                                                      | Type                    | Checked Date | Claim Used                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------- | ----------------------- | -----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat`                                      | Official docs           |   2026-05-26 | `useChat` is transport-based and exposes messages, status, send/regenerate/stop/resume, tool output, approval response, and local message updates.                              |
| `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot`                                                 | Official docs           |   2026-05-26 | File attachments are supported through `FileList`/file parts; image/text are auto-converted and other file types need custom handling.                                          |
| `https://ai-sdk.dev/docs/ai-sdk-ui/transport`                                               | Official docs           |   2026-05-26 | `DefaultChatTransport` supports custom request transformation for metadata and auth.                                                                                            |
| `https://ai-sdk.dev/docs/reference/ai-sdk-ui/convert-to-model-messages`                     | Official docs           |   2026-05-26 | `convertDataPart` converts custom UI data parts into model-compatible text/file context.                                                                                        |
| `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage`                                      | Official docs           |   2026-05-26 | Tool calls/results are rendered from typed `message.parts`; client tools and approvals have first-class hooks.                                                                  |
| `https://ai-sdk.dev/docs/ai-sdk-core/transcription`                                         | Official docs           |   2026-05-26 | Transcription supports audio, bounded downloads, abort signals/timeouts, headers, and errors.                                                                                   |
| `https://ai-sdk.dev/docs/agents/workflows`                                                  | Official docs           |   2026-05-26 | Agent workflows include sequential, parallel, feedback, orchestration, and routing patterns; use them as primitives under `.flow`.                                              |
| `https://ai-sdk.dev/docs/agents/subagents`                                                  | Official docs           |   2026-05-26 | Subagents can isolate context/tool access, stream preliminary progress, and summarize output for the parent.                                                                    |
| `https://ai-sdk.dev/docs/agents/loop-control`                                               | Official docs           |   2026-05-26 | Agent loops stop on non-tool finish, missing execute, approval requirement, or explicit stop condition.                                                                         |
| `https://ai-sdk.dev/cookbook/next/human-in-the-loop`                                        | Official cookbook       |   2026-05-26 | Approval-requested states and `addToolApprovalResponse` drive human-in-the-loop UI.                                                                                             |
| `https://ai-sdk.dev/docs/advanced/stopping-streams`                                         | Official docs           |   2026-05-26 | Active AI SDK streams should forward abort signals and handle abort cleanup; abort and resume semantics conflict.                                                               |
| `https://ai-sdk.dev/docs/advanced/backpressure`                                             | Official docs           |   2026-05-26 | Streams should be lazy and cancellation-aware; avoid eager producer loops.                                                                                                      |
| `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams`                                  | Official docs           |   2026-05-27 | `useChat` can resume streams with app-owned persistence/Redis/endpoints, but abort and resume conflict, so workflow execution must be decoupled from browser request lifetimes. |
| `packages/ai/node_modules/ai/docs/08-migration-guides/24-migration-guide-6-0.mdx`           | Installed official docs |   2026-05-26 | `generateObject` and `streamObject` are deprecated in AI SDK v6; use `generateText`/`streamText` with `Output.*`.                                                               |
| `https://vercel.com/blog/introducing-ai-elements`                                           | Vercel blog             |   2026-05-26 | AI Elements validates the composable AI SDK + shadcn-style pattern, but is reference only for this product.                                                                     |
| [AI SDK v6 reference notes](../../09-research/references/ai-sdk-v6-reference-2026-05-26.md) | Repo reference          |   2026-05-26 | Consolidates feature map, custom UI rules, `.flow`/Inngest orchestration, and package subpaths.                                                                                 |
| [MADR-078](../../07-madr/MADR-078-flow-orchestrates-ai-sdk-subagents-and-tools.md)          | Repo decision           |   2026-05-26 | `.flow` owns orchestration policy; AI SDK owns primitives; Inngest/runtime owns durability/triggers/cancellation.                                                               |
| `pnpm view ai version peerDependencies engines`                                             | Registry metadata       |   2026-05-26 | Latest `ai` is `6.0.191`, matching the package.                                                                                                                                 |
| `pnpm view @ai-sdk/react version peerDependencies engines`                                  | Registry metadata       |   2026-05-26 | Latest `@ai-sdk/react` is `3.0.193`; it should be consumed by app UI, not `@repo/ai`.                                                                                           |
| `pnpm view next version peerDependencies engines`                                           | Registry metadata       |   2026-05-26 | Latest stable `next` is `16.2.6`; repo is already on the requested version.                                                                                                     |
| `pnpm outdated -r --format json`                                                            | Registry metadata       |   2026-05-26 | Returned `{}` under repo Node `22.22.1` and pnpm `11.3.0`; no active package upgrades were available.                                                                           |
| Local package audit                                                                         | Repo evidence           |   2026-05-26 | No active app/non-AI package imports `@repo/ai`; the old UI layer was package-local salvage.                                                                                    |

## Cleanup Completed

- [x] Removed old agent-service provider and `AGENT_SERVICE_URL` package env key.
- [x] Removed custom fake agent wrapper and re-exported AI SDK `ToolLoopAgent`.
- [x] Removed broken custom AI stream fallback.
- [x] Removed custom execution registry from old `lib/tools`.
- [x] Removed React components, canvas, hooks, providers, and third-party assistant UI adapters from `@repo/ai`.
- [x] Removed React/UI dependencies from `@repo/ai`.
- [x] Moved package code under `packages/ai/src`.
- [x] Added package README with ownership and AI SDK feature map.
- [x] Kept tests under `packages/ai/tests`.
- [x] Added public API and package-boundary tests.
- [x] Removed deprecated AI SDK `streamObject` from the `@repo/ai` public API.
- [x] Added `Output.object`/`Output.array` to the structured-output public contract.

## Current Refactor Checklist

- [ ] Add app-local chat shell using `@ai-sdk/react` `useChat`.
- [ ] Add resumable UI stream/reconnect behavior only after MADR-096 data/runtime/API gates exist.
- [ ] Add app-local upload tray and unsupported-file upload route.
- [ ] Add app-local voice recorder and server transcription route.
- [ ] Add app-local tool renderer registry for typed AI SDK parts.
- [ ] Add app-local approval card flow.
- [ ] Add app-local artifact/workbench pane using `@repo/sandbox`.
- [ ] Add route-level tests for uploads, voice transcription, approvals, and tool rendering.
- [ ] Add `.flow` subagent/reporting mode schema and compiler validation.
- [ ] Add Inngest cancellation/progress event contracts.
- [ ] Add app-local tool renderer registry for normalized internal and connector tool manifests.

## Validation

Run after every AI package change:

```bash
pnpm --filter @repo/ai typecheck
pnpm exec vitest run --project @repo/ai
pnpm boundaries:cruise --focus packages/ai
pnpm --filter "./packages/*" typecheck
pnpm test
pnpm outdated -r --format json
```

Latest validation will be recorded in the phase audit after this reset completes.

Latest completed validation on 2026-05-26:

```bash
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs outdated -r --format json
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs --filter @repo/ai typecheck
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs exec vitest run --project @repo/ai
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs boundaries:cruise --focus packages/ai
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs --filter "./packages/*" typecheck
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs test
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs boundaries:cruise
git diff --check
```

Results: AI package typecheck passed, AI tests passed 2 files / 7 tests, focused dependency-cruise passed with no violations, all active package typechecks passed, root package tests passed 8 files / 25 tests, full dependency-cruise had no errors or warnings and only info-level orphan findings, and `pnpm outdated` returned `{}`.
