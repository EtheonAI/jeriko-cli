# Part 9: The REAL Agent Architecture — Corrected and Definitive

> **This document corrects the contradiction in Part 7.** Part 7 said "Manus does NOT use multiple agents — it's one Claude instance." That was an oversimplification. The truth is more nuanced: Manus uses a **hybrid architecture** — a single Claude orchestrator agent for the main loop, but with **actual sub-agents** for parallel processing and **nested sub-calls** for specialized modes. This document lays out the complete truth.

---

## 1. The Contradiction Explained

In Part 7, I wrote:

> "Manus does NOT use a multi-agent architecture with separate 'browser agent', 'terminal agent', 'search agent'. It uses a single LLM agent with dynamic tool set switching."

In Part 2 (Orchestration), I wrote:

> "Claude 3.5 Sonnet is the PRIMARY LLM. OpenAI (gpt-4.1-mini, gpt-4.1-nano) and Google (gemini-2.5-flash) are SECONDARY, available INSIDE sandbox. Claude is BLOCKED from being called inside E2B sandboxes."

Both statements contain truth, but they paint incomplete pictures. The full architecture has **three distinct execution patterns**, and understanding all three is critical.

---

## 2. The Three Execution Patterns

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MANUS AGENT ARCHITECTURE                              │
│                                                                          │
│  PATTERN 1: MAIN AGENT LOOP (Single Claude Instance)                    │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  Claude 3.5 Sonnet (Anthropic API)                             │     │
│  │  - Plans tasks                                                  │     │
│  │  - Calls tools (shell, file, search, browser, message, etc.)   │     │
│  │  - Processes results                                            │     │
│  │  - Decides next action                                          │     │
│  │  - Loops until task complete (maxSteps: ~30)                    │     │
│  │  - ONE conversation thread, ONE context window                  │     │
│  └────────────────────────────────────────────────────────────────┘     │
│       │                    │                       │                     │
│       ▼                    ▼                       ▼                     │
│  PATTERN 2: MODE SWITCH   PATTERN 3: SUB-AGENTS   Direct Tool          │
│  (Nested Sub-Call)        (Parallel Sandboxes)     Execution            │
│  ┌──────────────┐        ┌──────────────────┐     ┌──────────┐        │
│  │ generate()    │        │ map()             │     │ shell()  │        │
│  │ slides()      │        │                   │     │ file()   │        │
│  │               │        │ Spawns N sandboxes│     │ search() │        │
│  │ SAME Claude   │        │ Each runs its OWN │     │ browser()│        │
│  │ DIFFERENT     │        │ LLM (OpenAI or    │     │ etc.     │        │
│  │ tool set      │        │ Google) with its   │     │          │        │
│  │ SEPARATE call │        │ OWN agent loop     │     │ Executed │        │
│  │ Returns to    │        │ Returns structured │     │ in main  │        │
│  │ main loop     │        │ results            │     │ sandbox  │        │
│  └──────────────┘        └──────────────────────┘     └──────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Pattern 1: The Main Agent Loop (Claude Only)

This is the primary execution pattern. **One Claude instance** runs in the orchestration layer (NOT inside the sandbox). It has access to 29 base tools and operates in a loop.

### How It Works

The orchestrator calls the Anthropic API with `claude-3-5-sonnet-20241022` (or a newer version). Claude receives the system prompt, conversation history, and tool definitions. It returns either a text response or a tool call. If it returns a tool call, the orchestrator executes it and feeds the result back to Claude. This loops until Claude sends a final `message` tool call with `type: "result"`.

```
Orchestrator → Anthropic API:
    POST https://api.anthropic.com/v1/messages
    {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 8192,
        system: "<system_prompt with 29 tool definitions>",
        messages: [
            ...conversation_history,
            { role: "user", content: "Build me a website" }
        ],
        tools: [ ...29 tool definitions ]
    }
    ↓
Claude responds:
    { tool_use: { name: "plan", input: { action: "update", goal: "...", phases: [...] } } }
    ↓
Orchestrator executes plan tool (LOCAL — just stores in database)
    ↓
Orchestrator → Anthropic API (again, with tool result appended):
    { messages: [...previous, { role: "tool", content: "Plan updated" }] }
    ↓
Claude responds:
    { tool_use: { name: "shell", input: { command: "mkdir -p /home/ubuntu/project" } } }
    ↓
Orchestrator routes to sandbox (TCP → start_server → PTY)
    ↓
... loop continues ...
```

