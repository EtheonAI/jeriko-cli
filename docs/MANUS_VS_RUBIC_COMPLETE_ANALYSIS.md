# Manus vs Rubic: Complete E2B Implementation Analysis

**Date**: February 13, 2026
**Purpose**: Comprehensive comparison to achieve Manus parity in Rubic E2B template
**Sources**: Actual Manus runtime files (378MB archive), startup scripts, supervisor configs

---

## 1. CRITICAL DIFFERENCES (Must Fix)

### 1.1 Display Server
- **Manus**: `DISPLAY=:0`
- **Rubic**: `DISPLAY=:99` ❌
- **Impact**: ALL X11 applications, Neko WebRTC, Xorg configs must use :0

### 1.2 Ports
| Service | Manus | Rubic | Status |
|---------|-------|-------|--------|
| Terminal Server | 8330 | 8330 | ✅ |
| Runtime Upgrade | 8340 | N/A | ❌ Missing |
| Neko WebRTC | 8333 | 8080 | ❌ Wrong |
| Code-server | 8329 | 8329 | ✅ |
| Chrome Debug | 9222 | 9222 | ✅ |

### 1.3 Health Endpoints
- **Manus Sandbox Runtime**: `/healthz` (port 8330)
- **Rubic**: `/health` ❌ Wrong endpoint!
- **Manus Runtime Upgrade**: `/health` (port 8340)

### 1.4 User and Paths
| Item | Manus | Rubic | Status |
|------|-------|-------|--------|
| User | `ubuntu` | `user` | ❌ |
| Home | `/home/ubuntu` | `/home/user` | ❌ |
| Opt Path | `/opt/.manus` | `/opt/.rubic` | ✅ Similar |
| Runtime Path | `/opt/.manus/.sandbox-runtime` | `/opt/.rubic/runtime` | ❌ |

### 1.5 Supervisor Configuration
**Manus has proper supervisor configs:**
- `/etc/supervisor/conf.d/1-sandbox-runtime.conf` - Terminal server
- `/etc/supervisor/conf.d/7-code-server.conf` - Code-server (autostart=false, depends_on=sandbox-runtime)
- `/etc/supervisor/conf.d/neko-supervisor.conf` - Neko WebRTC (autostart=true)

**Rubic's implementation** (current):
- Created supervisor configs but sandboxes fail to boot
- Terminal server not starting via supervisor
- Bootstrap problem: can't debug without terminal access

---

## 2. MANUS ARCHITECTURE (Verified)

### 2.1 Directory Structure
```
/opt/.manus/
├── .host_id                    # EC2 instance ID
├── .sandbox-runtime → current  # Symlink
├── current/                    # Active runtime
│   ├── start_server           # Nuitka-compiled Python binary (14.9 MB)
│   ├── start_server.sh        # Wrapper script (sets PYTHONPATH)
│   ├── upgrade                # Upgrade binary (14.5 MB)
│   ├── upgrade.sh             # Upgrade wrapper
│   ├── .venv/                 # Python 3.13 virtual env
│   ├── data_api.py            # API client using sandbox_api_token
│   └── runtime_version.py     # VERSION = '2.0.17'
├── .packages/
│   ├── scripts/
│   │   ├── env.sh                      # Sets SANDBOX_SERVER_PORT=9330
│   │   ├── check-start-code-server.sh  # Waits for :8330/healthz, generates password
│   │   ├── start-neko-with-turn.sh     # Neko startup with TURN
│   │   ├── start-chrome.sh             # Chrome with extensions
│   │   ├── start-clock-sync.sh
│   │   ├── start-vnc.sh
│   │   └── start-manus-mcp-server.sh
│   └── chrome-extensions/
│       ├── manus-helper/
│       ├── ublock-lite/
│       └── ublock-origin/
├── webdev/
│   └── templates/
│       └── web-dev-templates/
│           ├── web-static/
│           ├── web-db-user/
│           └── app/
├── deploy/
│   └── templates/
│       ├── next/
│       ├── react/
│       ├── flask/
│       └── [30+ other templates]
└── neko/
    ├── client/              # Neko web client
    ├── server/neko          # Neko binary
    ├── config/
    │   ├── neko.yml         # Neko configuration
    │   ├── neko-supervisor.conf
    │   ├── xorg.conf        # X11 with neko input driver
    │   └── ice_servers.json # TURN credentials
    ├── cursor/              # Custom cursors
    └── xf86-input-neko/     # Custom X11 input driver
```

### 2.2 Startup Sequence (`/startup.sh`)

