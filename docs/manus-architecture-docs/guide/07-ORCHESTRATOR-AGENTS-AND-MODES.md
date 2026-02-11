# Part 7: Orchestrator Agent Architecture — Who Works, What Controls What, and How Modes Switch

> **This is the answer to the question: "Which agents in the orchestrator work?"** The answer is not what most people assume. Manus does NOT use a multi-agent architecture with separate "browser agent", "terminal agent", "search agent". It uses a **single LLM agent** with **dynamic tool set switching** — what we call **mode-based tool expansion**. This document explains exactly how it works, with every detail.

---

## 1. The Core Truth: One Agent, Many Modes

Based on our complete investigation — process trees, network traces, WebSocket events, Redux state, system prompt analysis — here is the definitive architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION SERVER                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              SINGLE CLAUDE INSTANCE                        │  │
│  │                                                           │  │
│  │  System Prompt (massive XML document)                     │  │
│  │  + Conversation History                                   │  │
│  │  + Dynamic Tool Set (changes based on mode)               │  │
│  │                                                           │  │
│  │  The SAME Claude instance handles:                        │  │
│  │    ✓ Planning (plan tool)                                 │  │
│  │    ✓ Shell commands (shell tool)                          │  │
│  │    ✓ File operations (file tool)                          │  │
│  │    ✓ Browser automation (browser tools)                   │  │
│  │    ✓ Web search (search tool)                             │  │
│  │    ✓ Image generation (generate mode)                     │  │
│  │    ✓ Slide creation (slides mode)                         │  │
│  │    ✓ User communication (message tool)                    │  │
│  │    ✓ Parallel processing (map tool)                       │  │
│  │    ✓ MCP connectors (via shell → manus-mcp-cli)          │  │
│  │    ✓ Webdev project management (webdev tools)             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                    Tool Router                                   │
│                    ┌────┴────┐                                   │
│              ┌─────┤         ├─────┐                            │
│              ▼     ▼         ▼     ▼                            │
│         Sandbox  Local    External  Mode                        │
│         Tools    Tools    APIs      Switch                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**There is ONE agent. Not multiple.** Claude decides everything — what tool to call, when to switch modes, when to talk to the user, when to stop.

---

## 2. Why It's NOT Multi-Agent

Many people assume Manus uses separate agents like:
- "Browser Agent" that handles web browsing
- "Terminal Agent" that handles shell commands
- "Search Agent" that handles web search
- "Code Agent" that handles file operations

**This is wrong.** Here's the evidence:

| Evidence | What It Proves |
|----------|---------------|
| Single TCP connection from orchestration to sandbox | One controller, not multiple |
| All tool calls come from the same Claude conversation thread | Same context, same agent |
| Plan tool manages phases for the SAME agent | One planner, one executor |
| `maxSteps: 30` in a single `streamText()` call | One continuous loop |
| System prompt says "You are Manus" (singular) | One identity |
| All 29 tools sent in EVERY LLM API call | One agent sees all tools |
| Conversation history is continuous across tool types | No context handoff between agents |

The key insight: **Claude IS the agent.** The orchestrator is just the routing infrastructure. Claude decides to use `shell` one step, then `browser` the next step, then `file` the next — all within the same conversation.

---

## 3. The Mode System — Dynamic Tool Set Expansion

While there's one agent, the **available tool set changes dynamically**. This is the mode system:

### 3.1 Base Mode (Default)

When a session starts, Claude receives these **29 tools**:

```
BASE TOOL SET (always available):
├── plan                    (1 tool)
├── message                 (1 tool — but handles info/ask/result)
├── shell                   (1 tool — but handles exec/view/wait/send/kill)
├── file                    (1 tool — but handles read/write/edit/view/append)
├── match                   (1 tool — but handles glob/grep)
├── search                  (1 tool — but handles info/image/api/news/tool/data/research)
├── browser                 (1 tool — ENTRANCE ONLY, triggers browser mode)
├── generate                (1 tool — ENTRANCE ONLY, triggers generate mode)
├── slides                  (1 tool — ENTRANCE ONLY, triggers slides mode)
├── map                     (1 tool)
├── schedule                (1 tool)
├── expose                  (1 tool)
└── (webdev tools if project active)  (7 tools)
```

**Critical detail:** `browser`, `generate`, and `slides` are **entrance tools**. Their descriptions literally say:

