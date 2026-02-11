# CONTROLLED-DELETION-PLAN.md

**Date:** 2026-02-11  
**Status:** BLOCKED (preconditions not met)

## Objective
Delete legacy services only after proving green gates and end-to-end runtime stability.

## Preconditions (all required)
1. `pnpm turbo run typecheck --continue` passes.
2. `pnpm turbo run test --continue` passes.
3. E2E runtime checks pass for:
- signup/login
- chat send/stream
- tool rendering/execution events
- file upload flow
- billing route checks
- websocket state updates
4. Phase 5 reconciliation completed and artifacts either restored or marked out-of-scope.
5. Keep/Delete matrix approved.

## Current State
- Preconditions 1-3: **FAILED**
- Precondition 4: **DONE** (`PHASE-5-RECONCILIATION-REPORT.md`)
- Precondition 5: **DONE** (`KEEP-DELETE-MATRIX.md`)

## Deletion Candidate Order (when preconditions become green)
1. `services/agent` (Python legacy), retain archive tag and image for rollback window.
2. Consolidation targets: `services/gateway`, `services/task`, `services/notification`, `services/webhook`, `services/knowledge`, `services/project`, `services/sandbox` (only after orchestrator parity).
3. Evaluate `services/billing`, `services/device`, `services/search` after traffic/complexity checks.

## Execution Steps
1. Create safety tag:
- `git tag pre-delete-legacy-services-YYYYMMDD-HHMM`
2. Create deletion branch:
- `git checkout -b chore/delete-legacy-services-YYYYMMDD`
3. Remove selected service(s) and update all imports/scripts/routes.
4. Run full gates + runtime suite.
5. Merge only if all checks are green.

## Rollback
- Revert deletion commit(s), or reset to safety tag in emergency branch.
- Keep archived Docker images for 90 days.

## Decision
**No service deletion performed in this run.**
Reason: required validation gates are not green.
