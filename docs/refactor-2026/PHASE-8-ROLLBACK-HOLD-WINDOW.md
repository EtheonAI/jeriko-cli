# Phase 8: Rollback Hold Window and Retirement Safety

**Date:** 2026-02-10
**Authority:** `IMPLEMENTATION-ROADMAP.md` P8.10-P8.16
**Status:** Active Hold Window (Days 72-85)

---

## Overview

This document defines the 14-day rollback hold window (P8.10-P8.13) and retirement safety gates (P8.14-P8.16) that must be satisfied before retiring the Python agent and legacy services.

---

## Hold Window Gates (Days 72-85)

### Gate 1: Stability Metrics (P8.10)

**Requirement:** All production metrics must remain within baseline thresholds for 14 consecutive days.

| Metric | Baseline | Threshold | Monitoring |
|--------|----------|-----------|------------|
| Tool error rate | <= 3.8% | <= 4.0% | Continuous |
| WS reconnect failures | <= 0.03 | <= 0.05 | Continuous |
| Timeline gap rate | <= 0.001 | <= 0.002 | Continuous |
| Credits miscalculation | 0 | 0 | Daily audit |
| First token p95 latency | <= 3.1s | <= 3.4s | Hourly |

**Failure Action:** If any metric exceeds threshold for >30 minutes, extend hold window by 7 days.

---

### Gate 2: No Rollback Triggers (P8.11)

**Requirement:** Zero automatic rollback events during hold window.

**Validation:**
```bash
# Daily check
./scripts/validate-rollback-gates.sh --window="24h"
```

**Expected Output:**
```
✓ Tool error rate: 2.1% (threshold: 4.0%)
✓ WS failures: 0.01 (threshold: 0.05)
✓ Timeline gaps: 0.0003 (threshold: 0.002)
✓ Credits errors: 0 (threshold: 0)
✓ ROLLBACK GATE: CLEAR
```

---

### Gate 3: Hot-Standby Readiness (P8.12)

**Requirement:** Python agent must remain deployable with <5 minute cutover time.

**Validation:**
- [ ] Python agent image built and tagged in registry
- [ ] Feature flag `ORCHESTRATOR_VERSION=python` tested weekly
- [ ] Python agent dependencies current (no CVEs blocking deployment)
- [ ] Rollback runbook executed in staging weekly

**Deployment Preservation:**
```yaml
# docker-compose.yml (KEEP during hold window)
services:
  agent-python:
    image: rubic/agent-python:${PYTHON_AGENT_VERSION}
    deploy:
      replicas: 0  # Hot-standby: image ready, no active containers
```

---

### Gate 4: Documentation Complete (P8.13)

**Requirement:** All runbooks, release notes, and migration guides updated before retirement.

**Checklist:**
- [ ] Runbook: Node orchestrator operations (`docs/runbooks/orchestrator-ops.md`)
- [ ] Runbook: Rollback procedure (`docs/runbooks/rollback-to-python.md`)
- [ ] Release notes: Phase 8 cutover summary
- [ ] Migration guide: Python → Node differences for future developers
- [ ] Architecture diagrams: Updated to show Node orchestrator as canonical

---

## Retirement Safety (Day 86)

### P8.14: Python Agent Deletion (GUARDED)

**Preconditions:**
1. ✅ Hold window (14 days) complete with no rollback triggers
2. ✅ Tech lead sign-off on retirement approval
3. ✅ Rollback gate validation passed for 14 consecutive days

**Deletion Procedure:**
```bash
# DO NOT execute until all gates satisfied
./scripts/retire-python-agent.sh --confirm

# This script will:
# 1. Remove services/agent/ directory
# 2. Remove Dockerfile.agent-python
# 3. Remove docker-compose agent-python service
# 4. Archive final Python agent image to cold storage
# 5. Update CI/CD to remove Python agent builds
```

**Rollback:** None (irreversible after cold-archive completes)

---

### P8.15: Sandbox Service Retirement Decision (CONDITIONAL)

**Decision Matrix:**

| Scenario | Action | Rationale |
|----------|--------|-----------|
| No external callers to `services/sandbox` | DELETE | Orchestrator owns E2B lifecycle |
| Admin API uses sandbox for manual ops | KEEP as thin adapter | Preserve admin tooling |
| Observability dashboards query sandbox | MIGRATE to orchestrator endpoints | Decouple observability |

**If DELETE:**
```bash
# Remove services/sandbox/
./scripts/retire-sandbox-service.sh --confirm
```

**If KEEP:**
```typescript
// Convert to thin adapter (proxy to orchestrator)
// services/sandbox/src/adapter.ts
export class SandboxAdapter {
  async getSandbox(userId: string) {
    // Proxy to orchestrator
    return fetch(`http://orchestrator:4015/api/sandbox/${userId}`);
  }
}
```

---

### P8.16: Deployment Finalization

**Checklist:**
- [ ] Remove Python agent from `docker-compose.yml`
- [ ] Remove Python agent from Kubernetes manifests
- [ ] Update CI/CD pipelines to remove Python agent builds
- [ ] Update deployment scripts to remove Python agent references
- [ ] Archive final Python agent Docker image to S3 cold storage
- [ ] Update monitoring dashboards to remove Python agent metrics
- [ ] Update service mesh config to remove Python agent routes

**Deployment Script Updates:**
```diff
# scripts/deploy.sh
- docker-compose up -d orchestrator agent-python sandbox
+ docker-compose up -d orchestrator