> "Use this tool to start browser interactions and navigate to web pages. **After starting browser, you'll have access to more browser-related tools.**"

> "Use this tool to begin generation or editing operations. **After entering generate mode, you'll have access to specific AI-powered generation tools.**"

> "Use this tool to begin slides operations. **After entering slides mode, you'll have access to slide creation and presentation tools.**"

### 3.2 Browser Mode (After `browser` entrance tool is called)

When Claude calls the `browser` tool with a URL, the orchestrator:
1. Executes the navigation in the sandbox
2. **Replaces the tool set** for the next LLM call with browser-specific tools

```
BROWSER MODE TOOL SET:
├── browser_view            View current page state + screenshot
├── browser_navigate        Navigate to new URL
├── browser_click           Click element by index or coordinates
├── browser_input           Type text into field
├── browser_move_mouse      Move cursor
├── browser_press_key       Press keyboard key
├── browser_select_option   Select dropdown option
├── browser_scroll_up       Scroll up
├── browser_scroll_down     Scroll down
├── browser_console_exec    Execute JavaScript
├── browser_console_view    View console logs
├── browser_restart         Restart Chromium
├── browser_save_image      Save image from page
├── browser_upload_file     Upload file to form
└── (plus ALL base tools)   Still available
```

**How it works in the agent loop:**

```
Step N: Claude calls browser({ url: "https://example.com", intent: "informational" })
    ↓
Orchestrator:
    1. Routes to sandbox → Playwright navigates → returns page content + screenshot
    2. Sets internal flag: browserModeActive = true
    3. Next LLM call includes browser_* tools in the tool set
    ↓
Step N+1: Claude now sees browser_click, browser_input, etc.
    Claude calls browser_click({ index: 3 })
    ↓
Step N+2: Claude calls browser_input({ element_id: 5, text: "search query" })
    ↓
Step N+3: Claude calls file_write(...) ← base tool still available
    Orchestrator: browserModeActive stays true (doesn't auto-exit)
    ↓
Step N+4: Claude calls browser_navigate({ url: "..." }) ← still in browser mode
```

**Browser mode persists** until the agent naturally stops using browser tools. The base tools remain available alongside browser tools.

### 3.3 Generate Mode (After `generate` entrance tool is called)

When Claude calls the `generate` tool:

```
Step N: Claude calls generate({ brief: "Generate hero image for tech startup" })
    ↓
Orchestrator:
    1. Sets internal flag: generateModeActive = true
    2. Makes a SEPARATE LLM call with generate-specific tools:
       {
         "system": "You are now in generate mode. Use the image generation tools.",
         "tools": [
           { "name": "generate_image", ... },
           { "name": "generate_video", ... },
           { "name": "generate_audio", ... },
           { "name": "generate_speech", ... }
         ]
       }
    3. This is a SUB-CALL — a nested LLM invocation
    ↓
Sub-step: Claude (in generate context) calls generate_image({
    prompt: "Modern tech startup hero image, abstract geometric shapes...",
    size: "1024x1024"
})
    ↓
Orchestrator:
    1. Calls image generation API (Forge API → DALL-E/Stability AI)
    2. Receives image URL
    3. Returns URL to the generate sub-call
    ↓
Sub-step complete: Returns image URL to main agent loop
    ↓
Step N+1: Claude (back in main mode) uses the image URL in code
```

**Key difference from browser mode:** Generate mode uses a **nested LLM call** — a separate conversation context with different tools. Browser mode just expands the existing tool set.

### 3.4 Slides Mode (After `slides` entrance tool is called)

```
Step N: Claude calls slides({
    slide_content_file_path: "/home/ubuntu/project/content.md",
    slide_count: 10,
    generate_mode: "html"
})
    ↓
Orchestrator:
    1. Reads the content file from sandbox
    2. Makes a SEPARATE LLM call with slides-specific tools
    3. Generates slides (HTML or image-based)
    4. Returns slides URI: "manus-slides://{versionId}"
    ↓
Step N+1: Claude (back in main mode) delivers slides URI to user
```

### 3.5 Mode Summary Table

