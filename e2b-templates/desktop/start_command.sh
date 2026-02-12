#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Rubic Desktop Sandbox — Startup Script
#
# Follows the Manus bootstrap pattern:
#   1. Load environment (.env + .user_env)
#   2. Ensure rc files source env
#   3. Start D-Bus
#   4. Start Xvfb → PulseAudio → XFCE desktop
#   5. Start Neko WebRTC server
#   6. TURN watcher (restarts Neko when TURN credentials arrive)
#   7. Monitor loop (keep processes alive)
#
# Environment Layers:
#   ~/.env       — Layer 1: static config (baked at template build)
#   ~/.user_env  — Layer 2: session secrets (written post-creation by sandbox service)
#   ~/.secrets/  — Layer 3: sandbox_api_token (written post-creation)
# ═══════════════════════════════════════════════════════════════════════════

echo "=== Rubic Sandbox Boot ==="

# ─── Phase 1: Load environment ──────────────────────────────────────────

# Source base env (Layer 1 — baked into template)
if [ -f "$HOME/.env" ]; then
    echo "Loading base environment from ~/.env"
    set -a
    source "$HOME/.env"
    set +a
fi

# Source user env (Layer 2 — may not exist yet at boot, that's OK)
if [ -f "$HOME/.user_env" ]; then
    echo "Loading user environment from ~/.user_env"
    set -a
    source "$HOME/.user_env"
    set +a
fi

# Force key env vars for this session
export DISPLAY=${DISPLAY:-:99}
export PYTHONIOENCODING=utf-8
export RUBIC_OPT_PATH=/opt/.rubic
export RUNTIME_PATH=${RUBIC_OPT_PATH}/runtime

echo "DISPLAY=$DISPLAY"
echo "RUBIC_OPT_PATH=$RUBIC_OPT_PATH"

# ─── Phase 2: Start D-Bus (required for desktop session) ────────────────

echo "Starting D-Bus..."
sudo rm -f /run/dbus/pid /var/run/dbus/pid
sudo mkdir -p /var/run/dbus
sudo dbus-daemon --system --fork 2>/dev/null || sudo service dbus start 2>/dev/null || true
dbus-daemon --session --fork 2>/dev/null || true

# ─── Phase 3: Start Xvfb (virtual framebuffer) ──────────────────────────

