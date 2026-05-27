# MADR-076: Build custom AI UI on Vercel AI SDK

Status: Accepted

Date: 2026-05-26

## Context

The old AI package carried assistant-ui adapters, custom chat hooks, and large product UI salvage from the Manus clone. The new platform needs a workflow-native interface with uploads, downloads, files, voice-to-text, tool rendering, approvals, artifacts, sandbox views, and `.flow` editing.

That UI is too product-specific to outsource to a generic assistant UI package.

## Decision

Use Vercel AI SDK as the protocol/runtime layer and build our own product UI.

Concretely:

- remove assistant-ui from `@repo/ai`;
- keep `@repo/ai` focused on AI SDK v6, server helpers, agents, and platform tools;
- build chat/workbench UI inside `apps/app` first, route-local under authenticated app folders;
- compose UI from `@repo/design-system` primitives;
- render AI output from AI SDK `UIMessage.parts`;
- use `@ai-sdk/react` `useChat` directly in the app when the chat UI is built;
- treat AI Elements as reference/copyable patterns, not a required dependency.

## Consequences

Positive:

- Full control over product behavior and visual design.
- No adapter layer between assistant-ui and AI SDK message parts.
- Uploads, downloads, artifacts, approvals, `.flow`, and sandbox state can be modeled directly.
- `@repo/ai` stays a clean core package.

Negative:

- We must build and test our own accessibility, scrolling, composer, upload tray, tool cards, artifact panes, and voice UX.
- We cannot rely on assistant-ui for prebuilt thread behavior.
- AI Elements can accelerate implementation only if we deliberately copy/adapt components.

## Evidence

- AI SDK v6 `useChat` provides the state and actions needed for custom UI, including transport config, `sendMessage`, `regenerate`, `stop`, `resumeStream`, `addToolOutput`, `addToolApprovalResponse`, and `setMessages`.
- AI SDK v6 attachments support covers image/text automatically, while other file types need custom upload and data-part handling.
- AI SDK v6 tool usage docs require rendering from `message.parts` and support typed tool parts, client-side tools, approvals, and continuation helpers.
- AI SDK `convertToModelMessages` supports custom `convertDataPart`, which is the correct place to translate workflow/artifact/file context into model input.
- AI SDK transcription supports server-side voice-to-text with size limits, abort signals, and headers.
- Local audit found no active app consumer for the old assistant-ui layer.

## Implementation Checklist

- [x] Remove `@assistant-ui/react` from `@repo/ai`.
- [x] Remove assistant-ui providers/adapters from `@repo/ai`.
- [x] Keep `@repo/ai` exports focused on AI SDK/server/tools.
- [ ] Build app-local AI chat shell with `@ai-sdk/react` `useChat`.
- [ ] Add app-local composer with text, file upload, and voice recording controls.
- [ ] Add server-side upload handling for unsupported file types.
- [ ] Add server-side transcription route/wrapper.
- [ ] Add typed tool-part renderer registry in the app.
- [ ] Add approval card flow using `addToolApprovalResponse`.
- [ ] Add artifact/workbench panes using app state and `@repo/sandbox`.
- [ ] Add tests for message parts, upload conversion, approvals, and tool rendering.