### What Claude Controls

Claude is the **sole decision-maker** in this loop. It decides what tool to call, what arguments to pass, how to interpret results, when to retry on failure, and when to deliver the final result to the user. The orchestrator is pure infrastructure — it routes, persists, and streams, but never makes decisions about what to do next.

### What Claude Does NOT Do

Claude does NOT run inside the E2B sandbox. Claude does NOT call OpenAI or Google APIs. Claude does NOT directly execute code. Claude only produces tool calls, and the orchestrator handles execution.

---

## 4. Pattern 2: Mode Switches (Nested Sub-Calls, Still Claude)

When Claude calls `generate()` or `slides()`, the orchestrator does NOT simply add tools to the existing conversation. Instead, it makes a **separate, nested LLM call** — still to Claude, but with a different system prompt and a different tool set.

### Generate Mode

```
Main Loop: Claude calls generate({ brief: "Create hero image for landing page" })
    ↓
Orchestrator intercepts — does NOT send to sandbox
    ↓
Orchestrator makes a SEPARATE Anthropic API call:
    POST https://api.anthropic.com/v1/messages
    {
        model: "claude-3-5-sonnet-20241022",
        system: "You are now in generate mode. Use the image generation tools.",
        messages: [
            { role: "user", content: "Create hero image for landing page" }
        ],
        tools: [
            { name: "generate_image", ... },
            { name: "generate_video", ... },
            { name: "generate_audio", ... },
            { name: "generate_speech", ... }
        ]
    }
    ↓
Claude (in generate context) responds:
    { tool_use: { name: "generate_image", input: { prompt: "Modern tech hero..." } } }
    ↓
Orchestrator calls Forge API:
    POST https://forge.manus.ai/api/v1/images/generate
    ↓
Returns image URL to the sub-call
    ↓
Sub-call completes — returns image URL to main loop
    ↓
Main Loop continues with the image URL in context
```

### Browser Mode (Different Pattern — Tool Set Expansion)

Browser mode is NOT a nested sub-call. It's a **tool set expansion** on the same conversation. When Claude calls `browser({ url: "https://example.com" })`, the orchestrator:

1. Executes the navigation in the sandbox
2. Takes a screenshot
3. On the NEXT LLM call, **adds 12 browser-specific tools** to the existing 29 base tools
4. Claude continues in the same conversation with 41 tools available

```
Before browser call: 29 tools
After browser call: 29 + 12 = 41 tools (browser_view, browser_click, etc.)
Same conversation, same context window, same Claude instance
```

### Slides Mode

Similar to generate mode — a nested sub-call with a different tool set. The orchestrator makes a separate Anthropic API call with slide-specific tools.

### Summary of Mode Patterns

| Mode | Trigger | Mechanism | LLM | Same Conversation? |
|------|---------|-----------|-----|-------------------|
| **Browser** | `browser()` | Tool set expansion | Same Claude | Yes — tools added to main loop |
| **Generate** | `generate()` | Nested sub-call | Same Claude, separate call | No — separate call, result returns |
| **Slides** | `slides()` | Nested sub-call | Same Claude, separate call | No — separate call, result returns |
| **Webdev** | `webdev_init_project()` | Tool set expansion | Same Claude | Yes — tools added to main loop |

---

## 5. Pattern 3: Sub-Agents (Map Tool — Different LLMs, Different Sandboxes)

**This is where the actual multi-agent behavior happens.** When Claude calls the `map()` tool, the orchestrator spawns multiple E2B sandboxes, each running its own independent LLM agent loop. These sub-agents use **OpenAI or Google models**, NOT Claude.

### How Map Tool Sub-Agents Work

