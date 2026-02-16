# Rubic Desktop Sandbox - Complete E2B Template (Manus Parity)
# Python/FastAPI sandbox runtime + Go upload binary + all tooling

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install sudo first
RUN apt-get update && apt-get install -y sudo && apt-get clean

# Create ubuntu user with sudo
RUN useradd -m -s /bin/bash -G sudo ubuntu && \
    echo 'ubuntu ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# System packages
RUN yes | unminimize || true && \
    apt-get update && \
    apt-get install -y \
    xserver-xorg xserver-xorg-core xserver-xorg-video-dummy \
    x11-xserver-utils x11-utils xauth xdotool \
    xfce4 xfce4-goodies \
    util-linux curl git wget ca-certificates gnupg lsb-release \
    python3-pip python3-venv python3-dev \
    scrot ffmpeg net-tools netcat-openbsd \
    x11-apps libreoffice gedit tint2 galculator pcmanfm \
    pulseaudio \
    ripgrep fd-find tree htop jq build-essential zip unzip \
    zsh dbus dbus-x11 pandoc wkhtmltopdf \
    fonts-liberation fonts-noto-color-emoji \
    gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly \
    gstreamer1.0-pulseaudio gstreamer1.0-tools \
    golang-go && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    ln -sf /usr/bin/fdfind /usr/bin/fd

# Node.js 22 + supervisor
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs supervisor && \
    npm install -g corepack@latest && \
    corepack enable && \
    corepack install -g pnpm@latest-10 && \
    npm install -g yarn --force && \
    apt-get clean

# Python uv
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh

# Chromium — installed via Playwright (system chromium-browser is a snap wrapper on 22.04)
# Playwright install happens in the Python deps step below

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && apt-get install -y gh && apt-get clean

# code-server
RUN curl -fsSL https://code-server.dev/install.sh | sh

# Copy ALL Rubic runtime files (pre-extracted directories, ~120MB)
# Tar archives excluded via .dockerignore — directories already contain all content
COPY --chown=ubuntu:ubuntu rubic-files /opt/.rubic

# Set ownership and permissions
RUN chown -R root:root /opt/.rubic && \
    chmod -R 755 /opt/.rubic

# Build neko input driver
RUN apt-get update && \
    apt-get install -y gcc pkgconf autoconf automake libtool make xorg-dev xutils-dev && \
    cd /opt/.rubic/neko/xf86-input-neko && \
    ./autogen.sh --prefix=/usr && \
    ./configure && make -j$(nproc) && make install && \
    apt-get clean

# ── Python sandbox runtime dependencies ──────────────────────────
USER root
RUN uv pip install --system \
    fastapi uvicorn httpx pydantic requests \
    cryptography \
    Pillow \
    rembg \
    playwright \
    numpy pandas openpyxl xlsxwriter \
    beautifulsoup4 lxml \
    pdfminer.six pdfplumber PyPDF2 reportlab \
    python-pptx python-docx \
    PyYAML toml python-dotenv \
    psutil aiofiles aiohttp \
    jinja2 markdown \
    sympy scipy scikit-learn \
    matplotlib seaborn plotly \
    anthropic openai google-generativeai \
    tiktoken tokenizers \
    selenium \
    yt-dlp \
    chardet charset-normalizer \
    paramiko \
    redis \
    && playwright install chromium

# ── Build Go binaries ────────────────────────────────────────────
# rubic-upload-file (matches manus-upload-file Go binary)
COPY rubic-upload-file/ /tmp/rubic-upload-file-src/
RUN cd /tmp/rubic-upload-file-src && \
    GOOS=linux GOARCH=amd64 go build -o /usr/local/bin/rubic-upload-file . && \
    chmod +x /usr/local/bin/rubic-upload-file && \
    rm -rf /tmp/rubic-upload-file-src

# Conversion utility scripts
COPY rubic-files/bin/rubic-md-to-pdf /usr/local/bin/rubic-md-to-pdf
COPY rubic-files/bin/rubic-export-slides /usr/local/bin/rubic-export-slides
RUN chmod +x /usr/local/bin/rubic-md-to-pdf /usr/local/bin/rubic-export-slides

# rubic-mcp-cli (matches manus-mcp-cli Go binary)
COPY rubic-mcp-cli/ /tmp/rubic-mcp-cli-src/
RUN cd /tmp/rubic-mcp-cli-src && \
    GOOS=linux GOARCH=amd64 go build -o /usr/local/bin/rubic-mcp-cli . && \
    chmod +x /usr/local/bin/rubic-mcp-cli && \
    rm -rf /tmp/rubic-mcp-cli-src