| Mode | Trigger | Tool Set Change | Execution Model | Returns To |
|------|---------|----------------|-----------------|------------|
| **Base** | Session start | 29 core tools | Main agent loop | — |
| **Browser** | `browser()` call | +12 browser tools added to base | Same conversation, expanded tools | Auto (when agent stops using browser) |
| **Generate** | `generate()` call | Separate call with generate tools | Nested LLM sub-call | Main loop after sub-call completes |
| **Slides** | `slides()` call | Separate call with slides tools | Nested LLM sub-call | Main loop after sub-call completes |
| **Webdev** | `webdev_init_project()` | +7 webdev tools added to base | Same conversation, expanded tools | Persists for session duration |

---

## 4. The Agent Loop in Detail — Step by Step

Here is EXACTLY what happens inside the orchestrator for every user message:

```typescript
// PSEUDOCODE — What the orchestrator actually does

async function runAgentLoop(sessionId: string, userMessage: string) {
  // ============================================================
  // PHASE 1: PREPARE CONTEXT
  // ============================================================
  const session = await db.getSession(sessionId);
  const sandbox = await sandboxManager.acquireForUser(session.userId);
  const history = await db.getConversationHistory(sessionId);
  const systemPrompt = buildSystemPrompt(session); // Massive XML document

  // ============================================================
  // PHASE 2: BUILD DYNAMIC TOOL SET
  // ============================================================
  let tools = buildBaseTools(sandbox); // 29 core tools

  // Add browser tools if browser mode is active
  if (session.browserModeActive) {
    tools = { ...tools, ...buildBrowserTools(sandbox) }; // +12 tools
  }

  // Add webdev tools if project is active
  if (session.webdevProject) {
    tools = { ...tools, ...buildWebdevTools(session.webdevProject) }; // +7 tools
  }

  // Add MCP tools if connectors are configured
  if (session.mcpConnectors.length > 0) {
    // MCP tools are accessed via shell → manus-mcp-cli, not as separate tools
    // But the system prompt includes instructions about available MCP servers
  }

  // ============================================================
  // PHASE 3: RUN THE AGENT LOOP (streamText with maxSteps)
  // ============================================================
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    messages: [...history, { role: 'user', content: userMessage }],
    tools: tools,
    maxSteps: 30,

    // ============================================================
    // PHASE 4: HANDLE EACH STEP
    // ============================================================
    onStepFinish: async ({ stepType, toolCalls, toolResults, usage }) => {
      for (const toolCall of toolCalls) {
        // Track in database
        await db.insertToolCall({
          sessionId,
          toolName: toolCall.toolName,
          args: toolCall.args,
          status: 'completed',
        });

        // Emit to frontend via WebSocket
        wsServer.emit(sessionId, {
          type: 'tool_call',
          toolName: toolCall.toolName,
          args: toolCall.args,
        });

        // ========================================================
        // MODE SWITCHING LOGIC
        // ========================================================

        // Browser entrance tool → activate browser mode
        if (toolCall.toolName === 'browser') {
          session.browserModeActive = true;
          // Next iteration will include browser_* tools
        }

        // Generate entrance tool → run nested sub-call
        if (toolCall.toolName === 'generate') {
          const generateResult = await runGenerateSubCall(
            toolCall.args.brief,
            sandbox
          );
          // Result injected back into main conversation
        }

        // Slides entrance tool → run nested sub-call
        if (toolCall.toolName === 'slides') {
          const slidesResult = await runSlidesSubCall(
            toolCall.args,
            sandbox
          );
          // Result injected back into main conversation
        }

        // Webdev init → activate webdev mode
        if (toolCall.toolName === 'webdev_init_project') {
          session.webdevProject = toolCall.result;
          // Next iteration will include webdev_* tools
        }

        // Message with type "result" → task is finishing
        if (toolCall.toolName === 'message' && toolCall.args.type === 'result') {
          // Upload any attachments to S3
          for (const attachment of toolCall.args.attachments || []) {
            const cdnUrl = await storage.uploadFromSandbox(sandbox, attachment, session.userId);
            // Replace local path with CDN URL
          }
        }

        // Plan tool → update plan state
        if (toolCall.toolName === 'plan') {
          await db.updatePlan(sessionId, toolCall.args);
          wsServer.emit(sessionId, {
            type: 'plan_update',
            plan: toolCall.args,
          });
        }
      }

      // Track token usage
      await db.updateSessionUsage(sessionId, usage);
    },
  });

  // ============================================================
  // PHASE 5: STREAM RESULTS TO FRONTEND
  // ============================================================
  for await (const chunk of result.textStream) {
    wsServer.emit(sessionId, {
      type: 'text_delta',
      content: chunk,
    });
  }

  // ============================================================
  // PHASE 6: CLEANUP
  // ============================================================
  wsServer.emit(sessionId, { type: 'task_finished', status: 'completed' });
}
```