```
Main Loop: Claude calls map({
    name: "research_companies",
    prompt_template: "Research the company background of {{input}}",
    inputs: ["Apple", "Google", "Microsoft"],
    target_count: 3,
    output_schema: [
        { name: "overview", type: "string" },
        { name: "recent_news", type: "string" }
    ]
})
    ↓
Orchestrator intercepts — this is NOT a simple tool execution
    ↓
Orchestrator spawns 3 NEW E2B sandboxes (from same template):
    ├── Subtask Sandbox A (169.254.0.X)
    ├── Subtask Sandbox B (169.254.0.Y)
    └── Subtask Sandbox C (169.254.0.Z)
    ↓
Each sandbox gets:
    - Same ~/.env (infrastructure vars)
    - Same ~/.user_env (user secrets)
    - Same ~/.secrets/sandbox_api_token (same multi-purpose token)
    - Same OPENAI_API_KEY (for LLM proxy access)
    - Same start_server, same Chromium, same tools
    ↓
Orchestrator sends subtask to each sandbox:
    {
        "type": "subtask",
        "prompt": "Research the company background of Apple",
        "output_schema": [{ name: "overview", type: "string" }, ...]
    }
    ↓
INSIDE EACH SUBTASK SANDBOX:
    The sandbox-runtime runs its OWN agent loop:
    
    1. Receives prompt + output schema
    2. Calls LLM via OPENAI_API_KEY:
       POST https://api.manus.im/api/llm-proxy/v1/chat/completions
       {
           model: "gpt-4.1-mini",  ← NOT Claude! OpenAI model!
           messages: [
               { role: "system", content: "You are a research assistant..." },
               { role: "user", content: "Research the company background of Apple" }
           ],
           tools: [
               { name: "search", ... },
               { name: "browser", ... },
               { name: "shell", ... },
               { name: "file", ... }
           ]
       }
    3. The LLM (gpt-4.1-mini) responds with tool calls
    4. The sandbox executes those tools locally
    5. Results fed back to the LLM
    6. Loop continues until structured output is produced
    7. Returns results to orchestrator
    ↓
ALL THREE RUN IN PARALLEL (10-30 seconds)
    ↓
Orchestrator aggregates results:
    {
        results: [
            { input: "Apple", overview: "...", recent_news: "..." },
            { input: "Google", overview: "...", recent_news: "..." },
            { input: "Microsoft", overview: "...", recent_news: "..." }
        ]
    }
    ↓
Orchestrator feeds aggregated results back to main Claude loop
    ↓
Claude formats and presents to user
```

### Why Sub-Agents Use OpenAI/Google, NOT Claude

This is a deliberate architectural decision. The evidence:

1. **Claude is blocked from the LLM proxy.** When you try to call a Claude model through `OPENAI_API_KEY` + `OPENAI_BASE_URL` inside the sandbox, it fails. Only `gpt-4.1-mini`, `gpt-4.1-nano`, and `gemini-2.5-flash` are available.

2. **Cost optimization.** Claude 3.5 Sonnet is expensive. Running 10-100 parallel Claude instances for subtasks would be prohibitively costly. GPT-4.1-mini and GPT-4.1-nano are significantly cheaper.

3. **Architectural separation.** Claude is the "brain" (planner/orchestrator). OpenAI/Google models are the "hands" (executors). This separation prevents recursive self-invocation issues and keeps billing predictable.

4. **Rate limiting.** Anthropic has stricter rate limits than OpenAI. Spawning 50 parallel Claude calls would hit rate limits immediately.

### Available Models for Sub-Agents

| Model | Provider | Use Case | Cost Tier |
|-------|----------|----------|-----------|
| `gpt-4.1-mini` | OpenAI | Complex subtasks (research, analysis) | Medium |
| `gpt-4.1-nano` | OpenAI | Simple subtasks (extraction, formatting) | Low |
| `gemini-2.5-flash` | Google | Alternative for variety/fallback | Low |

### Sub-Agent Capabilities

Each subtask sandbox is a **full agent** — not just a simple LLM call. It has:

| Capability | Available? | Details |
|-----------|-----------|---------|
| LLM reasoning | Yes | Via gpt-4.1-mini/nano or gemini-2.5-flash |
| Shell execution | Yes | Full PTY with all system tools |
| File I/O | Yes | Read, write, edit files |
| Web search | Yes | Via search tool |
| Browser automation | Yes | Playwright + Chromium |
| Internet access | Yes | Full outbound HTTP/HTTPS |
| Other tool calls | Yes | match, expose, etc. |

