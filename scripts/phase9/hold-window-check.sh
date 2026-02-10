#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PHASE9_LOG="$ROOT_DIR/docs/refactor-2026/phase-logs/phase-9.log"
DAY_LABEL="${1:-day-check}"
TS="$(date -u +"%Y-%m-%d %H:%M:%S UTC")"

mkdir -p "$(dirname "$PHASE9_LOG")"

if [[ ! -f "$ROOT_DIR/scripts/validate-rollback-gates.sh" ]]; then
  echo "[$TS] phase9: hold-window-check -> FAIL (missing scripts/validate-rollback-gates.sh)" >> "$PHASE9_LOG"
  echo "missing rollback gate validator"
  exit 1
fi

if OUTPUT=$(cd "$ROOT_DIR" && ./scripts/validate-rollback-gates.sh 24h 2>&1); then
  echo "[$TS] phase9: hold-window-check($DAY_LABEL) -> PASS" >> "$PHASE9_LOG"
  echo "$OUTPUT"
  exit 0
fi

echo "[$TS] phase9: hold-window-check($DAY_LABEL) -> FAIL" >> "$PHASE9_LOG"
echo "$OUTPUT"
exit 1