---

## 5. The Nested Sub-Call Pattern (Generate & Slides)

This is the most important architectural pattern to understand. When Claude calls `generate` or `slides`, the orchestrator doesn't just execute a function — it makes a **separate LLM API call** with a different tool set.

### 5.1 Generate Sub-Call

```typescript
async function runGenerateSubCall(brief: string, sandbox: Sandbox): Promise<string> {
  // This is a SEPARATE Claude call with DIFFERENT tools
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `You are an image generation assistant. Generate images based on the user's request.
             Use the generate_image tool with a VERY detailed prompt.`,
    messages: [{ role: 'user', content: brief }],
    tools: {
      generate_image: tool({
        description: 'Generate an image from a text description',
        parameters: z.object({
          prompt: z.string().describe('Detailed image generation prompt'),
          size: z.enum(['1024x1024', '1792x1024', '1024x1792']).optional(),
          style: z.enum(['natural', 'vivid']).optional(),
        }),
        execute: async ({ prompt, size, style }) => {
          // Call image generation API (Forge API → DALL-E/Stability)
          const response = await fetch(process.env.FORGE_API_URL + '/generate/v1/image', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.FORGE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, size: size || '1024x1024', style }),
          });
          const data = await response.json();
          return { imageUrl: data.url };
        },
      }),
      generate_video: tool({ /* similar */ }),
      generate_audio: tool({ /* similar */ }),
      generate_speech: tool({ /* similar */ }),
    },
    maxSteps: 5, // Generate sub-calls are short
  });

  // Return the generated image URL to the main agent loop
  return result.text;
}
```

### 5.2 Why Sub-Calls Instead of Just Adding Tools?

| Approach | Pros | Cons |
|----------|------|------|
| **Add tools to main set** | Simpler, one conversation | Pollutes tool set, confuses Claude with too many tools |
| **Nested sub-call** (what Manus does) | Clean separation, focused context | More complex, separate billing |

The sub-call pattern keeps the main agent's tool set clean. Claude doesn't need to see `generate_image` when it's writing shell commands. The entrance tool (`generate`) acts as a gateway.

---

## 6. How Sessions Are Created and Controlled

### 6.1 Session Creation Flow

```
User clicks "New Chat" or sends first message
    ↓
Frontend: POST /api/sessions
    Body: { title: "New Task" }
    ↓
Server:
    1. INSERT INTO sessions (user_id, title, status) VALUES (...)
    2. Returns: { id: "sess_abc123", title: "New Task" }
    ↓
Frontend:
    1. sessionsSlice.addSession(session)
    2. sessionsSlice.setCurrentSessionId("sess_abc123")
    3. WebSocket: { type: "subscribe", sessionId: "sess_abc123" }
    ↓
User sends message
    ↓
Frontend: POST /api/sessions/sess_abc123/messages
    Body: { content: "Build me a website", attachments: [] }
    ↓
Server:
    1. INSERT INTO messages (session_id, role, content) VALUES (...)
    2. UPDATE sessions SET status = 'active' WHERE id = ...
    3. Emit WebSocket: { type: "message", role: "user", content: "..." }
    4. ASYNC: runAgentLoop("sess_abc123", "Build me a website")
    ↓
Agent loop starts (see Phase 3 above)
```

### 6.2 Who Creates What

| Entity | Created By | When | Stored Where |
|--------|-----------|------|-------------|
| **Session** | Frontend → Server API | User clicks New Chat or sends first message | PostgreSQL `sessions` table |
| **Sandbox** | Orchestrator | First tool call that needs sandbox | E2B API (tracked in Redis) |
| **Conversation History** | Orchestrator | Each message/tool call | PostgreSQL `messages` + `tool_calls` tables |
| **Plan** | Claude (via plan tool) | When Claude decides to create a plan | PostgreSQL `plans` table |
| **WebSocket Subscription** | Frontend | When session is selected | In-memory on server |
| **Browser Session** | Claude (via browser tool) | When Claude navigates to a URL | Chromium process in sandbox |
| **Shell Sessions** | Claude (via shell tool) | When Claude runs a command with a session name | PTY in sandbox |
| **File State** | Claude (via file tool) | When Claude writes/edits files | Sandbox filesystem |
| **Generated Images** | Orchestrator (via Forge API) | When Claude calls generate → generate_image | S3 + CDN |
| **Webdev Project** | Claude (via webdev_init_project) | When Claude creates a web project | Sandbox filesystem + Git |

