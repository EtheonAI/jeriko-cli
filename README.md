# Jeriko

**A production-grade AI agent platform with autonomous desktop control, browser automation, code execution, and real-time collaboration.**

Built by [Etheon](https://github.com/Etheon) as a full-stack SaaS platform where AI agents can see your screen, control a browser, write and execute code, manage files, send emails, and interact with 36+ third-party services — all orchestrated through a real-time chat interface.

---

## Table of Contents

- [Vision](#vision)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Applications](#applications)
- [Microservices](#microservices)
- [Shared Packages](#shared-packages)
- [E2B Sandbox Templates](#e2b-sandbox-templates)
- [AI Agent System](#ai-agent-system)
- [Database Schema](#database-schema)
- [Authentication](#authentication)
- [Real-Time System](#real-time-system)
- [Redux State Architecture](#redux-state-architecture)
- [API Layer](#api-layer)
- [Connectors & Integrations](#connectors--integrations)
- [Billing & Payments](#billing--payments)
- [Search Infrastructure](#search-infrastructure)
- [Email System](#email-system)
- [Smart Home & IoT](#smart-home--iot)
- [Knowledge Base & RAG](#knowledge-base--rag)
- [Testing Strategy](#testing-strategy)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment](#deployment)
- [Load Testing](#load-testing)
- [Skills System](#skills-system)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Development Commands](#development-commands)
- [Network Architecture](#network-architecture)
- [Security](#security)
- [Known Gotchas](#known-gotchas)
- [Documentation](#documentation)
- [License](#license)

---

## Vision

Jeriko is an AI-native workspace where users interact with autonomous agents through natural language. The agent can:

- **See and control a full desktop** — Ubuntu sandbox with XFCE via WebRTC streaming (Neko)
- **Automate browsers** — Navigate, click, type, screenshot, read PDFs via Playwright + CDP
- **Execute code** — Run Python, JavaScript, and shell commands in isolated Firecracker microVMs
- **Manage files** — Upload, download, preview, version, and share files via S3
- **Build websites** — Generate and deploy full web projects with live preview
- **Connect to 36+ services** — Gmail, Slack, Notion, GitHub, Figma, Stripe, HubSpot, and more
- **Process emails** — Dedicated agent email inbox for forwarding and automated processing
- **Control smart home devices** — Home Assistant integration for IoT automation
- **Collaborate in real-time** — Shared sessions with live cursors and presence
- **Schedule recurring tasks** — Cron-based automation with approval workflows
- **Search everything** — Full-text search across sessions, files, projects, and tasks

The platform is designed for multi-tenancy, with per-user sandboxes, credit-based billing, and enterprise team features.

---

## Architecture Overview

```
                                    Users
                                      |
                                      v
                        +---------------------------+
                        |    Next.js App (3000)     |
                        |   React 19 + Redux + tRPC |
                        +---------------------------+
                                      |
                    +-----------------+-----------------+
                    |                                   |
                    v                                   v
        +-------------------+               +-------------------+
        |  Gateway (4001)   |               |  tRPC Routers     |
        |  Fastify + WS     |               |  (22 endpoints)   |
        +-------------------+               +-------------------+
                    |
    +-------+-------+-------+-------+-------+-------+
    |       |       |       |       |       |       |
    v       v       v       v       v       v       v
 Orch.   Task    File   Billing  Search Connector  ...
(4014)  (4002)  (4005)  (4008)  (4013)  (4009)
    |
    v
+-------------------+       +---------------------------+
| E2B Sandbox       |       | External Services         |
| (Firecracker VM)  |       | Anthropic, OpenAI, Stripe |
| Ubuntu + Neko     |       | Composio, Knock, S3, etc. |
| Playwright + CDP  |       +---------------------------+
| Code Server       |
+-------------------+
```

**Request Flow:**
1. User sends a message via the chat interface
2. Next.js API route saves the message to PostgreSQL, then proxies to the Orchestrator
3. Orchestrator runs the LLM agent loop (plan → tool selection → execution → observation)
4. Tool calls are routed to the E2B sandbox (browser, terminal, files) or external services
5. Results stream back via SSE with Redis-backed resumable streams
6. Frontend renders incrementally via the AI SDK message parts system
7. Tool events sync to Redux for canvas rendering (browser view, terminal, code editor)

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Runtime** | Node.js | 22 LTS |
| **Package Manager** | pnpm | 10.19.0 |
| **Monorepo** | Turborepo | 2.8.3 |
| **Language** | TypeScript (strict mode) | 5.9.3 |
| **Frontend Framework** | Next.js (App Router, Turbopack) | 16.1.5 |
| **UI Library** | React | 19.2.3 |
| **State Management** | Redux Toolkit (44+ slices) | latest |
| **Data Fetching** | RTK Query + tRPC | 11.9.0 |
| **Styling** | Tailwind CSS + shadcn/ui + Radix UI | 4.1.7 |
| **AI SDK** | Vercel AI SDK | 6.0.77 |
| **LLM Providers** | Anthropic (Claude), OpenAI (GPT-4o) | latest |
| **Database** | PostgreSQL (Neon serverless) | 17 |
| **ORM** | Drizzle ORM | 0.38.4 |
| **Cache** | Redis | 7 |
| **Search Engine** | Typesense | 2.0.0 |
| **File Storage** | AWS S3 + CloudFront CDN | v3 SDK |
| **Authentication** | Better-Auth (email, OAuth, passkeys) | 1.4.18 |
| **Payments** | Stripe | 19.1.0 |
| **Email** | React Email + Resend + Knock | latest |
| **Real-Time** | WebSocket + SSE + Redis pub/sub + Liveblocks | latest |
| **Sandbox** | E2B (Firecracker microVMs) | latest |
| **Desktop Streaming** | Neko (WebRTC + GStreamer) | v3 |
| **Browser Automation** | Playwright + Chromium (CDP) | latest |
| **Microservices** | Fastify | 5.2.2 |
| **Task Orchestration** | Inngest | 3.32.3 |
| **Connectors** | Composio SDK (36+ services) | 0.6.3 |
| **Analytics** | PostHog + Google Analytics + Vercel Analytics | latest |
| **Observability** | Sentry + OpenTelemetry + BetterStack | latest |
| **Security** | Arcjet (WAF, bot protection, rate limiting) | latest |
| **Feature Flags** | Vercel Flags | 4.0.1 |
| **Notifications** | Knock (email/push) + Web Push API | latest |
| **Collaboration** | Liveblocks (cursors, presence) | 3.9.1 |
| **Unit Testing** | Vitest + Testing Library | 4.0.3 |
| **E2E Testing** | Playwright | 1.58.1 |
| **Load Testing** | k6 (Grafana) | latest |
| **Security Scanning** | Trivy | latest |
| **Container Registry** | GHCR + Amazon ECR | latest |
| **Deployment** | AWS ECS + Docker | latest |
| **CMS** | Basehub | 9.5.2 |
| **i18n** | next-intl | 4.5.0 |
| **Canvas/Drawing** | Konva.js | latest |
| **Code Editor** | Monaco Editor | latest |
| **Webhooks** | Svix | 1.80.0 |

---

## Monorepo Structure

```
jeriko/
├── apps/                          # Deployable applications
│   ├── app/                       # Main Next.js application (port 3000)
│   ├── web/                       # Marketing website (port 3001)
│   ├── api/                       # API gateway app (port 3002)
│   ├── docs/                      # Documentation site (Mintlify)
│   ├── email/                     # Email template development (React Email)
│   ├── storybook/                 # Component library explorer
│   └── studio/                    # Admin CMS studio (Basehub)
│
├── packages/                      # Shared libraries (24 packages)
│   ├── ai/                        # AI SDK integration, tools, providers, agents
│   ├── agentmail/                 # Email agent inbox (AgentMail)
│   ├── analytics/                 # PostHog + Google Analytics + Vercel
│   ├── auth/                      # Better-Auth (email, OAuth, passkeys)
│   ├── cms/                       # Basehub CMS integration
│   ├── collaboration/             # Liveblocks real-time collaboration
│   ├── contracts/                 # Zod API contracts between services
│   ├── database/                  # Drizzle ORM + Neon PostgreSQL (25+ tables)
│   ├── design-system/             # shadcn/ui + Radix + Tailwind (200+ components)
│   ├── email/                     # React Email templates + Resend
│   ├── feature-flags/             # Vercel Flags
│   ├── internationalization/      # next-intl i18n
│   ├── next-config/               # Shared Next.js config + bundle analyzer
│   ├── notifications/             # Knock + Web Push
│   ├── observability/             # Sentry + OpenTelemetry + BetterStack
│   ├── payments/                  # Stripe subscriptions + agent toolkit
│   ├── rate-limit/                # Upstash Redis rate limiting
│   ├── search/                    # Typesense client + collections
│   ├── security/                  # Arcjet WAF + Nosecone headers
│   ├── seo/                       # Metadata, sitemaps, JSON-LD
│   ├── service-utils/             # Fastify middleware factory (auth, CORS, health, etc.)
│   ├── storage/                   # AWS S3 v3 (upload, download, presigned URLs)
│   ├── testing/                   # Vitest factories, MSW handlers, DB seeds
│   ├── typescript-config/         # Shared tsconfig
│   └── webhooks/                  # Svix webhook management
│
├── services/                      # Microservices (15+ services)
│   ├── orchestrator/              # AI brain — LLM loop, tool routing, E2B lifecycle
│   ├── gateway/                   # API proxy, WebSocket hub, rate limiting
│   ├── sandbox/                   # E2B sandbox lifecycle, code execution, browser
│   ├── task/                      # Inngest scheduled tasks, cron, approvals
│   ├── file/                      # S3 file management, versioning, webhooks
│   ├── billing/                   # Stripe billing, credits, usage tracking
│   ├── notification/              # Email/push/in-app notification delivery
│   ├── webhook/                   # Svix webhook dispatch, HMAC signing
│   ├── connector/                 # Composio OAuth, 36+ integrations
│   ├── project/                   # Project CRUD, members, permissions
│   ├── search/                    # Typesense full-text search + DB fallback
│   ├── knowledge/                 # RAG pipeline — embeddings, vector search
│   ├── device/                    # Smart home (Home Assistant) IoT control
│   ├── webrtc-media/              # TURN credentials, Neko auth, media sessions
│   ├── website/                   # Website builder, templates, deployment
│   ├── sandbox-proxy/             # HTTP proxy for sandbox environments
│   └── agent/                     # Python AI agent runtime (pytest-tested)
│
├── e2b-templates/                 # E2B Firecracker VM templates
│   ├── base/                      # Minimal: Python 3.11, Node.js 22
│   ├── code-interpreter-v1/       # Data science: NumPy, Pandas, Matplotlib
│   └── desktop/                   # Full GUI: Neko, Playwright, Code Server, MCP
│
├── skills/                        # 27 LLM-facing AI skill definitions
├── scripts/                       # Utility scripts (seed, migrate, validate)
├── docs/                          # Architecture documentation (14 supplements)
├── k6/                            # k6 load test scripts
├── load-tests/                    # Load test configurations
├── .github/                       # CI/CD workflows, security policy, CODEOWNERS
├── docker-compose.services.yml    # Development: all 15+ services
├── docker-compose.prod.yml        # Production deployment
├── docker-compose.dev.yml         # Dev overrides
├── docker-compose.typesense.yml   # Typesense search engine
├── turbo.json                     # Turborepo task definitions
├── pnpm-workspace.yaml            # pnpm workspace config
├── vitest.workspace.ts            # Vitest workspace config
└── package.json                   # Root package (v5.2.1)
```

---

## Applications

### `apps/app` — Main Application (Port 3000)

The primary user-facing application. A Next.js 16 app using the App Router with Turbopack.

**Authenticated Routes:**

| Route | Purpose |
|---|---|
| `/` | Dashboard — hero prompt, example suggestions, onboarding wizard |
| `/chat/[id]` | Chat session — real-time AI conversation with canvas |
| `/chat/test` | Chat testing sandbox |
| `/chat/test-stream` | SSE streaming integration test (browser, terminal, files) |
| `/chat/test-ide` | IDE/code editor test page |
| `/files` | File library — upload, preview, share, version files |
| `/projects/[id]` | Project detail — sessions, settings, deployment |
| `/actions` | Automations — trigger/action configuration |
| `/applications` | Application marketplace |
| `/community` | Shared sessions and community features |

**Unauthenticated Routes:**

| Route | Purpose |
|---|---|
| `/login` | Multi-step auth — email check → password → verification |
| `/share/[id]` | Public read-only shared session view |
| `/verify-email` | Email verification flow |
| `/forgot-password` | Password reset initiation |
| `/reset-password` | Token-based password reset |

**Settings System (13 tabs, all lazy-loaded):**

| Tab | Description |
|---|---|
| Account | Profile, name, email, avatar upload (S3) |
| Settings | General app preferences |
| Usage | Credit usage dashboard and analytics |
| Billing | Subscription management, payment history |
| Scheduled Tasks | Recurring task automation with cron expressions |
| Connectors | Third-party OAuth connections (Gmail, Slack, Notion, etc.) |
| Mail Jeriko | Email agent configuration, inbox provisioning |
| Data Controls | Data export, deletion, privacy settings |
| Personalization | Theme, language, model preferences |
| Skills | AI capability configuration |
| Integrations | Webhook setup, API connections |
| Secrets | Environment variables injected into sandbox |
| Help | Documentation, support links |

**API Routes:**

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Send message — SSE streaming response (600s max) |
| `/api/chat` | GET | Resume interrupted stream from Redis |
| `/api/chat/[id]/stop` | POST | Abort active stream |
| `/api/chat/[id]/stream` | GET | Alternative stream endpoint |
| `/api/sandbox` | POST | Create E2B sandbox |
| `/api/sandbox/[id]/browser` | POST | Start browser in sandbox |
| `/api/sandbox/[id]/browser/stream` | GET | Browser video stream |
| `/api/sandbox/[id]/shell` | POST | Execute shell command |
| `/api/sandbox/[id]/terminal/stream` | POST | Terminal SSE stream |
| `/api/sandbox/[id]/files/list` | GET | List sandbox files |
| `/api/sandbox/[id]/files` | POST | Upload to sandbox |
| `/api/sandbox/[id]/stop` | POST | Destroy sandbox |
| `/api/trpc/[trpc]` | GET/POST | tRPC endpoint (22 routers) |
| `/api/auth/[...all]` | GET/POST | Better-Auth delegation |
| `/api/auth/check-email` | POST | Email existence check |
| `/api/files/upload` | POST | Upload file to S3 |
| `/api/avatar/upload` | POST | Upload user avatar to S3 |
| `/api/health` | GET | Health check |
| `/api/gateway-token` | GET | Gateway authentication |
| `/api/connectors/redirect` | GET | OAuth redirect |
| `/api/connectors/callback` | POST | OAuth callback |
| `/api/collaboration/auth` | POST | Liveblocks auth |
| `/api/webhooks/agentmail` | POST | Email inbox webhook |
| `/api/webhooks/stripe` | POST | Stripe payment webhook |
| `/api/sessions/[id]/media/*` | POST | WebRTC media control |

### `apps/web` — Marketing Website (Port 3001)

Public-facing marketing site built with Next.js 16, Tailwind CSS, and MDX. Includes rate limiting via Arcjet and CMS integration via Basehub.

### `apps/api` — API Gateway App (Port 3002)

REST/webhook API server for external integrations. Handles Stripe payment webhooks via Svix.

### `apps/email` — Email Templates

React Email template library for transactional emails with hot-reload preview server.

### `apps/docs` — Documentation

Documentation site powered by Mintlify.

### `apps/storybook` — Component Library

Storybook environment for developing and testing design system components in isolation.

### `apps/studio` — Admin Studio

Basehub CMS studio for content management.

---

## Microservices

All services are built with Fastify 5.x and share common utilities from `@repo/service-utils` (auth middleware, CORS, health checks, logging, rate limiting, validation, circuit breakers, metrics).

### Orchestrator (Port 4014)

The brain of the system. Runs the AI agent loop and manages tool execution.

- **LLM Providers**: Claude Sonnet 4 (default), GPT-4o (fallback), Gemini 2.5 Flash
- **Agent Loop**: Plan → Tool Selection → Execution → Observation → Repeat
- **E2B Integration**: Creates/manages per-user sandboxes
- **LLM Proxy**: Exposes `/api/llm-proxy/v1` so sandbox code can call LLMs
- **File Upload**: S3 presigned URL generation
- **Routes**: Sessions (create/resume), completions (streaming), media (TURN/WebRTC), webdev (IDE), deploy, sandbox runtime, file ops, email, image ops, slides, skills, OAuth, API proxy
- **Cleanup Loop**: Automatic resource reclamation for idle sandboxes

### Gateway (Port 4001)

API entry point and WebSocket multiplexer.

- Request rate limiting per user/IP
- WebSocket room management with Redis pub/sub
- SSE passthrough for streaming responses
- Path-based routing to downstream services
- CORS and Helmet security headers

### Sandbox (Port 4012)

E2B sandbox lifecycle management.

- Create/destroy Firecracker microVMs
- Python, JavaScript, and Bash code execution
- Browser controller API via Playwright CDP
- File read/write operations
- Security: path traversal prevention, command allowlists

### Task (Port 4002)

Scheduled task orchestration via Inngest.

- Task CRUD with status transitions (pending → running → completed/failed)
- Cron scheduler with `cron-parser`
- Inngest function triggers (execute-task, cron-scheduler, approval-workflow)
- Retry logic with exponential backoff
- Task execution run tracking

### File (Port 4005)

S3-backed file management.

- Multipart upload to S3
- File versioning
- Presigned URL generation for downloads
- MIME type validation and file size limits
- User isolation
- Webhook triggers on upload/delete

### Billing (Port 4008)

Stripe-based subscription and credit management.

- Stripe webhook processing
- Subscription CRUD
- Credit system (daily credits, starter credits, purchased credits, auto top-up)
- Usage tracking per request
- Invoice generation
- Plan management (free, pro, enterprise)

### Notification (Port 4006)

Multi-channel notification delivery.

- Email via Knock
- Web Push via `web-push`
- In-app notifications stored in PostgreSQL
- User preference management (digest frequency, quiet hours)
- Batching and retry with backoff

### Webhook (Port 4007)

Outbound webhook dispatch.

- HMAC signature verification
- Event routing
- Idempotency keys
- Retry queues with exponential backoff
- Failure tracking

### Connector (Port 4009)

Third-party service integration via Composio SDK.

- OAuth flows for 36+ services
- Token management and refresh
- Tool discovery per connector
- Credential storage with user isolation
- Categories: communication, storage, productivity, development, CRM, analytics

### Project (Port 4010)

Project management service.

- Project CRUD with member roles (owner, editor, viewer)
- Permission checks
- Project sessions and groups
- Cascade delete

### Search (Port 4013)

Full-text search with graceful fallback.

- Typesense integration (fuzzy matching, filters, pagination)
- DB ILIKE fallback when Typesense is unavailable
- Index sync for sessions, files, tasks, projects
- User isolation

### Knowledge (Port 8001 — Python)

RAG pipeline for personal knowledge bases.

- Document ingestion (PDF, Markdown, plain text)
- Text chunking
- OpenAI embedding generation
- Vector search
- Source tracking
- User isolation

### Device (Port 4015)

Smart home and IoT device management.

- Home Assistant WebSocket integration
- Entity discovery (19 domains: light, climate, sensor, switch, lock, cover, etc.)
- Command execution with safety checks (dangerous command filtering)
- Device heartbeat tracking
- User isolation

### WebRTC Media (Port 4016)

WebRTC infrastructure for desktop streaming.

- Cloudflare TURN server configuration
- Neko authentication
- Media session CRUD
- WebSocket control channel

### Website (Port 4015)

Website builder service.

- Template library
- Website CRUD
- Vercel deployment integration
- TiDB database provisioning
- AI generation (planned)

### Sandbox Proxy

HTTP proxy for sandbox environments.

### Agent (Python)

Python AI agent runtime with pytest test suite.

---

## Shared Packages

### `@repo/ai` — AI Integration Layer

The core AI package providing:

- **Custom Provider** (`JerikoAI`): Routes all completions through the orchestrator
- **Model Registry**: Claude Sonnet 4.5 (default), Claude Haiku 4.5 (fast), Claude Opus 4.5 (powerful)
- **Tool System**: 34 agent tools with Zod schema definitions and dynamic renderers
- **Tool Categories**: Browser (22 tools), Terminal (5), Match (2), Code, Web Search, File Ops, Notifications, Plans, Images, Projects
- **Canvas System**: Maps tool calls to canvas views (browser, terminal, webDevIDE, slideEditor, codeViewer)
- **Hooks**: `useChat`, `useVoiceInput`, `useFileUpload`, `useE2bStream`, `useE2bTerminal`
- **Components**: Message list, prompt input, tool renderers, agent UI, chat thread
- **Transport**: WebSocket and HTTP transport layers
- **Agent System**: Tool-loop implementation with approval workflow

### `@repo/database` — Data Layer

Drizzle ORM with Neon serverless PostgreSQL. Exports schema, client, and service utilities.

**25+ Schema Tables:**

| Domain | Tables |
|---|---|
| Users & Auth | `users`, `accounts`, `authSessions`, `verifications`, `apiKeys` |
| Sessions & Chat | `agentSessions`, `messages`, `votes`, `documents` |
| Agents | `agents`, `agentTasks` |
| Files | `files`, `fileVersions`, `fileShares` |
| Organizations | `organizations`, `members`, `invitations` |
| Connectors | `connectorDefinitions`, `userConnectors`, `connectorSyncLogs` |
| Notifications | `notifications`, `notificationPreferences`, `pushSubscriptions` |
| Tasks | `scheduledTasks`, `taskExecutions`, `triggerEvents` |
| Projects | `projects`, `projectMembers`, `projectSessions`, `projectGroups` |
| Billing | `plans`, `subscriptions`, `usageMetrics`, `invoices`, `creditBalances` |
| Sandbox | `sandboxes`, `sandboxFiles`, `sandboxSessions` |
| Smart Home | `smartHomeHubs`, `smartHomeEntities`, `devices` |
| Knowledge | `vectorDocuments`, `documentChunks`, `embeddingVectors` |
| Other | `agentMailboxes`, `skills`, `userSecrets`, `mediaSessions`, `webdevDomains`, `websites`, `webhooks` |

### `@repo/auth` — Authentication

Better-Auth 1.4.18 (NOT Clerk). Supports:

- Email/password with verification
- OAuth (Google, GitHub, etc.)
- Passkeys (WebAuthn)
- Cookie-based sessions (httpOnly, secure, sameSite)
- `proxy.ts` integration (Next.js 16 request interceptor, replaces middleware.ts)

### `@repo/design-system` — UI Components

200+ components built on shadcn/ui + Radix UI + Tailwind CSS 4.1. Includes buttons, cards, dialogs, modals, forms, data tables, charts (Recharts), canvas editors (Konva), carousel (Embla), animations (motion), and markdown rendering (streamdown).

### `@repo/payments` — Stripe Integration

Stripe 19.1.0 for subscriptions and Stripe Agent Toolkit 0.7.11 for AI-powered billing operations.

### `@repo/search` — Typesense Client

Typesense 2.0.0 client with collection definitions, query builders, and DB fallback.

### `@repo/storage` — AWS S3

AWS SDK v3 for file upload, download, and presigned URL generation.

### `@repo/observability` — Monitoring

Sentry error tracking, OpenTelemetry distributed tracing, BetterStack log aggregation. Supports server, client, and edge runtimes.

### `@repo/security` — WAF & Protection

Arcjet integration for bot detection, rate limiting, DDoS protection, and secure headers via Nosecone.

### `@repo/notifications` — Multi-Channel Alerts

Knock for email notifications, `web-push` for browser push, and database-backed in-app notifications.

### `@repo/collaboration` — Real-Time Presence

Liveblocks 3.9.1 for live cursors, shared state, and user presence in collaborative sessions.

### `@repo/contracts` — API Contracts

Zod-based TypeScript interfaces for type-safe service-to-service communication.

### `@repo/service-utils` — Microservice Framework

Fastify 5.2.2 middleware factory providing: auth, CORS, health checks, logging (pino), rate limiting, validation, error handling, metrics, circuit breakers, Redis, database, compression, Swagger, webhook utilities.

### `@repo/testing` — Test Infrastructure

Faker.js factories for test data, MSW handlers for API mocking, Vitest setup utilities, database seeders, and tRPC test callers.

### Other Packages

- `@repo/analytics` — PostHog + Google Analytics + Vercel Analytics
- `@repo/agentmail` — AgentMail SDK for email inbox agent
- `@repo/cms` — Basehub CMS integration
- `@repo/email` — React Email templates + Resend transactional delivery
- `@repo/feature-flags` — Vercel Flags with toolbar toggle
- `@repo/internationalization` — next-intl for multi-language support
- `@repo/rate-limit` — Upstash Redis rate limiting
- `@repo/seo` — Metadata, sitemaps, JSON-LD structured data
- `@repo/webhooks` — Svix webhook management
- `@repo/next-config` — Shared Next.js config + bundle analyzer

---

## E2B Sandbox Templates

### `desktop/` — Full GUI Sandbox

The primary sandbox used for agent tool execution. A full Ubuntu environment running inside a Firecracker microVM.

**Includes:**
- Ubuntu 22.04 with XFCE desktop and D-Bus
- Neko v3 WebRTC server (port 8080) — live desktop streaming via Cloudflare TURN
- Playwright + Chromium (CDP on port 9222) — browser automation with screenshots
- PulseAudio — audio capture for voice features
- Node.js 22 LTS + pnpm + yarn
- Python 3.12 + uv (fast package installer)
- Code Server (VS Code in browser, port 8329)
- MCP CLI server (port 8350) for connector tools
- Developer tools: ripgrep, fd-find, tree, jq, build-essential, GitHub CLI, pandoc, wkhtmltopdf, LibreOffice
- Supervisor for process management (Chrome, Code Server, MCP, Neko, Terminal)

**Directory Structure Inside Sandbox:**
```
/home/user/                         # Workspace root
/home/user/screenshots/             # Browser screenshots (WebP)
/home/user/Downloads/               # Browser downloads
/home/user/upload/                  # User file uploads
/home/user/skills/                  # Agent skill scripts
/home/user/.secrets/                # API token (sandbox_api_token)
/home/user/.browser_data_dir/       # Chromium profile
/opt/.jeriko/runtime/               # Runtime scripts
/opt/.jeriko/webdev/templates/      # Web project templates
```

**4-Layer Environment System:**
1. `~/.env` — Static config (DISPLAY, PATH, etc.)
2. `~/.user_env` — Session secrets (API keys via LLM proxy)
3. `~/.secrets/sandbox_api_token` — API auth token
4. Process env — Per-execution tool variables

### `base/` — Minimal Sandbox

Lightweight environment: Python 3.11, Node.js 22. For file ops, shell commands, and HTTP-based tasks. 2 CPU, 512 MB RAM.

### `code-interpreter-v1/` — Data Science Sandbox

Python data science stack: NumPy, Pandas, Matplotlib, Scikit-learn, Jupyter. For code execution and data analysis. 4 CPU, 2048 MB RAM.

---

## AI Agent System

### Agent Loop

The orchestrator runs a continuous plan-act-observe loop:

1. **Plan** — The LLM analyzes the user's message and conversation context
2. **Tool Selection** — Chooses from 34 available tools based on the task
3. **Execution** — Routes the tool call to the sandbox or external service
4. **Observation** — Collects tool output, screenshots, file contents
5. **Streaming** — Streams results to the frontend via SSE
6. **Context Management** — Manages context window across turns

### 34 Agent Tools

**Browser Tools (22):** `navigate`, `click`, `double_click`, `scroll`, `type`, `screenshot`, `screenshot_overlay`, `hover`, `focus`, `blur`, `get_element_text`, `get_pdf_text`, `launch_chromium`, `press_key`, `select_option`, `wait_for_selector`, `wait_for_navigation`, `get_page_url`, `get_page_title`, `evaluate_javascript`, `set_viewport`, `go_back`

**Terminal Tools (5):** `shell_exec`, `shell_continue`, `cancel_shell`, `shell_view`, `shell_write_stdin`

**Match Tools (2):** `match_image`, `match_coordinates`

**Other Tools:** `message_notify_user`, `show_plan`, `generate_image`, `create_project`, `upload_file`

### Canvas Views

Tool calls automatically trigger canvas views in the frontend:

| View | Triggered By | Displays |
|---|---|---|
| Browser | `navigate`, `click`, `screenshot`, etc. | Live browser frame, screenshots |
| Terminal | `shell_exec`, `shell_continue` | Terminal output stream |
| WebDev IDE | `create_project`, file edits | Code Server (Monaco) |
| Code Viewer | File read tools | File browser with tabs |
| Slide Editor | Presentation tools | Slide editing canvas |

### LLM Provider Fallback

The orchestrator supports automatic provider fallback:
1. Primary: Claude Sonnet 4 (Anthropic)
2. Fallback: GPT-4o (OpenAI) — triggered on quota exhaustion
3. Optional: Gemini 2.5 Flash via proxy

### Chat Pipeline

```
User Message → /api/chat (POST)
  → Save user message to DB (parts column)
  → agentProxy() → Orchestrator service
  → SSEProcessor transforms events to AI SDK format
  → consumeSseStream wraps in Redis for resumability
  → SSE response to client
  → Finally: save assistant message, clear activeStreamId

Stream Resume → /api/chat (GET)
  → Look up activeStreamId in DB
  → resumeExistingStream from Redis
  → Replay stored events + follow live
```

**SSE Event Types:** `text-start/delta/end`, `reasoning-start/delta/end`, `tool-input-start/available`, `tool-output-available/error`, `source-url`, `message-metadata`, `start-step/finish-step`, `start/finish`

---

## Database Schema

PostgreSQL 17 via Neon serverless, managed with Drizzle ORM 0.38.4.

**Key Tables:**

- `users` — id, email, name, image, password, emailVerified, stripeCustomerId, preferences
- `agentSessions` — id, userId, title, status (active/paused/completed/failed/archived), metadata, activeStreamId
- `messages` — id, sessionId, role (user/assistant/system/tool), content, parts (JSON), attachments, metadata
- `agents` — id, sessionId, type (orchestrator/researcher/coder/browser/file_manager/executor/analyst), status
- `files` — id, userId, sessionId, name, mimeType, size, s3Key, metadata
- `connectorDefinitions` — id, name, category, oauthConfig, availableTools
- `userConnectors` — id, userId, definitionId, credentials, status
- `scheduledTasks` — id, userId, cron, sessionId, payload, active
- `creditBalances` — userId, balance, periodCredits, dailyCredits, purchasedCredits, autoTopup
- `projects` — id, userId, title, status, settings
- `smartHomeHubs` — id, userId, url, accessToken
- `vectorDocuments` — id, userId, content, embedding, chunks
- `agentMailboxes` — id, userId, email, createdAt

**Limitation:** Neon HTTP driver does NOT support transactions at runtime. Services use workarounds for multi-step operations.

---

## Authentication

**Framework:** Better-Auth 1.4.18

**Providers:**
- Email/password with verification code flow
- OAuth (Google, GitHub, etc.)
- Passkeys (WebAuthn) support

**Session Management:**
- Cookie-based sessions (httpOnly, secure, sameSite)
- Token validation on every request via `proxy.ts` (Next.js 16 request interceptor)
- Session table: `auth_sessions` with token, userId, ipAddress, userAgent

**Auth Flow:**
1. User navigates to `/login`
2. Multi-step: email check → password/register → verification
3. Better-Auth creates session, sets cookie
4. `proxy.ts` validates cookie on each request
5. Invalid/missing → redirect to `/login`
6. Valid → pass through with user context

**Public Routes:** `/login`, `/sign-up`, `/api/auth/*`, `/api/health`, `/share/[id]`

**E2E Auth Bypass:** Supports `E2E_AUTH_BYPASS` env for Playwright tests.

---

## Real-Time System

### WebSocket (Gateway)

- Per-session rooms with Redis pub/sub for cross-instance sync
- Auto-reconnect with exponential backoff
- Message routing to Redux store actions
- Tool event synchronization

### Server-Sent Events (SSE)

- Chat responses stream via SSE from the orchestrator
- Redis-backed resumable streams for page refresh/reconnection
- `consumeSseStream` wraps events with persistence
- Graceful degradation: streams work without Redis (non-resumable)

### Liveblocks Collaboration

- Live cursors and user presence in shared sessions
- Shared state synchronization
- Conditional loading (only when collaboration is enabled)

---

## Redux State Architecture

44+ Redux slices organized by domain. RTK Query is the single source of truth for async data fetching.

**Core Slices:**

| Slice | Purpose |
|---|---|
| `auth` | User profile, credits, membership, preferences |
| `chat` | Messages, input state, file attachments, task modes |
| `sessions` | Session entities, status, settings, stats, collaborators |
| `websocket` | Connection state, message queue, rooms |
| `ui` | Global UI state (modals, drawers, theme, sidebar) |
| `api` | RTK Query cache (the ONLY async data slice) |

**Feature Slices:**

| Slice | Purpose |
|---|---|
| `agentWorkspace` | Sidebar, timeline, dialog states |
| `aiCanvas` | Canvas instances, OCR cache |
| `aiCanvasEditor` | Konva editor state (shapes, tools, camera, selections) |
| `billing` / `biz` | Billing UI, subscriptions, credit packages |
| `codeViewer` | Code file browser (tabs, active file, directory) |
| `community` | Shared sessions/projects |
| `configs` | Local client preferences |
| `connectors` | Third-party integration state |
| `enterpriseTeam` | Team admin (API keys, audit logs) |
| `experiment` | Feature flags |
| `fileManagement` | File library UI |
| `filePreviewer` | File preview modal |
| `fileShare` | Public file sharing |
| `fileConnector` | Cloud storage auth |
| `knowledge` | Knowledge base entries |
| `library` | Attachment library |
| `login` | Login form state (steps, OAuth) |
| `mailAgent` | Email agent settings |
| `mapReduce` | Map-reduce job state |
| `myBrowser` | Browser tool state |
| `navbar` | Navigation state |
| `notification` | In-app notifications |
| `onboarding` | Onboarding flow |
| `plan` | Agent planning/thinking |
| `products` | Product catalog |
| `project` | Project management |
| `scheduledTasks` | Scheduled task state |
| `search` | Search results |
| `session` / `sessionSwitch` | Current session, session switcher |
| `skill` / `skills` | Skill activation |
| `slideEditor` | Presentation editor |
| `timeline` | Chat message history |
| `toolCalls` | Active tool call tracking |
| `webDev` / `webDevUsage` | Web development IDE state |
| `webdevAuth` | WebDev auth state |

**Middleware:**
- `websocket.middleware.ts` — WebSocket connection lifecycle, auto-reconnect, room management, message routing
- `redux-persist` — Session recovery via localStorage

**Selectors (Canvas):**
- `selectLatestCanvasToolEvent` — Most recent tool call
- `selectAvailableViews` — Valid canvas views based on tool state
- `selectLatestBrowserScreenshot` — Latest browser frame
- `selectSessionMetadata` — Session info (sandboxId, nekoUrl)

---

## API Layer

### tRPC (22 Routers)

Type-safe API layer with tRPC 11.9.0 + TanStack React Query.

| Router | Key Procedures |
|---|---|
| `agents` | list, get, create, update (types: orchestrator, researcher, coder, browser, file_manager, executor, analyst) |
| `apiKeys` | list, create, revoke |
| `billing` | getPlans, getBalance, upgrade, getUsage |
| `community` | listShared, share, unshare |
| `connectors` | listDefinitions, listInstalled, initializeOAuth, connectWithApiKey, checkConnection, uninstall |
| `devices` | list, get, create, update, delete, heartbeat |
| `files` | list, get, create, delete, share, generatePresignedUrl |
| `knowledge` | search, create, delete |
| `mail` | getMailbox, updateSettings |
| `messages` | list, get, create, delete |
| `notifications` | list, markRead, delete |
| `projects` | list, get, create, update, delete, listSessions |
| `scheduledTasks` | list, create, update, delete |
| `search` | global, quickSearch, initializeCollections, syncAllData |
| `secrets` | list, create, update, delete |
| `sessions` | list, get, create, update, delete, updateMultiple |
| `skills` | list, enable, disable |
| `smartHome` | listHubs, listEntities, executeCommand |
| `user` | getProfile, updateProfile, updatePreferences |
| `webhooks` | list, create, update, delete |
| `websiteBuilder` | list, get, create, deploy |

### REST API Routes

The `/api/chat`, `/api/sandbox/*`, `/api/files/*`, `/api/auth/*`, and `/api/webhooks/*` endpoints operate as standard REST routes outside of tRPC.

---

## Connectors & Integrations

Powered by Composio SDK with OAuth flow management.

**36+ Supported Connectors:**

| Category | Services |
|---|---|
| Communication | Gmail, Slack, Microsoft Teams, Discord |
| Productivity | Notion, Google Docs, Google Sheets, Airtable |
| Development | GitHub, GitLab, Bitbucket, Linear, Jira |
| Design | Figma |
| CRM | HubSpot, Salesforce |
| Automation | Zapier, Make (Integromat), n8n |
| Payments | Stripe |
| Storage | Google Drive, Dropbox, OneDrive |
| Analytics | Google Analytics |
| Project Management | Asana, Monday.com, ClickUp, Trello |

**Connection Methods:**
1. **OAuth** — Full OAuth 2.0 flow with redirect and callback
2. **API Key** — Direct API key entry for simpler services
3. **Custom MCP** — Model Context Protocol for custom tool servers

---

## Billing & Payments

Stripe-based subscription system with credit management.

**Plans:** Free, Pro, Enterprise

**Credit System:**
- `periodCredits` / `periodCreditsUsed` — Monthly allocation
- `dailyCredits` / `dailyCreditsUsed` — Daily refresh amount
- `starterCredits` / `starterCreditsUsed` — One-time starter bonus
- `purchasedCredits` / `purchasedCreditsUsed` — Top-up purchases
- `autoTopupEnabled` / `autoTopupThreshold` / `autoTopupPackageId` — Automatic refill

**Features:**
- Stripe webhook processing for subscription lifecycle
- Invoice tracking
- Usage metrics per request
- Billing portal redirect
- Stripe Agent Toolkit for AI-powered billing operations

---

## Search Infrastructure

Typesense 2.0.0 for full-text search with PostgreSQL ILIKE fallback.

**Indexed Collections:** sessions, files, tasks, projects, actions

**Features:**
- Fuzzy matching
- Faceted filtering
- Pagination
- Per-user isolation
- Automatic index sync
- Graceful fallback to DB when Typesense is unavailable

---

## Email System

### Agent Email Inbox

Each user gets a provisioned email address (via AgentMail) that forwards to the AI agent for automated processing.

**Features:**
- Auto-summarize incoming emails
- Auto-categorize and label
- Whitelist-based sender filtering
- Configurable via the Mail Jeriko settings tab

### Transactional Email

React Email templates delivered via Resend for:
- Email verification
- Password reset
- Notification digests (instant, hourly, daily, weekly)

### Notification Email

Knock integration for structured notification delivery with user preference management and quiet hours.

---

## Smart Home & IoT

Home Assistant integration for smart device control.

**Supported Domains (19):** light, climate, sensor, switch, lock, cover, fan, media_player, vacuum, camera, alarm_control_panel, binary_sensor, input_boolean, input_number, input_select, scene, script, automation, weather

**Features:**
- Hub registration with access token
- WebSocket command execution
- Entity discovery across all domains
- Safety checks (dangerous command filtering)
- Heartbeat monitoring

---

## Knowledge Base & RAG

Python-based RAG (Retrieval-Augmented Generation) pipeline.

**Document Ingestion:**
- PDF, Markdown, plain text
- Automatic text chunking
- OpenAI embedding generation

**Search:**
- Vector similarity search
- Source tracking and attribution
- Per-user isolation

---

## Testing Strategy

### Unit Tests (Vitest 4.0.3)

- **Framework**: Vitest + jsdom + @testing-library/react 16.3.x
- **Location**: `__tests__/` directories alongside source
- **Data**: `@repo/testing` factories (Faker.js)
- **Mocking**: MSW for API, `vi.mock()` for modules

### Integration Tests

- PostgreSQL (test isolation via transactions)
- Redis
- MSW for external API mocking
- tRPC test callers

### E2E Tests (Playwright 1.58.1)

- **Location**: `e2e/` directories
- **Pattern**: Page Object Model
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile**: Pixel 7, iPhone 15
- **CI**: 2 retries, 4 workers
- **Reports**: HTML + GitHub reporters

**Test Specs:**
- `auth.spec.ts` — Login redirect, page rendering, metadata
- `user-can-chat.spec.ts` — Full chat flow: send → receive → sidebar
- `chat-streaming.spec.ts` — Message streaming, tool rendering
- `regression.spec.ts` — Critical functionality preservation

### Security Tests

- Auth bypass attempts
- XSS prevention
- CSRF protection
- SQL injection
- Sensitive data leak detection

### Contract Tests

TypeScript interface validation between services using Zod schemas.

### Bundle Analysis

- `pnpm analyze` — Next.js bundle size analysis
- Lighthouse CI (`pnpm lhci`) — Performance scoring

### Agent Tests (Python)

- `pytest` with coverage
- Located in `services/agent/tests/`
- CI: Python 3.12, coverage upload to Codecov

---

## CI/CD Pipeline

### CI Workflow (`.github/workflows/ci.yml`)

Triggers on push to `main`/`develop` and pull requests.

| Job | Description |
|---|---|
| **Lint & Type Check** | ESLint + TypeScript (affected packages only via Turbo) |
| **Dependency Boundaries** | `dependency-cruiser` validation |
| **Unit & Integration Tests** | Vitest with PostgreSQL 17 + Redis 7 services |
| **E2E Tests** | Playwright on production build |
| **Python Agent Tests** | pytest with coverage |
| **Build** | Turbo build (affected only) |
| **Docker Images** | Matrix build for 14 services → GHCR (main only) |
| **Security Scan** | Trivy vulnerability scanner → SARIF |

### Deploy Workflow (`.github/workflows/deploy.yml`)

Triggers on push to `main` (auto) or manual workflow_dispatch.

| Stage | Description |
|---|---|
| **Prepare** | Determine environment, version (timestamp+SHA), changed services |
| **Build & Push** | Docker images to Amazon ECR (matrix: 15 services) |
| **Deploy Staging** | ECS task definition update + force deployment |
| **Deploy Production** | Manual trigger only, same ECS flow |
| **Smoke Tests** | Health check with 3 retries |

**Smart Deployment:** Only changed services are rebuilt and deployed. If `packages/` changes, all services are redeployed.

---

## Deployment

### Docker Compose (Development)

```bash
# Start infrastructure
pnpm services:up  # PostgreSQL + Redis

# Start all 15+ services
pnpm dev:services

# Or start individually
pnpm --filter app dev
pnpm --filter orchestrator dev
```

**`docker-compose.services.yml` containers:**

| Container | Port | Purpose |
|---|---|---|
| `jeriko-postgres` | 5432 | PostgreSQL 17 |
| `jeriko-redis` | 6379 | Redis 7 |
| `jeriko-inngest` | 8288 | Task orchestration |
| `jeriko-gateway` | 3001 | API gateway |
| `jeriko-task` | 3002 | Task service |
| `jeriko-file` | 3003 | File service |
| `jeriko-website` | 3004 | Website builder |
| `jeriko-billing` | 3005 | Billing |
| `jeriko-notification` | 3006 | Notifications |
| `jeriko-webhook` | 3007 | Webhooks |
| `jeriko-connector` | 3008 | Connectors |
| `jeriko-search` | 3009 | Search |
| `jeriko-project` | 3010 | Projects |
| `jeriko-orchestrator` | 4014 | AI orchestrator |
| `jeriko-device` | 4001 | Smart home |
| `jeriko-webrtc-media` | 4016 | WebRTC |
| `jeriko-knowledge` | 8001 | Knowledge (Python) |
| `jeriko-sandbox` | 8081 | E2B sandbox |

### Production

- **Container Registry**: GHCR (CI) + Amazon ECR (deploy)
- **Orchestration**: AWS ECS with per-service task definitions
- **Database**: Neon serverless PostgreSQL (auto-scaling, connection pooling)
- **Cache**: Redis cluster
- **Storage**: AWS S3 + CloudFront CDN
- **Sandboxes**: E2B cloud infrastructure (Firecracker)
- **LLM Proxy**: Must be publicly reachable from E2B sandboxes
- **Monitoring**: Sentry + OpenTelemetry + BetterStack
- **Network**: `jeriko-network` Docker bridge

---

## Load Testing

k6 (Grafana) load test scripts in `k6/` and `load-tests/`.

| Test | Scenario | Threshold |
|---|---|---|
| `gateway-ws.js` | 500 concurrent WebSocket connections | p95 < 500ms |
| `chat-api.js` | 100 concurrent SSE chat sessions | p95 < 5s |
| `trpc-sessions.js` | 200 concurrent tRPC reads | p95 < 500ms |
| `service-device.js` | 100 concurrent device heartbeats | Error rate < 1% |

---

## Skills System

27 LLM-facing skill definitions in `skills/` that enhance agent capabilities:

**Architecture:** CSS Architecture, Tailwind CSS Patterns, Tailwind Animations, UnoCSS

**Testing:** E2E Testing Patterns, JavaScript Testing Patterns, Python Testing Patterns, TDD, Playwright, Vitest, QA Test Planner, Temporal Python Testing

**Backend:** Better-Auth Best Practices, Database Schema Designer, PostgreSQL, Docker Expert

**Frontend:** Next.js, React Best Practices, Vercel Composition Patterns, Redux Toolkit

**DevOps:** CI/CD Expert, GitHub Actions, GitHub Workflow Automation

**Infrastructure:** AWS S3 Management, Typesense, Monorepo Management

---

## Environment Variables

### Required — Core

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon) |
| `REDIS_URL` | Redis connection string |
| `BETTER_AUTH_SECRET` | Auth encryption key |
| `BETTER_AUTH_URL` | Auth callback URL |

### Required — AI

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API access |
| `OPENAI_API_KEY` | GPT-4o API access (optional fallback) |
| `E2B_API_KEY` | E2B sandbox provisioning |
| `LLM_PROXY_URL` | **Must be publicly reachable** — sandboxes call this |

### Required — Storage

| Variable | Purpose |
|---|---|
| `AWS_ACCESS_KEY_ID` | S3 access |
| `AWS_SECRET_ACCESS_KEY` | S3 secret |
| `AWS_REGION` | S3 region (default: us-east-1) |
| `S3_BUCKET` | S3 bucket name |

### Required — Payments

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature |

### Required — WebRTC

| Variable | Purpose |
|---|---|
| `CLOUDFLARE_TURN_KEY_ID` | Cloudflare TURN credentials |
| `CLOUDFLARE_TURN_TOKEN` | Cloudflare TURN token |

### Optional — Services

| Variable | Purpose |
|---|---|
| `KNOCK_API_KEY` | Notification delivery |
| `RESEND_API_KEY` | Transactional email |
| `COMPOSIO_API_KEY` | Connector integrations |
| `SVIX_API_KEY` | Webhook management |
| `TYPESENSE_HOST` / `TYPESENSE_API_KEY` | Full-text search |
| `SERPER_API_KEY` / `TAVILY_API_KEY` | Web search |
| `TIDB_PUBLIC_KEY` / `TIDB_PRIVATE_KEY` | TiDB for webdev projects |
| `VERCEL_TOKEN` | Vercel deployment |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Task orchestration |

### Optional — Monitoring

| Variable | Purpose |
|---|---|
| `SENTRY_DSN` | Error tracking |
| `POSTHOG_API_KEY` | Product analytics |
| `BETTERSTACK_API_KEY` | Log aggregation |
| `ARCJET_KEY` | WAF & security |

### Service URLs (Docker Compose)

| Variable | Default |
|---|---|
| `ORCHESTRATOR_SERVICE_URL` | `http://orchestrator:4014` |
| `SANDBOX_SERVICE_URL` | `http://sandbox:4012` |
| `CONNECTOR_SERVICE_URL` | `http://connector:4009` |
| `TASK_SERVICE_URL` | `http://task:3002` |
| `FILE_SERVICE_URL` | `http://file:3003` |
| `DEVICE_SERVICE_URL` | `http://device:4001` |
| `WEBRTC_MEDIA_SERVICE_URL` | `http://webrtc-media:4016` |

---

## Getting Started

### Prerequisites

- **Node.js** 22+ (specified in CI, minimum 20.9.0)
- **pnpm** 10.19.0 (`corepack enable && corepack prepare pnpm@10.19.0`)
- **Docker** & Docker Compose (for PostgreSQL, Redis, and services)
- **E2B API Key** (for sandbox provisioning)
- **Anthropic API Key** (for Claude LLM)
- **Stripe CLI** (for local webhook testing)

### Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd Jeriko

# 2. Install dependencies
pnpm install

# 3. Approve build scripts (Prisma, SWC, esbuild, etc.)
pnpm approve-builds

# 4. Set up environment variables
# Copy .env.example files in services/ and apps/app/
# Fill in required API keys (see Environment Variables section)

# 5. Start infrastructure (PostgreSQL + Redis)
pnpm services:up

# 6. Push database schema
pnpm migrate

# 7. Start the Next.js app
pnpm dev --filter app

# 8. (Optional) Start all microservices
pnpm dev:services
```

The app will be available at `http://localhost:3000`.

### LLM Proxy for Development

If using E2B sandboxes locally, the `LLM_PROXY_URL` must be publicly reachable (sandboxes run on remote infrastructure). Use a tunnel:

```bash
ngrok http 4014
# Update LLM_PROXY_URL in your .env with the ngrok URL
```

---

## Development Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start all apps via Turbo |
| `pnpm dev --filter app` | Start only the Next.js app |
| `pnpm dev:services` | Start all 15 microservices (concurrency 15) |
| `pnpm services:up` | Start PostgreSQL + Redis (Docker) |
| `pnpm services:down` | Stop PostgreSQL + Redis |
| `pnpm services:logs` | Tail service logs |
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Run unit/integration tests (Vitest) |
| `pnpm test:integration` | Run integration tests |
| `pnpm test:security` | Run security tests |
| `pnpm test:agent` | Run Python agent tests (pytest) |
| `pnpm test:all` | Run all tests including agent |
| `pnpm test:a11y` | Run accessibility tests |
| `pnpm test:visual` | Run visual regression tests |
| `pnpm test:smoke` | Run smoke tests |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm check` | Lint all code (Ultracite) |
| `pnpm fix` | Auto-fix lint issues |
| `pnpm migrate` | Push DB schema (Drizzle) |
| `pnpm analyze` | Bundle size analysis |
| `pnpm boundaries` | Turbo dependency boundary check |
| `pnpm boundaries:cruise` | Dependency-cruiser validation |
| `pnpm lhci` | Lighthouse CI audit |
| `pnpm bump-deps` | Update all dependencies |
| `pnpm bump-ui` | Update shadcn/ui components |
| `pnpm changeset` | Create a changeset for versioning |
| `pnpm clean` | Clean all node_modules |

---

## Network Architecture

### Port Map

| Port | Service | Protocol |
|---|---|---|
| 3000 | Next.js App | HTTP |
| 3001 | Gateway / Marketing Site | HTTP + WS |
| 3002 | Task Service | HTTP |
| 3003 | File Service | HTTP |
| 3004 | Website Service | HTTP |
| 3005 | Billing Service | HTTP |
| 3006 | Notification Service | HTTP |
| 3007 | Webhook Service | HTTP |
| 3008 | Connector Service | HTTP |
| 3009 | Search Service | HTTP |
| 3010 | Project Service | HTTP |
| 4001 | Device Service | HTTP + WS |
| 4014 | Orchestrator | HTTP + SSE |
| 4016 | WebRTC Media | HTTP + WS |
| 5432 | PostgreSQL | TCP |
| 6379 | Redis | TCP |
| 8001 | Knowledge Service (Python) | HTTP |
| 8080 | Neko (in sandbox) | WebRTC |
| 8081 | Sandbox Manager | HTTP |
| 8288 | Inngest | HTTP |
| 8329 | Code Server (in sandbox) | HTTP |
| 8330 | Sandbox Runtime API (in sandbox) | HTTP |
| 8350 | MCP CLI (in sandbox) | HTTP |
| 9222 | Chromium CDP (in sandbox) | WebSocket |

---

## Security

### Application Security

- **Arcjet WAF** — Bot detection, rate limiting, DDoS protection
- **Nosecone** — Secure HTTP headers (CSP, HSTS, X-Frame-Options)
- **Helmet** — CORS with `crossOriginResourcePolicy: cross-origin`
- **Rate Limiting** — Per-user and per-IP at gateway and API levels
- **Trivy** — Vulnerability scanning in CI (CRITICAL + HIGH severity)

### Authentication Security

- Cookie-based sessions (httpOnly, secure, sameSite)
- Password requirements: min 12 chars, letter, special character
- Email verification flow with 60s resend cooldown
- OAuth token management

### Data Security

- Per-user data isolation across all services
- Path traversal prevention in sandbox
- Command allowlists for sandbox execution
- S3 presigned URLs with expiration
- User secrets encrypted in database

### Reporting Vulnerabilities

Email: `security@jeriko.dev` (see `.github/SECURITY.md` for full policy)

---

## Known Gotchas

1. **`proxy.ts` not `middleware.ts`** — Next.js 16 renamed the request interceptor. Auth checking happens in proxy.ts.
2. **`LLM_PROXY_URL` must be publicly reachable** — E2B sandboxes run on remote infrastructure and call back to the LLM proxy.
3. **Neon HTTP driver has no transaction support** — The serverless PostgreSQL driver doesn't support transactions; services use workarounds.
4. **E2B `envs` parameter not available to `start_command.sh`** — Use file write post-sandbox-creation instead.
5. **Cookie auth in iframes** — Third-party cookies are blocked in modern browsers; Neko uses token-based auth.
6. **RTK Query is the ONLY async Redux slice** — All other 43+ slices are synchronous.
7. **Zod v4 `z.record()`** — Must use `z.record(z.string(), z.unknown())` (not shorthand).
8. **ESM + dynamic imports** — Services use `(mod as any).default ?? mod` pattern for `@repo/database` imports.
9. **React 19 Strict Mode** — Double-invoke guard needed in `useChatSession` to prevent duplicate stream starts.
10. **Turbopack cache** — After file renames, you may need to delete `.next/` and restart the dev server.

---

## Documentation

Comprehensive architecture documentation in `docs/manus-architecture-docs/`:

| Document | Topic |
|---|---|
| `01-INFRASTRUCTURE-AND-E2B-SANDBOX.md` | Firecracker VM details, sandbox architecture |
| `02-ORCHESTRATION-AND-SESSION-MANAGEMENT.md` | Session lifecycle, orchestrator flow |
| `03-TOOL-EXECUTION-ENGINE.md` | All 34 tools breakdown, execution mechanics |
| `04-FRONTEND-AND-REDUX-STATE.md` | Redux architecture, 44+ slices |
| `05-CONNECTORS-AND-INTEGRATIONS.md` | MCP, OAuth, 36+ connector details |
| `06-API-REFERENCE-AND-NETWORK-FLOWS.md` | Complete API reference |
| `07-SUPPLEMENT-A-ENVIRONMENT-VARIABLES.md` | Every env var explained |
| `08-SUPPLEMENT-B-E2B-BOOTSTRAP-SEQUENCE.md` | Sandbox boot process |
| `09-SUPPLEMENT-C-TOOL-EXECUTION-MECHANICS.md` | Tool tracing and debugging |
| `10-SUPPLEMENT-D-ORCHESTRATOR-AND-LLM-LOOP.md` | Agent loop in detail |
| `11-SUPPLEMENT-E-STATE-CHANGE-FLOWS.md` | Redux + WebSocket flow diagrams |
| `12-SUPPLEMENT-F-FILE-STORAGE-S3-CDN-FLOWS.md` | File upload/download lifecycle |
| `13-SUPPLEMENT-G-TIMELINE-DATABASE-PERSISTENCE.md` | Database schema details |
| `14-SUPPLEMENT-H-VOICE-SKILLS-KNOWLEDGE-FILES-FORGE.md` | Voice, skills, knowledge, Forge API |

Additional docs in `docs/`:
- `PRODUCTION_DEPLOYMENT.md` — Production deployment guide
- `IMPLEMENTATION_ROADMAP.md` — Feature implementation roadmap
- `refactor-2026/` — Refactoring notes and architecture alignment

---

## What's Built vs. What's Missing

### Built and Functional

- Full chat interface with SSE streaming and resumable streams
- AI agent loop with 34 tools (browser, terminal, files, search, etc.)
- E2B sandbox with desktop streaming (Neko WebRTC)
- Better-Auth authentication (email, OAuth)
- Redux state management (44+ slices)
- 22 tRPC routers with full CRUD
- 15+ microservices architecture
- S3 file management with versioning
- Stripe billing with credit system
- Typesense search with DB fallback
- Composio connectors (36+ services)
- Playwright E2E tests
- CI/CD pipeline with Docker builds
- Comprehensive architecture documentation

### In Progress / Planned

- Website builder AI generation (stub exists)
- Full knowledge base vector search (pipeline built, UI integration ongoing)
- Voice input/output (hooks exist, Whisper integration)
- Slide editor (Redux slice exists, editor UI in progress)
- Map-reduce jobs (slice exists, orchestration planned)
- Full i18n translation coverage
- Production Kubernetes manifests (currently ECS-based)
- Visual regression testing (Playwright project configured)
- Full connector tool discovery and execution

---

## License

Proprietary. All rights reserved by Etheon.
