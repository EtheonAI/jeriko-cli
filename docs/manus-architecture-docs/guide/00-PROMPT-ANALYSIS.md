# Critical Analysis of Your Prompt

> **Verdict:** Your prompt is 70% good — the intent and structure are right, but there are several factual errors about how Manus actually works that will lead an AI agent (Claude Code or Codex) down the wrong path. I'll go point by point.

---

## Point-by-Point Analysis

### Point 1: "Analyze the whole document set" — GOOD

> *"Analyze the whole document set that manus has, the API endpoints, business logic and flow, state flow, what we have and whats missing."*

**Verdict: Correct approach.** You're telling the agent to read all 14 documents first before doing anything. This is essential. The documents contain the ground truth.

**What's missing from this point:** You should explicitly tell the agent which documents to read in which order. The recommended reading order from our index is: 01 → 08 → 07 → 02 → 10 → 03 → 09 → 12 → 13 → 04 → 14 → 11 → 05 → 06. Without this, the agent will read them in numeric order and miss the logical dependency chain.

---

### Point 3: "Manus uses Claude as the planner then makes 2-3 sessions of E2B" — PARTIALLY WRONG

> *"Manus uses claude as the planner then it makes lets say 2-3 sessions of E2B depending on task with each having its own template used"*

**This is incorrect based on our investigation. Here is what actually happens:**

1. **Manus uses ONE sandbox per user, shared across ALL sessions.** It does NOT spin up 2-3 sandboxes per task. We confirmed this — one Firecracker VM (PID 1, init process), one `start_server` (PID 794), one Chromium (PID 901). All conversations from the same user share this single sandbox.

2. **The ONLY exception is the `map` tool (parallel processing).** When the agent calls the `map` tool, THEN the orchestrator spins up N separate sandboxes (one per subtask). But for normal tasks — one sandbox.

3. **Claude is BOTH the planner AND the executor.** There is no separate "planner" and "executor" model. Claude Sonnet 4 runs the entire agent loop: it plans (via the `plan` tool), it decides which tools to call, it processes results, and it generates the final response. It is one continuous LLM conversation with tool calling.

4. **There is NO "OpenAI loaded in E2B finishing the task."** This is the biggest misconception. OpenAI (GPT-4.1-mini) is available inside the sandbox ONLY for **user-built webdev applications** that call the LLM proxy. The agent itself — the one doing the work — is always Claude. The `OPENAI_API_KEY` in the sandbox is a multi-purpose token that routes through `api.manus.im/api/llm-proxy/v1`, and it's there for webdev apps, NOT for the agent's own reasoning.

**The correct flow:**
```
User sends message
  → Orchestrator (backend server)
  → Builds system prompt + tool definitions
  → Calls Claude Sonnet 4 API with streamText
  → Claude returns tool calls (shell, file, browser, etc.)
  → Orchestrator routes tool calls TO the sandbox via E2B SDK (gRPC)
  → Sandbox executes (start_server binary handles it)
  → Results return to orchestrator
  → Orchestrator feeds results back to Claude
  → Claude decides next action or responds
  → Loop continues until Claude calls message tool with type "result"
```

**If you feed your wrong understanding to Claude Code or Codex, they will build a multi-sandbox multi-model system that is unnecessarily complex and doesn't match how Manus works.**

---

### Point 4: "Read how S3, files are read, write" — GOOD

**Verdict: Correct.** Document 12 (Supplement F) covers this completely. The key facts:
- Files live in sandbox filesystem (`/home/ubuntu/`)
- `manus-upload-file` binary uploads to S3 → returns CDN URL (`files.manuscdn.com`)
- CDN URL pattern: `/user_upload_by_module/session_file/{userId}/{randomId}.{ext}`
- Message attachments trigger automatic upload before sending to frontend

---

### Point 5: "each tool call and its action" — GOOD BUT INCOMPLETE INSTRUCTION

> *"manus has Claude, Claude plans and orchestrate then it gives openai loaded in E2B with the task through the tool and openai inside E2B finishes and comes back with the task"*

**This is wrong again.** Same error as Point 3. Let me state it clearly:

**Claude does NOT "give OpenAI the task."** Claude IS the agent. Claude calls tools. Tools execute in the sandbox. Results come back to Claude. There is no OpenAI agent inside E2B doing independent work.

The tools execute as **dumb functions** — they don't have their own LLM. When Claude calls `shell.exec("ls -la")`, the sandbox literally runs `ls -la` and returns the output. No AI involved in tool execution. Claude then reads the output and decides what to do next.

---

### Point 8: "Manus uses Go for WebRTC Neko" — CORRECT

**Verdict: Accurate.** Neko is indeed a Go binary (`/opt/.manus/neko-server/neko`), and it handles WebRTC streaming of the X11 display (Xvfb at 1280x1029). It uses Cloudflare TURN servers for NAT traversal. This is one of the few points where your understanding is exactly right.

---

### Point 9: "Our app is bloated" — CORRECT INSTINCT

If you've been building with multiple microservices, separate planner/executor models, and multiple E2B sessions per task, then yes — Manus proves that a simpler architecture works:
- One orchestrator process
- One LLM (Claude) doing everything
- One sandbox per user
- One WebSocket connection for all real-time events
- Tools are just functions, not services

---

### Point 10: "Composio as connector provider" — GOOD DECISION

Manus uses its own proprietary connector system (190+ connectors via MCP). Composio is a solid open-source alternative that provides the same thing — pre-built tool integrations for Gmail, Slack, GitHub, Google Drive, etc. This is a correct substitution.

---

## What Your Prompt Is Missing Entirely

These are critical aspects of Manus that your prompt doesn't mention at all:

### Missing 1: The System Prompt Architecture

The system prompt is the most important piece. It's ~15,000 tokens of carefully structured XML that controls everything the agent does. Your prompt doesn't tell the AI to build this. Without it, your agent will be dumb.

Key sections that must be replicated:
- `<agent_loop>` — The plan/act/observe/repeat cycle
- `<tool_use>` — Rules for function calling
- `<sandbox>` — Environment description
- `<skills>` — Modular capability loading
- `<related_knowledge>` — Persistent facts
- `<format>` — Output formatting rules
- `<error_handling>` — Retry and fallback logic

### Missing 2: The `plan` Tool

Manus has a dedicated `plan` tool that creates structured task plans with phases. This is what makes it feel intelligent — it plans before acting. Your prompt doesn't mention building this.

### Missing 3: The `message` Tool

The agent doesn't just "respond." It calls a `message` tool with types: `info` (progress update), `ask` (needs user input), `result` (final delivery). This controls the conversation flow. Without it, your agent will dump everything at once.

### Missing 4: Context Window Management

Manus uses "context compaction" — when the conversation gets too long, it summarizes older messages to fit within Claude's context window. Your prompt doesn't address this, and without it, your agent will crash on long tasks.

### Missing 5: The WebSocket Event Protocol

Every tool call, every plan update, every message streams to the frontend via WebSocket events. There are 18+ event types. Your prompt doesn't specify this real-time protocol.

### Missing 6: The Timeline/Segment Architecture

The conversation isn't just a flat list of messages. It's organized into segments for pagination. Each segment contains events (messages, tool calls, tool results, plan updates). Without this, your UI won't scale.

### Missing 7: Credit/Token Tracking

Manus tracks credits per session. Every LLM call and tool execution has a cost. Your prompt doesn't mention billing/usage tracking.

### Missing 8: Sandbox Warm Pooling

E2B sandboxes take 2-5 seconds to cold start. Manus keeps sandboxes warm and reuses them across sessions. Your prompt doesn't address this performance optimization.

---

## The Corrected Prompt

Here is what your prompt SHOULD say. I've rewritten it to be factually accurate based on our investigation:

