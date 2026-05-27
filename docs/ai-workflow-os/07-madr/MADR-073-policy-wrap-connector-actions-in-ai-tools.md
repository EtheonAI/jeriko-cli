# MADR-073: Policy-Wrap Connector Actions In `@repo/ai/tools`

Date: 2026-05-26

Status: Accepted

Amends: [MADR-070](./MADR-070-separate-connectors-from-ai-platform-tools.md), [MADR-072](./MADR-072-composio-session-first-connectors-package.md)

## Context

`@repo/connectors` now owns Composio sessions, connected accounts, auth links, direct connector adapters, triggers, and raw connector execution. That package intentionally does not decide whether a workflow or model is allowed to perform a user-visible side effect.

AI SDK v6 tools with `execute` run automatically by default. Official docs also provide `needsApproval` for sensitive tools. External connector actions such as sending email, posting to social, creating issues, or modifying external apps must therefore be policy-wrapped before being passed to a model or workflow runtime.

## Sources Checked

| Source                                                               | Type             | Checked Date | Evidence Used                                                                                                                          |
| -------------------------------------------------------------------- | ---------------- | -----------: | -------------------------------------------------------------------------------------------------------------------------------------- |
| `https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`         | Official docs    |   2026-05-26 | Tools use `inputSchema`, optional `execute`, optional `strict`, and optional `needsApproval`; `execute` runs automatically by default. |
| `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-with-tool-calling`        | Official docs    |   2026-05-26 | Tool execution approval is for sensitive server-side operations and uses approval-requested tool state.                                |
| `https://v6.ai-sdk.dev/docs/foundations/tools`                       | Official docs    |   2026-05-26 | Zod or JSON schemas are used for tool input validation.                                                                                |
| `https://v6.ai-sdk.dev/docs/agents/loop-control`                     | Official docs    |   2026-05-26 | Agent loops stop when a tool needs approval.                                                                                           |
| Local installed `ai@6.0.191` types                                   | Installed source |   2026-05-26 | `Tool<INPUT, OUTPUT>` has `inputSchema`, `execute`, and `needsApproval(input, options)`.                                               |
| [MADR-070](./MADR-070-separate-connectors-from-ai-platform-tools.md) | Repo decision    |   2026-05-26 | Platform tool policy belongs in `@repo/ai/tools`; connector provider execution belongs in `@repo/connectors`.                          |
| [MADR-072](./MADR-072-composio-session-first-connectors-package.md)  | Repo decision    |   2026-05-26 | `@repo/connectors` is session-first and raw connector actions are not platform tools.                                                  |

## Decision

Add a server-only connector bridge under `@repo/ai/tools`.

The bridge owns:

- platform connector manifests;
- input schema parsing;
- permission ID and risk metadata;
- approval policy decisions;
- AI SDK v6 `tool(...)` conversion;
- direct server execution helper for future workflow runtime use.

The bridge delegates raw provider execution to `@repo/connectors`.

```text
@repo/ai/tools manifest
  -> approval/risk/permission policy
  -> @repo/connectors ConnectorAdapter.execute
  -> provider SDK such as @composio/core
```

## Consequences

Positive:

- Keeps Composio SDK imports out of `@repo/ai`.
- Prevents raw connector actions from becoming model-callable by accident.
- Gives workflow runtime a server-side approval gate even outside AI SDK.
- Uses AI SDK v6 `needsApproval` instead of custom-only approval semantics.

Tradeoffs:

- This is not yet persisted audit/idempotency/billing. Those must be added before real external side effects run in production.
- App routes and workflow runtime still need to consume this bridge intentionally.
- Dynamic Composio meta-tool exposure remains deferred until platform policy can safely filter and observe it.

## Implementation Checklist

- [x] Add `packages/ai/tools/contracts.ts`.
- [x] Add `PlatformToolApprovalRequiredError`.
- [x] Add `packages/ai/tools/connectors.ts`.
- [x] Add `executeConnectorPlatformTool`.
- [x] Add `createConnectorAiSdkTool`.
- [x] Add `createConnectorAiSdkTools`.
- [x] Add `@repo/connectors` as an `@repo/ai` dependency.
- [x] Keep tests under `packages/ai/tests`.
- [x] Validate `@repo/ai` typecheck and AI/connectors tests.
- [ ] Add persisted audit/idempotency/billing records before real production external actions.
- [ ] Wire app route handlers/settings UI to connector sessions.
- [ ] Wire workflow runtime/platform manifests to concrete connector manifests.
