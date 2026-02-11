# Next Worker Backlog (Post Phase 9)

## Canonical Alignment Source

Derived from `docs/manus-architecture-docs/guide/09-*` through `18-*` (with Part 10 canonical decisions as tie-breaker).

## Priority 0: Test Red CI in `services/orchestrator`

1. `src/lib/__tests__/context-compactor.test.ts`
   - Export or restore `compactHistory` API expected by tests.
2. `src/lib/__tests__/feature-flags.test.ts`
   - Export or restore `getOrchestratorVersion` and `isShadowMode` helpers.
3. `src/lib/__tests__/mode-manager.test.ts`
   - Export or restore `getBaseTools`, `expandToolsForMode`, and `isNestedSubcallTool`.
4. `src/lib/__tests__/shadow-router.test.ts`
   - Fix shadow routing dependency on missing `isShadowMode`.

## Priority 1: Contract Parity (Guide Parts 10, 17, 18)

1. Lock canonical event contract and adapters:
   - 21-event contract (18 verified + 3 reserved).
2. Endpoint parity validation:
   - Ensure documented orchestrator-facing endpoints have handlers or explicit non-goals.
3. Tool contract parity:
   - Maintain 12 entrance tools + mode expansions + map behavior constraints.

## Priority 2: Runtime Flow Validation

1. Add smoke flow for:
   - Health check + session/message flow route validation.
2. Add hold-window operational job:
   - Daily execution wrapper for `scripts/phase9/hold-window-check.sh` and readiness check.

## Priority 3: Architecture Hardening

1. Formalize rollback thresholds as env-configurable with sane defaults.
2. Add explicit anti-destructive checks for retirement scripts:
   - Verify repository path, dry-run default, explicit `--confirm`.
3. Expand phase logs with per-run metadata:
   - Commit SHA, command, pass/fail, duration.
