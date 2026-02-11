# Codex Architecture Package

Date: 2026-02-10
Owner: Codex
Status: Canonical implementation package for Rubic refactor/build

## Purpose
This folder is the execution source of truth for building a Manus-style Rubic architecture using:
- Part 10 canonical decisions: `docs/manus-architecture-docs/guide/10-CONTRADICTION-REGISTER-AND-CANONICAL-DECISIONS.md`
- Corrected architecture: `docs/manus-architecture-docs/guide/09-CORRECTED-AGENT-ARCHITECTURE.md`
- Existing Rubic service reality under `services/*` and `apps/*`

## Documents
1. `01-CANONICAL-BASELINE.md`
2. `02-AS-IS-RUBIC-ARCHITECTURE.md`
3. `03-TARGET-ARCHITECTURE.md`
4. `04-SERVICE-BOUNDARY-PLAN.md`
5. `05-SLICE-BY-SLICE-BUILD-SPEC.md`
6. `06-ENDPOINT-CONTRACTS.md`
7. `07-E2B-RUNTIME-AND-ENV-INJECTION.md`
8. `08-TOOL-CONTRACTS-AND-ORCHESTRATOR-LOOP.md`
9. `09-DATA-MODEL-AND-PERSISTENCE.md`
10. `10-WEBSOCKET-EVENT-PROTOCOL.md`
11. `11-PHASED-MIGRATION-PLAN.md`
12. `12-TEST-RELEASE-OPERATIONS.md`
13. `13-IMPLEMENTATION-BACKLOG.md`
14. `14-OPEN-RISKS-AND-NON-GOALS.md`
15. `15-USER-LIFECYCLE-END-TO-END.md`
16. `16-API-EVENT-SLICE-MATRIX.md`
17. `17-ONBOARDING-AUTH-SESSION-STATE-MACHINE.md`
18. `18-FULL-WORKFLOW-CHECKLIST-AND-TRACEABILITY.md`

## How to use
- If any doc conflicts with this package, resolve using:
  1. `guide/10-CONTRADICTION-REGISTER-AND-CANONICAL-DECISIONS.md`
  2. `guide/09-CORRECTED-AGENT-ARCHITECTURE.md`
  3. this package
- Build strictly in phase order from `11-PHASED-MIGRATION-PLAN.md`.
- Do not add new architecture branches without updating this folder.

## External validation notes
- Official references were cross-checked for E2B, Neko/WebRTC, and Composio.
- `guide/2505.02024v1.pdf` text is available in this session (user-provided) and used as supporting context only, not canonical authority for internals.