1. **Load environment** (`.env` + `.user_env`)
2. **Setup shell RC files** (add env sourcing to .bashrc/.zshrc)
3. **Create pip/pip3 wrappers** (use `uv` instead of pip)
4. **Set env vars**: DISPLAY=:0, MANUS_OPT_PATH=/opt/.manus, RUNTIME_PATH=/opt/.manus/.sandbox-runtime, PYTHONIOENCODING=utf-8
5. **Start D-Bus** (clean old PIDs first)
6. **Check/start supervisord**
7. **Terminate old processes** (kill stale start_server/upgrade processes)
8. **Start log tail** (tail -f supervisor logs)
9. **Wait for services**:
   - Wait for :8330/healthz (sandbox-runtime)
   - Wait for :8340/health (runtime-upgrade) - unless SKIP_UPGRADE_MODE=1
10. **Monitor loop** (every 10 seconds):
    - Check supervisord PID
    - Check D-Bus
    - Check sandbox-runtime :8330/healthz - restart if failed
    - Check runtime-upgrade :8340/health - restart if failed
    - Correct clock with chronyc if offset > 0.5s
    - Fetch EC2 instance ID and write to /opt/.manus/.host_id

### 2.3 Supervisor Configs

#### 1-sandbox-runtime.conf
```ini
[program:sandbox-runtime]
command=/opt/.manus/.sandbox-runtime/start_server.sh
directory=/opt/.manus/.sandbox-runtime
user=ubuntu
stdout_logfile=/var/log/supervisor/sandbox-runtime.log
stderr_logfile=/var/log/supervisor/sandbox-runtime.err.log
environment=
    PATH="/home/ubuntu/bin:/home/ubuntu/.local/bin:/home/ubuntu/.local/share/pnpm:/home/ubuntu/.nvm/versions/node/v22.13.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    HOME="/home/ubuntu",
    CHROME_INSTANCE_PATH="/usr/bin/chromium-browser",
    WEBDEV_TEMPLATES_PATH="/opt/.manus/webdev/templates",
    DBUS_SESSION_BUS_ADDRESS="unix:path=/tmp/dbus-session-bus-socket",
    TZ="UTC"
startsecs=3
stopwaitsecs=10
stopsignal=TERM
killasgroup=true
stopasgroup=true
exitcodes=0
priority=1
```

#### 7-code-server.conf
```ini
[program:code-server]
command=/opt/.manus/.packages/scripts/check-start-code-server.sh
directory=/home/ubuntu
user=root
stdout_logfile=/var/log/supervisor/code-server.log
stderr_logfile=/var/log/supervisor/code-server.err.log
exitcodes=0
startsecs=0
depends_on=sandbox-runtime
autostart=false
autorestart=true
```

#### neko-supervisor.conf
```ini
[program:neko-server]
command=/opt/.manus/.packages/scripts/start-neko-with-turn.sh
directory=/opt/.manus/neko
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/neko-server.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=3
environment=DISPLAY=":0",PULSE_RUNTIME_PATH="/tmp/pulse-runtime",XDG_RUNTIME_DIR="/run/user/1000",HOME="/home/ubuntu"
```

### 2.4 Code-Server Startup Script
```bash
#!/bin/bash

# Wait for sandbox-runtime health check to pass
while ! curl -s http://localhost:8330/healthz -o /dev/null -w "%{http_code}" | grep -q "200"; do
    echo "[code server] Waiting for sandbox-runtime to be ready..."
    sleep 1
done

echo "sandbox-runtime is ready, starting code server..."
CODE_SERVER_CONFIG='/home/ubuntu/.config/code-server/config.yaml'
CODE_SERVER_PORT=8329
echo "export CODE_SERVER_PORT=\"$CODE_SERVER_PORT\"" >> /home/ubuntu/.env

# Generate random password for code server auth and write to environment variables
if ! grep -q "CODE_SERVER_PASSWORD=" "/home/ubuntu/.env"; then
    CODE_SERVER_PASSWORD=$(openssl rand -base64 8 | md5sum | head -c16)
    echo "bind-addr: 0.0.0.0:$CODE_SERVER_PORT" >> $CODE_SERVER_CONFIG
    echo "password: $CODE_SERVER_PASSWORD" >> $CODE_SERVER_CONFIG
    echo "export CODE_SERVER_PASSWORD=\"$CODE_SERVER_PASSWORD\"" >> /home/ubuntu/.env
    source /home/ubuntu/.env
fi
su -l ubuntu -c "code-server --config $CODE_SERVER_CONFIG --disable-workspace-trust"
```

