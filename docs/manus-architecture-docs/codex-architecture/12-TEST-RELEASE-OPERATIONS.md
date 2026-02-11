# Test, Release, and Operations Plan

## Test matrix
1. Unit tests
- Tool schema validation
- Planner state transitions
- Event reducer determinism

2. Integration tests
- Orchestrator <-> E2B execution paths
- Orchestrator <-> Composio connector execution
- Orchestrator <-> file service S3 metadata roundtrip

3. E2E tests (Playwright)
- Chat full flow with tools
- Browser takeover and stream stability
- File upload/download + timeline replay
- Billing and limits banner behavior
- Devices approval workflow

4. Contract tests
- JSON schema compatibility (request/response/events)
- Old/new adapter parity during migration

## Reliability SLOs
1. Chat first token p95 < 2.5s
2. Tool execution success rate >= 98.5%
3. WS live connection uptime >= 99.9%
4. Timeline replay correctness 100% for ordered sequence windows

## Observability
1. Metrics
- `orchestrator_loop_duration_ms`
- `tool_call_duration_ms`
- `tool_call_error_total{tool,code}`
- `sandbox_create_duration_ms`
- `ws_reconnect_total`
- `credits_spend_total`

2. Logs
- Structured JSON logs with `sessionId`, `correlationId`, `eventId`.

3. Tracing
- OpenTelemetry spans for full plan/act/observe loops.

## Release pipeline
1. PR checks: lint, typecheck, unit, integration, schema diff.
2. Staging deployment with canary seed sessions.
3. Automated e2e smoke suite.
4. Production canary 5%, then progressive rollout.

## Ops runbooks
1. Sandbox saturation
- Action: enforce queue + warm pool scaling.
2. Connector outage
- Action: disable connector tools per provider health signal.
3. WebRTC degradation
- Action: fail over TURN config and restart media pods.
4. Billing drift
- Action: stop spend debits, replay usage ledger, reconcile.

## Security controls
1. Strict allowlist for sandbox-exposed ports.
2. Secrets injected runtime-only (never persisted in plaintext files).
3. Connector scopes least privilege.
4. Audit log for tool calls with side effects.

## References
- `docs/manus-architecture-docs/12-SUPPLEMENT-F-FILE-STORAGE-S3-CDN-FLOWS.md`
- `docs/manus-architecture-docs/14-SUPPLEMENT-H-VOICE-SKILLS-KNOWLEDGE-FILES-FORGE.md`
- `docs/manus-architecture-docs/orchestrator/phases/PHASE-06-LATEST-DOCS-REFERENCE-LIST.md`
