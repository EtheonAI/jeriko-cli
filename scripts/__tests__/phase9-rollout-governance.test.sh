#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

bash -n "$ROOT_DIR/scripts/phase9/hold-window-check.sh"
bash -n "$ROOT_DIR/scripts/phase9/retirement-readiness.sh"

"$ROOT_DIR/scripts/phase9/hold-window-check.sh" "ci-check" >/dev/null
"$ROOT_DIR/scripts/phase9/retirement-readiness.sh" >/dev/null

echo "phase9 governance tests passed"