### 6.3 Session Lifecycle State Machine

```
CREATED → ACTIVE → COMPLETED
                 → WAITING_FOR_USER → ACTIVE (user replies)
                 → FAILED
                 → EXPIRED (timeout)
```

**State transitions and who triggers them:**

| Transition | Trigger | Who |
|-----------|---------|-----|
| CREATED → ACTIVE | First user message sent | Server (on message POST) |
| ACTIVE → WAITING_FOR_USER | Claude calls `message(type="ask")` | Orchestrator |
| WAITING_FOR_USER → ACTIVE | User sends reply | Server (on message POST) |
| ACTIVE → COMPLETED | Claude calls `message(type="result")` | Orchestrator |
| ACTIVE → FAILED | Unrecoverable error (3 retries exhausted) | Orchestrator |
| ACTIVE → EXPIRED | Sandbox timeout (1 hour idle) | Orchestrator cleanup job |

---

## 7. The Complete "Who Does What" Map

### 7.1 Claude (The Single Agent) Decides:

- **What to do next** — which tool to call
- **How to plan** — creates and advances plans
- **What to say** — composes messages to user
- **When to stop** — sends result message
- **How to recover** — retries on error, tries alternatives
- **What to generate** — writes image prompts
- **What code to write** — all file content
- **What commands to run** — all shell commands
- **Where to browse** — all URLs and interactions
- **What to search** — all search queries

### 7.2 Orchestrator (The Infrastructure) Handles:

- **Tool routing** — sandbox vs. local vs. external API
- **Mode switching** — expanding/changing tool sets
- **Session management** — create, track, cleanup
- **Sandbox lifecycle** — acquire, warm, release, cleanup
- **WebSocket events** — emit to frontend in real-time
- **Database persistence** — store everything
- **File storage** — S3 upload/download
- **Credit tracking** — deduct per token
- **Rate limiting** — prevent abuse
- **Error recovery** — retry LLM calls, handle sandbox failures
- **Context management** — build system prompt, manage history length

### 7.3 Sandbox (The Execution Environment) Runs:

- **Shell commands** — via PTY sessions
- **File I/O** — read/write/edit on filesystem
- **Browser automation** — Playwright → Chromium via CDP
- **MCP CLI** — manus-mcp-cli for external service calls
- **Dev servers** — for webdev projects (Vite, etc.)
- **Code execution** — Python, Node.js scripts
- **Screenshot capture** — via CDP Page.captureScreenshot

### 7.4 External APIs (Called by Orchestrator):

- **Anthropic API** — Claude LLM calls
- **OpenAI API** — Whisper transcription, fallback LLM
- **Image Generation API** — DALL-E, Stability AI via Forge
- **Search API** — Tavily/Serper for web search
- **S3 API** — File storage
- **E2B API** — Sandbox management

---

## 8. How to Implement This in Your Clone

### 8.1 The Mode Manager

```typescript
// src/server/orchestrator/mode-manager.ts

export type AgentMode = 'base' | 'browser' | 'generate' | 'slides' | 'webdev';

export class ModeManager {
  private activeModes: Set<AgentMode> = new Set(['base']);

  // Get current tool set based on active modes
  getToolSet(sandbox: Sandbox, webdevProject?: any): Record<string, any> {
    let tools = { ...BASE_TOOLS(sandbox) };

    if (this.activeModes.has('browser')) {
      tools = { ...tools, ...BROWSER_TOOLS(sandbox) };
    }

    if (this.activeModes.has('webdev') && webdevProject) {
      tools = { ...tools, ...WEBDEV_TOOLS(webdevProject) };
    }

    // Note: generate and slides are NOT added to the tool set
    // They use nested sub-calls instead

    return tools;
  }

  // Handle mode transitions based on tool calls
  handleToolCall(toolName: string): 'continue' | 'generate_subcall' | 'slides_subcall' {
    switch (toolName) {
      case 'browser':
        this.activeModes.add('browser');
        return 'continue'; // Just expand tools, continue main loop

      case 'generate':
        return 'generate_subcall'; // Trigger nested sub-call

      case 'slides':
        return 'slides_subcall'; // Trigger nested sub-call

      case 'webdev_init_project':
        this.activeModes.add('webdev');
        return 'continue';

      default:
        return 'continue';
    }
  }

  // Reset modes for new session
  reset(): void {
    this.activeModes.clear();
    this.activeModes.add('base');
  }
}
```

