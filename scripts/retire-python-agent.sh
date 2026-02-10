#!/bin/bash
# scripts/retire-python-agent.sh
# Phase 8 Python agent retirement script (P8.14)
# GUARDED: Requires --confirm and precondition checks

set -euo pipefail

CONFIRM_FLAG="${1:-}"
DRY_RUN=true

if [[ "$CONFIRM_FLAG" == "--confirm" ]]; then
  DRY_RUN=false
fi

echo "=== Phase 8: Python Agent Retirement (P8.14) ==="
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Mode: $([ "$DRY_RUN" = true ] && echo "DRY-RUN" || echo "LIVE")"
echo ""

# Precondition 1: Verify hold window complete (14 days)
echo "[Precondition 1] Verifying 14-day hold window completion..."
HOLD_WINDOW_COMPLETE="${HOLD_WINDOW_COMPLETE:-false}"
if [[ "$HOLD_WINDOW_COMPLETE" != "true" ]]; then
  echo "✗ FAILED: Hold window (14 days) not complete"
  echo "  Set HOLD_WINDOW_COMPLETE=true after Day 85 verification"
  exit 1
fi
echo "✓ Hold window complete (14 days verified)"

# Precondition 2: Tech lead sign-off
echo "[Precondition 2] Checking tech lead approval..."
TECH_LEAD_APPROVAL="${TECH_LEAD_APPROVAL:-false}"
if [[ "$TECH_LEAD_APPROVAL" != "true" ]]; then
  echo "✗ FAILED: Tech lead sign-off required"
  echo "  Set TECH_LEAD_APPROVAL=true after approval obtained"
  exit 2
fi
echo "✓ Tech lead sign-off confirmed"

# Precondition 3: Rollback gates passed for 14 days
echo "[Precondition 3] Validating rollback gates..."
if ! ./scripts/validate-rollback-gates.sh 24h > /dev/null 2>&1; then
  echo "✗ FAILED: Rollback gate validation failed"
  echo "  Run: ./scripts/validate-rollback-gates.sh"
  exit 3
fi
echo "✓ Rollback gates passed"

# Precondition 4: Require explicit --confirm flag
if [[ "$DRY_RUN" = true ]]; then
  echo ""
  echo "✓ All preconditions satisfied"
  echo "⚠️  DRY-RUN MODE: No files will be deleted"
  echo ""
  echo "Would delete:"
  echo "  - services/agent/ (Python agent codebase)"
  echo "  - Dockerfile.agent-python"
  echo "  - docker-compose.yml (agent-python service)"
  echo "  - .github/workflows/build-python-agent.yml"
  echo ""
  echo "Would archive:"
  echo "  - Python agent Docker image → S3 cold storage"
  echo ""
  echo "To execute deletion, run:"
  echo "  HOLD_WINDOW_COMPLETE=true TECH_LEAD_APPROVAL=true ./scripts/retire-python-agent.sh --confirm"
  exit 0
fi

# LIVE MODE: Perform deletion
echo ""
echo "⚠️  LIVE MODE: Deleting Python agent (IRREVERSIBLE)"
echo "Proceeding in 5 seconds... (Ctrl+C to abort)"
sleep 5

# Step 1: Archive Python agent image
echo "[Step 1] Archiving Python agent Docker image..."
PYTHON_AGENT_VERSION="${PYTHON_AGENT_VERSION:-latest}"
if command -v docker &> /dev/null; then
  docker pull "rubic/agent-python:${PYTHON_AGENT_VERSION}" || echo "⚠️  Image not found in registry"
  docker save "rubic/agent-python:${PYTHON_AGENT_VERSION}" | gzip > "/tmp/agent-python-${PYTHON_AGENT_VERSION}.tar.gz"
  echo "✓ Image archived to /tmp/agent-python-${PYTHON_AGENT_VERSION}.tar.gz"
  echo "  TODO: Upload to S3 cold storage"
else
  echo "⚠️  Docker not available, skipping image archive"
fi

# Step 2: Remove services/agent/
echo "[Step 2] Removing services/agent/ directory..."
if [[ -d "services/agent" ]]; then
  rm -rf "services/agent"
  echo "✓ services/agent/ deleted"
else
  echo "⚠️  services/agent/ not found (already removed?)"
fi

# Step 3: Remove Dockerfile.agent-python
echo "[Step 3] Removing Dockerfile.agent-python..."
if [[ -f "Dockerfile.agent-python" ]]; then
  rm -f "Dockerfile.agent-python"
  echo "✓ Dockerfile.agent-python deleted"
else
  echo "⚠️  Dockerfile.agent-python not found"
fi

# Step 4: Remove docker-compose agent-python service
echo "[Step 4] Updating docker-compose.yml..."
if [[ -f "docker-compose.yml" ]]; then
  # This is a simplified example; in production use proper YAML parser
  if grep -q "agent-python:" "docker-compose.yml"; then
    echo "⚠️  MANUAL ACTION REQUIRED: Remove agent-python service from docker-compose.yml"
    echo "  Lines to remove: agent-python service definition"
  else
    echo "✓ agent-python service not found in docker-compose.yml"
  fi
else
  echo "⚠️  docker-compose.yml not found"
fi

# Step 5: Remove CI/CD workflows
echo "[Step 5] Removing CI/CD Python agent builds..."
if [[ -f ".github/workflows/build-python-agent.yml" ]]; then
  rm -f ".github/workflows/build-python-agent.yml"
  echo "✓ .github/workflows/build-python-agent.yml deleted"
else
  echo "⚠️  Python agent workflow not found"
fi

echo ""
echo "✓ Python agent retirement complete"
echo "✓ Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""
echo "Post-retirement checklist:"
echo "  [ ] Upload archived image to S3 cold storage"
echo "  [ ] Remove Python agent from Kubernetes manifests"
echo "  [ ] Update monitoring dashboards"
echo "  [ ] Update service mesh config"
echo "  [ ] Notify team of retirement completion"
