# Rubic Chat — Definitive Architecture & Refactoring Guide

> **Scope**: This document reverse-engineers the entire Rubic chat codebase, maps every tool to its renderer, explains the exact data flow from backend stream to UI pixel, documents every Redux state connection, and provides precise instructions for building and testing the complete system using **AI SDK v6** and **Elements AI**.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The Three Rendering Layers](#2-the-three-rendering-layers)
3. [AI SDK v6 — The Wire Protocol](#3-ai-sdk-v6--the-wire-protocol)
4. [UIMessage.parts — The Single Source of Truth](#4-uimessageparts--the-single-source-of-truth)
5. [Tool Invocation Lifecycle (7 States)](#5-tool-invocation-lifecycle-7-states)
6. [The Master Renderer — MessageRenderer](#6-the-master-renderer--messagerenderer)
7. [The Tool Registry Pattern](#7-the-tool-registry-pattern)
8. [Every Tool — Complete Rendering Map](#8-every-tool--complete-rendering-map)
9. [The Canvas System — useCanvas Hook](#9-the-canvas-system--usecanvas-hook)
10. [The Plan + Search Merge (Chain of Thought)](#10-the-plan--search-merge-chain-of-thought)
11. [Redux State — Every Slice Connected](#11-redux-state--every-slice-connected)
12. [Component Hierarchy — Full Tree](#12-component-hierarchy--full-tree)
13. [Elements AI Component Mapping](#13-elements-ai-component-mapping)
14. [Refactoring Checklist](#14-refactoring-checklist)
15. [Testing Strategy](#15-testing-strategy)

---

## 1. Architecture Overview

The Rubic chat system has **three concurrent rendering surfaces** that react to the same stream of data:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Backend (API Route)                             │
│  streamText({ model, tools, messages, onChunk, onFinish })             │
│  Returns: Data Stream Protocol (text, reasoning, tool-call, sources)   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ SSE / fetch stream
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    useChat() — AI SDK v6 Hook                          │
│  Parses stream → builds UIMessage[] with typed parts[]                 │
│  Manages: messages, status, sendMessage, stop, regenerate              │
└──────────┬──────────────────────┬──────────────────────┬───────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
   ┌──────────────┐    ┌──────────────────┐    ┌─────────────────┐
   │  Chat Panel  │    │   Canvas Panel   │    │   Redux Store   │
   │ (messages)   │    │ (agent computer) │    │ (persistence)   │
   │              │    │                  │    │                 │
   │ MessageRen-  │    │ useCanvas() hook │    │ chat.slice      │
   │ derer loops  │    │ reads latest     │    │ sessions.slice  │
   │ over parts[] │    │ tool part →      │    │ agentWorkspace  │
   │ and renders  │    │ switches canvas  │    │ .slice          │
   │ each one     │    │ view type        │    │                 │
   └──────────────┘    └──────────────────┘    └─────────────────┘
```

### Key Insight: Dual Rendering

Every tool invocation renders in **two places simultaneously**:

| Location | What renders | Who drives it |
|----------|-------------|---------------|
| **Chat panel** (left) | Compact inline card via `ToolPart` → `ToolCard` → `ToolRenderer` | `MessageRenderer` iterating `message.parts[]` |
| **Canvas panel** (right) | Full interactive view (browser, terminal, code editor) | `useCanvas()` hook reading the **latest** tool part from all messages |

This is the fundamental architecture: the chat shows a summary, the canvas shows the live workspace.

---

## 2. The Three Rendering Layers

### Layer 1: Part-Level Rendering (MessageRenderer)

`MessageRenderer` receives a single `UIMessage` and iterates its `parts[]` array. Each part has a `type` field that determines which component renders it:

```
UIMessage.parts[] iteration:
  ├── type: "text"           → TextPartRenderer (markdown)
  ├── type: "reasoning"      → ReasoningPartRenderer (collapsible thinking)
  ├── type: "tool-invocation" → ToolPart → ToolRegistry → specific renderer
  ├── type: "source-url"     → collected, rendered as SourcesGroup at bottom
  ├── type: "source-document" → collected, rendered as SourcesGroup at bottom
  ├── type: "step-start"     → skipped (invisible separator)
  └── type: "file"           → skipped in loop, rendered as AttachmentsGrid
```

**Critical behavior**: `show_plan` and `web_search` tools are **merged** into a single `ChainOfThought` component. The renderer collects all plan + search tool parts, builds enriched steps with search results attached, and renders one unified timeline instead of individual tool cards.

### Layer 2: Tool-Level Rendering (ToolRegistry)

When a tool part is encountered, the `ToolPart` component:

1. Looks up the tool name in `ToolRegistry` context
2. Checks if it's a **standalone** tool (`show_plan`) → renders without `ToolCard` wrapper
3. Checks if it's a **compact** tool (`message_notify_user`) → renders as `ToolCompact` pill
4. Otherwise → wraps in `ToolCard` (collapsible header + body) and renders the specific `ToolRenderer`

```
ToolPart decision tree:
  ├── STANDALONE_TOOLS (show_plan, showPlan)
  │   └── Render: <StandaloneRenderer /> (no wrapper)
  ├── COMPACT_TOOLS (message_notify_user, message_ask_user, schedule_task)
  │   └── Render: <ToolCompact /> (inline pill)
  └── Everything else
      └── Render: <ToolCard><ToolRenderer /></ToolCard> (collapsible card)
```

### Layer 3: Canvas-Level Rendering (useCanvas → AgentCanvas)

The `useCanvas(messages)` hook:

1. Scans **all messages** backwards to find the **latest** tool invocation
2. Maps the tool name to a `CanvasViewType` via `TOOL_VIEW_MAP`
3. Extracts tool-specific data (screenshots, terminal output, file contents)
4. Returns a `CanvasState` object that drives `AgentCanvas`

```
useCanvas() pipeline:
  messages[] → find latest tool part → TOOL_VIEW_MAP[toolName] → CanvasViewType
  
  CanvasViewType → AgentCanvas renders:
    ├── "browser"     → BrowserView (screenshot + URL bar + nav buttons)
    ├── "code"        → CodeView (file tree + tabs + syntax-highlighted editor)
    ├── "terminal"    → TerminalView (accumulated shell output)
    ├── "filePreview" → FilePreviewView (image/pdf/markdown/text)
    ├── "slides"      → SlidesView (slide deck viewer)
    ├── "aiCanvas"    → AICanvasView (drawing canvas)
    ├── "webDevIDE"   → WebDevIDEView (full IDE with preview)
    ├── "mapReduce"   → MapReduceView (parallel processing grid)
    └── "empty"       → EmptyView (placeholder)
```

---

## 3. AI SDK v6 — The Wire Protocol

### Backend: `streamText()` in API Route

```typescript
// app/api/chat/route.ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { messages, chatId } = await req.json();

  const result = streamText({
    model: openai("gpt-4.1-mini"),
    messages,
    tools: {
      show_plan: { description: "...", parameters: z.object({...}) },
      web_search: { description: "...", parameters: z.object({...}), execute: async (args) => {...} },
      shell_exec: { description: "...", parameters: z.object({...}), execute: async (args) => {...} },
      browser_navigate: { description: "...", parameters: z.object({...}), execute: async (args) => {...} },
      file_read: { description: "...", parameters: z.object({...}), execute: async (args) => {...} },
      // ... all 33 tools
    },
    maxSteps: 25,  // Allow multi-step tool chains
    experimental_reasoning: { enabled: true },
    toolCallStreaming: true,
  });

  return result.toDataStreamResponse();
}
```

### Frontend: `useChat()` Hook

```typescript
// hooks/use-chat-session.ts
const {
  messages,      // UIMessage[] — the source of truth
  status,        // "streaming" | "submitted" | "ready" | "error"
  sendMessage,   // (text, options?) => void
  stop,          // () => void
  regenerate,    // () => void
} = useChat({
  id: sessionId,
  transport: new DefaultChatTransport({ api: "/api/chat" }),
  experimental_throttle: 16,  // 60fps UI updates
  onFinish: ({ messages }) => {
    // Sync to Redux for persistence
    dispatch(setReduxMessages({ sessionId, messages }));
  },
});
```

### The Stream Protocol

The backend sends a stream of typed chunks. AI SDK v6 parses them into `UIMessage.parts[]`:

| Stream chunk type | Becomes part type | Description |
|-------------------|-------------------|-------------|
| `0:` (text) | `{ type: "text", text: "..." }` | Markdown text content |
| `g:` (reasoning) | `{ type: "reasoning", text: "...", state: "streaming" }` | Chain of thought |
| `9:` (tool-call) | `{ type: "tool-invocation", toolCallId, toolName, input, state }` | Tool being called |
| `a:` (tool-result) | Updates existing tool part's `output` and `state` | Tool execution result |
| `h:` (source) | `{ type: "source-url", url, title, sourceId }` | Citation source |
| `e:` (step-start) | `{ type: "step-start" }` | Multi-step boundary |

---

## 4. UIMessage.parts — The Single Source of Truth

Every `UIMessage` has a `parts[]` array. This is the **only** data structure that drives all rendering. There is no separate state for "current tool" or "current plan" — everything comes from iterating parts.

### Part Types (TypeScript)

```typescript
// From @repo/ai/lib/types/ui-message.ts

type UIMessagePart =
  | TextUIPart           // { type: "text", text: string, state?: "streaming" }
  | ReasoningUIPart      // { type: "reasoning", text: string, state?: "streaming" }
  | StaticToolUIPart     // { type: "tool-invocation", toolCallId, toolName, input, output, state }
  | DynamicToolUIPart    // Same but with streaming input
  | SourceUrlUIPart      // { type: "source-url", sourceId, url, title }
  | SourceDocumentUIPart // { type: "source-document", sourceId, title, filename? }
  | FileUIPart           // { type: "file", data, mimeType }
  | StepStartUIPart      // { type: "step-start" }
  | DataUIPart;          // { type: "data-*", data: unknown }

// Type guards
function isToolUIPart(part: UIMessagePart): boolean {
  return part.type === "tool-invocation";
}
function isTextUIPart(part: UIMessagePart): boolean {
  return part.type === "text";
}
// etc.
```

### Tool Part State Machine

Every tool invocation part has a `state` field that progresses through:

```
input-streaming → input-available → [approval-requested → approval-responded →] output-available
                                                                                  ↘ output-error
                                                                                  ↘ output-denied
```

The `state` field is the **single field** that determines how a tool renders:

| State | Chat rendering | Canvas rendering |
|-------|---------------|-----------------|
| `input-streaming` | Shimmer/skeleton + "Calling..." | Canvas opens, shows loading |
| `input-available` | Shows input args, spinner | Canvas shows loading state |
| `approval-requested` | `ApprovalCard` with Approve/Deny buttons | Canvas paused |
| `approval-responded` | Brief "Approved" flash | Canvas resumes |
| `output-available` | Full result (search results, terminal output, etc.) | Canvas shows result |
| `output-error` | Red error card with message | Canvas shows error |
| `output-denied` | Gray "Denied" pill | Canvas unchanged |

---

## 5. Tool Invocation Lifecycle (7 States)

Here is the exact lifecycle of a tool call from stream to pixel:

```
Step 1: Backend starts generating tool arguments
        Stream: 9:{"toolCallId":"tc_1","toolName":"web_search","args":{"query":"best je...
        Part state: "input-streaming"
        Chat: ToolCard shows shimmer, "Searching..."
        Canvas: Switches to browser view, shows loading

Step 2: Backend finishes generating arguments
        Stream: 9:{"toolCallId":"tc_1","toolName":"web_search","args":{"query":"best jeeps 2026"},"state":"input-available"}
        Part state: "input-available"
        Chat: ToolCard shows full query, spinner
        Canvas: Browser view, loading indicator

Step 3: (Optional) Tool requires approval
        Part state: "approval-requested"
        Chat: ApprovalCard replaces ToolCard content
        Canvas: Paused, waiting

Step 4: (Optional) User responds to approval
        Part state: "approval-responded"
        Chat: Brief "Approved" indicator
        Canvas: Resumes

Step 5: Backend executes tool, returns result
        Stream: a:{"toolCallId":"tc_1","result":{"results":[...]}}
        Part state: "output-available"
        Chat: WebSearchEnhanced shows expandable results
        Canvas: Browser view shows search results

Step 6: (Alternative) Tool execution fails
        Part state: "output-error"
        Chat: Red error banner in ToolCard
        Canvas: Shows error state

Step 7: (Alternative) User denied execution
        Part state: "output-denied"
        Chat: Gray "Denied" pill
        Canvas: Unchanged
```

---

## 6. The Master Renderer — MessageRenderer

This is the most important component in the system. It takes a single `UIMessage` and renders all its parts, with special logic for merging plan + search tools.

### Current Implementation Analysis

The `MessageRenderer` in `message-renderer.tsx` does the following:

**Pass 1 — Collect and merge** (in `useMemo`):
1. Iterates all parts to find `show_plan` tool parts and `web_search` tool parts
2. Collects all `source-url` and `source-document` parts
3. Extracts sources from search results and browser outputs
4. Builds a `ChainOfThought` data structure by:
   - Taking the **latest** plan's todos as steps
   - Matching search results to plan steps by keyword overlap
   - Attaching matched search results to the relevant step
5. Returns `{ chainOfThought, mergedToolIds, sources }`

**Pass 2 — Render** (in JSX):
1. Iterates parts again
2. Skips `step-start`, `source-url`, `source-document` parts
3. For `text` → `TextPartRenderer`
4. For `reasoning` → `ReasoningPartRenderer`
5. For tool parts:
   - If `toolCallId` is in `mergedToolIds` AND it's a plan tool AND chain not yet rendered → render `ChainOfThought`
   - If `toolCallId` is in `mergedToolIds` but already rendered or is a search tool → skip
   - Otherwise → `ToolPartRenderer` (which delegates to `ToolPart`)
6. After all parts, render `SourcesGroup` at the bottom

### The Merge Algorithm (Plan + Search)

This is the key innovation. Instead of showing separate plan and search tool cards, the renderer merges them:

```
Before merge:
  [show_plan] → Plan with 3 steps
  [web_search] → 5 search results
  [web_search] → 3 more results
  [text] → "Based on my research..."

After merge:
  [ChainOfThought] → Plan with 3 steps, each with relevant search results attached
  [text] → "Based on my research..."
  [SourcesGroup] → All 8 sources at bottom
```

The matching heuristic: for each plan step, check if any search query contains words from the step label (words > 3 chars). If so, attach those search results to that step.

---

## 7. The Tool Registry Pattern

### How It Works

```typescript
// tool-registry.tsx
const defaultRenderers: Record<string, ToolRenderer> = {
  web_search: WebSearchEnhanced,
  shell_exec: TerminalOutputEnhanced,
  browser_navigate: BrowserViewerEnhanced,
  file_read: FilePreview,
  show_plan: ShowPlanRenderer,
  generate_image: ImageResult,
  deploy_expose_port: DeployResult,
  // ... all mappings
  "*": GenericTool,  // fallback
};

// Provided via React context
<ToolRegistry customRenderers={{}}>
  {children}
</ToolRegistry>

// Consumed by ToolPart
const { getRenderer } = useToolRegistry();
const Renderer = getRenderer(toolName);
```

### ToolPart Decision Logic

```typescript
// tool-part.tsx
function ToolPart({ part, onApproval, variant = "auto" }) {
  const toolName = getToolName(part);

  // 1. Compact tools → inline pill
  if (COMPACT_TOOLS.has(toolName)) {
    return <ToolCompact toolName={toolName} state={part.state} />;
  }

  // 2. Standalone tools → no wrapper
  if (STANDALONE_TOOLS.has(toolName)) {
    return <StandaloneRenderer toolName={toolName} input={part.input} output={part.output} state={part.state} />;
  }

  // 3. Everything else → ToolCard wrapper
  return (
    <ToolCard part={part} onApproval={onApproval}>
      <ToolRenderer toolName={toolName} input={part.input} output={part.output} state={part.state} />
    </ToolCard>
  );
}
```

### ToolCard Wrapper

`ToolCard` provides:
- Collapsible header with tool icon, name, and status badge
- Loading shimmer during `input-streaming`
- Approval UI during `approval-requested`
- Error display during `output-error`
- The specific renderer as children

---

## 8. Every Tool — Complete Rendering Map

### Category 1: Planning (1 tool)

| Tool | Chat Renderer | Canvas View | Rendering Mode | State Connection |
|------|--------------|-------------|----------------|-----------------|
| `show_plan` | `ShowPlanRenderer` → `ChainOfThought` | None | **Standalone** (no ToolCard) | `agentWorkspace.isPlannerExpanded` |

**How it renders in chat:**
- `ShowPlanRenderer` maps `todos[]` to `ChainOfThoughtStep[]`
- Each todo gets a status icon (check/dot/circle)
- Search results from merged web_search tools appear as favicon pills under relevant steps
- The whole thing is collapsible with a header showing completion count

**How it renders in the merged ChainOfThought:**
- `MessageRenderer` detects `show_plan` + `web_search` in the same message
- Builds enriched steps with search results attached
- Renders one `ChainOfThought` component instead of separate tool cards
- All merged tool IDs are skipped in the normal rendering loop

### Category 2: Communication (2 tools)

| Tool | Chat Renderer | Canvas View | Rendering Mode |
|------|--------------|-------------|----------------|
| `message_notify_user` | `ProgressTool` | None | **Compact** (pill) |
| `message_ask_user` | `ProgressTool` | None | **Compact** (pill) |

**How they render:**
- `ToolCompact` shows a small inline pill with the tool name and status
- `getCompactSummary()` extracts the message text from input/output
- No canvas view — these are chat-only interactions

### Category 3: File System (5 tools)

| Tool | Chat Renderer | Canvas View | Rendering Mode |
|------|--------------|-------------|----------------|
| `file_read` | `FilePreview` | `CodeView` | ToolCard |
| `file_write` | `FilePreview` | `CodeView` | ToolCard |
| `file_str_replace` | `FilePreview` | `CodeView` | ToolCard |
| `file_find_in_content` | `FilePreview` | `CodeView` | ToolCard |
| `file_find_by_name` | `FilePreview` | `CodeView` | ToolCard |

**Chat rendering:**
- `FilePreview` shows the file path, a snippet of content, and syntax highlighting
- During `input-streaming`: shows file path being typed
- During `output-available`: shows file content with line numbers

**Canvas rendering (via useCanvas):**
- `TOOL_VIEW_MAP["file_read"] = "code"` → switches canvas to `CodeView`
- `useCanvas` accumulates file contents in `fileContents` state (persists across calls)
- Builds `fileTree` from all accumulated file paths
- Shows `fileTabs` for all opened files
- Active file gets syntax highlighting via `getLanguage(path)`

### Category 4: Shell Sessions (5 tools)

| Tool | Chat Renderer | Canvas View | Rendering Mode |
|------|--------------|-------------|----------------|
| `shell_exec` | `TerminalOutputEnhanced` | `TerminalView` | ToolCard |
| `shell_view` | `TerminalOutputEnhanced` | `TerminalView` | ToolCard |
| `shell_wait` | `TerminalOutputEnhanced` | `TerminalView` | ToolCard |
| `shell_write_to_process` | `TerminalOutputEnhanced` | `TerminalView` | ToolCard |
| `shell_kill_process` | `TerminalOutputEnhanced` | `TerminalView` | ToolCard |

**Chat rendering:**
- Shows command in monospace font
- ANSI color support in output
- Collapsible long output
- During `input-streaming`: shows command being typed with cursor animation

**Canvas rendering (via useCanvas):**
- `TOOL_VIEW_MAP["shell_exec"] = "terminal"` → switches canvas to `TerminalView`
- `useCanvas` accumulates terminal history in `terminalHistory` state
- Each `shell_exec` with `output-available` appends `$ command` + output lines
- Terminal view shows full scrollable history

### Category 5: Code Execution (1 tool)

| Tool | Chat Renderer | Canvas View | Rendering Mode |
|------|--------------|-------------|----------------|
| `code_execute` | `CodeBlockEnhanced` | `TerminalView` | ToolCard |

**Chat rendering:**
- Shows code with syntax highlighting (Python/JS/Bash)
- Line numbers
- Copy button
- Output section below code

**Canvas rendering:**
- Maps to `"terminal"` view (same as shell)
- Shows execution output in terminal

### Category 6: Web Search (1 tool)

| Tool | Chat Renderer | Canvas View | Rendering Mode |
|------|--------------|-------------|----------------|
| `web_search` | `WebSearchEnhanced` | `BrowserView` | ToolCard (or merged into ChainOfThought) |

**Chat rendering (standalone):**
- Animated search progress during loading
- Expandable result cards with favicon, title, snippet, domain
- Score badges for high-relevance results
- Copy citation button per result
- Related searches pills
- Quick answer snippet if available

**Chat rendering (merged with plan):**
- Search results appear as favicon pills under the relevant plan step
- The WebSearchEnhanced card is **not** rendered separately
- Sources are collected and shown in `SourcesGroup` at bottom

**Canvas rendering:**
- `TOOL_VIEW_MAP["web_search"] = "browser"` → switches canvas to `BrowserView`
- Shows search results in the browser panel

### Category 7: Browser Interactive (13 tools)

| Tool | Chat Renderer | Canvas View | Rendering Mode |
|------|--------------|-------------|----------------|
| `browser_navigate` | `BrowserViewerEnhanced` | `BrowserView` | ToolCard |
| `browser_view` | `BrowserViewerEnhanced` | `BrowserView` | ToolCard |
| `browser_click` | `BrowserViewerEnhanced` | `BrowserView` | ToolCard |
| `browser_input` | `BrowserViewerEnhanced` | `BrowserView` | ToolCard |
| `browser_scroll` / `_up` / `_down` | `BrowserViewerEnhanced` | `BrowserView` | ToolCard |
| `browser_move_mouse` | `BrowserViewerEnhanced` | `BrowserView` | ToolCard |
| `browser_press_key` | `BrowserViewerEnhanced` | `BrowserView` | ToolCard |
| `browser_select_option` | `BrowserViewerEnhanced` | `BrowserView` | ToolCard |
| `browser_console_exec` / `_view` | `BrowserViewerEnhanced` | `BrowserView` | ToolCard |
| `browser_screenshot` | `BrowserViewerEnhanced` | `BrowserView` | ToolCard |
| `browser_restart` | `BrowserViewerEnhanced` | `BrowserView` | ToolCard |

**Chat rendering:**
- Shows a compact card with the action description (e.g., "Navigating to google.com")
- Screenshot thumbnail if available
- Zoom and fullscreen buttons

**Canvas rendering (via useCanvas):**
- All browser tools map to `"browser"` view
- `useCanvas` maintains **persistent** browser state:
  - `browserUrl` — survives across non-navigate calls
  - `browserScreenshot` — updates when new screenshot arrives
  - `browserContent` — page text content
  - `browserTitle` — page title
  - `browserHistory` + `historyIndex` — back/forward navigation
- `BrowserView` shows:
  - URL bar with back/forward/refresh buttons
  - Screenshot image (or loading skeleton)
  - Optional search results overlay
  - Sandbox ID for direct E2B control

### Category 8: Deployment (2 tools)

| Tool | Chat Renderer | Canvas View | Rendering Mode |
|------|--------------|-------------|----------------|
| `deploy_expose_port` | `DeployResult` | `BrowserView` | ToolCard |
| `deploy_apply_deployment` | `DeployResult` | `BrowserView` | ToolCard |

**Chat rendering:**
- Shows deployment URL as clickable link
- Status indicator (deploying/deployed/failed)

**Canvas rendering:**
- Maps to `"browser"` view → shows the deployed URL in browser

### Category 9: Image Generation (1 tool)

| Tool | Chat Renderer | Canvas View | Rendering Mode |
|------|--------------|-------------|----------------|
| `generate_image` | `ImageResult` | None (could be `filePreview`) | ToolCard |

**Chat rendering:**
- Shows generated image with loading skeleton during generation
- Full image preview on completion

### Category 10: Scheduling (1 tool)

| Tool | Chat Renderer | Canvas View | Rendering Mode |
|------|--------------|-------------|----------------|
| `schedule_recurring_task` | `ProgressTool` | None | ToolCard |

### Category 11: Analytics (1 tool)

| Tool | Chat Renderer | Canvas View | Rendering Mode |
|------|--------------|-------------|----------------|
| `check_outcomes` | `ProgressTool` | None | ToolCard |

### Category 12: Dynamic Tools

| Pattern | Chat Renderer | Canvas View | Rendering Mode |
|---------|--------------|-------------|----------------|
| `app_{appName}_{action}` | `GenericTool` (fallback) | None | ToolCard |
| `device_{deviceId}_command` | `GenericTool` (fallback) | None | ToolCard |

---

## 9. The Canvas System — useCanvas Hook

### How useCanvas Works (Step by Step)

```typescript
function useCanvas(messages: UIMessage[]): CanvasState {
  // 1. Persistent state (survives across tool calls)
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [browserUrl, setBrowserUrl] = useState<string>();
  const [browserScreenshot, setBrowserScreenshot] = useState<string>();
  const [browserHistory, setBrowserHistory] = useState<string[]>([]);
  const [sandboxId, setSandboxId] = useState<string>();

  // 2. Find latest tool (useMemo, scans messages backwards)
  const { latestTool, totalToolCalls } = useMemo(() => {
    // Walk messages backwards → walk parts backwards
    // Find first tool part that maps to a canvas view
    // Return: { toolName, args, output, viewType, currentAction, isWorking, state }
  }, [messages]);

  // 3. Side effects: accumulate data from tool results
  useEffect(() => {
    // shell_exec → append to terminalHistory
  }, [latestTool?.toolCallId, latestTool?.state]);

  useEffect(() => {
    // file_read/file_write → update fileContents
  }, [latestTool?.toolCallId, latestTool?.state]);

  useEffect(() => {
    // browser_* → update browserUrl, browserScreenshot, browserHistory
  }, [latestTool?.toolCallId, latestTool?.state]);

  // 4. Build and return CanvasState
  return {
    isVisible: !!latestTool,
    viewType: latestTool?.viewType ?? "empty",
    isWorking: latestTool?.isWorking ?? false,
    browserUrl, browserScreenshot, // ... all persistent state
    terminalOutput: terminalHistory,
    fileTree: buildFileTree(Object.keys(fileContents)),
    // ... etc
  };
}
```

### TOOL_VIEW_MAP — Complete Mapping

```typescript
const TOOL_VIEW_MAP: Record<string, CanvasViewType> = {
  // Browser tools → "browser"
  browser_navigate: "browser",
  browser_view: "browser",
  browser_click: "browser",
  browser_input: "browser",
  browser_scroll: "browser",
  browser_scroll_up: "browser",
  browser_scroll_down: "browser",
  browser_move_mouse: "browser",
  browser_key_press: "browser",
  browser_press_key: "browser",
  browser_select_option: "browser",
  browser_console_exec: "browser",
  browser_console_view: "browser",
  browser_screenshot: "browser",
  browser_restart: "browser",

  // Shell tools → "terminal"
  shell_exec: "terminal",
  shell_view: "terminal",
  shell_wait: "terminal",
  shell_write_to_process: "terminal",
  shell_kill_process: "terminal",

  // File tools → "code"
  file_read: "code",
  file_write: "code",
  file_str_replace: "code",
  file_find_in_content: "code",
  file_find_by_name: "code",

  // Code execution → "terminal"
  code_execute: "terminal",

  // Search → "browser"
  info_search_web: "browser",
  web_search: "browser",
  search_web: "browser",

  // Deploy → "browser"
  deploy_expose_port: "browser",
  deploy_apply_deployment: "browser",

  // Manus page → "browser"
  make_manus_page: "browser",
};
```

### TOOL_ACTION_MAP — Action Labels

Each tool generates a human-readable action label for the canvas status bar:

```typescript
const TOOL_ACTION_MAP = {
  browser_navigate: (args) => ({ type: "browsing", label: `Browsing ${hostname(args.url)}` }),
  shell_exec: (args) => ({ type: "typing", label: `Running ${args.command.split(" ")[0]}` }),
  file_read: (args) => ({ type: "reading", label: `Reading ${fileName(args.path)}` }),
  file_write: (args) => ({ type: "editing", label: `Writing ${fileName(args.path)}` }),
  web_search: (args) => ({ type: "searching", label: `Searching "${truncate(args.query)}"` }),
  // ... etc
};
```

### Canvas Data Persistence

**Critical**: The canvas maintains persistent state across tool calls. This means:

- **Terminal history** accumulates — every `shell_exec` result appends to the terminal
- **File contents** accumulate — every `file_read`/`file_write` adds to the file map
- **Browser state** persists — URL and screenshot survive across `browser_click`, `browser_scroll`, etc.
- **Browser history** tracks — enables back/forward navigation

This persistence is managed via `useState` + `useEffect` with deps on `latestTool?.toolCallId` and `latestTool?.state` (primitives to avoid infinite loops).

---

## 10. The Plan + Search Merge (Chain of Thought)

This is the most complex rendering logic in the system. Here's exactly how it works:

### Step 1: Collection

```typescript
// In MessageRenderer useMemo:
for (const part of parts) {
  if (isPlanTool(part)) → planParts.push({ index, data, toolCallId })
  if (isSearchTool(part)) → searchParts.push({ index, data, toolCallId })
  if (isSourceUrl(part)) → collectedSources.push(part)
  if (isBrowserTool(part) && hasUrlAndTitle) → collectedSources.push(synthetic source)
}
```

### Step 2: Build Enriched Steps

```typescript
const latestPlan = planParts[planParts.length - 1]; // Use latest plan
const steps = latestPlan.todos.map(todo => {
  const step = { id: todo.id, label: todo.label, status: normalize(todo.status) };
  
  // Find relevant search results
  const labelWords = todo.label.split(/\s+/).filter(w => w.length > 3);
  for (const search of searchParts) {
    const query = search.data.query;
    if (labelWords.some(w => query.includes(w))) {
      step.searchResults = search.data.results.slice(0, 6);
      mergedIds.add(search.toolCallId); // Mark as merged
    }
  }
  return step;
});

// Unmatched searches → attach to first active/complete step
```

### Step 3: Render

```typescript
// In JSX loop:
if (mergedToolIds.has(toolCallId)) {
  if (!chainRendered && isPlanTool) {
    chainRendered = true;
    return <ChainOfThought steps={steps} title={title} />;
  }
  return null; // Skip merged tools
}
// Non-merged tools render normally
```

### Visual Result

```
┌─────────────────────────────────────────────┐
│ 🔍 Research best Jeeps 2026                 │
│ ─────────────────────────────── 2/3         │
│                                             │
│ ✅ Search for 2026 Jeep lineup              │
│    [motortrend.com] [truecar.com] [cdjr.com]│
│                                             │
│ ✅ Compare specifications and pricing        │
│    [edmunds.com] [jeep.com]                 │
│                                             │
│ ⏳ Compile findings into report              │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 11. Redux State — Every Slice Connected

### Which slices matter for chat rendering:

| Slice | Fields Used | Connected To |
|-------|------------|-------------|
| `chat` | `files`, `taskMode`, `inputMode` | `UnifiedPrompt` (input area) |
| `sessions` | `currentSessionId`, `sessions.entities[id]` | `ChatClient` (session routing) |
| `websocket` | `status`, `taskFinished`, `isVNCConnected` | `ChatClient` (connection state) |
| `agentWorkspace` | `sidebarType`, `isPlannerExpanded`, `isSidebarPreviewFullscreen` | `useCanvasPanel`, `AgentCanvas` |
| `codeViewer` | `fileTabList`, `activeTabId`, `fileDataSource` | `CodeView` in canvas |
| `webDev` | `isFullscreenMode`, `activeTab`, `preview` | `WebDevIDEView` in canvas |
| `ui` | `isMobile`, `chatSidebarWidth` | `ChatLayout` (responsive) |
| `timeline` | `percentage`, `segmentEventsMap` | `TimelineScrubber` in canvas |
| `fileManagement` | `sessionFileList` | `FileManagementPanel` |

### State Flow Diagram

```
User types message
  ↓
UnifiedPrompt.onSubmit(text)
  ↓
ChatClient.handleSendMessage(text)
  ↓
useChatSession.sendMessage(text, { body: { chatId } })
  ↓
useChat.sdkSendMessage({ text }, { body })
  ↓
DefaultChatTransport → POST /api/chat
  ↓
Backend streamText() → SSE stream
  ↓
useChat parses stream → updates messages[]
  ↓
├── ChatMessages re-renders (messages prop)
│   ├── MessageRenderer iterates parts[]
│   │   ├── TextPartRenderer
│   │   ├── ReasoningPartRenderer
│   │   ├── ChainOfThought (merged plan+search)
│   │   ├── ToolPart → ToolCard → specific renderer
│   │   └── SourcesGroup
│   └── ThinkingIndicator (during streaming)
│
├── useCanvas(messages) re-computes
│   ├── Finds latest tool → determines viewType
│   ├── Accumulates terminal/file/browser state
│   └── Returns CanvasState
│       ↓
│       AgentCanvas renders the right view
│
└── onFinish callback
    ├── dispatch(setReduxMessages({ sessionId, messages }))
    └── dispatch(updateSession({ id, updates: { updatedAt } }))
```

### agentWorkspace.sidebarType — The Canvas Driver

This Redux field is the **bridge** between the chat and canvas:

```typescript
// Current values:
type SidebarType = null | "browser" | "code" | "terminal" | "preview" | "image" | "slides" | "webDevIDE" | "mapReduce";
```

However, in the current codebase, the canvas is primarily driven by `useCanvas()` hook (which reads from `messages[]` directly), not from Redux. The Redux `sidebarType` is used for:
- Manual canvas open/close by user
- Persisting canvas state across navigation
- Mobile sidebar visibility

### Key State Connections Missing / To Add

Based on the current codebase analysis, these connections need attention:

1. **`agentWorkspace.isPlannerExpanded`** — Should control whether `PlanWindow` in the activity tracker is expanded/collapsed. Currently the `PlanWindow` manages its own local state.

2. **`timeline.percentage`** — Should drive the `TimelineScrubber` in canvas. Currently `useCanvas` computes `timelinePercentage` from tool completion, but doesn't read from Redux.

3. **`codeViewer.fileTabList`** / `codeViewer.activeTabId` — Should sync with `useCanvas`'s `fileTabs` and active file. Currently `useCanvas` maintains its own file state.

4. **`webDev.preview`** — Should provide the preview URL for `WebDevIDEView`. Currently not connected.

5. **`websocket.isVNCConnected`** — Should enable/disable direct sandbox interaction in `BrowserView`. Currently checked but not fully wired.

---

## 12. Component Hierarchy — Full Tree

```
ChatClient
├── ChatHeader
│   ├── SessionTitle
│   ├── CollaboratePopover
│   ├── SharePopover
│   └── FileManagement toggle
│
├── ChatLayout (split panel)
│   ├── [left] ChatMessages
│   │   ├── MessageList
│   │   │   ├── UserMessage (for role="user")
│   │   │   │   └── AttachmentsGrid
│   │   │   │
│   │   │   └── AssistantMessage (for role="assistant")
│   │   │       ├── MessageRenderer ← THE MASTER RENDERER
│   │   │       │   ├── TextPartRenderer (markdown)
│   │   │       │   ├── ReasoningPartRenderer (collapsible)
│   │   │       │   ├── ChainOfThought (merged plan+search)
│   │   │       │   │   └── StepItem (with search result pills)
│   │   │       │   ├── ToolPart
│   │   │       │   │   ├── ToolCompact (pill for notify/ask)
│   │   │       │   │   ├── ShowPlanRenderer → ChainOfThought (standalone)
│   │   │       │   │   └── ToolCard (collapsible wrapper)
│   │   │       │   │       ├── WebSearchEnhanced
│   │   │       │   │       ├── TerminalOutputEnhanced
│   │   │       │   │       ├── CodeBlockEnhanced
│   │   │       │   │       ├── BrowserViewerEnhanced
│   │   │       │   │       ├── FilePreview
│   │   │       │   │       ├── ImageResult
│   │   │       │   │       ├── DeployResult
│   │   │       │   │       ├── ProgressTool
│   │   │       │   │       ├── PlanToolEnhanced
│   │   │       │   │       └── GenericTool (fallback)
│   │   │       │   └── SourcesGroup (at bottom)
│   │   │       │
│   │   │       └── Action toolbar (copy, regenerate, like, dislike)
│   │   │
│   │   ├── ThinkingIndicator (during streaming)
│   │   ├── Suggestions (after response)
│   │   └── ScrollToBottom
│   │
│   ├── [right] AgentCanvas (when visible)
│   │   ├── Header (view type label + action badge + fullscreen/close)
│   │   ├── Content
│   │   │   ├── BrowserView (URL bar + screenshot + nav)
│   │   │   ├── CodeView (file tree + tabs + editor)
│   │   │   ├── TerminalView (scrollable output)
│   │   │   ├── FilePreviewView (image/pdf/markdown)
│   │   │   ├── SlidesView (slide deck)
│   │   │   ├── AICanvasView (drawing)
│   │   │   ├── WebDevIDEView (full IDE)
│   │   │   ├── MapReduceView (parallel grid)
│   │   │   └── EmptyView (placeholder)
│   │   ├── TimelineScrubber
│   │   └── StatusBar (working indicator + step counter + action label)
│   │
│   └── [right] FileManagementPanel (when open)
│
├── UnifiedPrompt (pinned to bottom)
│   ├── AnimatedPlaceholder
│   ├── PromptInput (textarea)
│   ├── AttachmentRow
│   ├── QuickActions
│   ├── FilesButton
│   ├── SkillsButton
│   ├── ConnectorsButton
│   └── VoiceInputButton
│
└── AgentActivityTracker (floating)
    └── PlanWindow (collapsible plan progress)
```

---

## 13. Elements AI Component Mapping

### Direct Replacements

| Your Component | Elements AI Equivalent | Install Command |
|---------------|----------------------|-----------------|
| `TextPartRenderer` | `<Message>` with markdown | `npx ai-elements add message` |
| `ReasoningPartRenderer` | `<Reasoning>` | `npx ai-elements add reasoning` |
| `ChainOfThought` | `<Plan>` + `<Task>` | `npx ai-elements add plan` |
| `PlanDisplay` | `<Plan>` | `npx ai-elements add plan` |
| `PlanWindow` | `<Plan>` (standalone) | `npx ai-elements add plan` |
| `SourcesGroup` | `<Sources>` | `npx ai-elements add sources` |
| `ToolCard` | `<Tool>` | `npx ai-elements add tool` |
| `ToolCompact` | `<Tool>` with compact variant | `npx ai-elements add tool` |
| `WebSearchEnhanced` | `<Sources>` + custom results | `npx ai-elements add sources` |
| `TerminalOutputEnhanced` | `<Terminal>` | `npx ai-elements add terminal` |
| `CodeBlockEnhanced` | `<CodeBlock>` | `npx ai-elements add code-block` |
| `BrowserViewerEnhanced` | `<WebPreview>` | `npx ai-elements add web-preview` |
| `FilePreview` | `<FileTree>` + `<CodeBlock>` | `npx ai-elements add file-tree code-block` |
| `ImageResult` | `<Image>` | `npx ai-elements add image` |
| `ApprovalCard` | `<Confirmation>` | `npx ai-elements add confirmation` |
| `Suggestions` | `<Suggestion>` | `npx ai-elements add suggestion` |
| `AgentCanvas` | `<Sandbox>` | `npx ai-elements add sandbox` |
| `AssistantMessage` | `<Message>` | `npx ai-elements add message` |
| `ChatMessages` | `<Conversation>` | `npx ai-elements add conversation` |
| `UnifiedPrompt` | `<PromptInput>` | `npx ai-elements add prompt-input` |

### Components to Keep Custom

| Component | Reason |
|-----------|--------|
| `ChatLayout` | Split panel layout is app-specific |
| `ChatHeader` | App-specific navigation/collaboration |
| `AgentActivityTracker` | Floating overlay is custom UX |
| `FileManagementPanel` | App-specific file management |
| `DeployResult` | No Elements AI equivalent |
| `ProgressTool` | Custom progress indicator |
| `GenericTool` | Fallback JSON display |

---

## 14. Refactoring Checklist

### Phase 1: Install Elements AI Components

```bash
npx ai-elements add message reasoning plan sources tool terminal code-block web-preview file-tree image confirmation suggestion sandbox prompt-input conversation
```

### Phase 2: Replace Part Renderers

1. **TextPartRenderer** → Use `<Message>` from Elements AI with markdown rendering
2. **ReasoningPartRenderer** → Replace with `<Reasoning>` component
3. **SourcesGroup** → Replace with `<Sources>` component
4. **Suggestions** → Replace with `<Suggestion>` component

### Phase 3: Replace Tool Renderers

1. **ToolCard** → Replace with `<Tool>` wrapper from Elements AI
2. **TerminalOutputEnhanced** → Replace with `<Terminal>` component
3. **CodeBlockEnhanced** → Replace with `<CodeBlock>` component
4. **BrowserViewerEnhanced** → Replace with `<WebPreview>` component
5. **ApprovalCard** → Replace with `<Confirmation>` component

### Phase 4: Replace Canvas

1. **AgentCanvas** → Replace with `<Sandbox>` component from Elements AI
2. Keep `useCanvas` hook logic but output to Elements AI components
3. Map `CanvasViewType` to Elements AI view components

### Phase 5: Replace Layout Components

1. **ChatMessages** → Wrap with `<Conversation>` component
2. **UnifiedPrompt** → Replace with `<PromptInput>` component
3. Keep `ChatLayout` as custom split panel

### Phase 6: Preserve Custom Styling

Apply your existing Tailwind classes on top of Elements AI components:
- Use `className` prop on all Elements AI components
- Keep your color scheme (`canvas-bg`, `canvas-header`, `canvas-surface`, `canvas-deep`)
- Keep your animation classes (`shimmer`, `fade-in-up`, `spring-bounce`)

### Phase 7: State Connections

1. Keep `useChatSession` hook as-is (it wraps `useChat` correctly)
2. Keep `useCanvas` hook as-is (it reads from `messages[]` correctly)
3. Connect `agentWorkspace.isPlannerExpanded` to `PlanWindow` collapse state
4. Connect `timeline.percentage` to `TimelineScrubber`
5. Sync `codeViewer` Redux state with `useCanvas` file state

---

## 15. Testing Strategy

### Unit Tests

| Component | Test |
|-----------|------|
| `MessageRenderer` | Render message with text + tool + sources → verify all parts appear |
| `MessageRenderer` | Render message with plan + search → verify ChainOfThought merge |
| `ToolPart` | Render standalone tool → verify no ToolCard wrapper |
| `ToolPart` | Render compact tool → verify ToolCompact pill |
| `ToolPart` | Render approval-requested → verify ApprovalCard |
| `useCanvas` | Pass messages with browser tool → verify viewType is "browser" |
| `useCanvas` | Pass messages with shell_exec → verify terminal history accumulates |
| `useCanvas` | Pass messages with file_read → verify file contents accumulate |

### Integration Tests

| Scenario | Steps | Expected |
|----------|-------|----------|
| Simple text response | Send message → receive text | Text renders in chat, no canvas |
| Search + plan | Send research request | ChainOfThought renders with search results, sources at bottom |
| Browser navigation | Agent navigates to URL | BrowserViewerEnhanced in chat, BrowserView in canvas with screenshot |
| File editing | Agent writes file | FilePreview in chat, CodeView in canvas with file tree |
| Shell execution | Agent runs command | TerminalOutputEnhanced in chat, TerminalView in canvas with history |
| Multi-step | Agent does search → browse → write | Canvas switches views, chat shows all tool cards |
| Approval flow | Agent requests approval | ApprovalCard appears, buttons work, tool continues after approval |

### E2E Tests

| Flow | Verify |
|------|--------|
| Full research task | Plan appears → searches execute → sources collect → report generated |
| Code generation | Files created → terminal commands run → deployment succeeds |
| Browser automation | Navigation → clicking → form filling → screenshot capture |

---

## Appendix A: File-to-Component Map

| File | Component | Role |
|------|-----------|------|
| `chat-client.tsx` | `ChatClient` | Top-level orchestrator |
| `use-chat-session.ts` | `useChatSession` | AI SDK `useChat` wrapper |
| `use-canvas.ts` | `useCanvas` | Canvas state from messages |
| `use-canvas-panel.ts` | `useCanvasPanel` | Canvas visibility/fullscreen |
| `message-renderer.tsx` | `MessageRenderer` | Master part renderer with merge logic |
| `tool-registry.tsx` | `ToolRegistry` | Tool name → renderer mapping |
| `tool-part.tsx` | `ToolPart` | Tool rendering decision (standalone/compact/card) |
| `tool-card.tsx` | `ToolCard` | Collapsible tool wrapper |
| `tool-compact.tsx` | `ToolCompact` | Inline pill for compact tools |
| `chain-of-thought.tsx` | `ChainOfThought` | Merged plan+search timeline |
| `plan-display.tsx` | `PlanDisplay` | Standalone plan progress |
| `plan-window.tsx` | `PlanWindow` | Floating plan with animations |
| `show-plan.tsx` | `ShowPlanRenderer` | Tool renderer for show_plan |
| `web-search-enhanced.tsx` | `WebSearchEnhanced` | Search results with expand/cite |
| `terminal-output-enhanced.tsx` | `TerminalOutputEnhanced` | Terminal with ANSI colors |
| `code-block-enhanced.tsx` | `CodeBlockEnhanced` | Code with syntax highlighting |
| `browser-viewer-enhanced.tsx` | `BrowserViewerEnhanced` | Browser screenshot viewer |
| `file-preview.tsx` | `FilePreview` | File content preview |
| `image-result.tsx` | `ImageResult` | Generated image display |
| `deploy-result.tsx` | `DeployResult` | Deployment URL/status |
| `approval-card.tsx` | `ApprovalCard` | User approval UI |
| `agent-canvas.tsx` | `AgentCanvas` | Canvas container + view switching |
| `browser-view.tsx` | `BrowserView` | Canvas browser panel |
| `code-view.tsx` | `CodeView` | Canvas code editor panel |
| `terminal-view.tsx` | `TerminalView` | Canvas terminal panel |
| `assistant-message.tsx` | `AssistantMessage` | Message wrapper with actions |
| `sources-group.tsx` | `SourcesGroup` | Grouped source citations |
| `suggestions.tsx` | `Suggestions` | Follow-up suggestion pills |
| `reasoning-part.tsx` | `ReasoningPart` | Collapsible reasoning display |
| `text-part.tsx` | `TextPart` | Markdown text rendering |
| `agent-activity-tracker.tsx` | `AgentActivityTracker` | Floating progress overlay |

---

## Appendix B: Elements AI Install Commands

```bash
# Core chat components
npx ai-elements add conversation message prompt-input suggestion

# Part renderers
npx ai-elements add reasoning plan sources

# Tool renderers
npx ai-elements add tool terminal code-block web-preview file-tree image confirmation

# Canvas
npx ai-elements add sandbox

# Optional
npx ai-elements add artifact canvas
```

---

## Appendix C: Key Patterns to Preserve

### 1. The Merge Pattern
Always merge `show_plan` + `web_search` into `ChainOfThought`. This is the signature UX.

### 2. The Dual Render Pattern
Every tool renders in both chat (compact) and canvas (full). The `useCanvas` hook drives the canvas independently.

### 3. The Persistent State Pattern
Canvas state (terminal history, file contents, browser state) persists across tool calls. Never reset on new tool invocation.

### 4. The Registry Pattern
Tool renderers are registered in a context provider. Custom renderers can override defaults.

### 5. The Three-Variant Pattern
Tools render as standalone (no wrapper), compact (pill), or expanded (ToolCard wrapper).

### 6. The Source Collection Pattern
Sources are collected from: native source parts, search results, and browser outputs. All rendered in one `SourcesGroup` at the bottom.