### 2.5 Neko Startup Script
```bash
#!/bin/bash
set -e

# Generate and persist Neko passwords to ~/.env
ENV_FILE="/home/ubuntu/.env"
NEKO_CONFIG="/opt/.manus/neko/config/neko.yml"

if ! grep -q "^export NEKO_ADMIN_PASSWORD=" "$ENV_FILE"; then
    NEKO_ADMIN_PASSWORD=$(openssl rand -base64 8 | md5sum | head -c16)
    echo "export NEKO_ADMIN_PASSWORD=\"$NEKO_ADMIN_PASSWORD\"" >> "$ENV_FILE"
fi
if ! grep -q "^export NEKO_USER_PASSWORD=" "$ENV_FILE"; then
    NEKO_USER_PASSWORD=$(openssl rand -base64 8 | md5sum | head -c16)
    echo "export NEKO_USER_PASSWORD=\"$NEKO_USER_PASSWORD\"" >> "$ENV_FILE"
fi
source "$ENV_FILE"

# Wait for X11 server to start
until [ -S /tmp/.X11-unix/X0 ]; do
    echo 'waiting Xorg'
    sleep 1
done

# Wait for neko input driver
until [ -S /tmp/xf86-input-neko.sock ]; do
    echo 'waiting neko input driver'
    sleep 1
done
chmod 666 /tmp/xf86-input-neko.sock || true

# Read ICE server configuration
ICE_SERVERS_PATH="/opt/.manus/neko/config/ice_servers.json"
DEFAULT_STUN='[{"urls":["stun:stun.l.google.com:19302"]}]'

if [ -f "$ICE_SERVERS_PATH" ]; then
  ICE_SERVERS=$(cat "$ICE_SERVERS_PATH" | jq -c '.' || echo "$DEFAULT_STUN")
else
  ICE_SERVERS="$DEFAULT_STUN"
fi

# Start neko server
exec /opt/.manus/neko/server/neko serve \
  --config /opt/.manus/neko/config/neko.yml \
  --server.bind 0.0.0.0:8333 \
  --webrtc.icelite=false \
  --webrtc.nat1to1 127.0.0.1 \
  --webrtc.iceservers.backend "$ICE_SERVERS" \
  --webrtc.iceservers.frontend "$ICE_SERVERS" \
  --webrtc.epr 59000-59100 \
  --desktop.screen 1280x1029@30
```

### 2.6 Xorg Configuration
```conf
Section "Files"
    ModulePath "/usr/local/lib/xorg/modules"
    ModulePath "/usr/lib/xorg/modules"
EndSection

Section "ServerFlags"
    Option "AutoAddDevices" "false"
EndSection

Section "Module"
    Load "dbe"
    Load "glx"
    Load "extmod"
EndSection

Section "Monitor"
    Identifier "Monitor0"
    HorizSync 31.0-64.0
    VertRefresh 59.0-61.0
    ModeLine "1280x1029" 108.00 1280 1368 1496 1712 1029 1032 1036 1060
EndSection

Section "Device"
    Identifier "Card0"
    Driver "dummy"
    VideoRam 256000
EndSection

Section "Screen"
    Identifier "Screen0"
    Device "Card0"
    Monitor "Monitor0"
    DefaultDepth 24
    SubSection "Display"
        Depth 24
        Modes "1280x1029"
    EndSubSection
EndSection

Section "InputDevice"
    Identifier "NekoInput"
    Driver "neko"
    Option "SocketPath" "/tmp/xf86-input-neko.sock"
EndSection

Section "ServerLayout"
    Identifier "DefaultLayout"
    Screen 0 "Screen0"
    InputDevice "NekoInput" "SendCoreEvents"
EndSection
```

### 2.7 Password Generation Pattern
All passwords use the same generation method:
```bash
PASSWORD=$(openssl rand -base64 8 | md5sum | head -c16)
```

---

## 3. RUBIC CURRENT IMPLEMENTATION

### 3.1 What Works
- ✅ Terminal server on port 8330
- ✅ Basic directory structure
- ✅ Environment layer pattern (.env, .user_env, .secrets)
- ✅ Pip/pip3 uv wrappers
- ✅ WebDev templates structure

### 3.2 What's Wrong
1. **DISPLAY=:99** instead of :0
2. **Neko port 8080** instead of 8333
3. **Health endpoint /health** instead of /healthz
4. **User `user`** instead of `ubuntu`
5. **Home `/home/user`** instead of `/home/ubuntu`
6. **Xvfb** instead of real Xorg with dummy driver
7. **Terminal server as mjs script** instead of compiled binary
8. **Supervisor configs created but services don't start**
9. **No neko input driver** (using standard input)
10. **No runtime-upgrade service**
11. **Missing Xorg configuration**
12. **Missing proper Chrome startup script**

