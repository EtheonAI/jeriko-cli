#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Rubic Desktop Sandbox — Startup Script (MANUS PARITY)
#
# Matches Manus startup.sh patterns EXACTLY:
#   - DISPLAY=:0 (NOT :99)
#   - Real Xorg with dummy driver (NOT Xvfb)
#   - Health endpoint /healthz (NOT /health)
#   - User ubuntu
#   - Supervisor service management
#   - Proper monitor loop
# ═══════════════════════════════════════════════════════════════════════════

echo "=== Rubic Sandbox Boot ==="

# ─── Phase 1: Load environment ──────────────────────────────────────────

echo "Loading environment..."
source "$HOME/.env"

# Source env.sh for sandbox port config
if [ -f "$HOME/env.sh" ]; then
    source "$HOME/env.sh"
fi

# Function to add env loading to rc files
add_env_to_rc() {
    local rc_file="$1"
    local env_line='[ -f "$HOME/.env" ] && source "$HOME/.env"'
    local user_env_line='[ -f "$HOME/.user_env" ] && source "$HOME/.user_env"'
    local env_sh_line='[ -f "$HOME/env.sh" ] && source "$HOME/env.sh"'

    if [ -f "$rc_file" ]; then
        if ! grep -q "^\[ -f \"\$HOME/.env\" \] && source \"\$HOME/.env\"" "$rc_file"; then
            echo "$env_line" >>"$rc_file"
        fi
        if ! grep -q "^\[ -f \"\$HOME/.user_env\" \] && source \"\$HOME/.user_env\"" "$rc_file"; then
            echo "$user_env_line" >>"$rc_file"
        fi
        if ! grep -q "^\[ -f \"\$HOME/env.sh\" \] && source \"\$HOME/env.sh\"" "$rc_file"; then
            echo "$env_sh_line" >>"$rc_file"
        fi
    else
        echo "$env_line" >"$rc_file"
        echo "$user_env_line" >>"$rc_file"
        echo "$env_sh_line" >>"$rc_file"
    fi

    # Add Python I/O encoding
    if ! grep -q "^export PYTHONIOENCODING=utf-8" "$rc_file"; then
        echo "" >>"$rc_file"
        echo "# Force UTF-8 encoding for Python I/O" >>"$rc_file"
        echo "export PYTHONIOENCODING=utf-8" >>"$rc_file"
    fi
}

# Add environment loading to rc files
add_env_to_rc "$HOME/.bashrc"
add_env_to_rc "$HOME/.zshrc"

# Set up gh command alias (Manus pattern — avoids terminal control sequences)
for rc_file in "$HOME/.bashrc" "$HOME/.zshrc"; do
    if [ -f "$rc_file" ] && ! grep -q "^alias gh=" "$rc_file"; then
        echo 'alias gh="TERM=dumb gh"' >>"$rc_file"
    fi
done

# Load user environment (if exists)
if [ -f "$HOME/.user_env" ]; then
    echo "Loading user environment from ~/.user_env"
    set -a
    source "$HOME/.user_env"
    set +a
fi

# ─── Phase 1.5: Persist E2B-injected env vars ─────────────────────────────
# E2B injects env vars into this process at sandbox creation.
# We write critical ones to ~/.user_env so they survive sudo supervisord
# (which clears the environment). This is a safety net — the orchestrator
# also calls POST /init-sandbox to set these in the Python process.
CRITICAL_VARS="ORCHESTRATOR_URL OPENAI_API_KEY OPENAI_BASE_URL OPENAI_API_BASE RUBIC_UPLOAD_URL CODE_SERVER_PASSWORD CODE_SERVER_PORT CODE_SERVER_DOMAIN BUILT_IN_FORGE_API_KEY BUILT_IN_FORGE_API_URL VITE_FRONTEND_FORGE_API_KEY VITE_FRONTEND_FORGE_API_URL"
touch "$HOME/.user_env"
for var in $CRITICAL_VARS; do
    eval val=\$$var
    if [ -n "$val" ]; then
        if ! grep -q "^export $var=" "$HOME/.user_env" 2>/dev/null; then
            echo "export $var=\"$val\"" >> "$HOME/.user_env"
        fi
    fi
done

# Write sandbox token as secret file (Manus pattern)
if [ -n "$SANDBOX_API_TOKEN" ]; then
    mkdir -p "$HOME/.secrets"
    echo -n "$SANDBOX_API_TOKEN" > "$HOME/.secrets/sandbox_api_token"
    chmod 600 "$HOME/.secrets/sandbox_api_token"
    echo "Sandbox API token written to ~/.secrets/sandbox_api_token"
fi

# Force key env vars for this session
export DISPLAY=${DISPLAY:-:0}  # CRITICAL: :0 not :99!
export PYTHONIOENCODING=utf-8
export RUBIC_OPT_PATH=/opt/.rubic
export RUNTIME_PATH=${RUBIC_OPT_PATH}/runtime
export PYTHONPATH=${RUNTIME_PATH}

echo "DISPLAY=$DISPLAY"
echo "RUBIC_OPT_PATH=$RUBIC_OPT_PATH"

# ─── Phase 2: Start D-Bus (required for desktop session) ────────────────

