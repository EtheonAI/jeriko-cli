# Phase 8 Cutover Runbook

**Date:** 2026-02-10
**Phase:** 8 - Cutover and Retirement
**Authority:** IMPLEMENTATION-ROADMAP.md (Days 68-86)

---

## Overview

This runbook provides step-by-step procedures for the progressive rollout of the Node.js orchestrator, monitoring rollback gates, and retiring the Python agent after a successful 14-day hold window.

**Rollout Timeline:**
- Day 68: 5% rollout
- Day 69: 25% rollout
- Day 70: 50% rollout
- Day 71: 100% rollout
- Days 72-85: 14-day rollback hold window
- Day 86: Python agent retirement

---

## Prerequisites

### Before Starting Rollout

1. **All previous phases completed:**
   - ✅ Phase 0: Baseline captured and golden suite passing
   - ✅ Phase 1: Contracts published and validated
   - ✅ Phase 2: Node orchestrator running in shadow mode
   - ✅ Phase 3: Sandbox control-plane consolidated
   - ✅ Phase 4: Tool runtime parity >= 95%
   - ✅ Phase 5: Media path hardened
   - ✅ Phase 6: Frontend slices consolidated
   - ✅ Phase 7: File and billing correctness validated

2. **Monitoring dashboards ready:**
   - Rollback detector metrics dashboard
   - Tool execution metrics
   - WebSocket health metrics
   - Timeline event integrity
   - Billing accuracy metrics

3. **Rollback procedure tested:**
   - Manual rollback tested in staging
   - Auto-rollback gates verified
   - Python agent confirmed hot-standby ready

4. **Team preparation:**
   - On-call rotation staffed
   - Incident response procedures reviewed
   - Communication channels established

---

## Progressive Rollout Procedure

### Day 68: 5% Rollout

#### Step 1: Enable Feature Flag

```bash
# Set environment variables
export ORCHESTRATOR_VERSION=node
export NODE_ORCHESTRATOR_ROLLOUT_PERCENTAGE=5
export ENABLE_AUTO_ROLLBACK=true
export ROLLBACK_WINDOW_DAYS=14

# Deploy configuration
kubectl set env deployment/gateway \
  ORCHESTRATOR_VERSION=node \
  NODE_ORCHESTRATOR_ROLLOUT_PERCENTAGE=5 \
  ENABLE_AUTO_ROLLBACK=true
```

#### Step 2: Monitor Metrics (4 hours)

Monitor the following metrics for 4 hours after rollout:

**Critical Metrics:**
- Tool error rate: Should be < 7.6% (2x baseline of 3.8%)
- WS reconnect failure rate: Should be < 5%
- Timeline gap rate: Should be < 0.2% (2x baseline of 0.1%)
- Credits miscalculations: Must be 0
- p95 latency: Should be < 4650ms (1.5x baseline of 3100ms)

**Dashboard Links:**
- Grafana: `https://grafana.manus.ai/d/phase8-rollout`
- DataDog: `https://app.datadoghq.com/dashboard/phase8`

#### Step 3: Verify Rollback Gates

```bash
# Run rollback gate check
npm run check-rollback-gates

# Expected output:
# ✓ Tool error rate: 3.2% (within threshold)
# ✓ WS reconnect failures: 0.4% (within threshold)
# ✓ Timeline gaps: 0.05% (within threshold)
# ✓ Credits miscalculations: 0 (within threshold)
# ✓ p95 latency: 2800ms (within threshold)
# ✓ All gates PASSED - proceed to next stage
```

#### Step 4: Triage Incidents

If any issues occur:

1. Check automatic rollback status
2. If auto-rollback triggered, investigate root cause
3. Document incident in incident log
4. Proceed to manual rollback if necessary (see Rollback section)

---

### Day 69: 25% Rollout

**Prerequisites:** Day 68 completed successfully with all gates passing

#### Step 1: Increase Traffic