---

## 4. RUBIC REFACTORING PLAN

### Phase 1: Critical Fixes (Bootstrap)
1. Change DISPLAY to :0 everywhere
2. Fix health endpoint to /healthz
3. Change user from `user` to `ubuntu`
4. Change home from `/home/user` to `/home/ubuntu`
5. Fix Neko port from 8080 to 8333

### Phase 2: Xorg + Neko Input Driver
1. Replace Xvfb with Xorg using dummy driver
2. Add Xorg configuration file
3. Add neko input driver (if we can get the source/binary)
4. Update Neko startup to wait for X11 socket and neko driver socket

### Phase 3: Proper Supervisor Setup
1. Create exact supervisor configs matching Manus
2. Ensure supervisord starts correctly
3. Ensure terminal-server starts via supervisor
4. Test supervisor status and restart functionality

### Phase 4: Script Alignment
1. Update start_command.sh to match Manus startup.sh patterns
2. Add proper monitor loop
3. Add process cleanup before starting services
4. Add clock synchronization

### Phase 5: Chrome Integration
1. Create start-chrome.sh script matching Manus
2. Add Chrome extensions (if needed)
3. Configure download directory properly
4. Add managed policies for Chrome

### Phase 6: Testing
1. Create sandbox and verify boot sequence
2. Test terminal server health endpoint
3. Test code-server startup
4. Test Neko WebRTC connection
5. Test Chrome browser automation
6. Test monitor loop restart functionality

---

## 5. CRITICAL ENVIRONMENT VARIABLES

### Manus Pattern
```bash
# Boot-time (in startup.sh)
export DISPLAY=:0
export MANUS_OPT_PATH=/opt/.manus
export RUNTIME_PATH=${MANUS_OPT_PATH}/.sandbox-runtime
export UPDATE_LOCK_FILE=${MANUS_OPT_PATH}/.versions/.update.lock
export PYTHONIOENCODING=utf-8

# In supervisor env (sandbox-runtime)
PATH="/home/ubuntu/bin:/home/ubuntu/.local/bin:/home/ubuntu/.local/share/pnpm:/home/ubuntu/.nvm/versions/node/v22.13.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
HOME="/home/ubuntu"
CHROME_INSTANCE_PATH="/usr/bin/chromium-browser"
WEBDEV_TEMPLATES_PATH="/opt/.manus/webdev/templates"
DBUS_SESSION_BUS_ADDRESS="unix:path=/tmp/dbus-session-bus-socket"
TZ="UTC"

# In start_server.sh
PYTHONHOME=/home/ubuntu/.local/share/uv/python/cpython-3.13.8-linux-x86_64-gnu
NUITKA_PYTHONPATH="..."
PYTHONPATH="..."
```

### Rubic Should Use
```bash
export DISPLAY=:0  # NOT :99!
export RUBIC_OPT_PATH=/opt/.rubic
export RUNTIME_PATH=${RUBIC_OPT_PATH}/runtime
export PYTHONIOENCODING=utf-8

# Terminal server should listen on 8330 with /healthz endpoint
# Neko should listen on 8333
# Code-server should listen on 8329
```

---

## 6. NEXT STEPS

1. **Immediate**: Read and understand the Manus neko input driver source code
2. **Then**: Refactor Rubic template.ts to install and configure proper Xorg + dummy driver
3. **Then**: Update start_command.sh to exactly match Manus startup.sh patterns
4. **Then**: Create proper supervisor configs that WILL work
5. **Then**: Test, test, test!

---

## 7. KEY TAKEAWAYS

- Manus uses **real Xorg with dummy driver**, not Xvfb
- Manus uses **compiled Nuitka binaries** for runtime, not Python scripts
- Manus has **custom neko input driver** for X11
- Manus uses **DISPLAY=:0** consistently
- Manus has **proper supervisor service management** with dependencies
- Manus has **comprehensive monitor loop** that restarts failed services
- Manus uses **/healthz** for sandbox-runtime health checks
- Manus runs everything as **ubuntu user**, not user
- Manus has **ICE server injection** via JSON file for TURN support
- Manus waits for **X11 socket** and **neko driver socket** before starting Neko

The key to fixing Rubic is to **follow Manus patterns exactly**, not try to simplify or "improve" them.