The only things sub-agents CANNOT do:
- Call Claude (blocked by LLM proxy)
- Spawn their own sub-agents (no nested map calls)
- Communicate with the user directly (no message tool — results go back to main agent)
- Access the main sandbox's filesystem (separate VM)

---

## 6. The Complete Agent Hierarchy

```
LEVEL 0: USER
    │
    ▼
LEVEL 1: CLAUDE (Main Orchestrator Agent)
    │   Model: claude-3-5-sonnet (Anthropic API)
    │   Runs in: Orchestration server (NOT in sandbox)
    │   Tools: 29 base + browser/webdev expansion
    │   Role: PLANNER — decides everything
    │   Conversation: Single thread with full history
    │
    ├── Direct tool execution (shell, file, search, etc.)
    │   → Routed to main sandbox (169.254.0.21)
    │   → Results return to Claude
    │
    ├── Mode switch: browser
    │   → Tool set expands (+12 browser tools)
    │   → SAME Claude, same conversation
    │   → Claude continues with more tools available
    │
    ├── Nested sub-call: generate
    │   → SEPARATE Anthropic API call
    │   → SAME model (Claude), DIFFERENT context
    │   → Returns result (image URL) to main loop
    │
    ├── Nested sub-call: slides
    │   → SEPARATE Anthropic API call
    │   → SAME model (Claude), DIFFERENT context
    │   → Returns result (slide deck) to main loop
    │
    └── Sub-agents: map (parallel processing)
        │
        ├── LEVEL 2: SUB-AGENT A
        │   Model: gpt-4.1-mini (OpenAI via LLM proxy)
        │   Runs in: Subtask Sandbox A (separate E2B VM)
        │   Tools: search, browser, shell, file, match
        │   Role: EXECUTOR — follows prompt, returns structured data
        │   Conversation: Fresh, single-purpose
        │
        ├── LEVEL 2: SUB-AGENT B
        │   Model: gpt-4.1-mini (OpenAI via LLM proxy)
        │   Runs in: Subtask Sandbox B (separate E2B VM)
        │   Tools: search, browser, shell, file, match
        │   Role: EXECUTOR — follows prompt, returns structured data
        │
        └── LEVEL 2: SUB-AGENT C
            Model: gpt-4.1-mini (OpenAI via LLM proxy)
            Runs in: Subtask Sandbox C (separate E2B VM)
            Tools: search, browser, shell, file, match
            Role: EXECUTOR — follows prompt, returns structured data
```

---

## 7. Who Creates What Sessions

This was another point of confusion. Here's the definitive answer:

### Session Creation Chain

```
USER clicks "New Chat"
    ↓
FRONTEND: POST /v1/sessions { taskMode: "standard" }
    ↓
ORCHESTRATION SERVER:
    1. Creates session record in database
    2. Returns session UID to frontend
    3. Frontend subscribes via WebSocket
    ↓
USER sends first message
    ↓
ORCHESTRATION SERVER:
    1. Checks if user has existing E2B sandbox
       ├── YES → Reuse (sandboxes are shared per user, not per session)
       └── NO → Call E2B API to create new sandbox (~150ms)
    2. Writes ~/.user_env with user's secrets
    3. Writes ~/.secrets/sandbox_api_token
    4. Establishes TCP connection to start_server (port 8330)
    5. Constructs system prompt + tool definitions
    6. Calls Anthropic API (Claude)
    7. Claude responds with tool calls
    8. Orchestrator executes tools via sandbox
    9. Loop continues
    ↓
IF Claude calls map() tool:
    ORCHESTRATION SERVER:
    1. Calls E2B API to create N new sandboxes
    2. Injects same env vars into each
    3. Sends subtask prompt to each
    4. Each sandbox runs its own agent loop (OpenAI LLM)
    5. Waits for all to complete
    6. Aggregates results
    7. Returns to Claude
    ↓
IF Claude calls generate() tool:
    ORCHESTRATION SERVER:
    1. Makes SEPARATE Anthropic API call (still Claude)
    2. With generate-specific tools
    3. Claude (in generate context) calls generate_image
    4. Orchestrator calls Forge API
    5. Returns image URL to main loop
    ↓
WHEN user opens "Manus Computer" view:
    FRONTEND:
    1. Connects to Neko WebRTC server in sandbox
    2. Authenticates with NEKO_USER_PASSWORD
    3. WebRTC negotiation via Cloudflare TURN
    4. Video stream begins (H.264, 30fps)
    5. This is a SEPARATE session — Neko session, not Manus session
```

