/**
 * E2B Desktop Template — Rubic Virtual Computer
 *
 * Replicates the Manus sandbox environment for feature parity.
 * Ubuntu 22.04 + XFCE Desktop + Neko WebRTC + Full dev stack.
 *
 * Build: npx tsx build.ts
 * Usage: DesktopSandbox.create({ template: 'desktop' })
 *
 * Ports:
 *   8080 — Neko HTTP + WebSocket (signaling + web client)
 *   8081 — Neko WebRTC TCP mux (media)
 *   8330 — Terminal Server (Manus sandbox runtime API — stateful PTY)
 *   9222 — Chromium CDP (Chrome DevTools Protocol)
 *   9821 — Playwright browser controller (started lazily by agent)
 *   3000 — Available for user apps
 *
 * Directory Structure (mirrors Manus /opt/.manus → /opt/.rubic):
 *   /home/user/                    — User workspace (default CWD)
 *   /home/user/screenshots/        — Browser screenshots (WebP)
 *   /home/user/Downloads/          — Browser download target
 *   /home/user/.browser_data_dir/  — Chromium profile data
 *   /home/user/.search_cache/      — Search image cache
 *   /home/user/upload/             — User-uploaded files
 *   /home/user/skills/             — Skill system files
 *   /home/user/terminal_full_output/ — Terminal session logs
 *   /home/user/.secrets/           — Per-session secrets (sandbox_api_token)
 *   /home/user/webdev-static-assets/ — CDN-uploaded media (moved from project dir)
 *   /opt/.rubic/                   — Platform runtime (equiv: /opt/.manus/)
 *   /opt/.rubic/runtime/           — Runtime API + scripts
 *   /opt/.rubic/runtime/js/        — Browser automation JS scripts
 *   /opt/.rubic/deploy/templates/  — Deployment templates
 *   /opt/.rubic/webdev/templates/  — Webdev project templates
 *   /tmp/rubic-mcp/                — MCP tool results
 *
 * Environment Layers (Manus 4-layer model):
 *   Layer 1 — ~/.env          (baked at template build — static config)
 *   Layer 2 — ~/.user_env     (injected at session start — user secrets)
 *   Layer 3 — ~/.secrets/     (injected at session start — sandbox_api_token)
 *   Layer 4 — Process env     (injected per exec — dynamic tool env)
 */

import { Template, waitForPort } from "e2b";

