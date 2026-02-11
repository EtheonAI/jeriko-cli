# Phase 00 - Assumptions and Evidence Policy

Date: 2026-02-10

## Scope audited
- Manus docs set under `docs/manus-architecture-docs/` (index + 14 parts + misc/orchestrator files).
- Rubic implementation paths:
  - Agent orchestration: `services/agent/src/*`
  - Sandbox service: `services/sandbox/src/index.ts`
  - File/S3 service: `services/file/src/index.ts`, `packages/storage/*`
  - Connector/Composio service: `services/connector/src/*`
  - Gateway websocket/proxy: `services/gateway/src/routes/*`
  - Frontend state/API: `apps/app/lib/store/*`, `apps/app/app/api/*`, `apps/app/lib/chat/*`

## Evidence rules used
- Confirmed: directly visible in source code or in official docs.
- Inferred: not explicit in code; reasoned from behavior/contracts.
- Unverified claim: appears in Manus docs but cannot be validated from public primary source or Rubic code.

## Important boundary
- Manus internals are proprietary. The local Manus documents are a research artifact, not first-party source code.
- Therefore, Manus behavior is treated as:
  - "Confirmed from provided Manus documentation artifact"
  - not "cryptographically verified from Manus production source"

## Key confidence flags
- High confidence: Rubic code paths and endpoint behavior.
- Medium confidence: Manus architecture statements that align with E2B public case study.
- Low confidence: very specific Manus implementation details (exact process IDs, exact secret names/values, exact DB schema) unless independently corroborated.