---

## 8. The LLM Routing Map

Here is exactly which LLM is used where, by whom, and for what:

| Context | LLM Model | Provider | Called By | Called From | Purpose |
|---------|-----------|----------|-----------|-------------|---------|
| Main agent loop | `claude-3-5-sonnet` | Anthropic | Orchestrator | Orchestration server | Planning, tool selection, reasoning, user communication |
| Generate sub-call | `claude-3-5-sonnet` | Anthropic | Orchestrator | Orchestration server | Image/video/audio prompt crafting |
| Slides sub-call | `claude-3-5-sonnet` | Anthropic | Orchestrator | Orchestration server | Slide content generation |
| Map subtask agents | `gpt-4.1-mini` | OpenAI (via proxy) | Subtask sandbox | Inside E2B sandbox | Research, data extraction, analysis |
| Map subtask agents (light) | `gpt-4.1-nano` | OpenAI (via proxy) | Subtask sandbox | Inside E2B sandbox | Simple extraction, formatting |
| Map subtask agents (alt) | `gemini-2.5-flash` | Google (via proxy) | Subtask sandbox | Inside E2B sandbox | Alternative/fallback |
| User code (if user writes it) | Any available model | OpenAI/Google (via proxy) | User's Python/Node.js code | Inside E2B sandbox | Whatever the user wants |
| Webdev server-side (if upgraded) | Any available model | Via Forge API | tRPC routes | Inside E2B sandbox | App-specific LLM features |

### The Critical Distinction

**Claude runs in the orchestration layer.** It NEVER runs inside the E2B sandbox. The Anthropic API is called from the orchestration server, not from within the sandbox.

**OpenAI and Google models run inside E2B sandboxes.** They are called via the LLM proxy (`OPENAI_API_KEY` + `OPENAI_BASE_URL`). They are used for:
1. Map tool subtask agents (autonomous agent loops)
2. User-written code that calls the OpenAI SDK
3. Webdev server-side features (via Forge API)

**Claude is blocked from the LLM proxy.** You cannot call Claude from inside the sandbox. This is enforced by the proxy — it only routes to OpenAI and Google models.

---

## 9. Why This Architecture Makes Sense

### Cost Structure

```
Claude 3.5 Sonnet: ~$15/M input tokens, ~$75/M output tokens
GPT-4.1-mini:      ~$0.40/M input tokens, ~$1.60/M output tokens
GPT-4.1-nano:      ~$0.10/M input tokens, ~$0.40/M output tokens
Gemini 2.5 Flash:  ~$0.15/M input tokens, ~$0.60/M output tokens
```

Running 50 parallel Claude instances for a map operation would cost ~50x the price of using GPT-4.1-nano. The architecture uses Claude where it matters most (planning, complex reasoning, user interaction) and cheap models where volume matters (parallel data extraction).

### Capability Matching

| Task Type | Best Model | Why |
|-----------|-----------|-----|
| Complex planning | Claude | Best at multi-step reasoning, tool selection |
| User communication | Claude | Best at natural, helpful responses |
| Code generation | Claude | Best at complex code with context |
| Parallel data extraction | GPT-4.1-mini | Good enough, 40x cheaper |
| Simple formatting | GPT-4.1-nano | Good enough, 150x cheaper |
| Image prompt crafting | Claude | Best at creative, detailed prompts |

### Rate Limit Management

Anthropic's rate limits are stricter than OpenAI's. By using Claude only for the main loop (1 concurrent call per user) and OpenAI for parallel subtasks (N concurrent calls), Manus avoids hitting Anthropic's rate limits even with heavy parallel processing.

---

## 10. How to Replicate This in Your Clone

### 10.1 The Dual-LLM Orchestrator

