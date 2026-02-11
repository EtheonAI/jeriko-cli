# Manus AI — Complete Architecture Documentation

> **Version:** 3.0 (Final — Core + All Supplements)
> **Date:** February 10, 2026
> **Author:** Compiled from live sandbox investigation — process inspection, network tracing, filesystem analysis, Redux state extraction, server template inspection, and live environment variable capture.
> **Total:** 14 documents | ~10,000+ lines | ~400+ KB

---

## Document Index

### Core Documents (Parts 1–6)

| # | File | Title | Scope |
|---|------|-------|-------|
| 01 | `01-INFRASTRUCTURE-AND-E2B-SANDBOX.md` | Infrastructure & E2B Sandbox | Firecracker microVM, start_server binary, process tree, filesystem layout, networking, display server |
| 02 | `02-ORCHESTRATION-AND-SESSION-MANAGEMENT.md` | Orchestration & Session Management | Session lifecycle, sandbox sharing, LLM architecture, system prompt injection, context management |
| 03 | `03-TOOL-EXECUTION-ENGINE.md` | Tool Execution Engine | All 29 tools, routing logic, TCP connections, execution states, MCP tools, webdev tools |
| 04 | `04-FRONTEND-AND-REDUX-STATE.md` | Frontend & Redux State | All 41 Redux slices with types, UI layout, component behavior, state update flows, Management UI |
| 05 | `05-CONNECTORS-AND-INTEGRATIONS.md` | Connectors & External Integrations | MCP protocol, Gmail connector, OAuth flows, secrets management, LLM proxy, S3, OpenTelemetry |
| 06 | `06-API-REFERENCE-AND-NETWORK-FLOWS.md` | API Reference & Network Flows | All endpoints, WebSocket protocol, full request lifecycles, network diagram, port/IP maps |

### Supplementary Deep Dives (Parts 7–14)

| # | File | Title | Scope |
|---|------|-------|-------|
| 07 | `07-SUPPLEMENT-A-ENVIRONMENT-VARIABLES.md` | Environment Variables Deep Dive | Every env var with exact values, injection chain (.env → .user_env → .secrets → OPENAI_API_KEY), multi-purpose token |
| 08 | `08-SUPPLEMENT-B-E2B-BOOTSTRAP-SEQUENCE.md` | E2B Bootstrap & Spin-Up Sequence | Complete boot order, Neko/WebRTC loading with ICE/TURN config, statesync, code-server, process spawn chain |
| 09 | `09-SUPPLEMENT-C-TOOL-EXECUTION-MECHANICS.md` | Tool-by-Tool Execution Mechanics | Every tool traced step-by-step with JSON calls, process chains, network calls, files created, timing |
| 10 | `10-SUPPLEMENT-D-ORCHESTRATOR-AND-LLM-LOOP.md` | Orchestrator Planning & LLM Agent Loop | How orchestrator plans, spins E2B, runs agent loop, manages sessions, streams responses, handles errors |
| 11 | `11-SUPPLEMENT-E-STATE-CHANGE-FLOWS.md` | Complete State Change Flows | Every Redux dispatch, WebSocket event, UI re-render for all major flows |
| 12 | `12-SUPPLEMENT-F-FILE-STORAGE-S3-CDN-FLOWS.md` | File Storage, S3 & CDN Flows | Complete file lifecycle, manus-upload-file, S3 upload, CDN delivery, screenshots, user uploads, webdev assets |
| 13 | `13-SUPPLEMENT-G-TIMELINE-DATABASE-PERSISTENCE.md` | Timeline, Database & Persistence | Timeline event architecture, segment pagination, backend database schema (all tables with SQL), Redis cache, redux-persist config, data retention, consistency guarantees |
| 14 | `14-SUPPLEMENT-H-VOICE-SKILLS-KNOWLEDGE-FILES-FORGE.md` | Voice, Skills, Knowledge, Files & Forge API | Voice/speech-to-text, skill system, knowledge base, file connectors (4 slices), Forge API (LLM/image/notification/maps/storage), all 41 Redux slices detailed, complete prompt-to-response flow, WebDev OAuth, protobuf types, MCP integration, scheduled tasks, slides, WebSocket event catalog |

---

## Technology Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Sandbox VM** | E2B (Firecracker microVM) | Ubuntu 22.04, 6 vCPUs, 4GB RAM, ext4 on /dev/vda |
| **Runtime** | `start_server` (Go binary, PID 794) | Port 8330 (external), 9330 (internal), tool execution |
| **Browser** | Chromium + Playwright (Node.js, PID 871/901) | CDP on port 9222, Manus Helper Extension v1.1.11 |
| **Display** | Neko Server (WebRTC, PID 1351) | Port 8333, H.264 @ 15fps, Cloudflare TURN servers |
| **X11** | Xvfb | 1280x1029@30, display :0, VNC on port 5900/5901 |
| **Browser State** | `statesync` (Go binary, PID 1316) | CDP-based cookie/localStorage persistence |
| **Code Editor** | code-server (VS Code web, PID 1384) | Port 8329, password-protected |
| **MCP** | `manus-mcp-cli` (Go binary, PID 1487) | Port 8350, Model Context Protocol connectors |
| **Upgrade** | `upgrade` (Go binary, PID 830) | Port 8340, feature upgrades (web-db-user, stripe) |
| **LLM** | Claude Sonnet 4 (main), GPT-4.1-mini/nano, Gemini 2.5 Flash | Via proxy at `api.manus.im/api/llm-proxy/v1` |
| **Frontend** | React 19 + Redux Toolkit (41 slices) + Tailwind CSS 4 | WebSocket real-time, Monaco code viewer |
| **Backend** | Node.js + Express + tRPC + Drizzle ORM | WebDev server template |
| **Database** | PostgreSQL/MySQL (platform), TiDB (webdev apps) | Persistent storage |
| **Cache** | Redis | Session state, rate limiting, context cache |
| **CDN** | `files.manuscdn.com` | AWS S3 + CloudFront |
| **Auth** | JWT + Manus OAuth (Connect Protocol/gRPC-Web) | User authentication |
| **Observability** | OpenTelemetry → `butterflyotel.online`, Sentry | Full trace sampling (ratio=1.0) |
| **Deployment** | Wasmer (WASM edge) | `{prefix}.manus.space` custom domains |