# Switch to ubuntu user
USER ubuntu
WORKDIR /home/ubuntu

# Create directories (Manus parity — all dirs that exist in /home/ubuntu/)
RUN mkdir -p ~/screenshots ~/Downloads ~/.browser_data_dir ~/.search_cache \
    ~/upload ~/skills ~/terminal_full_output ~/.secrets ~/webdev-static-assets \
    ~/.parallel_task_results ~/.config/code-server /tmp/rubic-mcp \
    ~/.logs/mcp-cli ~/.logs/state-sync ~/.logs/upload-file ~/.logs/render-diagram \
    ~/.history ~/.mcp ~/page_texts ~/gmail-attachments \
    ~/.config/state-sync ~/.config/rclone ~/.config/matplotlib \
    ~/.config/chromium && \
    echo '{}' > ~/.mcp/servers.json && \
    touch ~/.config/state-sync/.sync-ready

# ── Copy Python sandbox runtime ──────────────────────────────────
USER root
COPY --chown=ubuntu:ubuntu sandbox_runtime/ /opt/.rubic/runtime/sandbox_runtime/
COPY --chown=ubuntu:ubuntu sandbox_runtime/start_server.sh /opt/.rubic/runtime/start_server.sh
RUN chmod +x /opt/.rubic/runtime/start_server.sh

# ── Copy upgrade service ─────────────────────────────────────────
COPY --chown=ubuntu:ubuntu upgrade/ /opt/.rubic/runtime/upgrade/

# rubic-mcp-cli Go binary already installed to /usr/local/bin/ above

# ── Copy data_api.py (Manus pattern) ─────────────────────────────
COPY --chown=ubuntu:ubuntu data_api.py /opt/.rubic/runtime/data_api.py

# ── Copy RSA public key ──────────────────────────────────────────
COPY keys/public.pem /opt/.rubic/runtime/public.pem

# ── Copy startup script ──────────────────────────────────────────
COPY --chown=ubuntu:ubuntu start_command.sh /home/ubuntu/
RUN chmod +x /home/ubuntu/start_command.sh

# ── Copy configs ─────────────────────────────────────────────────
COPY xorg.conf /etc/X11/xorg.conf
COPY neko.yml /opt/.rubic/neko/config/neko.yml

# Supervisor configs
COPY supervisor-terminal-server.conf /etc/supervisor/conf.d/1-sandbox-runtime.conf
COPY supervisor-neko-server.conf /etc/supervisor/conf.d/2-neko-server.conf
COPY supervisor-upgrade.conf /etc/supervisor/conf.d/3-upgrade-service.conf
COPY supervisor-mcp-server.conf /etc/supervisor/conf.d/4-mcp-server.conf
COPY supervisor-chrome.conf /etc/supervisor/conf.d/6-chrome.conf
COPY supervisor-code-server.conf /etc/supervisor/conf.d/7-code-server.conf

# MCP server startup script
RUN mkdir -p /opt/.rubic/.packages/scripts
COPY start-rubic-mcp-server.sh /opt/.rubic/.packages/scripts/start-rubic-mcp-server.sh
RUN chmod +x /opt/.rubic/.packages/scripts/start-rubic-mcp-server.sh

# Base env + env.sh
COPY --chown=ubuntu:ubuntu base.env /home/ubuntu/.env
COPY --chown=ubuntu:ubuntu env.sh /home/ubuntu/env.sh
RUN chmod +x /home/ubuntu/env.sh

# pip wrappers
COPY pip-wrapper.sh /usr/local/bin/pip
COPY pip3-wrapper.sh /usr/local/bin/pip3
RUN chmod +x /usr/local/bin/pip /usr/local/bin/pip3

# Set permissions
# CRITICAL: sandbox_runtime/ must stay ubuntu-owned so Python can create __pycache__
# Pre-create corepack cache dir to avoid EACCES when pnpm runs as ubuntu at runtime
RUN mkdir -p /home/ubuntu/.cache/node/corepack/v1 && \
    chown -R ubuntu:ubuntu /home/ubuntu && \
    chown -R root:root /opt/.rubic && \
    chown -R ubuntu:ubuntu /opt/.rubic/runtime/sandbox_runtime && \
    chmod -R 755 /opt/.rubic

USER ubuntu
WORKDIR /home/ubuntu

CMD ["/bin/bash"]