```typescript
// src/server/orchestrator/agent.ts
import { streamText, generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

// MAIN AGENT: Claude for orchestration
async function runMainAgentLoop(session: Session, userMessage: string) {
  const result = await streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    maxSteps: 30,
    system: buildSystemPrompt(session),
    messages: session.history,
    tools: getToolSet(session),
    onStepFinish: async (step) => {
      // Track credits, emit WebSocket events
      await trackCredits(session, step);
      emitToolEvent(session, step);
    },
  });
  return result;
}

// SUB-AGENT: OpenAI for parallel subtasks
async function runSubtaskAgent(
  sandbox: Sandbox,
  prompt: string,
  outputSchema: OutputField[],
): Promise<Record<string, any>> {
  
  // This runs INSIDE the subtask sandbox via the LLM proxy
  // But we can also implement it in the orchestrator
  const result = await generateText({
    model: openai('gpt-4.1-mini'),  // ← NOT Claude!
    maxSteps: 15,  // Subtasks get fewer steps
    system: `You are a research assistant. Complete the task and return structured results.
             Output schema: ${JSON.stringify(outputSchema)}`,
    messages: [{ role: 'user', content: prompt }],
    tools: getSubtaskToolSet(sandbox),  // Reduced tool set
  });
  
  // Extract structured output from the final response
  return parseStructuredOutput(result, outputSchema);
}

// NESTED SUB-CALL: Claude for generate/slides modes
async function runGenerateSubCall(brief: string): Promise<string> {
  const result = await generateText({
    model: anthropic('claude-3-5-sonnet-20241022'),  // Same Claude
    system: 'You are in generate mode. Use the image generation tools.',
    messages: [{ role: 'user', content: brief }],
    tools: {
      generate_image: {
        description: 'Generate an image from a text prompt',
        parameters: z.object({
          prompt: z.string(),
          size: z.enum(['1024x1024', '1792x1024', '1024x1792']),
        }),
        execute: async ({ prompt, size }) => {
          // Call Forge API / DALL-E / Stability AI
          const imageUrl = await forgeApi.generateImage(prompt, size);
          return imageUrl;
        },
      },
    },
  });
  return result.text; // Contains image URL
}
```

### 10.2 The Map Tool Implementation

```typescript
// src/server/tools/map.ts
import Sandbox from '@e2b/code-interpreter';

export const mapTool = {
  name: 'map',
  description: 'Spawn parallel subtasks and aggregate results',
  parameters: z.object({
    prompt_template: z.string(),
    inputs: z.array(z.string()),
    target_count: z.number(),
    output_schema: z.array(z.object({
      name: z.string(),
      type: z.enum(['string', 'number', 'boolean', 'file']),
    })),
  }),
  execute: async ({ prompt_template, inputs, target_count, output_schema }) => {
    // Spawn N sandboxes in parallel
    const sandboxes = await Promise.all(
      inputs.map(input => Sandbox.create({
        template: 'manus-subtask-template',
        envs: {
          OPENAI_API_KEY: process.env.SANDBOX_TOKEN,
          OPENAI_BASE_URL: `${process.env.API_HOST}/api/llm-proxy/v1`,
        },
      }))
    );
    
    // Run subtask agent in each sandbox
    const results = await Promise.all(
      sandboxes.map((sandbox, i) => {
        const prompt = prompt_template.replace('{{input}}', inputs[i]);
        return runSubtaskAgent(sandbox, prompt, output_schema);
      })
    );
    
    // Cleanup sandboxes
    await Promise.all(sandboxes.map(s => s.close()));
    
    // Return aggregated results to main Claude loop
    return { results };
  },
};
```

### 10.3 The Mode Manager (Corrected)

```typescript
// src/server/orchestrator/mode-manager.ts

export class ModeManager {
  private expandedModes: Set<string> = new Set();
  
  handleToolCall(toolName: string): 'continue' | 'generate_subcall' | 'slides_subcall' | 'map_subagents' {
    switch (toolName) {
      // PATTERN 2: Tool set expansion (same conversation)
      case 'browser':
        this.expandedModes.add('browser');
        return 'continue';  // Add browser tools, continue main loop
      
      case 'webdev_init_project':
        this.expandedModes.add('webdev');
        return 'continue';  // Add webdev tools, continue main loop
      
      // PATTERN 2: Nested sub-call (separate Claude call)
      case 'generate':
        return 'generate_subcall';  // Separate Claude call with generate tools
      
      case 'slides':
        return 'slides_subcall';  // Separate Claude call with slides tools
      
      // PATTERN 3: Sub-agents (separate sandboxes, different LLMs)
      case 'map':
        return 'map_subagents';  // Spawn N sandboxes with OpenAI agents
      
      // PATTERN 1: Direct execution (main sandbox)
      default:
        return 'continue';
    }
  }
  
  getToolSet(): Record<string, any> {
    let tools = { ...BASE_TOOLS };  // 29 base tools
    
    if (this.expandedModes.has('browser')) {
      tools = { ...tools, ...BROWSER_TOOLS };  // +12 browser tools
    }
    if (this.expandedModes.has('webdev')) {
      tools = { ...tools, ...WEBDEV_TOOLS };  // +7 webdev tools
    }
    
    // generate and slides are NOT added here
    // They trigger separate sub-calls, not tool set expansion
    
    return tools;
  }
}
```