### 8.2 Updated Agent Loop with Mode Switching

```typescript
// src/server/orchestrator/agent-loop-with-modes.ts

import { streamText, generateText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { ModeManager } from './mode-manager';

export async function runAgentLoop(sessionId: string, userMessage: string) {
  const session = await db.getSession(sessionId);
  const sandbox = await sandboxManager.acquireForUser(session.userId);
  const modeManager = new ModeManager();

  // Restore modes from session state
  if (session.browserModeActive) modeManager.handleToolCall('browser');
  if (session.webdevProject) modeManager.handleToolCall('webdev_init_project');

  const history = await db.getConversationHistory(sessionId);
  const systemPrompt = buildSystemPrompt(session);

  // Get dynamic tool set
  const tools = modeManager.getToolSet(sandbox, session.webdevProject);

  // Override execute() for entrance tools to handle mode switching
  tools.generate = tool({
    description: 'Enter generation mode to create images, videos, audio, and speech.',
    parameters: z.object({ brief: z.string() }),
    execute: async ({ brief }) => {
      // ============================================================
      // NESTED SUB-CALL — separate LLM conversation
      // ============================================================
      const subResult = await generateText({
        model: anthropic('claude-sonnet-4-20250514'),
        system: 'You are an image generation assistant. Use generate_image with a VERY detailed prompt.',
        messages: [{ role: 'user', content: brief }],
        tools: {
          generate_image: tool({
            description: 'Generate an image from text',
            parameters: z.object({
              prompt: z.string(),
              size: z.enum(['1024x1024', '1792x1024', '1024x1792']).optional(),
            }),
            execute: async ({ prompt, size }) => {
              const imageUrl = await forgeApi.generateImage(prompt, size);
              return { url: imageUrl };
            },
          }),
        },
        maxSteps: 3,
      });

      return subResult.text; // Returns image URL(s) to main loop
    },
  });

  tools.slides = tool({
    description: 'Enter slides mode to create presentations.',
    parameters: z.object({
      slide_content_file_path: z.string(),
      slide_count: z.number(),
      generate_mode: z.enum(['html', 'image']),
    }),
    execute: async ({ slide_content_file_path, slide_count, generate_mode }) => {
      // Read content from sandbox
      const content = await sandbox.files.read(slide_content_file_path);

      // Nested sub-call for slides generation
      const subResult = await generateText({
        model: anthropic('claude-sonnet-4-20250514'),
        system: `Generate a ${slide_count}-slide presentation in ${generate_mode} format.`,
        messages: [{ role: 'user', content }],
        tools: {
          create_slide: tool({ /* ... */ }),
          update_slide: tool({ /* ... */ }),
        },
        maxSteps: slide_count + 5,
      });

      return { slidesUri: `manus-slides://${nanoid()}` };
    },
  });

  // Run the main agent loop
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    messages: [...history, { role: 'user', content: userMessage }],
    tools,
    maxSteps: 30,

    onStepFinish: async ({ toolCalls, usage }) => {
      for (const tc of toolCalls) {
        // Handle browser mode activation
        if (tc.toolName === 'browser') {
          modeManager.handleToolCall('browser');
          // The NEXT streamText iteration will include browser_* tools
          // But since we're inside streamText, we need to handle this differently
          // In practice, the browser sub-tools are already in the tool set
          // because browser mode is detected from the tool call
        }

        // Emit to frontend
        wsServer.emit(sessionId, {
          type: 'tool_call',
          toolName: tc.toolName,
          args: tc.args,
        });

        // Persist
        await db.insertToolCall(sessionId, tc);
      }
    },
  });

  // Stream to frontend
  for await (const chunk of result.textStream) {
    wsServer.emit(sessionId, { type: 'text_delta', content: chunk });
  }
}
```

### 8.3 The Browser Tool Set Expansion Pattern

The tricky part with AI SDK is that `streamText` doesn't let you change tools mid-stream. Here's how to handle it:

```typescript
// APPROACH 1: Include all browser tools from the start, but describe them
// as "only available after calling browser()"
// Claude is smart enough to not call browser_click before browser_navigate