# Clean up stale sockets
rm -rf /tmp/.X11-unix/X${DISPLAY#:} 2>/dev/null

echo "Starting Xvfb on $DISPLAY..."
Xvfb $DISPLAY -ac -screen 0 1280x720x24 +extension GLX +render -noreset -nolisten tcp &
XVFB_PID=$!

# Wait for X server to be ready
until xset -q -display $DISPLAY > /dev/null 2>&1; do
    echo "Waiting for X server..."
    sleep 0.5
done
echo "X server ready on $DISPLAY"

# ─── Phase 4: Start PulseAudio ──────────────────────────────────────────

pulseaudio --start --exit-idle-time=-1 2>/dev/null || true

# ─── Phase 5: Start XFCE desktop session ────────────────────────────────

startxfce4 &
sleep 2

# ─── Phase 6: Neko WebRTC server ────────────────────────────────────────

# Helper: build ICE config from TURN credentials file
build_ice_config() {
    python3 << 'PYEOF'
import json

turn_file = "/tmp/turn_credentials.json"
stun_front = [{"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}]
stun_back = [{"urls": ["stun:stun.l.google.com:19302"]}]

turn_servers = []
try:
    with open(turn_file) as f:
        data = json.load(f)
    turn_servers = data.get("iceServers", [])
    print("Loaded %d ICE servers from TURN provider" % len(turn_servers))
except FileNotFoundError:
    print("No TURN credentials file found (STUN-only mode)")
except Exception as e:
    print("WARNING: Failed to parse TURN credentials: %s" % e)

frontend = json.dumps(stun_front + turn_servers)
backend = json.dumps(stun_back + turn_servers)

with open("/tmp/ice_frontend.json", "w") as f:
    f.write(frontend)
with open("/tmp/ice_backend.json", "w") as f:
    f.write(backend)

print("ICE Frontend: %s" % frontend[:200])
print("ICE Backend: %s" % backend[:200])

if not turn_servers:
    print("WARNING: No TURN configured. WebRTC will NOT work through E2B.")
PYEOF
}

# Helper: start Neko with current ICE config
start_neko() {
    local ICE_FRONTEND=$(cat /tmp/ice_frontend.json 2>/dev/null || echo '[{"urls":["stun:stun.l.google.com:19302"]}]')
    local ICE_BACKEND=$(cat /tmp/ice_backend.json 2>/dev/null || echo '[{"urls":["stun:stun.l.google.com:19302"]}]')

    NEKO_SERVER_STATIC="/var/www" \
    NEKO_SERVER_BIND=":8080" \
    NEKO_DESKTOP_SCREEN="1280x720@30" \
    NEKO_DESKTOP_INPUT_ENABLED="false" \
    NEKO_CAPTURE_VIDEO_DISPLAY=":99" \
    NEKO_MEMBER_PROVIDER="multiuser" \
    NEKO_MEMBER_MULTIUSER_USER_PASSWORD="neko" \
    NEKO_MEMBER_MULTIUSER_ADMIN_PASSWORD="admin" \
    NEKO_SESSION_COOKIE_ENABLED="false" \
    NEKO_SESSION_IMPLICIT_HOSTING="true" \
    NEKO_SESSION_MERCIFUL_RECONNECT="true" \
    NEKO_WEBRTC_ICELITE="false" \
    NEKO_WEBRTC_TCPMUX="0" \
    NEKO_WEBRTC_UDPMUX="0" \
    NEKO_WEBRTC_ICESERVERS_FRONTEND="$ICE_FRONTEND" \
    NEKO_WEBRTC_ICESERVERS_BACKEND="$ICE_BACKEND" \
    neko serve &
    NEKO_PID=$!
    echo "Neko started (PID $NEKO_PID)"
}

# Build initial ICE config (STUN-only — TURN credentials arrive via file write later)
build_ice_config

# Start Neko
start_neko

# ─── Phase 7: TURN watcher ──────────────────────────────────────────────
# E2B injects env vars for exec commands AFTER boot, not during start_command.
# The sandbox service writes /tmp/turn_credentials.json via files.write() after creation.
# This watcher detects the file and restarts Neko with TURN-enabled ICE config.

TURN_FILE="/tmp/turn_credentials.json"
(
    TURN_READY="/tmp/turn_ready"

    # Skip if TURN already configured
    if [ -f "$TURN_FILE" ] && python3 -c "
import json
with open('$TURN_FILE') as f:
    d = json.load(f)
has_turn = any('turn:' in str(s.get('urls','')) for s in d.get('iceServers',[]))
exit(0 if has_turn else 1)
" 2>/dev/null; then
        echo "TURN already configured at boot, no watcher needed"
        exit 0
    fi

    echo "TURN watcher: waiting for $TURN_FILE with TURN servers..."
    for i in $(seq 1 60); do
        sleep 1
        if [ -f "$TURN_FILE" ] && python3 -c "
import json
with open('$TURN_FILE') as f:
    d = json.load(f)
has_turn = any('turn:' in str(s.get('urls','')) for s in d.get('iceServers',[]))
exit(0 if has_turn else 1)
" 2>/dev/null; then
            echo "TURN watcher: TURN credentials detected! Restarting Neko..."
            build_ice_config

            # Kill old Neko
            pkill -f "neko serve" 2>/dev/null
            sleep 2

            # Start new Neko with TURN
            start_neko
            echo "TURN watcher: Neko restarted with TURN relay"
            touch "$TURN_READY"
            exit 0
        fi
    done
    echo "TURN watcher: timed out after 60s, Neko running with STUN-only"
) &

# ─── Phase 8: User-env watcher ──────────────────────────────────────────
# The sandbox service writes ~/.user_env AFTER boot with session-specific
# secrets (proxy token, API URLs). This watcher re-sources it for the
# running session so subsequent shell_exec commands pick up the new env.

(
    USER_ENV_READY="/tmp/user_env_ready"
    echo "User-env watcher: waiting for ~/.user_env to be populated..."
    for i in $(seq 1 30); do
        sleep 1
        if [ -s "$HOME/.user_env" ]; then
            echo "User-env watcher: ~/.user_env populated, sourcing..."
            set -a
            source "$HOME/.user_env"
            set +a
            touch "$USER_ENV_READY"
            echo "User-env watcher: session environment loaded"
            exit 0
        fi
    done
    echo "User-env watcher: timed out after 30s (no user env injected)"
) &

# ─── Phase 9: Code-server (started on demand) ─────────────────────────
# Code-server (VS Code in browser) runs on port 8329. It's NOT started at boot
# (like Manus — autostart=false). The orchestrator writes /tmp/start_code_server
# as a trigger file when the user needs IDE access. This watcher detects it.

(
    TRIGGER="/tmp/start_code_server"
    echo "Code-server watcher: waiting for trigger at $TRIGGER..."
    while true; do
        sleep 2
        if [ -f "$TRIGGER" ]; then
            # Re-source env to pick up session-specific password
            [ -f "$HOME/.env" ] && source "$HOME/.env"
            [ -f "$HOME/.user_env" ] && source "$HOME/.user_env"

            CS_PORT="${CODE_SERVER_PORT:-8329}"
            CS_PASS="${CODE_SERVER_PASSWORD:-rubic-default}"

            # Update config file with session password (Manus pattern)
            mkdir -p /home/user/.config/code-server
            cat > /home/user/.config/code-server/config.yaml << CSEOF
bind-addr: 0.0.0.0:${CS_PORT}
auth: password
password: ${CS_PASS}
cert: false
CSEOF

            echo "Code-server watcher: starting code-server on port $CS_PORT..."
            code-server \
                --config /home/user/.config/code-server/config.yaml \
                --disable-workspace-trust \
                --disable-telemetry \
                --disable-update-check \
                /home/user &
            CS_PID=$!
            echo "Code-server started (PID $CS_PID) on port $CS_PORT"
            rm -f "$TRIGGER"
            break
        fi
    done
) &

# ─── Phase 9.5: Terminal Server (Manus sandbox runtime API) ─────────────
# Stateful PTY management on port 8330. The orchestrator / sandbox service
# communicates with this server via HTTP instead of using E2B SDK commands.
# Architecture: LLM → Orchestrator → Sandbox Service → Terminal Server → PTY → bash

echo "Starting Terminal Server on port 8330..."
node /opt/.rubic/runtime/terminal-server.mjs &
TERMINAL_SERVER_PID=$!

# Wait for terminal server to be ready
for i in $(seq 1 20); do
    if curl -sf http://localhost:8330/health > /dev/null 2>&1; then
        echo "Terminal Server ready (PID $TERMINAL_SERVER_PID)"
        break
    fi
    sleep 0.25
done

# ─── Phase 10: Process monitor (simplified Manus watchdog) ──────────────
# Monitors critical processes and restarts them if they die.

monitor_processes() {
    while true; do
        sleep 15

        # Check Xvfb
        if ! kill -0 $XVFB_PID 2>/dev/null; then
            echo "MONITOR: Xvfb died, restarting..."
            Xvfb $DISPLAY -ac -screen 0 1280x720x24 +extension GLX +render -noreset -nolisten tcp &
            XVFB_PID=$!
            sleep 1
        fi

        # Check Neko
        if ! pgrep -f "neko serve" > /dev/null; then
            echo "MONITOR: Neko died, restarting..."
            start_neko
        fi

        # Check Terminal Server
        if ! kill -0 $TERMINAL_SERVER_PID 2>/dev/null; then
            echo "MONITOR: Terminal Server died, restarting..."
            node /opt/.rubic/runtime/terminal-server.mjs &
            TERMINAL_SERVER_PID=$!
        fi

        # Check D-Bus
        if ! pgrep dbus-daemon > /dev/null; then
            echo "MONITOR: D-Bus died, restarting..."
            sudo dbus-daemon --system --fork 2>/dev/null || true
            dbus-daemon --session --fork 2>/dev/null || true
        fi
    done
}

monitor_processes &
MONITOR_PID=$!

echo "=== Rubic Sandbox Ready ==="
echo "  Neko WebRTC:     port 8080"
echo "  Terminal Server:  port 8330"
echo "  Display:          $DISPLAY"
echo "  Home:             /home/user"
echo "  Runtime:          /opt/.rubic"

# Keep running — wait for ALL background processes
wait