---

## 11. Corrected Summary

| Statement | Part 7 Said | The Truth |
|-----------|------------|-----------|
| "Manus uses one agent" | Yes, one Claude | **Partially true** — one Claude for main loop, but map spawns actual sub-agents |
| "No multi-agent" | Correct for browser/generate/slides | **Wrong for map tool** — map creates real sub-agents with their own LLM loops |
| "Mode switching only" | Yes | **True for browser/webdev** (tool expansion), **true for generate/slides** (nested sub-call), **false for map** (sub-agents) |
| "OpenAI only for user code" | Implied | **Wrong** — OpenAI is used for map subtask agents, which are system-level, not user code |
| "Claude does everything" | Yes | **True for planning/reasoning** — Claude is the brain. **False for execution** — OpenAI handles parallel execution |

### The Definitive Architecture Statement

> Manus uses a **hybrid single-orchestrator / multi-executor architecture**. A single Claude 3.5 Sonnet instance serves as the orchestrator agent — it plans, reasons, selects tools, and communicates with the user. For specialized modes (generate, slides), it delegates to nested sub-calls that still use Claude but with different tool sets. For parallel processing (map tool), it delegates to actual sub-agents running in separate E2B sandboxes using OpenAI (gpt-4.1-mini/nano) or Google (gemini-2.5-flash) models. Claude is the brain; OpenAI/Google models are the hands.

---

## 12. Visual Summary

```
USER MESSAGE: "Research 5 companies and build a comparison website"
    │
    ▼
CLAUDE (Orchestrator):
    "I need to research 5 companies in parallel, then build a website."
    │
    ├── Step 1: plan.update({ phases: [research, build, deliver] })
    │   → LOCAL (stored in database)
    │
    ├── Step 2: map({ inputs: ["Apple", "Google", "Microsoft", "Amazon", "Meta"] })
    │   → SPAWNS 5 SUB-AGENTS:
    │     ├── Sandbox A: gpt-4.1-mini researches Apple (search, browser, file)
    │     ├── Sandbox B: gpt-4.1-mini researches Google (search, browser, file)
    │     ├── Sandbox C: gpt-4.1-mini researches Microsoft (search, browser, file)
    │     ├── Sandbox D: gpt-4.1-mini researches Amazon (search, browser, file)
    │     └── Sandbox E: gpt-4.1-mini researches Meta (search, browser, file)
    │   ← Returns aggregated results (all 5 complete)
    │
    ├── Step 3: generate({ brief: "Create hero image for comparison site" })
    │   → NESTED SUB-CALL (still Claude):
    │     └── Claude calls generate_image → Forge API → returns URL
    │   ← Returns image URL
    │
    ├── Step 4: file.write({ path: "index.html", content: "..." })
    │   → MAIN SANDBOX (169.254.0.21)
    │
    ├── Step 5: shell.exec({ command: "pnpm dev" })
    │   → MAIN SANDBOX
    │
    ├── Step 6: browser({ url: "http://localhost:3000" })
    │   → MAIN SANDBOX (Playwright navigates Chromium)
    │   → TOOL SET EXPANDS (+12 browser tools)
    │
    ├── Step 7: browser_view()  ← Now available because browser mode is active
    │   → MAIN SANDBOX (takes screenshot)
    │
    └── Step 8: message({ type: "result", text: "Here's your comparison site" })
        → LOCAL (sent to user via WebSocket)
```

**That is the complete, corrected, definitive agent architecture. No contradictions. No oversimplifications.**
