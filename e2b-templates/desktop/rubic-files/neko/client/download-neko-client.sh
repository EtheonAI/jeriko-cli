#!/bin/bash
# Download Neko client JS bundles for self-hosting.
# Run this once to populate static/js/ — these files are then baked into the E2B template.
# After downloading, the sandbox serves them locally (no external CDN dependency).

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATIC_DIR="$SCRIPT_DIR/static/js"

mkdir -p "$STATIC_DIR"

echo "Downloading Neko client JS bundles..."

curl -fsSL "https://files.manuscdn.com/neko-client/static/js/chunk-vendors.25da2e10.js" \
  -o "$STATIC_DIR/chunk-vendors.25da2e10.js"
echo "  [OK] chunk-vendors.25da2e10.js ($(wc -c < "$STATIC_DIR/chunk-vendors.25da2e10.js") bytes)"

curl -fsSL "https://files.manuscdn.com/neko-client/static/js/app.f5410b2c.js" \
  -o "$STATIC_DIR/app.f5410b2c.js"
echo "  [OK] app.f5410b2c.js ($(wc -c < "$STATIC_DIR/app.f5410b2c.js") bytes)"

echo ""
echo "Done. Files saved to: $STATIC_DIR"
echo "These will be baked into the E2B template on next build."
