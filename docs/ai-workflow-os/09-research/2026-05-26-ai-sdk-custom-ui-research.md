# AI SDK Custom UI Research

Date: 2026-05-26

Scope: `@repo/ai`, future `apps/app` chat/workbench UI

## Question

Should the platform keep assistant-ui, use AI Elements as a dependency, or build a custom UI on top of Vercel AI SDK?

## Sources Checked

| Source                                                                      | Type           | Evidence Used                                                                                                                                                                                                       |
| --------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat`                      | Official docs  | AI SDK v6 `useChat` is transport-based, does not own input state, returns `messages`, `status`, `sendMessage`, `regenerate`, `stop`, `resumeStream`, `addToolOutput`, `addToolApprovalResponse`, and `setMessages`. |
| `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot`                                 | Official docs  | `useChat` supports file attachments through `FileList` or file parts; only `image/*` and `text/*` are automatically converted, so other files need custom handling.                                                 |
| `https://ai-sdk.dev/docs/ai-sdk-ui/transport`                               | Official docs  | `DefaultChatTransport` supports custom API, headers, credentials, body, fetch, and `prepareSendMessagesRequest`; this fits authenticated workflow/session metadata.                                                 |
| `https://ai-sdk.dev/docs/reference/ai-sdk-ui/convert-to-model-messages`     | Official docs  | `convertToModelMessages` converts UI messages to model messages and supports `convertDataPart` for custom parts such as code files and URLs.                                                                        |
| `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage`                      | Official docs  | Tool calls/results are rendered from `message.parts`; client tools use `onToolCall` and `addToolOutput`; approvals use `addToolApprovalResponse`; automatic continuation uses `sendAutomaticallyWhen`.              |
| `https://ai-sdk.dev/docs/ai-sdk-core/transcription`                         | Official docs  | `experimental_transcribe` supports audio input, custom download limits, abort signals/timeouts, and headers; voice-to-text belongs in a server route/package wrapper, not a chat UI dependency.                     |
| `https://ai-sdk.dev/docs/advanced/stopping-streams`                         | Official docs  | Forward abort signals, use `onAbort` for cleanup, and choose between abort and stream resume semantics deliberately.                                                                                                |
| `https://ai-sdk.dev/docs/advanced/backpressure`                             | Official docs  | Streams should produce lazily and respect consumer backpressure/cancellation; do not hand-roll eager stream loops.                                                                                                  |
| `https://ai-sdk.dev/docs/advanced/rate-limiting`                            | Official docs  | Protect AI routes with request rate limits and cost controls.                                                                                                                                                       |
| `https://ai-sdk.dev/docs/advanced/multistep-interfaces`                     | Official docs  | Multistep UI requires tool composition plus application context; this supports `.flow` and workflow state outside generic chat UI.                                                                                  |
| `https://ai-sdk.dev/docs/advanced/sequential-generations`                   | Official docs  | Sequential generations can decompose complex workflows, but deterministic product workflows should be represented in `.flow`/runtime.                                                                               |
| `https://ai-sdk.dev/docs/ai-sdk-core/provider-management`                   | Official docs  | Provider registries, custom providers, aliases, and middleware support centralized model policy.                                                                                                                    |
| `https://ai-sdk.dev/docs/ai-sdk-core/telemetry`                             | Official docs  | AI SDK telemetry exposes function IDs, metadata, usage, model/provider, and retry settings for observability.                                                                                                       |
| `https://ai-sdk.dev/docs/ai-sdk-core/testing`                               | Official docs  | AI SDK test utilities can simulate streams for package and route tests.                                                                                                                                             |
| `https://vercel.com/blog/introducing-ai-elements`                           | Vercel blog    | AI Elements is a customizable React component library built on shadcn/ui for AI SDK apps; it is useful as design reference, not mandatory runtime dependency.                                                       |
| `https://github.com/vercel/ai-elements`                                     | OSS project    | AI Elements components are registry-style and can be copied/adapted into an app/design-system if useful.                                                                                                            |
| [AI SDK v6 reference notes](./references/ai-sdk-v6-reference-2026-05-26.md) | Repo reference | Consolidated package mapping, custom UI rules, and feature checklist.                                                                                                                                               |
| Local package audit                                                         | Repo evidence  | After reset, no active app imports `@repo/ai`; old assistant-ui, canvas, hooks, providers, and workbench UI were package-local only.                                                                                |

## Findings

### Build Our Own UI

Verdict: yes, for the product UI.

Reason:

- The product needs workflow-aware rendering: `.flow` edits, approvals, artifacts, sandbox browser/terminal views, file renderers, tool audit trails, retries, and run state.
- Those concepts are product state, not generic assistant UI state.
- AI SDK already gives the hard protocol pieces: message parts, tool states, approvals, file parts, custom data parts, transport hooks, stream resumption, and model-message conversion.
- Owning the UI lets us match the new material design direction and avoid fighting a third-party abstraction.

### Do Not Keep assistant-ui

assistant-ui is not wrong generally, but it is wrong for this reset.

Reasons:

- No active consumer needs it.
- It adds an extra runtime and type adapter layer over AI SDK `UIMessage`.
- The old package adapter was tied to a deleted custom chat hook.
- The platform’s UI contract will be workflow/artifact/tool specific, so another assistant abstraction would hide the state we need to control.

### AI Elements

Use as reference, not as a package dependency for now.

Reason:

- AI Elements confirms the right direction: AI-specific components composed on top of AI SDK and shadcn-style primitives.
- But this platform needs a more specialized workbench and workflow UI.
- If a component is useful, copy/adapt it into app route-local `_components` or `@repo/design-system` according to ownership rules.

## Target Architecture

`@repo/ai`:

- AI SDK v6 re-export boundary;
- agent helpers;
- `@repo/ai/server` conversion/stream response helpers;
- `@repo/ai/tools` platform tool manifests, approval policy, connector bridge, and schema-only tool definitions.

`apps/app`:

- `app/(authenticated)/_components/ai-chat/*` for product chat composition;
- route-local message list, composer, upload tray, voice recorder, approval cards, tool renderers, artifact/workbench panes;
- direct use of `@ai-sdk/react` `useChat` with `DefaultChatTransport`;
- direct use of `@repo/design-system` primitives.

Future package only if reuse is proven:

- `@repo/workbench` or `@repo/artifacts-ui` for reusable sandbox/artifact panes across multiple apps.

## Enterprise Checklist

- [ ] Use AI SDK `UIMessage` as the canonical client message type.
- [ ] Render assistant messages from `message.parts`, never from a flattened text string.
- [ ] Use `DefaultChatTransport` with `prepareSendMessagesRequest` for session/workflow metadata.
- [ ] Keep prompt input state in our UI, since AI SDK v6 no longer owns input state.
- [ ] Use `sendMessage({ text, files })` for supported image/text attachments.
- [ ] Upload unsupported files first, then send file/data parts with metadata.
- [ ] Use `convertToModelMessages` server-side with `convertDataPart` for app-specific context parts.
- [ ] Use `addToolOutput` for client-handled tools.
- [ ] Use `addToolApprovalResponse` for approval-gated tools.
- [ ] Use `sendAutomaticallyWhen` only where the continuation policy is explicit.
- [ ] Put voice-to-text behind a server route/wrapper using AI SDK transcription with size limits, timeouts, and auth.
- [ ] Keep sandbox browser/terminal UI out of `@repo/ai`; consume `@repo/sandbox` and app APIs from app-local components.
- [ ] Use AI Elements only as implementation reference until a concrete component is adopted.
- [ ] Centralize model/provider policy through AI Gateway, provider registry, aliases, and middleware.
- [ ] Add telemetry metadata for workspace/session/workflow/run/tool usage.
- [ ] Use AI SDK test utilities for stream/tool/approval route tests.
- [ ] Respect abort signals/backpressure in every AI stream route.
