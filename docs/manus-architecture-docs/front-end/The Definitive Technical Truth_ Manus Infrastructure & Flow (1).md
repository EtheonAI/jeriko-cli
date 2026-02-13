# The Definitive Technical Truth: Manus Infrastructure & Flow

This document provides the absolute, verified truth of the Manus sandbox architecture, based on a deep-level trace of a running production environment.

## 1. Core Infrastructure Architecture

Manus does **not** use E2B. It uses a custom-built Ubuntu 22.04 VM orchestration layer.

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Orchestrator (Kernel)** | External (10.159.140.1) | Manages sandbox lifecycle, provides API keys, and handles tool routing. |
| **Sandbox Runtime** | Compiled Binary (`start_server`) | A FastAPI-based REST server on port 8330 that executes all tool commands. |
| **Database** | TiDB Serverless | Resolved via UUID; connection strings are passed from host to sandbox at runtime. |
| **Live Browser** | Neko (WebRTC) | Full desktop streaming on port 8333. |
| **IDE** | code-server | VS Code in the browser on port 8329. |
| **Reverse Proxy** | Custom Tunnel | Maps internal ports (e.g., 5173 for Vite) to public subdomains. |

## 2. The Real Tool Execution Flow

### Terminal (Live & Persistent)
Unlike one-shot shell execution, the terminal uses a persistent PTY (Pseudo-Terminal).
1. **Host** calls `POST /terminal` to create a session.
2. **Host** calls `POST /terminal/{id}/write` to send input.
3. **Host** calls `GET /terminal/{id}/view` to stream the current buffer back to the frontend.

### Browser (Real-time Interaction)
1. **Browser** is always running on port 9222 (Remote Debugging).
2. **Tools** call `POST /browser/action` with a payload containing the action (click, type, navigate).
3. **Live View** is handled by Neko on port 8333, which captures the X11 display and streams it via WebRTC.

### WebDev & Deployment
1. **Init:** `POST /webdev/init_project` copies a "Golden Template" from `/opt/.manus/webdev/templates/`.
2. **Dependencies:** Pre-installed in the template image (using `pnpm`).
3. **Preview:** The `expose` tool opens a tunnel from the internal port (e.g., 5173) to a public URL.
4. **Deploy:** `POST /deploy/zip-and-upload` zips the `/home/ubuntu/{project}` folder and sends it to a presigned S3 URL.

## 3. Network & Security Truth

*   **Outbound Calls:** The sandbox connects to `api.manus.im` (34.197.222.237) for initialization and status reporting.
*   **Secrets:** All sensitive keys (OpenAI, TiDB, etc.) are injected as environment variables by the Kernel at boot time.
*   **Metadata:** The sandbox-runtime uses a local sqlite database `/opt/.manus/runtime.db` to track active terminals and project states.

## 4. Why Your E2B Implementation Fails

1.  **Dependency Lag:** You are trying to `pnpm install` at runtime. Manus uses pre-baked images where `node_modules` already exists.
2.  **Stateless Shell:** You are using one-shot `exec` calls. You need a persistent PTY to maintain shell state (like `cd` or environment variables).
3.  **Screenshot Latency:** You are waiting for screenshots in the tool response. You need a side-channel (WebSocket or WebRTC) for the visual stream.

## 5. Implementation Roadmap for "Manus-Style" Flow

1.  **Bake the Template:** Create a Docker image for E2B that has your `web-db-user` project pre-installed with `node_modules`.
2.  **Bridge the PTY:** Use a library like `node-pty` on your agent server to bridge the E2B shell to a WebSocket for the frontend.
3.  **Reverse Proxy:** Use E2B's built-in port forwarding (`sandbox.get_hostname(port)`) to provide the live preview URL.
4.  **Unified API:** Create a single backend endpoint that translates tool calls into the specific E2B actions (filesystem, shell, browser).