```bash
export NODE_ORCHESTRATOR_ROLLOUT_PERCENTAGE=25

kubectl set env deployment/gateway \
  NODE_ORCHESTRATOR_ROLLOUT_PERCENTAGE=25
```

#### Step 2: Monitor (4 hours)

Same metrics as Day 68. Monitor for 4 hours.

#### Step 3: Verify Gates

```bash
npm run check-rollback-gates
```

---

### Day 70: 50% Rollout

**Prerequisites:** Day 69 completed successfully

#### Step 1: Increase Traffic

```bash
export NODE_ORCHESTRATOR_ROLLOUT_PERCENTAGE=50

kubectl set env deployment/gateway \
  NODE_ORCHESTRATOR_ROLLOUT_PERCENTAGE=50
```

#### Step 2: Monitor (4 hours)

Same metrics. Monitor for 4 hours.

#### Step 3: Verify Gates

```bash
npm run check-rollback-gates
```

---

### Day 71: 100% Rollout

**Prerequisites:** Day 70 completed successfully

#### Step 1: Full Cutover

```bash
export NODE_ORCHESTRATOR_ROLLOUT_PERCENTAGE=100

kubectl set env deployment/gateway \
  NODE_ORCHESTRATOR_ROLLOUT_PERCENTAGE=100
```

#### Step 2: Extended Monitoring (8 hours)

Monitor for 8 hours to ensure stability at full traffic.

#### Step 3: Verify Gates

```bash
npm run check-rollback-gates
```

#### Step 4: Begin 14-Day Hold Window

Once 100% rollout is stable:
- Mark hold window start date
- Continue daily monitoring
- Keep Python agent in hot-standby mode
- No retirement until hold window completes

---

## Rollback Hold Window (Days 72-85)

### Daily Monitoring Tasks

**Daily:**
1. Check rollback gate metrics
2. Review incident log
3. Verify Python agent hot-standby status
4. Update rollout status in tracking document

**Weekly:**
1. Review aggregate metrics
2. Team sync on rollout status
3. Document any issues or concerns

### Hold Window Success Criteria

To proceed to retirement on Day 86, ALL must be true:
- ✅ No rollback triggers for full 14 days
- ✅ All SLO metrics within acceptable thresholds
- ✅ No critical incidents related to orchestrator
- ✅ Billing accuracy 100% (zero miscalculations)
- ✅ Timeline replay correctness 100%

---

## Rollback Procedures

### Automatic Rollback

The system monitors rollback gates automatically and triggers rollback if:
- Tool error rate > 2x baseline (7.6%)
- WS reconnect failures > 5%
- Timeline gaps > 2x baseline (0.2%)
- Any credits miscalculation (> 0)
- p95 latency > 1.5x baseline (4650ms)

**When auto-rollback triggers:**
1. System automatically sets `ORCHESTRATOR_VERSION=python`
2. Alert sent to on-call engineer
3. Traffic shifts back to Python within 60 seconds
4. Incident created automatically

### Manual Rollback

**When to trigger manual rollback:**
- Automated gates not capturing critical issue
- Data integrity concerns
- Customer-reported critical bugs
- Executive decision

**Procedure:**

```bash
# Step 1: Set feature flag to Python
export ORCHESTRATOR_VERSION=python

kubectl set env deployment/gateway \
  ORCHESTRATOR_VERSION=python \
  NODE_ORCHESTRATOR_ROLLOUT_PERCENTAGE=0

# Step 2: Wait 60 seconds for in-flight requests
sleep 60

# Step 3: Verify Python agent receiving traffic
kubectl logs -l app=gateway --tail=100 | grep "orchestrator=python"

# Step 4: Verify metrics returning to baseline
npm run check-rollback-gates

# Step 5: Create incident report
# Document:
# - Time of rollback
# - Trigger reason
# - Metrics at time of rollback
# - Root cause (if known)
# - Next steps
```

### Post-Rollback Actions

