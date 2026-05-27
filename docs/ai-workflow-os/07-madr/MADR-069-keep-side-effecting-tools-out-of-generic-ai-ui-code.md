# MADR-069: Keep Side-Effecting Tools Out Of Generic AI UI Code

Date: 2026-05-26

Status: Accepted, amended by [MADR-070](./MADR-070-separate-connectors-from-ai-platform-tools.md)

## Context

AI Workflow OS needs external app actions: Gmail, Slack, GitHub, Notion, Linear, calendars, social publishing, CRM updates, and webhooks/triggers. The old codebase had connector service concepts, but those services were removed from the active workspace because the monorepo reset is package-first and Next.js route handlers should stay thin.

The architecture already accepted "Composio plus direct APIs" in MADR-007. This record clarifies where that belongs in the new monorepo.

## Sources Checked

| Source                                                                                                           | Type                   | Checked Date | Evidence Used                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------- | -----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| https://docs.composio.dev/docs                                                                                   | Official docs          |   2026-05-26 | Composio provides toolkits, tool search, context management, authentication, triggers, and workbench for AI agents.                                    |
| https://docs.composio.dev/docs/how-composio-works                                                                | Official docs          |   2026-05-26 | A session scopes user ID, enabled toolkits, auth, connected account selection, execution logs/state, MCP URL, and native tools.                        |
| https://docs.composio.dev/docs/tools-and-toolkits                                                                | Official docs          |   2026-05-26 | Tools follow toolkit/action slugs, sessions expose meta tools for search, schema inspection, connection management, execution, and workbench.          |
| https://docs.composio.dev/docs/configuring-sessions                                                              | Official docs          |   2026-05-26 | Sessions can restrict toolkits/tools, preload narrow tools, use direct-tools preset, disable workbench, select connected accounts, and configure auth. |
| https://docs.composio.dev/docs/authentication                                                                    | Official docs          |   2026-05-26 | Composio handles Connect Links, OAuth/token refresh, auth configs, connected accounts, and manual/in-chat auth.                                        |
| https://docs.composio.dev/docs/triggers                                                                          | Official docs          |   2026-05-26 | Triggers deliver app events to our webhook subscription URL and are scoped to a connected account.                                                     |
| https://docs.composio.dev/docs/providers/vercel                                                                  | Official docs          |   2026-05-26 | `@composio/vercel` converts Composio tools to Vercel AI SDK tools with built-in `execute` and supports multi-turn session reuse.                       |
| https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling                                                       | Official docs          |   2026-05-26 | AI SDK tools use `inputSchema`, can auto-execute when `execute` exists, and can require approval for sensitive operations.                             |
| https://docs.composio.dev/reference/sdk-reference/typescript                                                     | Official SDK reference |   2026-05-26 | Current TypeScript SDK is `@composio/core`; quickstart uses `Composio`, `tools.get`, and `tools.execute`.                                              |
| `pnpm view @composio/core version engines peerDependencies dependencies --registry https://registry.npmjs.org`   | Registry metadata      |   2026-05-26 | Latest `@composio/core` is `0.10.0`; peer `zod` supports v3/v4.                                                                                        |
| `pnpm view @composio/vercel version engines peerDependencies dependencies --registry https://registry.npmjs.org` | Registry metadata      |   2026-05-26 | Latest `@composio/vercel` is `0.9.2`; peers support `ai` v5/v6 and `@composio/core >=0.10.0 <1.0.0`.                                                   |
| `pnpm view composio-core version deprecated ... --registry https://registry.npmjs.org`                           | Registry metadata      |   2026-05-26 | Legacy `composio-core` is deprecated and must not be used.                                                                                             |

## Decision

Create a dedicated tool boundary that keeps side-effecting execution out of generic AI UI/chat code.

Amendment: MADR-070 rejects a separate `@repo/tools` package. Connector tools/toolkits and API integrations belong in `@repo/connectors`; platform tools belong in server-only `@repo/ai/tools`.

Important terminology:

- AI SDK "tools" are model-callable objects with descriptions, input schemas, optional `execute`, optional approval semantics, and tool-call/tool-result message parts.
- Composio "tools" are external app actions grouped by toolkit, backed by Composio sessions, connected accounts, auth configs, Connect Links, triggers, and optional workbench state. Per MADR-070, these belong behind `@repo/connectors`.
- AI Workflow OS "tools" are product-level tools with stable IDs, permissions, risk tiers, approvals, idempotency, billing, audit logs, and normalized results.

