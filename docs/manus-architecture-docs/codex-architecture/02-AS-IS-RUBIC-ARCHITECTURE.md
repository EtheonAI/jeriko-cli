# As-Is Rubic Architecture

## Current service topology
- `services/agent` (Python): orchestration loop, tool execution, SSE streaming.
- `services/sandbox` (Node): separate E2B lifecycle and sandbox API.
- `services/gateway` (Node): websocket/proxy ingress.
- `services/file` (Node): file metadata and object storage path.
- `services/connector` (Node): Composio integrations.
- Additional domain services: `billing`, `device`, `knowledge`, `notification`, `task`, `project`, `search`, `website`, `webhook`.

## Current request path
1. `apps/*` chat API route receives prompt.
2. Proxy calls `services/agent /v1/complete`.
3. Agent builds system prompt and toolset.
4. Agent acquires E2B via direct SDK manager.
5. Loop streams responses and tool events.

## Current strengths
- Working orchestrator loop exists.
- Direct E2B integration exists.
- Composio path exists.
- File service and storage layer exist.
- Gateway websocket path exists.

## Current architecture debt
1. Dual sandbox control planes (`services/agent` and `services/sandbox`).
2. Partial contract drift between services and frontend event handling.
3. Slice sprawl and inconsistent slice completeness.
4. Some tool/runtime contracts not normalized across shell/file/browser.
5. Endpoint surface spread across many services with overlapping responsibilities.

## Current known contract inventory
See `docs/manus-architecture-docs/orchestrator/API-ENDPOINT-INVENTORY.md` and this package's endpoint contract file.
