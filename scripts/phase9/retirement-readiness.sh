#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PHASE9_LOG="$ROOT_DIR/docs/refactor-2026/phase-logs/phase-9.log"
PHASE8_LOG="$ROOT_DIR/docs/refactor-2026/phase-logs/phase-8.log"
TS="$(date -u +"%Y-%m-%d %H:%M:%S UTC")"

mkdir -p "$(dirname "$PHASE9_LOG")"

required=(
  "$ROOT_DIR/scripts/retire-python-agent.sh"
  "$ROOT_DIR/scripts/retire-sandbox-service.sh"
  "$ROOT_DIR/scripts/validate-rollback-gates.sh"
)

for file in "${required[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "[$TS] phase9: retirement-readiness -> FAIL (missing $file)" >> "$PHASE9_LOG"
    echo "missing: $file"
    exit 1
  fi
  bash -n "$file"
done

PY_OUTPUT=$(cd "$ROOT_DIR" && env HOLD_WINDOW_COMPLETE=true TECH_LEAD_APPROVAL=true ./scripts/retire-python-agent.sh 2>&1 || true)
if ! echo "$PY_OUTPUT" | grep -q "DRY-RUN MODE"; then
  echo "[$TS] phase9: retirement-readiness -> FAIL (python retirement dry-run guard mismatch)" >> "$PHASE9_LOG"
  echo "python retirement dry-run guard mismatch"
  exit 1
fi

SB_OUTPUT=$(cd "$ROOT_DIR" && ./scripts/retire-sandbox-service.sh 2>&1 || true)
if ! echo "$SB_OUTPUT" | grep -q "FINAL CONFIRMATION REQUIRED"; then
  echo "[$TS] phase9: retirement-readiness -> FAIL (sandbox confirmation guard mismatch)" >> "$PHASE9_LOG"
  echo "sandbox confirmation guard mismatch"
  exit 1
fi

if [[ -f "$PHASE8_LOG" ]] && ! grep -q "Phase 8 verification complete" "$PHASE8_LOG"; then
  echo "[$TS] phase9: retirement-readiness -> FAIL (phase8 completion evidence missing)" >> "$PHASE9_LOG"
  echo "phase8 completion evidence missing"
  exit 1
fi

echo "[$TS] phase9: retirement-readiness -> PASS" >> "$PHASE9_LOG"
echo "retirement readiness checks passed"