echo "Starting D-Bus..."
sudo rm -f /run/dbus/pid /var/run/dbus/pid
sudo mkdir -p /var/run/dbus
sudo dbus-daemon --system --fork 2>/dev/null || sudo service dbus start 2>/dev/null || true
dbus-daemon --session --fork 2>/dev/null || true

# ─── Phase 3: Start Xorg (NOT Xvfb!) ────────────────────────────────────

# Clean up stale sockets
sudo rm -rf /tmp/.X11-unix/X${DISPLAY#:} 2>/dev/null

echo "Starting Xorg on $DISPLAY..."
# Use real Xorg with dummy driver (Manus pattern)
sudo X $DISPLAY -config /etc/X11/xorg.conf -nolisten tcp &
XORG_PID=$!

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

# ─── Phase 6: Start supervisord ─────────────────────────────────────────

echo "Starting supervisord..."
if pgrep supervisord > /dev/null; then
    echo "Supervisord already running"
    SUPERVISOR_PID=$(pgrep supervisord | head -1)
else
    sudo supervisord &
    sleep 3
    SUPERVISOR_PID=$(cat /var/run/supervisord.pid 2>/dev/null || pgrep supervisord | head -1)
fi
echo "Supervisor PID: $SUPERVISOR_PID"

# Check supervisor status
echo "Supervisor status:"
sudo supervisorctl status || true

# ─── Phase 7: Start Sandbox Runtime ──────────────────────────────────────

echo "Starting Sandbox Runtime via supervisord..."
sudo supervisorctl start sandbox-runtime

# Wait for sandbox runtime to be ready
echo "Waiting for Sandbox Runtime on port 8330..."
MAX_RETRIES=30
RETRY_COUNT=0
while ! curl -sf http://localhost:8330/healthz > /dev/null 2>&1 && [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
    sleep 1
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "WARNING: Sandbox Runtime failed to start in 30s"
    sudo supervisorctl status sandbox-runtime || true
    # Show logs
    echo "=== Sandbox Runtime Logs ==="
    sudo tail -50 /var/log/supervisor/sandbox-runtime.log || true
    echo "=== Sandbox Runtime Errors ==="
    sudo tail -50 /var/log/supervisor/sandbox-runtime.err.log || true
else
    echo "Sandbox Runtime ready"
fi

# Start MCP server (depends on sandbox runtime being ready)
echo "Starting MCP server via supervisord..."
sudo supervisorctl start mcp-server || true

# ─── Phase 8: Code-server watcher ───────────────────────────────────────
# Code-server starts on-demand when /tmp/start_code_server trigger is created

(
    TRIGGER="/tmp/start_code_server"
    echo "Code-server watcher: waiting for trigger at $TRIGGER..."
    while true; do
        sleep 2
        if [ -f "$TRIGGER" ]; then
            echo "Code-server watcher: trigger detected, starting via supervisorctl..."
            sudo supervisorctl start code-server
            rm -f "$TRIGGER"
            echo "Code-server started (managed by supervisord)"
            break
        fi
    done
) &

# ─── Phase 9: Process monitor (Manus watchdog pattern) ──────────────────

monitor_processes() {
    while true; do
        sleep 15

        # Check supervisord (Manus pattern)
        if ! sudo kill -0 $SUPERVISOR_PID 2>/dev/null; then
            echo "MONITOR: Supervisord died, restarting..."
            if pgrep supervisord > /dev/null; then
                SUPERVISOR_PID=$(pgrep supervisord | head -1)
            else
                sudo supervisord &
                sleep 2
                SUPERVISOR_PID=$(cat /var/run/supervisord.pid 2>/dev/null || pgrep supervisord | head -1)
            fi
        fi

        # Check Sandbox Runtime health via supervisor
        if ! curl -sf http://localhost:8330/healthz > /dev/null 2>&1; then
            echo "MONITOR: Sandbox Runtime not responding"
            sudo supervisorctl status sandbox-runtime || true
            echo "MONITOR: Restarting sandbox-runtime via supervisorctl..."
            sudo supervisorctl restart sandbox-runtime
            sleep 2
        fi

        # Check Xorg
        if ! sudo kill -0 $XORG_PID 2>/dev/null; then
            echo "MONITOR: Xorg died, restarting..."
            sudo rm -rf /tmp/.X11-unix/X${DISPLAY#:} 2>/dev/null
            sudo X $DISPLAY -config /etc/X11/xorg.conf -nolisten tcp &
            XORG_PID=$!
            sleep 1
        fi

        # Check Neko (managed by supervisor, so just check if it's running)
        if ! pgrep -f "neko serve" > /dev/null; then
            echo "MONITOR: Neko not running, supervisor should restart it"
            sudo supervisorctl status neko-server || true
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
echo "  Sandbox Runtime:  port 8330 (external), port 9330 (internal)"
echo "  Upgrade Service:  port 8340"
echo "  Neko WebRTC:      port 8333"
echo "  Code-server:      port 8329 (on-demand)"
echo "  Display:          $DISPLAY"
echo "  Home:             $HOME"
echo "  Runtime:          /opt/.rubic"

# Keep running — wait for ALL background processes
wait