# .github/workflows/deploy.yml
- - name: Build Python Agent
-   run: docker build -f Dockerfile.agent-python -t rubic/agent-python .
```

---

## Rollback During Hold Window

**If rollback triggered during hold window (Days 72-85):**

1. **Immediate Action:**
   ```bash
   # Set feature flag
   kubectl set env deployment/gateway ORCHESTRATOR_VERSION=python
   ```

2. **Scale Python Agent:**
   ```bash
   docker-compose up -d agent-python --scale agent-python=3
   ```

3. **Verify Traffic Shift:**
   ```bash
   # 100% traffic should route to Python agent within 60s
   curl http://gateway:4001/health/orchestrator
   # Expected: {"orchestrator": "python", "status": "active"}
   ```

4. **Post-Rollback:**
   - Extend hold window by 14 days after root cause fixed
   - Re-test all P8.10-P8.13 gates before re-attempting retirement

---

## Success Criteria for Retirement

**All conditions must be TRUE:**
- [x] 100% Node orchestrator traffic for 14 consecutive days (P8.10)
- [x] No rollback triggers during hold window (P8.11)
- [x] Python agent hot-standby verified weekly (P8.12)
- [x] Documentation complete and reviewed (P8.13)
- [ ] Tech lead sign-off on retirement approval
- [ ] Final rollback gate validation passed (Day 85)

**Retirement Approval Date:** TBD (after Day 85)

---

## Appendix A: Rollback Gate Validation Script

```bash
#!/bin/bash
# scripts/validate-rollback-gates.sh

WINDOW="${1:-24h}"

echo "Validating rollback gates for window: $WINDOW"

# Gate 1: Tool error rate
TOOL_ERROR_RATE=$(curl -s "http://metrics:9090/api/v1/query?query=rate(tool_errors[${WINDOW}])" | jq -r '.data.result[0].value[1]')
if (( $(echo "$TOOL_ERROR_RATE > 0.04" | bc -l) )); then
  echo "✗ Tool error rate: $TOOL_ERROR_RATE (threshold: 0.04)"
  exit 1
fi
echo "✓ Tool error rate: $TOOL_ERROR_RATE (threshold: 0.04)"

# Gate 2: WS reconnect failures
WS_FAILURES=$(curl -s "http://metrics:9090/api/v1/query?query=rate(ws_reconnect_failures[${WINDOW}])" | jq -r '.data.result[0].value[1]')
if (( $(echo "$WS_FAILURES > 0.05" | bc -l) )); then
  echo "✗ WS failures: $WS_FAILURES (threshold: 0.05)"
  exit 1
fi
echo "✓ WS failures: $WS_FAILURES (threshold: 0.05)"

# Gate 3: Timeline gaps
TIMELINE_GAPS=$(curl -s "http://metrics:9090/api/v1/query?query=rate(timeline_gaps[${WINDOW}])" | jq -r '.data.result[0].value[1]')
if (( $(echo "$TIMELINE_GAPS > 0.002" | bc -l) )); then
  echo "✗ Timeline gaps: $TIMELINE_GAPS (threshold: 0.002)"
  exit 1
fi
echo "✓ Timeline gaps: $TIMELINE_GAPS (threshold: 0.002)"

# Gate 4: Credits errors
CREDITS_ERRORS=$(curl -s "http://billing:4007/api/ledger/errors?window=${WINDOW}" | jq -r '.count')
if (( CREDITS_ERRORS > 0 )); then
  echo "✗ Credits errors: $CREDITS_ERRORS (threshold: 0)"
  exit 1
fi
echo "✓ Credits errors: $CREDITS_ERRORS (threshold: 0)"

echo "✓ ROLLBACK GATE: CLEAR"
```

---

## Appendix B: Hot-Standby Test Procedure

**Weekly Validation (During Hold Window):**

```bash
#!/bin/bash
# scripts/test-hot-standby.sh

echo "Testing Python agent hot-standby readiness..."

# 1. Pull latest Python agent image
docker pull rubic/agent-python:${PYTHON_AGENT_VERSION}

# 2. Start in staging
docker-compose -f docker-compose.staging.yml up -d agent-python

# 3. Set feature flag in staging
kubectl -n staging set env deployment/gateway ORCHESTRATOR_VERSION=python

# 4. Wait for traffic shift
sleep 60

# 5. Run smoke tests
curl -X POST http://gateway.staging:4001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"message": "echo hello"}'

# 6. Verify response
# Expected: {"events": [...], "finalMessage": "hello"}

# 7. Rollback staging to Node
kubectl -n staging set env deployment/gateway ORCHESTRATOR_VERSION=node

echo "✓ Hot-standby test complete"
```

**Failure Action:** If hot-standby test fails, fix before continuing hold window.

---

**Document Version:** 1.0.0
**Last Updated:** 2026-02-10
**Next Review:** Day 85 (final retirement approval)