1. **Investigate root cause** - determine why rollback was necessary
2. **Fix issues** - address bugs or configuration problems
3. **Test in staging** - verify fixes before re-attempting rollout
4. **Update runbook** - document lessons learned
5. **Re-plan rollout** - determine new rollout timeline

---

## Day 86: Python Agent Retirement

**Prerequisites:**
- ✅ 14-day hold window completed successfully
- ✅ No rollback triggers during hold window
- ✅ All success criteria met
- ✅ Tech lead approval for retirement

### Retirement Procedure

#### Step 1: Final Verification

```bash
# Verify 100% Node traffic for 14+ days
npm run verify-rollout-stability

# Expected output:
# ✓ 100% Node traffic for 14 days
# ✓ No rollback triggers
# ✓ All SLOs met
# ✓ Approved for retirement
```

#### Step 2: Archive Python Agent

```bash
# Create archive branch
git checkout -b archive/python-agent
git push origin archive/python-agent

# Tag final Python agent version
git tag -a python-agent-final -m "Final Python agent before retirement"
git push origin python-agent-final
```

#### Step 3: Remove Python Agent Code

```bash
# Delete Python agent service
rm -rf services/agent

# Delete sandbox service (if not kept as adapter)
rm -rf services/sandbox

# Update deployment manifests
rm k8s/deployments/python-agent.yaml
```

#### Step 4: Update Documentation

```bash
# Update deployment docs
vim docs/deployment/orchestrator.md

# Update architecture diagrams
vim docs/architecture/system-overview.md

# Add retirement notice
echo "Python agent retired on $(date)" >> docs/refactor-2026/phase-logs/phase-8.log
```

#### Step 5: Deploy Final Configuration

```bash
# Remove Python agent from deployments
kubectl delete deployment python-agent

# Clean up Python agent resources
kubectl delete service python-agent
kubectl delete configmap python-agent-config

# Verify cleanup
kubectl get pods -l app=python-agent
# Should return: No resources found
```

#### Step 6: Post-Retirement Monitoring

Monitor for 48 hours after retirement:
- Ensure no references to Python agent
- Verify no errors in logs
- Confirm all traffic on Node orchestrator
- Check for any unexpected issues

---

## Monitoring and Alerts

### Key Metrics

| Metric | Baseline | Threshold | Alert Level |
|--------|----------|-----------|-------------|
| Tool error rate | 3.8% | 7.6% (2x) | Critical |
| WS reconnect failures | 0.3% | 5% | Critical |
| Timeline gaps | 0.1% | 0.2% (2x) | Critical |
| Credits miscalculations | 0 | 0 | Critical |
| p95 latency | 3100ms | 4650ms (1.5x) | Warning |

### Alert Configuration

```yaml
# Example Prometheus alert rules
groups:
  - name: phase8_rollback_gates
    interval: 1m
    rules:
      - alert: ToolErrorRateHigh
        expr: tool_error_rate > 0.076
        for: 5m
        annotations:
          summary: "Tool error rate exceeds rollback threshold"

      - alert: WSReconnectFailuresHigh
        expr: ws_reconnect_failure_rate > 0.05
        for: 5m
        annotations:
          summary: "WS reconnect failures exceed 5%"

      - alert: CreditsMiscalculation
        expr: credits_miscalculations > 0
        for: 1m
        annotations:
          summary: "Credits miscalculation detected - immediate rollback"
```

---

## Troubleshooting

### Common Issues

#### Issue: Rollback gates failing intermittently

**Symptoms:**
- Metrics oscillating around thresholds
- Auto-rollback triggered then recovers

**Investigation:**
1. Check for traffic spikes or unusual patterns
2. Review recent deployments
3. Examine tool execution logs
4. Verify infrastructure health

**Resolution:**
- If transient: Continue monitoring
- If persistent: Investigate root cause and consider rollback

#### Issue: Credits miscalculation detected

