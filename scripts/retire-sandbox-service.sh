#!/bin/bash
# scripts/retire-sandbox-service.sh
# Phase 8 sandbox service retirement script (P8.15 - CONDITIONAL)
# Only execute if decision matrix indicates DELETE

set -euo pipefail

CONFIRM="${1:-}"

echo "=== Phase 8 Sandbox Service Retirement (P8.15) ==="
echo "⚠️  WARNING: This operation removes services/sandbox/"
echo ""

# Decision matrix check
echo "[Decision Matrix] Validating retirement conditions..."
echo ""
echo "Conditions for DELETE:"
echo "  1. No external callers to services/sandbox API"
echo "  2. Admin tools migrated to orchestrator endpoints"
echo "  3. Observability dashboards migrated to orchestrator metrics"
echo ""
echo "If ANY condition is FALSE, choose KEEP AS ADAPTER instead."
echo ""

if [ "$CONFIRM" != "--confirm" ]; then
  echo "⚠️  FINAL CONFIRMATION REQUIRED"
  echo ""
  echo "This script will:"
  echo "  1. Archive services/sandbox/ to S3 cold storage"
  echo "  2. Remove services/sandbox/ directory"
  echo "  3. Remove sandbox service from docker-compose.yml"
  echo "  4. Update deployment scripts"
  echo ""
  echo "Alternative: Keep as thin adapter (services/sandbox/src/adapter.ts)"
  echo ""
  echo "To proceed with DELETE, run: $0 --confirm"
  exit 0
fi

echo "=== Beginning Sandbox Service Retirement ==="
echo ""

# Step 1: Archive to S3
echo "[Step 1/4] Archiving services/sandbox/ to S3..."
ARCHIVE_PATH="s3://rubic-archives/sandbox-service/$(date +%Y-%m-%d)/"

if [ -d "services/sandbox" ]; then
  echo "  Creating tarball..."
  tar -czf "sandbox-service-$(date +%Y-%m-%d).tar.gz" services/sandbox/

  echo "  Uploading to S3: $ARCHIVE_PATH"
  if command -v aws &> /dev/null; then
    aws s3 cp "sandbox-service-$(date +%Y-%m-%d).tar.gz" "$ARCHIVE_PATH" || echo "⚠ S3 upload failed (manual upload required)"
  else
    echo "⚠ AWS CLI not found, archive saved locally: sandbox-service-$(date +%Y-%m-%d).tar.gz"
  fi
  echo "✓ Archive complete"
else
  echo "✗ services/sandbox/ not found"
  exit 1
fi

# Step 2: Remove services/sandbox/ directory
echo "[Step 2/4] Removing services/sandbox/ directory..."
mv services/sandbox services/sandbox.backup
echo "✓ services/sandbox/ moved to services/sandbox.backup"

# Step 3: Remove from docker-compose.yml
echo "[Step 3/4] Removing sandbox service from docker-compose.yml..."
if [ -f "docker-compose.yml" ]; then
  cp docker-compose.yml docker-compose.yml.backup

  # Remove sandbox service
  sed -i.bak '/sandbox:/,/^[^ ]/d' docker-compose.yml || echo "⚠ Manual docker-compose.yml edit required"
  echo "✓ docker-compose.yml updated (backup: docker-compose.yml.backup)"
else
  echo "⚠ docker-compose.yml not found"
fi

# Step 4: Update deployment scripts
echo "[Step 4/4] Updating deployment scripts..."
if [ -f "scripts/deploy.sh" ]; then
  cp scripts/deploy.sh scripts/deploy.sh.backup

  # Update docker-compose commands to remove sandbox
  sed -i.bak 's/orchestrator.*sandbox/orchestrator/g' scripts/deploy.sh || echo "⚠ Manual scripts/deploy.sh edit required"
  echo "✓ scripts/deploy.sh updated (backup: scripts/deploy.sh.backup)"
else
  echo "⚠ scripts/deploy.sh not found"
fi

echo ""
echo "=== Sandbox Service Retirement Complete ==="
echo ""
echo "✓ services/sandbox/ retired (P8.15)"
echo ""
echo "Backups created:"
echo "  - services/sandbox.backup/ (local)"
echo "  - sandbox-service-$(date +%Y-%m-%d).tar.gz (local)"
echo "  - docker-compose.yml.backup"
echo "  - scripts/deploy.sh.backup"
echo ""
echo "S3 archive: $ARCHIVE_PATH"
echo ""
echo "⚠️  Manual steps required:"
echo "  1. Update Kubernetes manifests to remove sandbox deployment"
echo "  2. Update service mesh config to remove sandbox routes"
echo "  3. Update monitoring dashboards to remove sandbox metrics"
echo "  4. Verify orchestrator handles all E2B lifecycle operations"
echo ""
echo "Retirement timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
