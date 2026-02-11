# Part 1: Architecture Blueprint, Technology Selection, and Project Structure

> **What you are building:** A Manus-class autonomous AI agent platform — an orchestrator that accepts user messages, plans tasks, spins up isolated sandboxes, executes tools (shell, file, browser, search, code), streams results in real-time via WebSocket, and presents everything in a polished React UI with full state management.

---

## 1. The Architecture (Exactly How Manus Works)

Manus is **three layers** talking to each other over well-defined protocols. You must replicate all three.

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: FRONTEND                                              │
│  React 19 + Redux Toolkit (41 slices) + Tailwind + shadcn/ui   │
│  WebSocket client (wss://) for real-time event streaming        │
│  Wouter for routing, Monaco for code viewing                    │
│                                                                 │
│  Communicates via:                                              │
│    HTTP REST  → session CRUD, file upload, auth                 │
│    WebSocket  → real-time events (tool calls, messages, plans)  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    HTTP + WebSocket
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  LAYER 2: ORCHESTRATOR (the brain)                              │
│  Node.js + Express + tRPC                                       │
│  AI SDK (streamText / generateText) with tool definitions       │
│  Agent loop: Plan → Act → Observe → Repeat                     │
│  Session manager, context builder, credit tracker               │
│                                                                 │
│  Communicates via:                                              │
│    HTTPS      → LLM API (Claude / GPT)                         │
│    E2B SDK    → Sandbox lifecycle (create, execute, destroy)    │
│    WebSocket  → Push events to frontend                        │
│    S3 SDK     → File storage                                   │
│    Database   → Persist sessions, messages, tool calls          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                      E2B SDK (gRPC)
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  LAYER 3: SANDBOX (isolated execution environment)              │
│  E2B Firecracker microVM — Ubuntu 22.04                         │
│  Shell execution, file I/O, browser automation (Playwright)     │
│  Each sandbox: 2-6 vCPUs, 512MB-4GB RAM, ext4 filesystem       │
│  Processes: Chromium, Xvfb, optional Neko (WebRTC streaming)    │
│                                                                 │
│  Communicates via:                                              │
│    E2B SDK    → Commands from orchestrator                      │
│    HTTP proxy → Expose sandbox ports to internet                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Selection

This is not a suggestion list. This is what you use, mapped directly from what Manus uses, with open-source equivalents where Manus uses proprietary components.

### 2.1 Orchestrator Stack

| Component | Manus Uses | You Use | Why |
|-----------|-----------|---------|-----|
| **Runtime** | Node.js | **Node.js 22+** | Same runtime, native fetch, ESM |
| **Framework** | Express + custom | **Next.js 15 App Router** or **Hono** | API routes + SSR + WebSocket |
| **LLM SDK** | Direct Anthropic API | **Vercel AI SDK (`ai` package)** | `streamText()`, `generateText()`, built-in tool calling, multi-provider |
| **Primary LLM** | Claude Sonnet 4 | **Claude Sonnet 4** via `@ai-sdk/anthropic` | Best tool calling, longest context |
| **Secondary LLM** | GPT-4.1-mini | **GPT-4.1-mini** via `@ai-sdk/openai` | Cheaper for subtasks |
| **Sandbox** | E2B (proprietary fork) | **E2B SDK** (`e2b`, `@e2b/code-interpreter`) | Same technology, public API |
| **Database** | PostgreSQL/MySQL | **PostgreSQL** + **Drizzle ORM** | Same pattern as Manus webdev |
| **Cache** | Redis | **Redis** (Upstash for serverless) | Session state, rate limiting |
| **File Storage** | AWS S3 + CloudFront | **AWS S3** + **CloudFront** (or R2 + Cloudflare) | Same CDN pattern |
| **WebSocket** | Custom WS server | **Socket.IO** or **ws** library | Real-time event streaming |
| **Auth** | JWT + OAuth | **NextAuth.js v5** or **Lucia Auth** | JWT sessions, OAuth providers |
| **Queue** | Internal | **BullMQ** (Redis-backed) | Agent job queue for concurrent sessions |

### 2.2 Frontend Stack

| Component | Manus Uses | You Use | Why |
|-----------|-----------|---------|-----|
| **Framework** | React 19 | **React 19** | Same |
| **State** | Redux Toolkit (41 slices) | **Zustand** (simpler) or **Redux Toolkit** (exact match) | Zustand for sanity, Redux for feature parity |
| **Styling** | Tailwind CSS 4 | **Tailwind CSS 4** | Same |
| **Components** | shadcn/ui | **shadcn/ui** | Same |
| **Routing** | Wouter | **Wouter** or **Next.js App Router** | Same |
| **Code Viewer** | Monaco Editor | **Monaco Editor** (`@monaco-editor/react`) | Same |
| **Markdown** | Custom renderer | **react-markdown** + **rehype-highlight** | Message rendering |
| **Real-time** | WebSocket (native) | **Socket.IO client** | Event streaming |

### 2.3 Sandbox Stack

| Component | Manus Uses | You Use | Why |
|-----------|-----------|---------|-----|
| **VM** | E2B Firecracker | **E2B Sandbox** | Same technology |
| **Browser** | Chromium + Playwright | **Playwright** (pre-installed in E2B) | Same |
| **Display** | Neko (WebRTC) | **noVNC** or **Neko** | Browser streaming to user |
| **File sync** | Custom statesync | **E2B filesystem API** | Read/write files |

---

## 3. Project Structure

```
your-agent-platform/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── .env.local
│
├── src/
│   ├── server/                          # LAYER 2: ORCHESTRATOR
│   │   ├── index.ts                     # Express/Hono server entry
│   │   ├── websocket.ts                 # WebSocket server + event broadcasting
│   │   ├── orchestrator/
│   │   │   ├── agent-loop.ts            # THE CORE: Plan → Act → Observe → Repeat
│   │   │   ├── context-builder.ts       # System prompt + conversation history assembly
│   │   │   ├── tool-router.ts           # Routes tool calls to sandbox vs. local
│   │   │   ├── session-manager.ts       # Session lifecycle (create, resume, destroy)
│   │   │   └── credit-tracker.ts        # Token counting + billing
│   │   ├── tools/
│   │   │   ├── definitions.ts           # All tool schemas (Zod) for AI SDK
│   │   │   ├── shell.ts                 # Shell execution via E2B
│   │   │   ├── file.ts                  # File read/write/edit via E2B
│   │   │   ├── browser.ts              # Browser automation via E2B + Playwright
│   │   │   ├── search.ts               # Web search (Tavily/Serper/Brave)
│   │   │   ├── message.ts              # Send messages back to user
│   │   │   ├── plan.ts                 # Task planning tool
│   │   │   ├── generate.ts             # Image generation (DALL-E/Flux)
│   │   │   ├── match.ts                # File search (glob/grep) via E2B
│   │   │   └── map.ts                  # Parallel subtask spawning
│   │   ├── sandbox/
│   │   │   ├── manager.ts              # E2B sandbox lifecycle
│   │   │   ├── pool.ts                 # Sandbox pooling (warm starts)
│   │   │   └── file-sync.ts            # S3 upload/download for sandbox files
│   │   ├── db/
│   │   │   ├── schema.ts               # Drizzle schema (sessions, messages, tool_calls, etc.)
│   │   │   ├── queries.ts              # Database query functions
│   │   │   └── migrate.ts              # Migration runner
│   │   ├── auth/
│   │   │   ├── jwt.ts                  # JWT creation/verification
│   │   │   └── oauth.ts                # OAuth flow handlers
│   │   └── routes/
│   │       ├── sessions.ts             # REST: session CRUD
│   │       ├── messages.ts             # REST: send message, get history
│   │       ├── files.ts                # REST: file upload/download
│   │       └── auth.ts                 # REST: login, logout, me
│   │
│   ├── client/                          # LAYER 1: FRONTEND
│   │   ├── App.tsx                      # Root component + routing
│   │   ├── main.tsx                     # React entry point
│   │   ├── index.css                    # Tailwind + design tokens
│   │   ├── store/
│   │   │   ├── index.ts                # Redux/Zustand store setup
│   │   │   ├── slices/
│   │   │   │   ├── auth.ts             # User auth state
│   │   │   │   ├── sessions.ts         # Session list + current session
│   │   │   │   ├── timeline.ts         # THE CORE: segmentEventsMap
│   │   │   │   ├── chat.ts             # Input state, files, model selection
│   │   │   │   ├── ui.ts               # Theme, sidebar, window state
│   │   │   │   ├── websocket.ts        # Connection state
│   │   │   │   ├── agent-workspace.ts  # Plan display
│   │   │   │   ├── browser-view.ts     # Remote browser state
│   │   │   │   ├── file-management.ts  # File uploads/downloads
│   │   │   │   └── code-viewer.ts      # Code editor state
│   │   │   └── middleware/
│   │   │       └── websocket.ts        # WebSocket middleware for Redux
│   │   ├── pages/
│   │   │   ├── Chat.tsx                # Main chat interface
│   │   │   ├── Login.tsx               # Auth page
│   │   │   └── Settings.tsx            # User settings
│   │   ├── components/
│   │   │   ├── Timeline.tsx            # Message + tool call renderer
│   │   │   ├── ToolCallCard.tsx        # Collapsible tool execution display
│   │   │   ├── PlanSidebar.tsx         # Task plan with phases
│   │   │   ├── ChatInput.tsx           # Message input with file upload
│   │   │   ├── SessionList.tsx         # Sidebar session list
│   │   │   ├── BrowserView.tsx         # Remote browser iframe/WebRTC
│   │   │   ├── CodeViewer.tsx          # Monaco-based code viewer
│   │   │   ├── FilePreview.tsx         # File attachment preview
│   │   │   └── MapReduceProgress.tsx   # Parallel task progress
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts         # WebSocket connection + event handling
│   │   │   ├── useAuth.ts              # Auth state + redirect
│   │   │   └── useTimeline.ts          # Timeline event subscription
│   │   └── lib/
│   │       ├── api.ts                  # HTTP client (fetch wrapper)
│   │       └── utils.ts                # Shared utilities
│   │
│   └── shared/                          # SHARED TYPES
│       ├── types.ts                     # Session, Message, ToolCall, Plan types
│       ├── events.ts                    # WebSocket event type definitions
│       └── constants.ts                 # Shared constants
│
├── sandbox/                             # LAYER 3: SANDBOX TEMPLATES
│   ├── Dockerfile                       # Custom E2B sandbox template
│   └── setup.sh                         # Pre-install: Python, Node, Playwright, etc.
│
└── scripts/
    ├── migrate.ts                       # Run database migrations
    └── seed.ts                          # Seed test data
```

---

## 4. Environment Variables

Based on exactly what Manus injects, here is what your `.env.local` needs:

```bash
# ===== LLM PROVIDERS =====
ANTHROPIC_API_KEY=sk-ant-...              # Claude API key
OPENAI_API_KEY=sk-...                      # OpenAI API key (for GPT-4.1-mini subtasks)

# ===== E2B SANDBOX =====
E2B_API_KEY=e2b_...                        # E2B API key
E2B_TEMPLATE_ID=your-custom-template       # Custom sandbox template (optional)
E2B_SANDBOX_TIMEOUT=3600                   # Sandbox timeout in seconds (default 1 hour)

# ===== DATABASE =====
DATABASE_URL=postgresql://user:pass@host:5432/agentdb
REDIS_URL=redis://localhost:6379

# ===== FILE STORAGE =====
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=your-agent-files
AWS_REGION=us-east-1
CDN_BASE_URL=https://files.yourdomain.com

# ===== AUTH =====
JWT_SECRET=your-256-bit-secret
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# ===== SEARCH =====
TAVILY_API_KEY=tvly-...                    # Or SERPER_API_KEY, BRAVE_API_KEY

# ===== IMAGE GENERATION =====
# Uses OPENAI_API_KEY for DALL-E, or:
REPLICATE_API_TOKEN=r8_...                 # For Flux/Stable Diffusion

# ===== WEBSOCKET =====
WS_PORT=3001                               # WebSocket server port

# ===== OBSERVABILITY (optional) =====
SENTRY_DSN=https://...@sentry.io/...
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-otel-collector
```

---

## 5. Package Dependencies

```json
{
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "e2b": "^1.0.0",
    "@e2b/code-interpreter": "^1.0.0",
    "express": "^4.21.0",
    "ws": "^8.18.0",
    "drizzle-orm": "^0.35.0",
    "postgres": "^3.4.0",
    "ioredis": "^5.4.0",
    "@aws-sdk/client-s3": "^3.600.0",
    "@aws-sdk/lib-storage": "^3.600.0",
    "jose": "^5.9.0",
    "zod": "^3.23.0",
    "bullmq": "^5.0.0",
    "nanoid": "^5.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@reduxjs/toolkit": "^2.5.0",
    "react-redux": "^9.2.0",
    "socket.io": "^4.8.0",
    "socket.io-client": "^4.8.0",
    "wouter": "^3.5.0",
    "@monaco-editor/react": "^4.6.0",
    "react-markdown": "^9.0.0",
    "rehype-highlight": "^7.0.0",
    "tailwindcss": "^4.0.0",
    "lucide-react": "^0.460.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.28.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0"
  }
}
```

---

## 6. The Critical Insight: Why AI SDK Is the Right Choice

Manus calls the Anthropic API directly with raw HTTP. You should not do this. The Vercel AI SDK abstracts the agent loop pattern that Manus implements manually:

**What Manus does manually (and you get for free with AI SDK):**

| Manus Manual Implementation | AI SDK Equivalent |
|----------------------------|-------------------|
| Build messages array with system prompt | `system` parameter in `streamText()` |
| Parse tool_use blocks from Claude response | `tools` parameter with Zod schemas |
| Route tool calls to execution layer | `execute` function in each tool definition |
| Add tool results back to context | Automatic with `maxSteps` |
| Loop until no more tool calls | `maxSteps: 25` (automatic multi-step) |
| Stream partial text to frontend | `streamText()` returns `textStream` |
| Handle errors and retries | Built-in error handling |
| Switch between Claude and GPT | `provider` parameter swap |

The AI SDK's `streamText()` with `maxSteps` **IS** the agent loop. One function call replaces Manus's entire orchestrator loop.

```typescript
// THIS is the entire agent loop in AI SDK
const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  system: buildSystemPrompt(session, user),
  messages: conversationHistory,
  tools: allToolDefinitions,
  maxSteps: 25,  // Max tool call rounds before stopping
  onStepFinish: async (step) => {
    // Persist each step to database
    // Broadcast via WebSocket to frontend
    // Track credits
  }
});
```

This is the foundation. The rest of this guide builds on top of it.
