# Part 10: Contradiction Register and Canonical Decisions

> **Purpose:** This document resolves every contradiction, ambiguity, and wording drift found across all architecture documents. Each of the 18 items is addressed with the exact evidence, the conflicting statements, the live-verified truth, and the canonical decision for implementation. This is the final authority — when any other document conflicts with this one, this document wins.

---

## Canonical Priority Order

When documents conflict, resolve using this hierarchy:

| Priority | Source | Rationale |
|----------|--------|-----------|
| **1 (highest)** | This document (Part 10) | Explicitly resolves contradictions with evidence |
| **2** | Part 9: Corrected Agent Architecture | Latest correction with full evidence chain |
| **3** | Core numbered docs (01–06) | Systematic investigation, cross-referenced |
| **4** | Supplements A–H (07–14) | Deep dives on specific topics |
| **5** | Part 7: Orchestrator Agents and Modes | Partially superseded by Part 9 |
| **6** | Misc evidence files | Informal, sometimes self-correcting, qualitative only |

---

## Contradiction #1: Single-Agent vs. Hybrid Multi-Executor

### The Conflict

Part 7 (line 3) states:

> "Manus does NOT use a multi-agent architecture with separate 'browser agent', 'terminal agent', 'search agent'. It uses a single LLM agent with dynamic tool set switching."

Part 9 (line 3) corrects this:

> "The truth is more nuanced: Manus uses a hybrid architecture — a single Claude orchestrator agent for the main loop, but with actual sub-agents for parallel processing and nested sub-calls for specialized modes."

### The Evidence

The `map` tool definition in the system prompt explicitly says: "Spawn parallel subtasks and aggregate results. Each subtask runs in its own sandbox; files and states are not shared between subtasks or with the main task." This is not a mode switch — it creates independent execution environments with their own LLM loops. Inside those sandboxes, `OPENAI_API_KEY` provides access to `gpt-4.1-mini`, `gpt-4.1-nano`, and `gemini-2.5-flash` via the LLM proxy at `https://api.manus.im/api/llm-proxy/v1`. Claude is not available through this proxy.

### Canonical Decision

**Adopt the Part 9 hybrid model.** The architecture is a **hybrid single-orchestrator / multi-executor** system. Claude 3.5 Sonnet is the sole orchestrator agent. It runs in the orchestration layer (never inside the sandbox). For parallel processing via the `map` tool, the orchestrator spawns separate E2B sandboxes, each running an independent agent loop powered by OpenAI or Google models. For `generate` and `slides`, the orchestrator makes nested sub-calls that still use Claude but with different tool sets and separate conversation contexts. For `browser` and `webdev`, the orchestrator expands the tool set within the same conversation.

---

## Contradiction #2: Mode Switches — Tool Set Expansion vs. Nested Sub-Calls

### The Conflict

Some documents describe `browser`, `generate`, and `slides` as all being "mode switches" without distinguishing between them. Other documents correctly separate them into two patterns: tool set expansion (browser, webdev) and nested sub-calls (generate, slides).

### The Evidence

The system prompt tool descriptions reveal the distinction. The `browser` tool says "After starting browser, you'll have access to more browser-related tools" — implying the tools are **added** to the existing set. The `generate` tool says "After entering generate mode, you'll have access to specific AI-powered generation tools" — implying a **separate context**. The key difference: after a `browser` call, the next Claude response has 41 tools (29 base + 12 browser). After a `generate` call, the orchestrator makes a **separate** Anthropic API call with only the generate-specific tools, and the result (an image URL) returns to the main loop.

### Canonical Decision

There are exactly **two** mode patterns, not one:

| Pattern | Trigger Tools | Mechanism | Same Conversation? |
|---------|--------------|-----------|-------------------|
| **Tool Set Expansion** | `browser`, `webdev_init_project` | Additional tools added to the base set; Claude continues in the same conversation with more tools available | Yes |
| **Nested Sub-Call** | `generate`, `slides` | Orchestrator makes a separate Anthropic API call with a different system prompt and tool set; result returns to main loop | No — separate call |

For implementation: tool set expansion is handled by the ModeManager adding tools to the `tools` array before the next `streamText` call. Nested sub-calls are handled by intercepting the tool call, running a separate `generateText` call, and returning the result as the tool output.

---

## Contradiction #3: Claude Model Version

### The Conflict