---

## End-to-End Flow

```
User Browser (manus.im)
    ↕ WebSocket (wss://api.manus.im/ws)
Orchestration (api.manus.im / 10.225.205.1)
    ├── ↕ HTTPS → LLM Proxy → Claude/GPT/Gemini
    ├── ↕ gRPC (port 8330) → E2B Sandbox (169.254.0.21)
    │       ├── start_server (PID 794) — all tool execution
    │       ├── Chromium (PID 901) — browser automation via CDP
    │       ├── Neko (port 8333) — WebRTC display streaming
    │       ├── statesync (PID 1316) — browser state persistence
    │       ├── code-server (port 8329) — VS Code web IDE
    │       ├── manus-mcp-cli (port 8350) — MCP connectors
    │       └── upgrade (port 8340) — feature upgrades
    ├── ↕ HTTPS → Search API (web, image, news, etc.)
    ├── ↕ HTTPS → Forge API (LLM, image gen, voice, maps, storage, notifications)
    ├── ↕ HTTPS → S3 / files.manuscdn.com
    └── ↕ HTTPS → E2B API (sandbox lifecycle)
```

---

## Key Architectural Insights

1. **One sandbox per user, multiple sessions.** Conversations share the same E2B sandbox. The orchestrator routes messages to the existing sandbox.

2. **The orchestrator runs the agent loop.** Plan → Act → Observe → Repeat. It manages the LLM context window, routes tool calls, and streams results to the frontend in real time.

3. **Tools execute in three places.** Sandbox (shell, file, browser, match), Orchestration (search, message, plan, schedule), and External APIs (generate, map subtasks).

4. **Three layers of state.** Frontend (Redux + localStorage), Backend (database + Redis), Sandbox (filesystem + processes). Backend is source of truth.

5. **The Forge API is the internal service gateway.** LLM chat completions, image generation, voice transcription, push notifications, Google Maps proxy, and S3 storage — all accessed via `BUILT_IN_FORGE_API_URL` with `BUILT_IN_FORGE_API_KEY`.

6. **Timeline uses segment-based pagination.** Events grouped into segments, lazy-loaded as user scrolls. `segmentEventsMap` is the core data structure.

7. **Backend persists everything.** Sessions, messages, tool calls, plans, files, scheduled tasks, connectors — all in relational database tables.

8. **Skills are modular capability packages.** Stored in `/home/ubuntu/skills/`, loaded progressively (discovery → activation → deep reference).

9. **Voice uses Whisper API.** Frontend captures via MediaRecorder, binary `manus-speech-to-text` in sandbox, or Forge API `/v1/audio/transcriptions` for webdev apps.

10. **WebDev OAuth uses Connect Protocol.** Protobuf-derived types, JWT sessions, TiDB database, tRPC API routes.

---

## Recommended Reading Order

**For the complete picture (infrastructure → logic → frontend):**

| Order | Document | Why |
|-------|----------|-----|
| 1 | **00-INDEX** (this file) | Overview and orientation |
| 2 | **01-INFRASTRUCTURE** | Foundation: what the sandbox IS |
| 3 | **08-SUPPLEMENT-B** | How the sandbox BOOTS |
| 4 | **07-SUPPLEMENT-A** | Every environment variable |
| 5 | **02-ORCHESTRATION** | How sessions and the orchestrator work |
| 6 | **10-SUPPLEMENT-D** | The agent loop in complete detail |
| 7 | **03-TOOL-ENGINE** | Tool overview and routing |
| 8 | **09-SUPPLEMENT-C** | Every tool traced step-by-step |
| 9 | **12-SUPPLEMENT-F** | File storage, S3, and CDN flows |
| 10 | **13-SUPPLEMENT-G** | Timeline, database schema, persistence |
| 11 | **04-FRONTEND** | Redux architecture overview |
| 12 | **14-SUPPLEMENT-H** | All 41 slices, voice, skills, knowledge, Forge API, complete prompt flow |
| 13 | **11-SUPPLEMENT-E** | Every state change flow |
| 14 | **05-CONNECTORS** | External integrations |
| 15 | **06-API-REFERENCE** | Complete API and network reference |

**By role:**

- **Frontend engineers:** 04 → 14 (Section 6) → 11 → 13
- **Backend engineers:** 02 → 10 → 13 → 14 (Section 7)
- **Infrastructure engineers:** 01 → 08 → 07 → 12
- **Integration engineers:** 05 → 14 (Sections 5, 8, 13) → 06

---

## Accuracy Disclaimer

This documentation is based on direct observation from within a running Manus sandbox. The following caveats apply:

- **Internal IPs** (e.g., `10.225.205.1`, `169.254.0.21`) were observed via `ss` and `netstat` — they may change across deployments.
- **PIDs** are session-specific and will differ across sandboxes.
- **Database schemas** are inferred from API behavior, WebSocket events, and server template code — exact column names may differ.
- **Redux slice names** are extracted from the frontend JavaScript bundle.
- **CDN URL patterns** are verified from live `manus-upload-file` output.
- **Forge API endpoints** are extracted from actual server template source code in `/opt/.manus/webdev/templates/`.

All claims are grounded in observable evidence. Where uncertainty exists, it is explicitly noted in the documents.
