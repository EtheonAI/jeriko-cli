#!/bin/bash

# Neko startup script with TURN configuration

set -e

# Generate and persist Neko passwords to ~/.env, and update config file
ENV_FILE="/home/ubuntu/.env"
NEKO_CONFIG="/opt/.rubic/neko/config/neko.yml"
mkdir -p "$(dirname "$ENV_FILE")"
[ -f "$ENV_FILE" ] || touch "$ENV_FILE"

if ! grep -q "^export NEKO_ADMIN_PASSWORD=" "$ENV_FILE"; then
NEKO_ADMIN_PASSWORD=$(openssl rand -base64 8 | md5sum | head -c16)
echo "export NEKO_ADMIN_PASSWORD=\"$NEKO_ADMIN_PASSWORD\"" >> "$ENV_FILE"
fi
if ! grep -q "^export NEKO_USER_PASSWORD=" "$ENV_FILE"; then
NEKO_USER_PASSWORD=$(openssl rand -base64 8 | md5sum | head -c16)
echo "export NEKO_USER_PASSWORD=\"$NEKO_USER_PASSWORD\"" >> "$ENV_FILE"
fi
if ! grep -q "^export NEKO_USERNAME=" "$ENV_FILE"; then
echo "export NEKO_USERNAME=\"neko\"" >> "$ENV_FILE"
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

# Write back to Neko configuration file
if [ -f "$NEKO_CONFIG" ]; then
  sed -i "s/admin_password: \".*\"/admin_password: \"$NEKO_ADMIN_PASSWORD\"/" "$NEKO_CONFIG" || true
  sed -i "s/user_password: \".*\"/user_password: \"$NEKO_USER_PASSWORD\"/" "$NEKO_CONFIG" || true
fi

echo "🚀 Starting neko server with TURN support..."

# Wait for X11 server to start
echo "⏳ Waiting for X11 server to start..."
until [ -S /tmp/.X11-unix/X0 ]; do 
    echo 'waiting Xorg'
    sleep 1
done

# Wait for neko input driver
echo "⏳ Waiting for neko input driver..."
until [ -S /tmp/xf86-input-neko.sock ]; do
    echo 'waiting neko input driver'
    sleep 1
done

# Set permissions
chmod 666 /tmp/xf86-input-neko.sock || true

# Read ICE server configuration (written by /init-sandbox)
ICE_SERVERS_PATH="/opt/.rubic/neko/config/ice_servers.json"
DEFAULT_STUN='[{"urls":["stun:stun.l.google.com:19302"]}]'

echo "🔧 Loading ICE server configuration..."
if [ -f "$ICE_SERVERS_PATH" ]; then
  # Compress to single-line JSON; fallback to default STUN on failure
  ICE_SERVERS=$(cat "$ICE_SERVERS_PATH" 2>/dev/null | jq -c '.' 2>/dev/null || echo "$DEFAULT_STUN")
else
  ICE_SERVERS="$DEFAULT_STUN"
fi

# Validate JSON is an array
if [ -z "$ICE_SERVERS" ] || [ "$ICE_SERVERS" = "null" ]; then
  ICE_SERVERS="$DEFAULT_STUN"
fi

# Display configuration info (URLs only)
echo "📋 ICE server configuration (URLs only):"
echo "$ICE_SERVERS" | jq '.[] | {urls: .urls}'

# Start neko server
echo "🚀 Starting neko server..."
exec /opt/.rubic/neko/server/neko serve \
  --config /opt/.rubic/neko/config/neko.yml \
  --server.bind 0.0.0.0:8333 \
  --webrtc.icelite=false \
  --webrtc.nat1to1 127.0.0.1 \
  --webrtc.iceservers.backend "$ICE_SERVERS" \
  --webrtc.iceservers.frontend "$ICE_SERVERS" \
  --webrtc.epr 59000-59100 \
  --desktop.screen 1280x1029@30