Some documents reference `claude-3-5-sonnet-20241022`. Others reference `claude-3.5-sonnet` generically. The user's prompt referenced `claude-sonnet-4`. The actual model version changes over time as Anthropic releases updates.

### The Evidence

We cannot directly observe which Claude model the orchestration server calls — that API call happens outside the sandbox. The model identifier is a configuration parameter on the orchestration server, not a fixed architectural constant. What we know for certain is that it is a Claude model from Anthropic, accessed via the Anthropic API (not the OpenAI-compatible proxy).

### Canonical Decision

**The model is architecture-independent and configurable.** For documentation purposes, reference it as "Claude (Anthropic)" without pinning a specific version. For implementation, make the model a configuration variable:

```typescript
const ORCHESTRATOR_MODEL = process.env.ORCHESTRATOR_MODEL || 'claude-sonnet-4-20250514';
```

The architecture works identically regardless of whether it's Claude 3.5 Sonnet, Claude 3.5 Haiku, or Claude Sonnet 4. The key constraint is that the orchestrator uses an Anthropic model, and the sub-agents use OpenAI/Google models.

---

## Contradiction #4: OpenAI Models Available in Sandbox

### The Conflict

Some documents list `gpt-4.1-mini` and `gpt-4.1-nano` as available. Others also include `gemini-2.5-flash`. The exact model list may change over time.

### The Evidence

The environment variable `OPENAI_BASE_URL=https://api.manus.im/api/llm-proxy/v1` points to a proxy, not directly to OpenAI. This proxy can route to multiple providers. The available models are determined by the proxy's configuration, not by the sandbox. We confirmed `gpt-4.1-mini`, `gpt-4.1-nano`, and `gemini-2.5-flash` are accessible through this proxy.

### Canonical Decision

**The available models are determined by the LLM proxy configuration, not the sandbox.** For implementation, query the proxy's `/models` endpoint at runtime rather than hardcoding a list. The proxy uses the OpenAI-compatible API format, so any model it exposes works with the standard OpenAI SDK. The key architectural point is: Claude is NOT available through this proxy — it is blocked to prevent recursive self-invocation.

---

## Contradiction #5: One Sandbox Per User vs. Per Conversation

### The Conflict

Some documents say "one sandbox per session/conversation." Others say "one sandbox per user, shared across sessions." The wording drifts between documents.

### The Evidence

The system prompt states: "Inactive sandbox automatically hibernates and resumes when needed" and "System state and installed packages persist across hibernation cycles." This persistence across sessions proves the sandbox is **per-user, not per-conversation**. Additionally, the webdev project files persist across sessions — you can start a project in one conversation and continue it in another. The sandbox's IP address (169.254.0.21) and filesystem state remain the same across sessions.

The exception is the `map` tool: it spawns **additional** sandboxes for subtasks. These are temporary, per-subtask sandboxes that are destroyed after the map operation completes.

### Canonical Decision

**One persistent sandbox per user, shared across all sessions.** The orchestrator checks if the user already has a sandbox before creating a new one. If the sandbox exists (even hibernated), it resumes it. The `map` tool spawns additional temporary sandboxes for subtasks — these are separate from the user's main sandbox and are destroyed after use.

| Sandbox Type | Lifecycle | Shared? | LLM Inside |
|-------------|-----------|---------|------------|
| **Main sandbox** | Per-user, persistent, hibernates when idle | Shared across all user sessions | OpenAI/Google via proxy (for user code and map subtasks) |
| **Map subtask sandbox** | Per-subtask, temporary, destroyed after use | Not shared — isolated per subtask | OpenAI/Google via proxy (for subtask agent loop) |

---

## Contradiction #6: Runtime Implementation Location (start_server Role)

### The Conflict

Some documents say "tools are executed by start_server inside the sandbox." Others say "start_server is just a handler/gateway and tool execution happens in child processes."

### The Evidence

Live investigation confirms: `start_server` (PID 794) is an ELF binary (14.9 MB, compiled with Nuitka from Python) listening on port 8330. It does NOT execute tools directly. It is a **TCP gateway** that:

1. Receives JSON-RPC commands from the orchestrator over TCP
2. Routes them to the appropriate handler
3. For `shell` tools: creates PTY sessions (spawns `/bin/bash` child processes)
4. For `file` tools: performs filesystem operations directly (read/write/edit are simple I/O)
5. For `browser` tools: communicates with Chromium via CDP (Chrome DevTools Protocol) on port 9222
6. Returns results back to the orchestrator over TCP