```
You are building a Manus-class autonomous AI agent platform. Read all 14 architecture 
documents in /docs/ before doing anything else. Read them in this order:
01 → 08 → 07 → 02 → 10 → 03 → 09 → 12 → 13 → 04 → 14 → 11 → 05 → 06

CRITICAL ARCHITECTURE FACTS (do not deviate from these):

1. ONE LLM does everything. Claude Sonnet 4 is the planner, executor, and responder.
   There is no separate "planner model" and "executor model." The agent loop is:
   Plan → Act (tool call) → Observe (tool result) → Repeat → Respond.

2. ONE sandbox per user, shared across all sessions. Do NOT create multiple sandboxes
   per task. The only exception is the `map` tool for parallel processing, which spawns
   N sandboxes for N subtasks.

3. Tools are DUMB FUNCTIONS. They execute in the sandbox (shell, file, browser, match)
   or in the orchestrator (search, message, plan, schedule, generate, map). No tool has
   its own LLM. Claude decides what to call, the tool executes, the result returns to Claude.

4. The orchestrator is a single Node.js process that:
   - Receives user messages via HTTP
   - Builds the system prompt (~15K tokens of structured XML)
   - Calls Claude API with tool definitions via AI SDK streamText()
   - Routes tool calls to E2B sandbox (via SDK) or executes locally
   - Streams events to frontend via WebSocket
   - Persists everything to database (sessions, messages, tool_calls, plans)

5. The system prompt has these sections: <agent_loop>, <tool_use>, <sandbox>,
   <skills>, <related_knowledge>, <format>, <error_handling>, <secrets>,
   <mcp_integration>. Each section controls agent behavior. Replicate all of them.

6. The frontend uses React 19 + Redux/Zustand with these core state slices:
   auth, sessions, timeline (segmentEventsMap), chat, ui, websocket, agentWorkspace,
   myBrowser, fileManagement, codeViewer, connectors, notification.

7. WebSocket events: message, tool_call, tool_result, plan_update, plan_advance,
   task_finished, map_progress, file_uploaded, browser_screenshot, error, pong.

8. Files: Live in sandbox → uploaded to S3 via utility → served via CDN.
   CDN pattern: https://files.yourdomain.com/{userId}/{randomId}.{ext}

9. Use Composio for connector integrations (replaces Manus's proprietary MCP connectors).

10. Use E2B SDK for sandbox management. Custom template with: Ubuntu 22.04, Python 3.11,
    Node.js 22, Playwright + Chromium, common CLI tools.

BUILD ORDER:
Phase 1: Database schema (sessions, messages, tool_calls, plans, files, users)
Phase 2: System prompt builder (all XML sections)
Phase 3: Tool definitions with Zod schemas for AI SDK
Phase 4: Agent loop using AI SDK streamText() with maxSteps
Phase 5: E2B sandbox manager (create, execute, pool, destroy)
Phase 6: Tool implementations (shell, file, browser, search, message, plan, etc.)
Phase 7: WebSocket server + event broadcasting
Phase 8: REST API routes (sessions, messages, files, auth)
Phase 9: Frontend store (Zustand/Redux slices)
Phase 10: Frontend components (Timeline, ChatInput, PlanSidebar, ToolCallCard, etc.)
Phase 11: Auth (JWT + OAuth)
Phase 12: File storage (S3 upload/download, CDN URLs)
Phase 13: Credit tracking and usage limits
Phase 14: Testing and deployment

Do NOT skip phases. Do NOT assume. Read the docs. Build exactly what they describe.
```

---

## Summary: What You Got Right vs. Wrong

| Aspect | Your Understanding | Reality | Impact |
|--------|-------------------|---------|--------|
| Multiple E2B sessions per task | 2-3 sandboxes per task | 1 sandbox per user, shared | Over-engineering, unnecessary cost |
| Claude plans, OpenAI executes | Two-model architecture | Claude does everything | Wrong architecture, wasted complexity |
| OpenAI loaded in E2B | GPT runs inside sandbox | GPT available only for user webdev apps | Fundamental misunderstanding |
| Neko for WebRTC | Go-based WebRTC streaming | Correct | Good |
| Composio for connectors | Replace Manus MCP | Valid substitution | Good decision |
| App is bloated | Too many microservices | Manus is surprisingly simple | Correct instinct |
| Need full state management | All slices must work | 41 slices, but ~12 are critical | Correct, but prioritize |
| E2B templates | Custom templates per task | One template, configured at boot | Simpler than you think |

The two biggest errors — **"multiple sandboxes per task"** and **"OpenAI executes inside E2B"** — would lead to building the wrong thing entirely. Fix those in your prompt and you're on the right track.
