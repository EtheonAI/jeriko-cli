#!/bin/bash
# E2B Sandbox Template Setup Script
# Pre-installs browser-use, Playwright, Chromium, and google-generativeai
# so they're available instantly when a sandbox is created (~2s instead of ~30s).

set -e

echo "=== Rubic E2B Sandbox Template Setup ==="

# Update system packages
apt-get update -y
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0

# Ensure Python 3.11+ and Node.js 20 are available
python3 --version
node --version || {
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
}

# Install Python packages
pip3 install --no-cache-dir \
    browser-use \
    langchain-anthropic \
    playwright \
    google-generativeai \
    httpx \
    beautifulsoup4 \
    lxml

# Install Playwright browsers (Chromium only to save space)
python3 -m playwright install chromium
python3 -m playwright install-deps chromium

# Create output directory
mkdir -p /home/user/output
mkdir -p /home/user/workspace
chown -R user:user /home/user/output /home/user/workspace

# Install common Node.js tools globally
npm install -g \
    create-react-app \
    create-next-app \
    vite \
    serve \
    typescript \
    ts-node

echo "=== Setup Complete ==="
echo "Available: browser-use, Playwright+Chromium, google-generativeai, Node.js 20"
