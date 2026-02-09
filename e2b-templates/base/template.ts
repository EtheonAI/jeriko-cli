/**
 * E2B Base Template — Rubic Lightweight Sandbox
 *
 * Ubuntu 22.04 + Python 3.11 + Node.js 22 LTS.
 * Lightweight sandbox for file operations, shell commands, and basic tools.
 * No GUI, no browser, no heavy dependencies.
 *
 * Build: npx tsx build.ts
 * Usage: E2BSandbox.create({ template: 'base' })
 *
 * Use cases:
 *   - File operations (read, write, search)
 *   - Shell commands
 *   - Web search (HTTP fallback)
 *   - Message/plan tools
 */

import { Template } from "e2b";

export const template = Template()
  .fromUbuntuImage("22.04")
  // System utilities and development tools
  .runCmd([
    "apt-get update",
    "DEBIAN_FRONTEND=noninteractive apt-get install -y " +
      "build-essential curl git wget " +
      "util-linux sudo ca-certificates " +
      "vim nano less " +
      "python3-pip python3-venv " +
      "jq ripgrep fd-find bat",
    "apt-get clean",
    "rm -rf /var/lib/apt/lists/*",
  ])
  // Install Node.js 22 LTS
  .runCmd([
    "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
    "apt-get install -y nodejs",
  ])
  // Install common Python packages
  .runCmd([
    "pip3 install --no-cache-dir " + "httpx requests beautifulsoup4 " + "python-dotenv pydantic",
  ])
  // Set working directory
  .runCmd("mkdir -p /home/user && chown -R 1000:1000 /home/user")
  .setStartCmd("tail -f /dev/null");
