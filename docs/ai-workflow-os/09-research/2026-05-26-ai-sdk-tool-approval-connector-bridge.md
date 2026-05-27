# AI SDK Tool Approval And Connector Bridge Research

Date researched: 2026-05-26

## Verdict

`@repo/ai/tools` should wrap connector actions before they become AI SDK tools or workflow-visible tools.

The AI SDK can execute tools automatically when a tool object has an `execute` function. Sensitive external actions should use `needsApproval`, and platform execution should still have an explicit policy helper for non-AI-SDK workflow runtime calls.

## Sources

| Source                                                                        | Type             | Claim                                                                                                                                                                       | Impact                                                                                                |
| ----------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`                  | Official docs    | AI SDK Core tools use `description`, `inputSchema`, optional `execute`, optional `strict`, and optional `needsApproval`; tools with `execute` run automatically by default. | Do not expose raw connector tools directly. Convert only approved platform manifests to AI SDK tools. |
| `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-with-tool-calling`                 | Official docs    | Server-side tools with approval execute only after approval; tool part state becomes `approval-requested` for UI handling.                                                  | Connector bridge should set `needsApproval` for external writes and destructive actions.              |
| `https://v6.ai-sdk.dev/docs/foundations/tools`                                | Official docs    | The AI SDK supports Zod/JSON schemas for tool input and uses the schema to validate model tool calls.                                                                       | Platform connector tools should own Zod input schemas in `@repo/ai/tools`.                            |
| `https://v6.ai-sdk.dev/docs/agents/loop-control`                              | Official docs    | Agent loops stop when a tool has no execute function or a tool call needs approval.                                                                                         | Approval is a first-class loop-control mechanism; use it for connector side effects.                  |
| Local installed `ai@6.0.191` types                                            | Installed source | `Tool<INPUT, OUTPUT>` supports `inputSchema`, `execute(input, options)`, and `needsApproval(input, options)`.                                                               | Implement with the installed v6 type surface, not remembered v5 patterns.                             |
| [MADR-070](../07-madr/MADR-070-separate-connectors-from-ai-platform-tools.md) | Repo decision    | Platform tools live in `@repo/ai/tools`; Composio/direct provider execution lives in `@repo/connectors`.                                                                    | Add dependency direction `@repo/ai/tools -> @repo/connectors`.                                        |
| [MADR-072](../07-madr/MADR-072-composio-session-first-connectors-package.md)  | Repo decision    | `@repo/connectors` is session-first and exposes raw connector execution; raw actions are not platform tools.                                                                | The bridge adds the missing policy layer before workflows/model calls can use connector actions.      |

## Implementation Rule

Use two execution APIs:

1. `executeConnectorPlatformTool(...)`
   - Direct server-side execution helper.
   - Parses input schema.
   - Computes platform approval requirement.
   - Throws `PlatformToolApprovalRequiredError` when approval is required but missing.
   - Delegates to `ConnectorAdapter.execute`.

2. `createConnectorAiSdkTool(...)`
   - Converts one platform connector manifest to an AI SDK v6 tool.
   - Uses `needsApproval` for external-write/destructive policy.
   - Uses `execute` only after the AI SDK approval gate has been satisfied.
   - Still delegates actual provider execution to `@repo/connectors`.

Do not import `@composio/*` in `@repo/ai/tools`.

## Checklist

- [x] Check current AI SDK tool calling docs.
- [x] Check current AI SDK approval docs.
- [x] Inspect installed `ai@6.0.191` tool types.
- [x] Add server-only connector bridge in `@repo/ai/tools`.
- [x] Keep provider SDKs isolated in `@repo/connectors`.
- [x] Add package-level tests under `packages/ai/tests`.
- [x] Run focused AI/connectors typecheck/tests.
- [ ] Wire app routes or workflow runtime to consume the bridge.
- [ ] Add persisted audit/idempotency/billing records before production side effects.