const allTools = {
  // Base tools
  ...baseTools,

  // Browser tools (always included, but described as requiring browser first)
  browser_click: tool({
    description: 'Click an element on the current page. REQUIRES: browser must be navigated first.',
    parameters: z.object({ index: z.number() }),
    execute: async ({ index }) => { /* ... */ },
  }),
  browser_input: tool({
    description: 'Type text into a field. REQUIRES: browser must be navigated first.',
    parameters: z.object({ element_id: z.number(), text: z.string() }),
    execute: async ({ element_id, text }) => { /* ... */ },
  }),
  // ... etc
};

// APPROACH 2: Use multiple streamText calls in a manual loop
// This gives you full control over tool set changes

async function runAgentLoopManual(sessionId: string, userMessage: string) {
  let tools = baseTools;
  let messages = [...history, { role: 'user', content: userMessage }];
  let stepCount = 0;

  while (stepCount < 30) {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 1, // One step at a time for full control
    });

    // Process the step
    for (const tc of result.toolCalls) {
      // Mode switching
      if (tc.toolName === 'browser') {
        tools = { ...tools, ...browserTools }; // Expand for next iteration
      }
      if (tc.toolName === 'generate') {
        await runGenerateSubCall(tc.args.brief);
      }

      // Check if task is complete
      if (tc.toolName === 'message' && tc.args.type === 'result') {
        return; // Done
      }
    }

    // Add assistant response + tool results to messages for next iteration
    messages = [...messages, ...result.responseMessages];
    stepCount++;
  }
}
```

**Approach 1 is simpler and what Manus likely does** — include all tools from the start, rely on Claude's intelligence to use them in the right order. The tool descriptions guide Claude.

**Approach 2 gives more control** but is slower (one LLM call per step instead of letting streamText handle multiple steps).

---

## 9. Summary: The Complete Agent Architecture

```
USER MESSAGE
    ↓
ORCHESTRATOR receives message
    ↓
ORCHESTRATOR builds:
    1. System prompt (identity, rules, context)
    2. Conversation history (from database)
    3. Dynamic tool set (base + mode-specific)
    ↓
ORCHESTRATOR calls streamText() with SINGLE Claude instance
    ↓
CLAUDE (the one and only agent) runs in a loop:
    │
    ├── Step 1: plan(action="update", goal="...", phases=[...])
    │   → Orchestrator stores plan, emits WebSocket
    │
    ├── Step 2: shell(command="mkdir -p /home/ubuntu/project")
    │   → Orchestrator routes to sandbox via TCP
    │   → Sandbox executes, returns result
    │
    ├── Step 3: search(queries=["React best practices"])
    │   → Orchestrator calls external search API
    │   → Returns results to Claude
    │
    ├── Step 4: browser(url="https://docs.react.dev")
    │   → Orchestrator routes to sandbox
    │   → Playwright navigates, screenshots, extracts content
    │   → Browser mode activated (browser_* tools now available)
    │
    ├── Step 5: browser_click(index=3)
    │   → Orchestrator routes to sandbox (browser mode tools)
    │
    ├── Step 6: file(action="write", path="/home/ubuntu/project/App.tsx")
    │   → Orchestrator routes to sandbox
    │
    ├── Step 7: generate(brief="Create hero image")
    │   → Orchestrator makes NESTED sub-call to Claude
    │   → Sub-Claude calls generate_image → Forge API → DALL-E
    │   → Returns image URL to main Claude
    │
    ├── Step 8: file(action="write", path="/home/ubuntu/project/index.html")
    │   → Uses generated image URL in code
    │
    ├── Step 9: plan(action="advance", next_phase_id=3)
    │   → Orchestrator updates plan state
    │
    ├── Step 10: message(type="result", text="Here's your website", attachments=[...])
    │   → Orchestrator uploads attachments to S3
    │   → Emits WebSocket to frontend
    │   → Task complete
    │
    └── END (Claude stops calling tools)
```

**That's it. One agent. Dynamic tools. Mode-based expansion. Nested sub-calls for generate and slides. Everything else is infrastructure.**
