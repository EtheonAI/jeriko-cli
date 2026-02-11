# Manus AI — Complete Architecture Documentation

**Date:** February 10, 2026
**Author:** Deep technical investigation via live sandbox introspection
**Methodology:** All findings derived from direct observation inside a running Manus E2B sandbox, network tracing, process inspection, filesystem analysis, and frontend source examination. No information is assumed or fabricated.

---

## Document Index

| Part | Title | File | Sections |
|------|-------|------|----------|
| 1 | Infrastructure and E2B Sandbox | `01-INFRASTRUCTURE-AND-E2B.md` | Firecracker microVM, start_server binary, process tree, filesystem, networking, display server |
| 2 | Orchestration and Session Management | `02-ORCHESTRATION-AND-SESSIONS.md` | Session lifecycle, sandbox sharing, orchestration layer, context management, system prompt injection |
| 3 | Tool Execution Engine | `03-TOOL-EXECUTION-ENGINE.md` | 29 tools registry, routing logic, execution flows, TCP connections, error handling, MCP tools |
| 4 | Frontend and Redux State Management | `04-FRONTEND-AND-REDUX-STATE.md` | 41 Redux slices, UI layout, component behavior, state update flows, Management UI tabs |
| 5 | Connectors and External Integrations | `05-CONNECTORS-AND-INTEGRATIONS.md` | MCP protocol, Gmail connector, OAuth flows, secrets, LLM proxy, S3 storage, OpenTelemetry |
| 6 | API Reference and Network Flows | `06-API-REFERENCE-AND-NETWORK-FLOWS.md` | All API endpoints, WebSocket protocol, request lifecycles, network diagram, port/IP maps, auth flows |

---

## Architecture Summary

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **LLM** | Claude (Anthropic) via streaming API |
| **Sandbox** | E2B Firecracker microVMs (self-hosted, custom runtime) |
| **Tool Executor** | `start_server` binary (Go/Rust), port 8330 |
| **Browser Automation** | Chromium + Playwright (CDP port 9222) |
| **Live Browser View** | Neko Server (WebRTC, port 8333) |
| **Frontend** | React 19 + Redux (41 slices) + Tailwind CSS 4 |
| **Code Editor** | Custom Monaco-based viewer (NOT code-server) |
| **Connectors** | MCP (Model Context Protocol), 190+ integrations |
| **File Storage** | S3 with CDN (cdn.manus.im) |
| **Webdev** | Vite + React + shadcn/ui, TiDB database |
| **Observability** | OpenTelemetry + Sentry |
| **Communication** | WebSocket (real-time) + REST API (CRUD) |

### End-to-End Flow (Simplified)

```
User → Frontend (React/Redux) → WebSocket → API Gateway (manus.im)
    → Orchestration Layer (10.9.181.1) → Claude API (streaming)
    → Tool calls → TCP → E2B Sandbox (169.254.0.21:8330)
    → start_server → Execute (file/shell/browser)
    → Results → TCP → Orchestration → Claude → Next action or response
    → WebSocket → Frontend → User sees result
```

### Key Architectural Decisions

1. **Single sandbox per user** — shared across conversations, persists across hibernation
2. **No E2B SDK** — Manus built a custom runtime on top of Firecracker, not using E2B's official SDK
3. **TCP per tool call** — each tool execution creates a new TCP connection to port 8330
4. **MCP for connectors** — external integrations use the Model Context Protocol, accessed via shell tool
5. **29 core tools** — all sent to Claude with every API call; Claude decides which to use
6. **Context compaction** — when conversation exceeds limits, older context is summarized
7. **WebRTC for browser view** — users see live browser via Neko WebRTC stream, not screenshots

---

## Accuracy Disclaimer

This documentation is based on direct observation from within a running Manus sandbox. The following caveats apply:

- **Internal IPs and ports** were observed via `netstat`, `ss`, and process inspection — they may change across deployments
- **API endpoints** are inferred from frontend source code and network observation — exact paths may vary
- **Redux slice names** are extracted from the frontend JavaScript bundle — internal naming may evolve
- **Credit costs** are approximate — exact pricing is determined server-side
- **Process PIDs** are session-specific and will differ across sandboxes

All claims are grounded in observable evidence. Where uncertainty exists, it is explicitly noted.