export const template = Template()
  .fromUbuntuImage("22.04")
  // ─── Root: System package installation ──────────────────────────────────
  .setUser("root")

  // Phase 1: Core desktop environment + system utilities
  .runCmd([
    "yes | unminimize || true",
    "apt-get update",
    "DEBIAN_FRONTEND=noninteractive apt-get install -y " +
      // X11 / Desktop
      "xserver-xorg xorg x11-xserver-utils xvfb x11-utils xauth " +
      "xfce4 xfce4-goodies " +
      // Core system tools
      "util-linux sudo curl git wget ca-certificates gnupg lsb-release " +
      // Python
      "python3-pip python3-venv python3-dev " +
      // Desktop utilities
      "xdotool scrot ffmpeg net-tools netcat-openbsd " +
      "x11-apps libreoffice gedit tint2 galculator pcmanfm " +
      // Audio
      "pulseaudio " +
      // Developer tools (matching Manus: ripgrep, fd-find, tree, htop, jq, build-essential)
      "ripgrep fd-find tree htop jq build-essential zip unzip " +
      // Shell
      "zsh " +
      // D-Bus (required for desktop session + service management)
      "dbus dbus-x11 " +
      // Document conversion (Manus feature: MD→PDF, HTML→PDF)
      "pandoc wkhtmltopdf " +
      // Fonts (for PDF rendering and browser)
      "fonts-liberation fonts-noto-color-emoji",
    // GStreamer plugins for Neko WebRTC encoding
    "DEBIAN_FRONTEND=noninteractive apt-get install -y " +
      "gstreamer1.0-plugins-base gstreamer1.0-plugins-good " +
      "gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly " +
      "gstreamer1.0-pulseaudio gstreamer1.0-tools",
    "apt-get clean",
    "rm -rf /var/lib/apt/lists/*",
  ])

  // Phase 2: Node.js 22 LTS (via NodeSource — matches Manus)
  .runCmd([
    "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
    "apt-get install -y nodejs",
    "corepack enable",
    "corepack prepare pnpm@latest --activate",
    // corepack creates /usr/bin/yarn shim — must remove before npm install -g
    "rm -f /usr/bin/yarn /usr/bin/yarnpkg",
    "npm install -g yarn",
  ])

  // Phase 3: uv — fast Python package manager (Manus uses uv-backed pip wrappers)
  .runCmd([
    "curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh",
  ])

  // Phase 4: GitHub CLI (Manus has gh pre-installed)
  .runCmd([
    "curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg",
    "chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg",
    'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null',
    "apt-get update",
    "apt-get install -y gh",
    "apt-get clean",
    "rm -rf /var/lib/apt/lists/*",
  ])

  // Phase 5: Neko server binary (extracted from ghcr.io/m1k1o/neko/xfce:latest)
  .copy("neko", "/usr/local/bin/neko")
  .runCmd("chmod +x /usr/local/bin/neko")

  // Neko web client (HTML/JS/CSS) — fallback for self-hosted mode.
  // Primary: CDN-hosted (upload-neko-client.ts → S3), NEKO_CLIENT_URL env var.
  // Fallback: served from /var/www by Neko itself (sandbox-hosted).
  .copy("www.tar.gz", "/tmp/www.tar.gz")
  .runCmd("mkdir -p /var/www && tar xzf /tmp/www.tar.gz -C /var/www && rm /tmp/www.tar.gz")

  // Set default terminal
  .runCmd("ln -sf /usr/bin/xfce4-terminal.wrapper /etc/alternatives/x-terminal-emulator")

  // Phase 6: code-server (VS Code in browser — Manus pattern: port 8329, password auth)
  // Installed system-wide, started on demand by orchestrator (NOT at boot).
  // Manus uses code-server 4.104.3 with password auth + pre-auth endpoint.
  .runCmd([
    "curl -fsSL https://code-server.dev/install.sh | sh",
    // Create config — password is overridden at session start via Layer 2 env
    "mkdir -p /home/user/.config/code-server",
    `cat > /home/user/.config/code-server/config.yaml << 'CSEOF'
bind-addr: 0.0.0.0:8329
auth: password
password: rubic-default
cert: false
CSEOF`,
    "chown -R user:user /home/user/.config/code-server",
  ])

  // Phase 7: Playwright for agent browser automation
  .runCmd([
    "pip install playwright e2b-desktop",
    "playwright install chromium",
    "playwright install-deps chromium",
  ])

  // Phase 8: Create pip/pip3 wrappers that use uv for speed (Manus pattern)
  .runCmd([
    // pip wrapper — delegates to uv for speed
    `cat > /usr/local/bin/pip << 'PIPEOF'
#!/bin/bash
# Reset Python environment variables to avoid conflicts
export PYTHONHOME=
export PYTHONPATH=
# Commands that modify the environment need --system flag
case "$1" in
    install|uninstall|sync|list)
        exec uv pip "$1" --system "\${@:2}"
        ;;
    *)
        exec uv pip "$@"
        ;;
esac
PIPEOF`,
    // pip3 wrapper — delegates to pip
    `cat > /usr/local/bin/pip3 << 'PIP3EOF'
#!/bin/bash
exec /usr/local/bin/pip "$@"
PIP3EOF`,
    "chmod +x /usr/local/bin/pip /usr/local/bin/pip3",
  ])

  // Phase 9: Create Rubic platform directory structure (equiv: /opt/.manus/)
  .runCmd([
    // /opt/.rubic/ — platform runtime root
    "mkdir -p /opt/.rubic/runtime/js",
    "mkdir -p /opt/.rubic/deploy/templates",
    "mkdir -p /opt/.rubic/webdev/templates",
    "mkdir -p /opt/.rubic/neko",
    // /tmp/rubic-mcp/ — MCP tool results directory
    "mkdir -p /tmp/rubic-mcp",
    "chmod 777 /tmp/rubic-mcp",
  ])

  // Phase 9a: Pre-built webdev templates (Manus pattern: /opt/.manus/webdev/templates/)
  // Templates are baked into the image and COPIED to project dir at init time.
  // This avoids network calls (create-vite) and ensures consistent, fast scaffolding.
  .runCmd([
    // web-static: React + Vite + TypeScript (basic SPA, no backend)
    "cd /opt/.rubic/webdev/templates && CI=true npx --yes create-vite@latest web-static -- --template react-ts",
    "cd /opt/.rubic/webdev/templates/web-static && pnpm install --frozen-lockfile || pnpm install",
    // Pre-warm: initial build to cache node_modules and verify template works
    "cd /opt/.rubic/webdev/templates/web-static && npx vite build || true",
    // Clean build artifacts (keep node_modules for fast init)
    "rm -rf /opt/.rubic/webdev/templates/web-static/dist",
    // web-db-user: React + Vite + TypeScript + Drizzle + Express (full-stack)
    // Start from web-static, add backend files at init time
    "cp -r /opt/.rubic/webdev/templates/web-static /opt/.rubic/webdev/templates/web-db-user",
    // Install full-stack deps into web-db-user
    "cd /opt/.rubic/webdev/templates/web-db-user && pnpm add drizzle-orm @neondatabase/serverless express cors dotenv",
    "cd /opt/.rubic/webdev/templates/web-db-user && pnpm add -D drizzle-kit @types/express @types/cors tsx",
    // Create backend structure placeholder dirs
    "mkdir -p /opt/.rubic/webdev/templates/web-db-user/src/db",
    "mkdir -p /opt/.rubic/webdev/templates/web-db-user/src/api",
  ])

  // Phase 9b: Terminal Server (Manus sandbox runtime API on port 8330)
  // Stateful PTY management — the orchestrator / sandbox service communicates
  // with this server via HTTP instead of using the E2B SDK's commands.run().
  // Architecture: LLM → Orchestrator → Sandbox Service → Terminal Server → PTY → bash
  .copy("terminal-server.mjs", "/opt/.rubic/runtime/terminal-server.mjs")
  .runCmd("chmod +x /opt/.rubic/runtime/terminal-server.mjs")

  // Phase 9c: rubic-upload-file utility (equiv: manus-upload-file)
  // Uploads files from sandbox to S3/CDN via presigned URL flow:
  //   1. Reads auth token from ~/.secrets/sandbox_api_token
  //   2. Calls orchestrator /api/upload/presign to get presigned PUT URL
  //   3. PUTs file directly to S3 (orchestrator never sees the file bytes)
  //   4. Prints CDN URL to stdout
  .runCmd([
    `cat > /usr/local/bin/rubic-upload-file << 'UPLOADEOF'
#!/bin/bash
# rubic-upload-file — Upload files to Rubic CDN
# Usage: rubic-upload-file <file1> [file2] [file3] ...
# Output: CDN URL for each uploaded file (printed to stdout)
#
# Equivalent of Manus's manus-upload-file binary.
# Uses presigned S3 PUT URLs for direct upload (no file bytes through orchestrator).

set -euo pipefail

# ─── Auth ────────────────────────────────────────────────────────────
TOKEN=""
if [ -f "$HOME/.secrets/sandbox_api_token" ]; then
    TOKEN=$(cat "$HOME/.secrets/sandbox_api_token")
elif [ -n "\${OPENAI_API_KEY:-}" ]; then
    TOKEN="$OPENAI_API_KEY"
fi

if [ -z "$TOKEN" ]; then
    echo "ERROR: No authentication token found." >&2
    echo "  Expected: ~/.secrets/sandbox_api_token or OPENAI_API_KEY env var" >&2
    exit 1
fi

# ─── Upload URL ──────────────────────────────────────────────────────
# Derive from OPENAI_BASE_URL: strip /llm-proxy/v1, add /upload/presign
UPLOAD_URL=""
if [ -n "\${RUBIC_UPLOAD_URL:-}" ]; then
    UPLOAD_URL="$RUBIC_UPLOAD_URL"
elif [ -n "\${OPENAI_BASE_URL:-}" ]; then
    # https://api.rubic.ai/api/llm-proxy/v1 → https://api.rubic.ai/api/upload/presign
    UPLOAD_URL=$(echo "$OPENAI_BASE_URL" | sed 's|/llm-proxy/v1$|/upload/presign|')
fi

if [ -z "$UPLOAD_URL" ]; then
    echo "ERROR: Cannot determine upload URL." >&2
    echo "  Set RUBIC_UPLOAD_URL or OPENAI_BASE_URL env var" >&2
    exit 1
fi

# ─── Validate arguments ─────────────────────────────────────────────
if [ $# -eq 0 ]; then
    echo "Usage: rubic-upload-file <file1> [file2] [file3] ..." >&2
    exit 1
fi

# ─── Upload each file ───────────────────────────────────────────────
for filepath in "$@"; do
    if [ ! -f "$filepath" ]; then
        echo "ERROR: File not found: $filepath" >&2
        continue
    fi

    filename=$(basename "$filepath")
    filesize=$(stat -c%s "$filepath" 2>/dev/null || stat -f%z "$filepath" 2>/dev/null)
    echo "Uploading file: $filename (size: \${filesize} bytes)" >&2

    # Step 1: Get presigned URL from orchestrator
    PRESIGN_RESPONSE=$(curl -sS -X POST "$UPLOAD_URL" \\
        -H "Authorization: Bearer $TOKEN" \\
        -H "Content-Type: application/json" \\
        -d "{\\"filename\\": \\"$filename\\"}" \\
        --max-time 30)

    # Check for errors
    if echo "$PRESIGN_RESPONSE" | grep -q '"error"'; then
        echo "ERROR: Failed to get presigned URL for $filename" >&2
        echo "$PRESIGN_RESPONSE" >&2
        continue
    fi

    # Extract URLs from response
    UPLOAD_S3_URL=$(echo "$PRESIGN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('uploadUrl',''))")
    ACCESS_URL=$(echo "$PRESIGN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessUrl',''))")
    CONTENT_TYPE=$(echo "$PRESIGN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('contentType','application/octet-stream'))")

    if [ -z "$UPLOAD_S3_URL" ]; then
        echo "ERROR: No upload URL in response for $filename" >&2
        continue
    fi

    # Step 2: Upload directly to S3 using presigned PUT URL
    HTTP_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \\
        -X PUT "$UPLOAD_S3_URL" \\
        -H "Content-Type: $CONTENT_TYPE" \\
        --data-binary "@$filepath" \\
        --max-time 120)

    if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
        echo "File uploaded successfully!" >&2
        # Print CDN URL to stdout (can be captured by caller)
        echo "$ACCESS_URL"
    else
        echo "ERROR: S3 upload failed with HTTP $HTTP_STATUS for $filename" >&2
    fi
done
UPLOADEOF`,
    "chmod +x /usr/local/bin/rubic-upload-file",
  ])

  // Phase 10: Create browser automation JS script stubs (Manus has these in /opt/.manus/.sandbox-runtime/app_data/js/)
  // These will be populated with real scripts as features are built
  .runCmd([
    `cat > /opt/.rubic/runtime/js/README.md << 'EOF'
# Rubic Browser Automation Scripts

Scripts injected into browser pages for element analysis and interaction.

## Scripts (to be implemented)
- analyzeHtmlElements.js — Analyze page DOM structure
- collectClickableElements.js — Find all interactive elements with indices
- captchaDetection.js — Detect CAPTCHA presence
- scrollAtPoint.js — Scroll at specific coordinates
- selectOption.js — Select dropdown options
- findElementByClickId.js — Find element by click index
- initScript.js — Initialize page instrumentation
EOF`,
  ])

  // Phase 11: Create user workspace directories (Manus /home/ubuntu/ layout)
  .runCmd([
    // Switch ownership patterns — these dirs belong to the sandbox user
    "mkdir -p /home/user/screenshots",
    "mkdir -p /home/user/Downloads",
    "mkdir -p /home/user/.browser_data_dir",
    "mkdir -p /home/user/.search_cache",
    "mkdir -p /home/user/upload",
    "mkdir -p /home/user/skills",
    "mkdir -p /home/user/terminal_full_output",
    "mkdir -p /home/user/.secrets",
    "chmod 700 /home/user/.secrets",
    // Webdev static assets — media files moved here before checkpoint
    // (Manus pattern: large files uploaded to CDN, moved out of project dir)
    "mkdir -p /home/user/webdev-static-assets",
    // Ensure user owns everything in their home
    "chown -R user:user /home/user",
  ])

  // Phase 12: Create base .env (Layer 1 — baked at template build)
  // Static configuration that doesn't change per session
  .runCmd([
    `cat > /home/user/.env << 'ENVEOF'
# Rubic Sandbox Environment — Layer 1 (baked at template build)
# Session-specific vars are in ~/.user_env (Layer 2, injected at session start)

export RUBIC_OPT_PATH=/opt/.rubic
export RUNTIME_PATH=/opt/.rubic/runtime
export APP_DOMAIN=rubic.ai
export DISPLAY=:99
export PYTHONIOENCODING=utf-8
export TERM=xterm-256color

# Node.js
export NODE_OPTIONS="--max-old-space-size=3072"

# Browser
export CHROME_FLAGS="--no-sandbox --disable-gpu --disable-dev-shm-usage"

# Code Server (password overridden at session start via Layer 2)
export CODE_SERVER_PORT="8329"
export CODE_SERVER_PASSWORD="rubic-default"

# Playwright
export PW_TEST_SCREENSHOT_NO_FONTS_READY=1
ENVEOF`,
    // Create empty .user_env placeholder (Layer 2 — written at session start by sandbox service)
    "touch /home/user/.user_env",
    "chown user:user /home/user/.env /home/user/.user_env",
  ])

  // Phase 13: Set up .bashrc and .zshrc with env sourcing (Manus pattern)
  .runCmd([
    // .bashrc — source both env files + set PYTHONIOENCODING
    `cat >> /home/user/.bashrc << 'RCEOF'

# ─── Rubic environment loading ─────────────────────────────────────────
[ -f "$HOME/.env" ] && source "$HOME/.env"
[ -f "$HOME/.user_env" ] && source "$HOME/.user_env"

# Force UTF-8 encoding for Python I/O to handle Unicode characters
export PYTHONIOENCODING=utf-8

# gh alias to avoid terminal control sequences
alias gh="TERM=dumb gh"

# fd-find is installed as fdfind on Ubuntu — alias for convenience
alias fd="fdfind"
RCEOF`,
    // .zshrc — same env loading
    `cat > /home/user/.zshrc << 'ZRCEOF'
# ─── Rubic environment loading ─────────────────────────────────────────
[ -f "$HOME/.env" ] && source "$HOME/.env"
[ -f "$HOME/.user_env" ] && source "$HOME/.user_env"

# Force UTF-8 encoding for Python I/O
export PYTHONIOENCODING=utf-8

# gh alias
alias gh="TERM=dumb gh"

# fd-find alias
alias fd="fdfind"
ZRCEOF`,
    // .bash_profile — login shells source this (bash -l)
    // Manus pattern: login shells must also get env via .bashrc
    `cat > /home/user/.bash_profile << 'BPEOF'
# Source .bashrc for login shells (terminal server uses bash --norc --noprofile
# but this ensures interactive login shells also get env)
[ -f "$HOME/.bashrc" ] && source "$HOME/.bashrc"
BPEOF`,
    "chown user:user /home/user/.bashrc /home/user/.zshrc /home/user/.bash_profile",
  ])

  // Copy start command
  .copy("start_command.sh", "/start_command.sh")
  .runCmd("chmod +x /start_command.sh")

  // ─── Switch to default user for runtime ───────────────────────────────
  .setUser("user")

  // Start the desktop environment and wait for Neko to be ready on port 8080
  .setStartCmd("/start_command.sh", waitForPort(8080));
