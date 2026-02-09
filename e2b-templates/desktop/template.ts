/**
 * E2B Desktop Template — Rubic Virtual Computer
 *
 * Ubuntu 22.04 + XFCE Desktop + Neko WebRTC on port 8080.
 * Provides a full virtual computer accessible via Neko WebRTC streaming.
 * Playwright Chromium is pre-installed for agent browser automation.
 *
 * Build: npx tsx build.ts
 * Usage: E2BSandbox.create({ template: 'rubic-desktop' })
 *
 * Ports:
 *   8080 — Neko HTTP + WebSocket (signaling + web client)
 *   8081 — Neko WebRTC TCP mux (media)
 *   9821 — Playwright browser controller (started lazily by agent)
 *   3000 — Available for user apps
 */

import { Template, waitForPort } from "e2b";

export const template = Template()
  .fromUbuntuImage("22.04")
  // Desktop environment and system utilities
  .runCmd([
    "yes | unminimize",
    "apt-get update",
    "DEBIAN_FRONTEND=noninteractive apt-get install -y " +
      "xserver-xorg xorg x11-xserver-utils xvfb x11-utils xauth " +
      "xfce4 xfce4-goodies util-linux sudo curl git wget " +
      "python3-pip xdotool scrot ffmpeg net-tools " +
      "netcat x11-apps libreoffice xpdf gedit xpaint tint2 " +
      "galculator pcmanfm chromium-browser pulseaudio",
    // GStreamer plugins for Neko WebRTC encoding
    "DEBIAN_FRONTEND=noninteractive apt-get install -y " +
      "gstreamer1.0-plugins-base gstreamer1.0-plugins-good " +
      "gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly " +
      "gstreamer1.0-pulseaudio gstreamer1.0-tools",
    "apt-get clean",
    "rm -rf /var/lib/apt/lists/*",
  ])
  // Neko server binary (pre-built for linux/amd64)
  .runCmd([
    "curl -L https://github.com/m1k1o/neko/releases/latest/download/server-linux-amd64 -o /usr/local/bin/neko",
    "chmod +x /usr/local/bin/neko",
  ])
  // Set default terminal
  .runCmd(
    "ln -sf /usr/bin/xfce4-terminal.wrapper /etc/alternatives/x-terminal-emulator"
  )
  // Pre-install Playwright for agent browser automation
  .runCmd([
    "pip install playwright e2b-desktop",
    "playwright install chromium",
    "playwright install-deps chromium",
  ])
  // Copy start command
  .copy("start_command.sh", "/start_command.sh")
  .runCmd("chmod +x /start_command.sh")
  // Start the desktop environment and wait for Neko to be ready on port 8080
  .setStartCmd("/start_command.sh", waitForPort(8080));