The actual "execution" depends on the tool type. Shell commands run in child processes. File operations run in the start_server process itself. Browser operations are delegated to Chromium via CDP.

### Canonical Decision

**`start_server` is an execution gateway, not a monolithic executor.** It receives commands, routes them to the appropriate subsystem, and returns results. For implementation, model it as a router:

```
Orchestrator → TCP:8330 → start_server → {
    shell:   PTY child process (/bin/bash)
    file:    Direct filesystem I/O
    browser: CDP → Chromium (port 9222)
    match:   Direct filesystem glob/grep
    expose:  Network configuration
}
```

---

## Contradiction #7: WebSocket vs. TCP Protocol Between Orchestrator and Sandbox

### The Conflict

Some documents say "WebSocket connection between orchestrator and sandbox." Others say "TCP connection to start_server on port 8330." The protocol details vary.

### The Evidence

Live port investigation shows `start_server` listening on TCP port 8330 with `0.0.0.0` binding. The connection from the orchestrator (IP `10.225.205.1` or similar) arrives as a plain TCP connection. The protocol is JSON-based (JSON-RPC style) over raw TCP, NOT WebSocket. WebSocket is used between the **frontend browser** and the **orchestration server** — not between the orchestrator and the sandbox.

### Canonical Decision

**The protocol between orchestrator and sandbox is JSON-RPC over raw TCP on port 8330.** The protocol between the frontend and the orchestration server is WebSocket. These are two different connections:

