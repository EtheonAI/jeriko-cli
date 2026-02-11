# Service Boundary Plan (Keep / Merge / Rebuild)

## Decision framework
Keep a separate service only if one is true:
1. Different runtime/performance profile required.
2. Independent scaling required.
3. Security boundary required.
4. Distinct deploy cadence and ownership required.

## Proposed boundaries
### Keep / Rebuild
1. `orchestrator` (new Node service): keep as primary control plane.
2. `webrtc-media` (new Go service): keep separate for Neko/WebRTC lifecycle.
3. `connector` (Node): keep separate (Composio auth/execution boundary).
4. `file` (Node): keep separate if object storage workload grows; otherwise can be module.

### Merge into orchestrator (phase-wise)
1. `gateway` websocket routing.
2. `task` scheduling integration.
3. `search` wrappers.
4. `project` and `website` orchestration adapters.
5. `knowledge` read path.
6. `notification` publish hooks.

### Replace
1. Replace `services/agent` Python loop with Node orchestrator loop.
2. Remove duplicated lifecycle logic from `services/sandbox` or convert it to thin runtime adapter used only by orchestrator.

## Cutover strategy
1. Shadow mode: run new orchestrator in parallel with mirror traffic.
2. Session-level progressive rollout.
3. Full cutover after e2e parity + SLO match.
4. Decommission old control plane paths only after rollback window expires.