**Symptoms:**
- Alert: "Credits miscalculation detected"
- Billing discrepancies reported

**Investigation:**
1. Review billing ledger entries
2. Compare Node vs Python billing
3. Check metering logic

**Resolution:**
1. **IMMEDIATE ROLLBACK** - Zero tolerance for billing errors
2. Fix billing logic
3. Reconcile affected user accounts
4. Re-test before re-attempting rollout

#### Issue: High latency on Node orchestrator

**Symptoms:**
- p95 latency > 4650ms
- User complaints about slow responses

**Investigation:**
1. Check CPU/memory usage
2. Review database query performance
3. Examine AI SDK API latency
4. Check for resource contention

**Resolution:**
1. Scale up Node orchestrator replicas
2. Optimize slow queries
3. Consider rollback if latency persists

---

## Communication Plan

### Stakeholder Updates

**Daily (during rollout):**
- Engineering team standup
- Metrics summary to leadership

**Weekly (during hold window):**
- Rollout status report
- Risk assessment update

**Milestones:**
- 5% rollout complete
- 25% rollout complete
- 50% rollout complete
- 100% rollout complete
- Hold window complete
- Retirement complete

### Templates

**Daily Status Update:**
```
Phase 8 Rollout - Day X Update

Current status: [Stage] - [Percentage]%
Rollback gates: ✓ All passing / ⚠ [Issue]
Incidents: [Count] ([Severity])
Next milestone: [Date] - [Description]
```

**Rollback Notification:**
```
ALERT: Phase 8 Rollback Triggered

Trigger: [Automatic/Manual]
Reason: [Gate failure / Manual decision]
Time: [Timestamp]
Current traffic: [Percentage]% Node
Action: Reverting to Python orchestrator
ETA to stable: 60 seconds
```

---

## Success Criteria

### Per-Stage Success Criteria

**5% Rollout:**
- [ ] Feature flag deployed
- [ ] 4 hours monitoring completed
- [ ] All rollback gates passing
- [ ] No critical incidents

**25% Rollout:**
- [ ] Traffic increased successfully
- [ ] 4 hours monitoring completed
- [ ] All rollback gates passing

**50% Rollout:**
- [ ] Traffic increased successfully
- [ ] 4 hours monitoring completed
- [ ] All rollback gates passing

**100% Rollout:**
- [ ] Full cutover completed
- [ ] 8 hours monitoring completed
- [ ] All rollback gates passing
- [ ] Hold window initiated

**Hold Window:**
- [ ] 14 consecutive days with no rollback triggers
- [ ] All SLO metrics within thresholds
- [ ] No critical incidents
- [ ] Billing accuracy 100%
- [ ] Timeline replay correctness 100%

**Retirement:**
- [ ] Python agent code archived
- [ ] Deployment manifests updated
- [ ] Python agent deleted from production
- [ ] 48-hour post-retirement monitoring completed

---

## Appendix: Rollback Gate Formulas

### Tool Error Rate
```
threshold = baseline * multiplier
threshold = 0.038 * 2 = 0.076 (7.6%)
```

### WS Reconnect Failure Rate
```
threshold = baseline * multiplier
threshold = 0.003 * 16.67 = 0.05 (5%)
```

### Timeline Gap Rate
```
threshold = baseline * multiplier
threshold = 0.001 * 2 = 0.002 (0.2%)
```

### p95 Latency
```
threshold = baseline * multiplier
threshold = 3100ms * 1.5 = 4650ms
```

### Credits Miscalculations
```
threshold = 0 (zero tolerance)
```

---

## Contact Information

**On-Call Engineer:** [Pager Duty]
**Tech Lead:** [Name/Contact]
**Incident Channel:** #phase8-rollout
**Escalation Path:** Tech Lead → Engineering Manager → CTO

---

**Document Version:** 1.0.0
**Last Updated:** 2026-02-10
**Next Review:** After each rollout stage