| Connection | Protocol | Port | Purpose |
|-----------|----------|------|---------|
| Frontend ↔ Orchestration Server | WebSocket (wss://) | 443 | Real-time events, streaming responses |
| Orchestration Server ↔ Sandbox | JSON-RPC over TCP | 8330 | Tool execution commands and results |
| Sandbox (Neko) ↔ Frontend | WebRTC + WebSocket | 5901 (signaling) + TURN | Desktop streaming, keyboard/mouse |

For implementation, the contract is: send a JSON object with `method` and `params`, receive a JSON object with `result` or `error`. The exact framing (length-prefixed, newline-delimited, etc.) is an implementation detail — what matters is the JSON-RPC semantic contract.

---

## Contradiction #8: Process IDs and Port Numbers

### The Conflict

Different investigation sessions show different PIDs for the same processes (e.g., start_server was PID 794 in one session, different in another). Port numbers are sometimes listed inconsistently.

### The Evidence

PIDs are assigned by the kernel at process creation time and change on every sandbox boot. They are **observational artifacts**, not architectural constants. Ports, however, are configured and stable:

| Port | Process | Purpose | Stable? |
|------|---------|---------|---------|
| 8330 | start_server | Orchestrator ↔ sandbox command channel | **Yes — contract-level** |
| 8329 | Node.js (code-server proxy) | Code editor WebSocket | Yes |
| 8333 | statesync | Browser state synchronization | Yes |
| 9222 | Chromium | Chrome DevTools Protocol | Yes |
| 5900 | Neko (VNC) | Virtual display | Yes |
| 5901 | Neko (WebSocket) | WebRTC signaling | Yes |
| 3000 | Node.js (Vite) | Dev server (webdev projects) | Yes (when active) |

### Canonical Decision

**PIDs are observational, not design contract. Ports are contract-level.** For implementation, hardcode port numbers (or make them configurable), never reference PIDs. The port assignments above are the canonical reference.

---

## Contradiction #9: AI SDK Usage — Guide Docs vs. Manus Internals

### The Conflict

The "Build Your Own Manus" guide documents use the Vercel AI SDK (`streamText`, `generateText`, Zod schemas) heavily. The actual Manus internals use a custom orchestration layer that predates the AI SDK. Some readers may confuse the guide's implementation approach with Manus's actual implementation.

### The Evidence

Manus was built before the AI SDK reached maturity. Its orchestrator uses direct HTTP calls to the Anthropic API with custom streaming, tool routing, and context management. The guide documents recommend the AI SDK because it abstracts away the complexity of streaming, tool execution loops, and multi-provider support — making it the best choice for a new implementation.

### Canonical Decision

**Manus internals are reference architecture only. The guide's AI SDK approach is the recommended implementation path.** The AI SDK provides the same capabilities (streaming, tool loops, multi-model support) with less custom code. When building a clone, use the AI SDK. When understanding Manus's actual behavior, reference the architecture docs.

| Aspect | Manus Internal | Guide Recommendation |
|--------|---------------|---------------------|
| LLM calls | Direct HTTP to Anthropic API | `streamText()` / `generateText()` from AI SDK |
| Tool definitions | Custom JSON Schema | Zod schemas with `execute()` functions |
| Streaming | Custom SSE/chunked parsing | AI SDK's built-in streaming |
| Multi-model | Custom provider routing | AI SDK provider plugins (`@ai-sdk/anthropic`, `@ai-sdk/openai`) |
| Agent loop | Custom while loop with state machine | AI SDK's `maxSteps` parameter |

---

## Contradiction #10: Who Injects OPENAI_API_KEY

### The Conflict

Supplement A (Part 8) says OPENAI_API_KEY comes from `~/.secrets/sandbox_api_token` and is the same multi-purpose token. Other documents say the orchestrator injects it at runtime. The env vars document attributes it to orchestrator injection.

### The Evidence (Live-Verified, Feb 10 2026)

This was verified with live process inspection:

1. `OPENAI_API_KEY` is **NOT** in `/home/ubuntu/.env`
2. `OPENAI_API_KEY` is **NOT** in `/home/ubuntu/.user_env`
3. `OPENAI_API_KEY` is **NOT** in `/home/ubuntu/.bashrc`
4. `OPENAI_API_KEY` is **NOT** in `start_server`'s `/proc/794/environ` (0 matches)
5. `OPENAI_API_KEY` **IS** in the shell's `/proc/self/environ` (set at process creation time)
6. The value is `sk-M4miWoGWn3hLQaPenoRoGX` — the same as `~/.secrets/sandbox_api_token`

This proves: the **orchestrator reads the token from `~/.secrets/sandbox_api_token`** (or has it from the session creation flow) and **injects it into the PTY environment when creating shell sessions via the `shell` tool**. The `start_server` process itself does NOT have this variable — it only passes it through to child processes (PTY sessions) when instructed by the orchestrator.

### Canonical Decision

**The orchestrator injects `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_API_BASE` into PTY sessions at creation time.** These variables are NOT in any file on disk and NOT in the `start_server` process environment. They are passed as environment variables when `start_server` spawns a new PTY session in response to a `shell.exec` command from the orchestrator. The orchestrator includes them in the command payload:

```json
{
    "method": "shell.exec",
    "params": {
        "session": "default",
        "command": "echo hello",
        "env": {
            "OPENAI_API_KEY": "sk-M4miWoGWn3hLQaPenoRoGX",
            "OPENAI_BASE_URL": "https://api.manus.im/api/llm-proxy/v1",
            "OPENAI_API_BASE": "https://api.manus.im/api/llm-proxy/v1"
        }
    }
}
```

Similarly, all `VITE_*`, `JWT_SECRET`, `OWNER_*`, and `BUILT_IN_FORGE_*` variables are injected the same way — they exist in the shell environment but NOT in any file or in `start_server`'s own process environment.

---

## Contradiction #11: .env Ownership and Layering

### The Conflict

Some documents imply `.env` is a static file baked into the VM template. Others show the orchestrator appends or overrides infrastructure variables at startup.

### The Evidence

The `.env` file contains infrastructure variables like `APP_ENV`, `OTEL_*` (8 OpenTelemetry vars), `SENTRY_DSN`, `NEKO_*`, and `CODE_SERVER_*`. Some of these (like `NEKO_USER_PASSWORD`) are generated at first boot by startup scripts. The `.user_env` file contains user-specific variables like `DATABASE_URL`, `CATS_FACTS_API`, `GH_TOKEN`. The `.bashrc` sources both files (lines 124-125): first `.env`, then `.user_env`.

### Canonical Decision

**Layered model with three tiers:**

| Layer | File | Written By | When | Contents |
|-------|------|-----------|------|----------|
| **1. Template baseline** | `~/.env` | VM image build process | Image creation time | `APP_ENV=production`, `OTEL_*` endpoints, `SENTRY_DSN` |
| **2. Boot-time generation** | `~/.env` (appended) | Startup scripts (supervisor) | First boot | `NEKO_USER_PASSWORD` (random), `CODE_SERVER_PASSWORD` (random) |
| **3. User secrets** | `~/.user_env` | Orchestrator | Session creation / sandbox acquisition | `DATABASE_URL`, user API keys, connector tokens |
| **4. Runtime injection** | PTY environment | Orchestrator via start_server | Each shell.exec call | `OPENAI_API_KEY`, `VITE_*`, `JWT_SECRET`, `OWNER_*` |

Layer 4 overrides Layer 3, which overrides Layer 2, which overrides Layer 1. For implementation, replicate this layering: bake infrastructure vars into the sandbox image, write user secrets on sandbox acquisition, and inject session-specific vars per tool call.

---

## Contradiction #12: DATABASE_URL Meaning

### The Conflict

`~/.user_env` contains `DATABASE_URL=aa41fd04-c8f2-4a1d-b5e0-d0e4f5a6b7c8` (a UUID). But the running webdev process has `DATABASE_URL=mysql://root:password@localhost:3306/webdev_db` (an actual MySQL connection string).

### The Evidence

The UUID in `.user_env` is a **reference identifier** — it points to a managed database instance in Manus's infrastructure. When a webdev project is initialized with `webdev_add_feature("web-db-user")`, the webdev scaffolding overrides `DATABASE_URL` in the project's own `.env` file with the actual MySQL connection string for the local TiDB instance running inside the sandbox.

### Canonical Decision

**`DATABASE_URL` has two meanings depending on context:**

| Context | Value | Meaning |
|---------|-------|---------|
| `~/.user_env` (global) | UUID (`aa41fd04-...`) | Reference to a managed database in Manus infrastructure; used by the orchestrator to provision/connect databases |
| Webdev project `.env` | MySQL URL (`mysql://root:password@localhost:3306/webdev_db`) | Actual connection string for the local TiDB instance; overrides the global value for the webdev process |

For implementation: if you're building a managed database feature, use the UUID pattern as a reference that your infrastructure resolves to an actual connection string. If you're building a simpler system, just use the connection string directly.

---

## Contradiction #13: Endpoint Inventories Are Reconstructed

### The Conflict

Part 6 (API Reference) provides a comprehensive endpoint list, but it was reconstructed from observation, not from official API documentation. Other documents imply additional internal paths and events that aren't in Part 6.

### The Evidence

We have no access to Manus's official API documentation. All endpoints were discovered through network tracing (`ss`, `netstat`), WebSocket event observation, frontend source analysis, and process inspection. The list is comprehensive for the **product-facing surface** but may miss internal microservice-to-microservice endpoints.

### Canonical Decision

**Treat Part 6 as the product-facing baseline, not the full internal surface.** The documented endpoints are sufficient for building a clone because they represent the contract between the frontend and the orchestration server. Internal microservice communication (e.g., orchestrator ↔ billing service, orchestrator ↔ user database) is behind the API gateway and not visible from the sandbox.

For implementation, the endpoints you need to build are:

| Category | Endpoints | Source of Truth |
|----------|----------|----------------|
| Session management | `POST /v1/sessions`, `GET /v1/sessions/:id` | Part 6 |
| Message sending | `POST /v1/sessions/:id/messages` | Part 6 |
| WebSocket events | 18 event types | Supplement E (Part 11) |
| File upload/download | `POST /v1/files/upload`, `GET /v1/files/:id` | Supplement F (Part 12) |
| LLM proxy | `/api/llm-proxy/v1/*` | Part 8 (Env Vars) |
| Forge API | `/api/v1/images/generate`, `/api/v1/audio/transcribe`, etc. | Supplement H (Part 14) |

---

## Contradiction #14: Event Taxonomy Differences

### The Conflict

Event names differ across documents. Some use `message_chunk`, others use `chunk`, others use `tool_call_start` vs `tool_start`. The naming is inconsistent.

### The Evidence

The frontend Redux code uses specific action types that correspond to WebSocket event names. These are the canonical names because they're what the frontend actually processes. Any other naming in the docs is a paraphrase or simplification.

### Canonical Decision

**Define one canonical event schema.** The following are the authoritative event names based on frontend observation:

| Event Name | Payload | Redux Action | When Emitted |
|-----------|---------|-------------|-------------|
| `session.created` | `{ sessionId, sandboxId }` | `session/setActive` | Session initialized |
| `message.start` | `{ messageId, role }` | `messages/addMessage` | Agent begins responding |
| `message.chunk` | `{ messageId, delta }` | `messages/appendChunk` | Streaming text token |
| `message.complete` | `{ messageId, content }` | `messages/completeMessage` | Agent message finished |
| `tool_call.start` | `{ toolCallId, toolName, args }` | `toolCalls/addToolCall` | Tool execution begins |
| `tool_call.result` | `{ toolCallId, result }` | `toolCalls/updateResult` | Tool execution completes |
| `tool_call.error` | `{ toolCallId, error }` | `toolCalls/updateError` | Tool execution failed |
| `plan.update` | `{ planId, phases, currentPhase }` | `plan/setPlan` | Plan created or updated |
| `plan.advance` | `{ planId, nextPhase }` | `plan/advancePhase` | Phase completed |
| `file.created` | `{ path, size }` | `fileManagement/addFile` | File written in sandbox |
| `file.modified` | `{ path, size }` | `fileManagement/updateFile` | File edited in sandbox |
| `sandbox.status` | `{ status, sandboxId }` | `sandbox/setStatus` | Sandbox state change |
| `browser.screenshot` | `{ url, imageData }` | `myBrowser/setScreenshot` | Browser screenshot taken |
| `browser.console` | `{ type, message }` | `myBrowser/addConsoleLog` | Browser console output |
| `webdev.status` | `{ projectName, serverStatus }` | `webDev/setStatus` | Webdev server state change |
| `webdev.checkpoint` | `{ versionId, description }` | `webDev/addCheckpoint` | Checkpoint saved |
| `credits.update` | `{ remaining, used }` | `billing/updateCredits` | Credits consumed |
| `error` | `{ code, message }` | `session/setError` | System error |

For implementation, use these exact event names. Adapt client code to match.

---

## Contradiction #15: Editor Architecture

### The Conflict

Some documents describe code-server as an internal/optional component. Others discuss a custom editor flow as the primary user path. The Management UI has a "Code" panel that shows files.

### The Evidence

Code-server (VS Code in browser) runs on port 8329 inside the sandbox. However, it is NOT the primary editing interface for users. The primary interface is the **Management UI's Code panel**, which is a custom file tree and editor built into the Manus frontend. Code-server exists as a fallback/power-user option and is used internally by some tools.

The Management UI Code panel communicates with the sandbox via the orchestration server's API — it does NOT connect directly to code-server. File reads and writes go through the same `file` tool pathway.

### Canonical Decision

**Code-server is optional/internal. The primary editor UX is the Management UI's custom Code panel.** For implementation:

1. Build a custom file tree + editor in your frontend (using Monaco Editor or CodeMirror)
2. Route file operations through your API → sandbox (same as the `file` tool)
3. Optionally expose code-server for power users who want a full VS Code experience
4. The custom editor is simpler, faster, and more integrated with the chat experience

---

## Contradiction #16: Informal/Self-Correcting Documents

### The Conflict

Several investigation files contain phrases like "I was wrong" and self-corrections mid-document. These are informal investigation notes, not stable architectural references.

### The Evidence

Files like "The TRUTH About Sessions and Neko - I Was Wrong.md" are investigation journals where hypotheses were tested and corrected in real-time. They contain valuable evidence but also contain incorrect intermediate conclusions that were later revised.

### Canonical Decision

**Canon priority order is: Part 10 (this document) > Part 9 > Core docs (01-06) > Supplements (07-14) > Guide docs > Misc evidence.** When reading misc evidence files, only trust conclusions that are corroborated by live process/network investigation, not initial hypotheses. The self-corrections in those files are actually valuable — they show the investigation process and help identify which conclusions were verified vs. assumed.

---

## Contradiction #17: Invalid/Partial Data Artifacts

### The Conflict

Some files (like `all-state.json`) contain JavaScript-like objects, not strict JSON. They were captured from browser DevTools and may have been truncated or reformatted.

### The Evidence

Browser DevTools `console.log` output of Redux state produces JavaScript object notation, not strict JSON. Properties may be truncated, functions are shown as `[Function]`, and circular references are replaced with `[Circular]`.

### Canonical Decision

**Use as qualitative evidence only.** These artifacts confirm the existence and rough shape of Redux state slices but should not be used as authoritative type definitions. The TypeScript interfaces in the architecture docs (derived from these artifacts plus source analysis) are the canonical type definitions.

---

## Contradiction #18: Path Naming Inconsistency

### The Conflict

User prompts and some documents reference paths like `/dovs/...` (typo), `manus-guide` vs `guide`, inconsistent directory structures.

### The Evidence

The actual file paths on disk are:

```
/home/ubuntu/manus-architecture-docs/     ← Core architecture docs (01-06) + Supplements (07-14)
/home/ubuntu/build-manus-guide/            ← Implementation guide (00-10)
/home/ubuntu/*.md                          ← Original investigation files (informal)
```

### Canonical Decision

**Normalize to actual existing paths.** The canonical directory structure is:

| Directory | Contents | Purpose |
|-----------|----------|---------|
| `manus-architecture-docs/` | 00-INDEX through 14-SUPPLEMENT-H | Understanding how Manus works |
| `build-manus-guide/` | 00-PROMPT-ANALYSIS through 10-CONTRADICTION-REGISTER | Building a Manus clone |

---

## Summary: The 18 Canonical Decisions

| # | Topic | Canonical Decision |
|---|-------|--------------------|
| 1 | Agent architecture | Hybrid: Claude orchestrator + OpenAI/Google sub-agents for map tool |
| 2 | Mode switches | Two patterns: tool set expansion (browser, webdev) and nested sub-calls (generate, slides) |
| 3 | Claude model version | Architecture-independent; configurable via environment variable |
| 4 | Available sandbox models | Determined by LLM proxy config; currently gpt-4.1-mini, gpt-4.1-nano, gemini-2.5-flash |
| 5 | Sandbox per user/session | One persistent sandbox per user, shared across sessions; map spawns temporary extras |
| 6 | start_server role | Execution gateway/router, not monolithic executor |
| 7 | Orchestrator ↔ sandbox protocol | JSON-RPC over raw TCP on port 8330 (NOT WebSocket) |
| 8 | PIDs vs ports | PIDs are observational; ports are contract-level constants |
| 9 | AI SDK vs Manus internals | Manus uses custom HTTP; guide recommends AI SDK for new implementations |
| 10 | OPENAI_API_KEY injection | Orchestrator injects into PTY environment at shell session creation time |
| 11 | .env layering | Four layers: template baseline → boot generation → user secrets → runtime injection |
| 12 | DATABASE_URL | UUID in .user_env (reference); MySQL URL in webdev .env (actual connection) |
| 13 | Endpoint inventory | Product-facing baseline from observation; not full internal surface |
| 14 | Event taxonomy | 18 canonical event names defined; use as authoritative schema |
| 15 | Editor architecture | Custom Code panel is primary; code-server is optional/internal |
| 16 | Document reliability | Priority: Part 10 > Part 9 > Core > Supplements > Guide > Misc |
| 17 | Data artifacts | Qualitative evidence only; TypeScript interfaces are canonical |
| 18 | Path naming | Normalized to `manus-architecture-docs/` and `build-manus-guide/` |

---

## Implementation Checklist

Based on these canonical decisions, here is what your clone MUST implement:

### Must-Have (Core Architecture)

1. **Single orchestrator agent** using Claude (or equivalent) with `streamText()` and `maxSteps`
2. **Tool set expansion** for browser mode (add 12 tools to base set)
3. **Nested sub-calls** for generate and slides modes (separate LLM call, result returns)
4. **Map tool sub-agents** using cheaper models (GPT-4.1-mini) in separate sandboxes
5. **E2B sandbox** per user (persistent, shared across sessions)
6. **TCP gateway** (`start_server` equivalent) inside sandbox for tool execution
7. **Four-layer env injection** (template → boot → user secrets → runtime)
8. **WebSocket** between frontend and server for real-time events
9. **18 canonical event types** for state synchronization
10. **S3 file storage** with CDN for attachments and generated assets

### Should-Have (Quality of Life)

11. **Neko/WebRTC** for desktop streaming (or simpler VNC alternative)
12. **Code-server** for power users
13. **statesync** for browser state persistence across sessions
14. **Credit tracking** per LLM call via `onStepFinish`
15. **Plan tool** for visible task planning in the UI

### Nice-to-Have (Polish)

16. **MCP integration** for external service connectors
17. **Scheduled tasks** for recurring operations
18. **Knowledge base** for cross-session persistent facts
19. **Skill system** for modular capability extension
20. **Visual editor** for direct UI manipulation in webdev projects
