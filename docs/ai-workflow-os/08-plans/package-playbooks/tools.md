# Tools Package Playbook

Package: `@repo/tools`

Date: 2026-05-26

Status: rejected package name

## Decision

Do not create `@repo/tools`.

The word "tools" is still valid, but ownership is split like this:

- `@repo/ai/tools`: our platform tools, tool manifests, `.flow` tool IDs, permission/risk/approval/idempotency/audit policy, normalized execution, and AI SDK adapters.
- `@repo/connectors`: Composio tools/toolkits, direct API integrations, connector auth/session/connected-account lifecycle, triggers, and raw connector execution.
- `@repo/ai/components/tools`: UI-only tool-call/tool-result renderers.

This file remains only to prevent future sessions from recreating a catch-all `@repo/tools` package.

## References

- [AI package playbook](./ai.md)
- [Connectors package playbook](./connectors.md)
- [MADR-070: Separate Connectors From AI Platform Tools](../../07-madr/MADR-070-separate-connectors-from-ai-platform-tools.md)