Because the AI SDK tool object may include an `execute` function, platform tools must live in a server-only boundary, not inside generic AI UI/chat components. That boundary is `@repo/ai/tools`.

Layering:

- `@repo/flow` references tools by stable IDs in `.flow` and compiled AST/ASG, but never imports Composio or provider SDKs.
- `@repo/connectors` owns Composio sessions, connector auth, connected accounts, trigger setup, raw connector action execution, and connector-normalized results.
- `@repo/ai/tools` resolves platform tool IDs to manifests, checks permissions, applies approval/risk/idempotency/audit policy, delegates external actions to `@repo/connectors`, normalizes platform results, and adapts approved tools into AI SDK-compatible tool objects.
- `@repo/ai` owns AI chat/model helpers and UI rendering of tool parts, but connector auth, Composio sessions, direct API integrations, and trigger lifecycle stay in `@repo/connectors`.
- `apps/app` owns route handlers and UI screens for connection management, but route handlers call `@repo/connectors` for connection lifecycle and `@repo/ai/tools` for platform tool execution/previews. No app-local Composio SDK code.
- `@repo/webhooks` can verify generic webhook concerns, while `@repo/connectors` owns connector trigger payload normalization and `@repo/ai/tools` maps allowed connector events into workflow-visible tool/event semantics where needed.
- `@repo/database` stores our workflow/tool/connection metadata, Composio session IDs, connected-account IDs/status, and audit records. Composio remains the token store unless a direct API adapter intentionally owns its own OAuth.

Current repo implication:

- `packages/ai/components/tools` can remain as the tool-result renderer registry for now.
- `packages/ai/lib/tools` is an old execution/definition surface and should be treated as migration debt. Provider/session/connector behavior now belongs to `@repo/connectors`; platform tool manifests/policy are reorganized under server-only `@repo/ai/tools`. UI renderers stay in `@repo/ai/components/tools` or later move to a dedicated artifact/workbench UI package if needed.

Use both Composio and direct APIs:

- Use Composio for breadth, long-tail integrations, OAuth/connect links, connected-account status, dynamic tool discovery, and many app triggers.
- Use direct APIs for first-class, high-volume, high-risk, or UX-critical integrations where we need exact domain contracts, predictable idempotency, custom scopes, lower latency, or better billing/observability control.

## Consequences

Positive:

- Keeps provider SDKs out of apps and workflow compiler packages.
- Avoids rebuilding hundreds of OAuth/tool integrations.
- Still lets the platform own safety, approvals, risk tiers, idempotency, billing, and event normalization.
- Allows future MCP support without making hosted MCP URLs or provider credentials a frontend concern.

Tradeoffs:

- Composio sessions and connected account IDs become state we must model carefully.
- We still need a direct API lane for critical integrations; Composio is not the only execution path.
- Composio workbench is useful, but our own Vercel Sandbox remains the code execution boundary for `.flow` sandbox tasks. Do not mix Composio workbench with workflow sandbox semantics without a later MADR.

## Implementation Checklist

- [x] Create `packages/connectors` as `@repo/connectors` for Composio/direct integration connectivity.
- [ ] Do not create `packages/tools`.
- [ ] Reorganize platform tools under server-only `@repo/ai/tools`.
- [ ] Add connector package-local T3 Env keys: `COMPOSIO_API_KEY`, optional auth config IDs, and feature flags for workbench/MCP if needed.
- [x] Install only the current required package in `@repo/connectors`: `@composio/core@0.10.0`.
- [x] Defer `@composio/vercel@0.9.2` until AI SDK native tool bridging is policy-wrapped in `@repo/ai/tools`.
- [ ] Do not install deprecated `composio-core`.
- [ ] Define provider-neutral `ToolManifest`, `ToolRisk`, `ToolPermission`, `ToolExecutionRequest`, `ToolExecutionResult`, and `ToolConnectionStatus` contracts.
- [x] Add Composio connector adapter behind `@repo/connectors/composio`.
- [ ] Add server-only `@repo/ai/tools` bridge that returns only approved AI SDK tool objects after permission/risk filtering.
- [ ] Add `DirectConnectorProvider` interface for first-class direct APIs.
- [ ] Add permission and approval gate before execution.
- [ ] Add session create/use strategy keyed by user/workflow/run where needed.
- [ ] Add trigger subscription and webhook normalization plan.
- [ ] Add mock provider tests before wiring app routes.
- [x] Add dependency-cruiser rule blocking apps and unrelated packages from importing `@composio/*` directly now that `@repo/connectors` exists.
