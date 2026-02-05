# Chat System - Complete Build Instructions

## Current State

### Working Infrastructure

1. **API Route** (`apps/app/app/api/chat/route.ts`, 51 lines) — Accepts POST with messages, calls `streamText()`, returns text stream. System prompt: "You are Rubic, a helpful AI assistant."

2. **Chat Page Client** (`apps/app/app/(authenticated)/chat/[id]/chat-page-client.tsx`, 327 lines) — Uses `useRealTimeChat` hook, integrates Redux, WebSocket room management, renders ChatContainer + MessageList + ChatComposer + AgentDagPanel.

3. **Chat Slice** (`apps/app/lib/store/slices/chat.slice.ts`, 475 lines) — Full state: messages, streaming, taskMode, inputMode, files, dataVisualization, typingUsers.

4. **WebSocket Provider** (`apps/app/lib/socket/provider.tsx`, 295 lines) — Handles message:new, message:stream, agent:created, agent:update, agent:task:new, session:new, file:new events.

5. **Messages Router** (`apps/app/lib/trpc/routers/messages.router.ts`, 103 lines) — list, send (has TODO for AI trigger), add.

6. **AI Components** (`packages/ai/components/`) — Chat container, message list, message items, streaming indicator, chat composer, agent DAG panel, tool card, tool registry, 10+ tool renderers.

7. **Agent Service** (`services/agent/src/`, Python FastAPI) — Basic LLM streaming for Anthropic/OpenAI. **No tool loop, no conversation history, no tool execution.**

8. **Socket Events** (`apps/app/lib/socket/events.ts`, 168 lines) — Comprehensive event types for messages, agents, sessions, files, devices, notifications.

### What's Broken / Missing

- Messages NOT persisted to DB (lost on refresh)
- No credit deduction after responses
- Agent service has no tool loop (can't use tools)
- No E2B sandbox integration for code execution
- No browser use integration
- No document rendering (PDF, Word, Excel)
- No progress/planning UI during task execution
- No Rubic Computer sidebar panel
- Toolbar actions are decorative

---

## What Needs Building

### 1. Message Persistence (CRITICAL — P0)

**Current:** Messages stream but are never saved to DB.
**Target:** Every message (user + assistant) persisted in `messages` table.

**Implementation:**

In `chat-page-client.tsx`, in the `onFinish` callback:

```typescript
const addMessage = api.messages.add.useMutation();

// After AI response completes:
onFinish: async (message) => {
  // Persist the assistant message
  await addMessage.mutateAsync({
    sessionId,
    role: "assistant",
    content: message.content,
    metadata: {
      model: selectedModel,
      tokenCount: message.usage?.totalTokens,
      toolCalls: message.toolCalls,
    },
  });
},
```

On page load, fetch existing messages:

```typescript
const { data: existingMessages } = api.messages.list.useQuery({ sessionId });
// Pass as initialMessages to useRealTimeChat
```

**Files to modify:**

- `apps/app/app/(authenticated)/chat/[id]/chat-page-client.tsx`
- `apps/app/app/(authenticated)/chat/[id]/page.tsx` — Server-side fetch
- `apps/app/lib/trpc/routers/messages.router.ts` — Add `bulkAdd` mutation

### 2. Credit Deduction (CRITICAL — P0)

After each AI response, calculate and deduct credits.

```typescript
// In onFinish callback after message persistence
const deductCredits = api.billing.recordUsage.useMutation();

await deductCredits.mutateAsync({
  type: "chat",
  amount: calculateCreditCost(message.usage),
  description: `Chat response (${selectedModel})`,
  metadata: { sessionId, model: selectedModel },
});
```

Credit costs (from VISION.md):

- Chat message: 1 credit
- Agent task: 5-50 credits (based on complexity)
- Code execution: 2 credits
- Image generation: 5 credits

### 3. Tool System — Agent Service Tool Loop (CRITICAL — P0)

The agent service (`services/agent/src/routes/completion.py`) needs a full tool loop:

```python
# Pseudocode for tool loop
while True:
    response = await llm.chat(messages, tools=available_tools)

    if response.stop_reason == "tool_use":
        tool_results = []
        for tool_call in response.tool_calls:
            result = await execute_tool(tool_call)
            tool_results.append(result)
            # Stream tool call + result to frontend via SSE
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool_call, 'result': result})}\n\n"

        messages.append(assistant_message)
        messages.append(tool_result_messages)
        continue  # Loop back to LLM with tool results

    else:  # stop_reason == "end_turn"
        yield f"data: {json.dumps({'type': 'text', 'content': response.text})}\n\n"
        break
```

**Available tools to implement:**

| Tool               | Service                | Purpose                        |
| ------------------ | ---------------------- | ------------------------------ |
| `web_search`       | Serper/Tavily API      | Search the web                 |
| `code_execution`   | E2B Sandbox            | Run code in sandboxed env      |
| `browser_use`      | Playwright/Browserbase | Browse websites                |
| `file_create`      | File Service           | Create files (PDF, docx, etc.) |
| `file_read`        | File Service           | Read uploaded files            |
| `composio_action`  | Connector Service      | Execute Composio app actions   |
| `device_command`   | Device Service         | Control devices                |
| `data_analysis`    | Python/E2B             | Analyze data, create charts    |
| `image_generation` | DALL-E API             | Generate images                |
| `create_document`  | File Service           | Create Word/PDF/Excel docs     |

### 4. Chat Tool Rendering (P0)

When the agent uses a tool, the frontend must render it properly.

**Tool renderers exist at** `packages/ai/components/tools/renderers/`:

- `code-block.tsx` — Syntax highlighted code
- `terminal-output.tsx` — Terminal with ANSI colors
- `file-preview.tsx` — File preview card
- `web-search.tsx` — Search results with links
- `approval-card.tsx` — Tool approval/rejection
- `progress-tracker.tsx` — Multi-step progress
- `plan-tool.tsx` — Planning steps
- `progress-tool.tsx` — Progress indicator
- `generic-tool.tsx` — Fallback

**New renderers to create:**

#### Document Renderer (`document-renderer.tsx`)

For AI-generated documents (PDF, Word, Excel, Markdown):

```tsx
<DocumentRenderer
  type="pdf" // or "docx", "xlsx", "md", "mdx", "code"
  content={documentContent}
  fileName="report.pdf"
  onDownload={() => downloadFile(url)}
  onOpenInViewer={() => openViewer(url)}
/>
```

- PDF: Embed `react-pdf` viewer
- Word/Excel: Show preview with download button
- Markdown/MDX: Render with `react-markdown` + syntax highlighting
- Code: Monaco editor read-only view

#### Website Preview (`website-preview.tsx`)

For AI-generated websites:

```tsx
<WebsitePreview
  url={previewUrl} // E2B sandbox URL
  screenshot={screenshotUrl}
  code={sourceCode}
  onOpenFull={() => openRubicComputer(url)}
/>
```

- Sandboxed iframe with zoom controls
- Toggle between preview and code view

#### Data Visualization (`chart-renderer.tsx`)

For data analysis results:

```tsx
<ChartRenderer
  type="bar" // or "line", "pie", "scatter", "table"
  data={chartData}
  options={chartOptions}
/>
```

Use Recharts (already common in Next.js).

#### Browser Use Viewer (`browser-viewer.tsx`)

For browser automation results:

```tsx
<BrowserViewer
  screenshots={screenshots} // Array of step screenshots
  currentUrl={currentUrl}
  steps={executionSteps}
/>
```

Show step-by-step browser screenshots with action descriptions.

### 5. Rubic Computer Panel (P1) — Manus-style Sidebar

When the AI performs complex tasks (code execution, website building, browser use), open a **Rubic Computer** panel that takes ~half the screen.

**Layout:**

```
┌──────────────────────┬──────────────────────┐
│                      │                      │
│   Chat Messages      │   Rubic Computer     │
│                      │                      │
│   [Message list]     │   [Tab: Browser]     │
│                      │   [Tab: Terminal]    │
│                      │   [Tab: Preview]     │
│                      │   [Tab: Files]       │
│                      │                      │
│   [Prompt input]     │   [Status bar]       │
└──────────────────────┴──────────────────────┘
```

**Tabs:**

1. **Browser** — Live browser view from browser-use (Playwright screenshots or live stream)
2. **Terminal** — Live terminal output from E2B sandbox (xterm.js)
3. **Preview** — Website preview iframe from E2B
4. **Files** — File tree showing generated files

**Implementation:**

```typescript
// In chat-page-client.tsx
const [computerOpen, setComputerOpen] = useState(false);
const [computerTab, setComputerTab] = useState<"browser" | "terminal" | "preview" | "files">(
  "terminal"
);

// Open computer when agent starts executing tools
useEffect(() => {
  if (agentStatus === "executing" && !computerOpen) {
    setComputerOpen(true);
  }
}, [agentStatus]);
```

Use `react-resizable-panels` for the split layout.

**Create:** `apps/app/app/(authenticated)/chat/[id]/components/rubic-computer.tsx`

### 6. Progress & Planning UI (P1)

When the AI plans and executes tasks, show progress in the chat.

**Planning Phase:**

```
┌─────────────────────────────────────┐
│ 📋 Planning: Build landing page     │
│                                     │
│ ✅ 1. Research design trends        │
│ ⏳ 2. Create HTML/CSS structure     │
│ ○  3. Add responsive design         │
│ ○  4. Deploy to preview             │
│                                     │
│ Step 2 of 4 • ~2 min remaining      │
└─────────────────────────────────────┘
```

Use existing `plan-tool.tsx` and `progress-tracker.tsx` renderers. Enhance with:

- Animated step transitions
- Time estimates
- Expandable step details
- Error recovery (retry failed steps)

**WebSocket events used:**

- `agent:task:new` — New step added
- `agent:task:update` — Step status changed
- `agent:update` — Overall progress percentage

### 7. Task Segmentation (P1)

Different task types should have different handling:

| Task Type            | Trigger Keywords              | Agent Behavior        | UI                         |
| -------------------- | ----------------------------- | --------------------- | -------------------------- |
| **Search**           | "search", "find", "look up"   | Web search tool       | Search results cards       |
| **Building**         | "build", "create website"     | E2B + code gen        | Rubic Computer (preview)   |
| **Analyzing**        | "analyze", "chart", "data"    | Code execution        | Charts + data tables       |
| **Scheduling**       | "schedule", "remind", "every" | Inngest task creation | Schedule confirmation card |
| **Commanding**       | "turn on", "set temperature"  | Device commands       | Device control card        |
| **Code Execution**   | "run", "execute", "code"      | E2B sandbox           | Terminal output            |
| **Website Showcase** | "show website", "preview"     | Browser screenshot    | Website preview panel      |
| **File Rendering**   | "create PDF", "generate doc"  | File service          | Document viewer            |

**Auto-detect task type from user message:**

```typescript
function detectTaskType(message: string): TaskType {
  const lower = message.toLowerCase();
  if (/search|find|look up|what is|who is/.test(lower)) return "search";
  if (/build|create.*website|landing page|web app/.test(lower)) return "building";
  if (/analyze|chart|graph|data|spreadsheet/.test(lower)) return "analyzing";
  if (/schedule|remind|every day|recurring|cron/.test(lower)) return "scheduling";
  if (/turn on|turn off|set.*temperature|device/.test(lower)) return "commanding";
  if (/run.*code|execute|python|javascript/.test(lower)) return "code_execution";
  if (/show.*website|preview|screenshot/.test(lower)) return "website_showcase";
  if (/create.*pdf|generate.*document|word|excel/.test(lower)) return "file_rendering";
  return "general";
}
```

Pass task type to agent service so it knows which tools to prioritize.

### 8. E2B Sandbox Integration (P1)

For code execution, use E2B sandbox service.

**Flow:**

1. Agent decides to execute code
2. Agent calls `code_execution` tool with code + language
3. Backend sends to sandbox service: `POST /sandboxes/:id/execute`
4. Sandbox service runs code in E2B
5. Results streamed back via WebSocket
6. Frontend renders in Terminal tab of Rubic Computer

**Frontend terminal** (in Rubic Computer):

```typescript
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";

// Connect terminal to WebSocket for live output
socket.on("sandbox:output", (data) => {
  terminal.write(data.output);
});
```

### 9. Browser Use Integration (P1)

For browsing the web in real-time.

**Flow:**

1. Agent decides to browse a URL
2. Agent calls `browser_use` tool
3. Backend uses Playwright (or Browserbase) to navigate
4. Screenshots sent via WebSocket
5. Frontend shows screenshots in Browser tab of Rubic Computer

**Browser panel:**

```tsx
<div className="flex flex-col h-full">
  <div className="flex items-center gap-2 px-3 py-2 border-b">
    <div className="flex-1 rounded bg-muted px-3 py-1 text-sm">{currentUrl}</div>
  </div>
  <div className="flex-1 overflow-auto">
    <img src={latestScreenshot} alt="Browser view" className="w-full" />
  </div>
  <div className="flex items-center gap-2 px-3 py-2 border-t text-xs text-muted-foreground">
    Step {currentStep} of {totalSteps} • {stepDescription}
  </div>
</div>
```

### 10. File Rendering in Chat (P1)

When AI generates files, render them inline:

**PDF:** Use `react-pdf` for inline viewing

```tsx
import { Document, Page } from "react-pdf";
<Document file={pdfUrl}>
  <Page pageNumber={1} />
</Document>;
```

**Word (.docx):** Use `mammoth` to convert to HTML, render inline

```typescript
import mammoth from "mammoth";
const result = await mammoth.convertToHtml({ arrayBuffer });
```

**Excel (.xlsx):** Use `xlsx` to parse, render as data table

```typescript
import * as XLSX from "xlsx";
const workbook = XLSX.read(data);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(sheet);
```

**Markdown/MDX:** Use `react-markdown` with `rehype-highlight`

**Code files:** Monaco editor in read-only mode with proper language detection

---

## Architecture

```
User sends message
  └── Dashboard: Create session → redirect → /chat/[id]?q=message
  └── Chat page: sendMessage() via useRealTimeChat

useRealTimeChat → POST /api/chat
  └── Vercel AI SDK streamText()
  └── Agent service (Python) receives request
      └── LLM generates response
      └── If tool_use → execute tool → loop back to LLM
      └── Stream chunks via SSE to frontend
  └── Frontend renders streamed content
  └── Tool calls rendered by tool-registry.tsx

onFinish callback:
  └── Persist messages to DB (messages.router.ts)
  └── Deduct credits (billing.router.ts)
  └── Sync to Redux state
  └── WebSocket broadcasts to other clients

WebSocket events:
  └── message:stream → Live streaming chunks
  └── agent:update → Agent status/progress
  └── agent:task:new → New planning step
  └── agent:task:update → Step completion
  └── file:new → Generated file available
  └── device:command:update → Device response
```

---

## Key File Paths

| Purpose            | Path                                                          |
| ------------------ | ------------------------------------------------------------- |
| Chat API route     | `apps/app/app/api/chat/route.ts`                              |
| Chat page          | `apps/app/app/(authenticated)/chat/[id]/page.tsx`             |
| Chat page client   | `apps/app/app/(authenticated)/chat/[id]/chat-page-client.tsx` |
| Chat slice         | `apps/app/lib/store/slices/chat.slice.ts`                     |
| Messages router    | `apps/app/lib/trpc/routers/messages.router.ts`                |
| Sessions router    | `apps/app/lib/trpc/routers/sessions.router.ts`                |
| Billing router     | `apps/app/lib/trpc/routers/billing.router.ts`                 |
| WebSocket provider | `apps/app/lib/socket/provider.tsx`                            |
| Socket events      | `apps/app/lib/socket/events.ts`                               |
| AI components      | `packages/ai/components/`                                     |
| Tool renderers     | `packages/ai/components/tools/renderers/`                     |
| Tool registry      | `packages/ai/components/tools/tool-registry.tsx`              |
| Agent DAG          | `packages/ai/components/agents/agent-dag-panel.tsx`           |
| Chat composer      | `packages/ai/components/input/chat-composer.tsx`              |
| Agent service      | `services/agent/src/routes/completion.py`                     |
| Sandbox service    | `services/sandbox/src/index.ts`                               |
| Gateway            | `services/gateway/src/index.ts`                               |
| Gateway proxy      | `services/gateway/src/routes/proxy.ts`                        |

---

## Components to Create

| Component               | Purpose                       | Path                                                           |
| ----------------------- | ----------------------------- | -------------------------------------------------------------- |
| `rubic-computer.tsx`    | Split-screen computer panel   | `chat/[id]/components/rubic-computer.tsx`                      |
| `browser-panel.tsx`     | Browser screenshots viewer    | `chat/[id]/components/browser-panel.tsx`                       |
| `terminal-panel.tsx`    | Live terminal via xterm.js    | `chat/[id]/components/terminal-panel.tsx`                      |
| `preview-panel.tsx`     | Website preview iframe        | `chat/[id]/components/preview-panel.tsx`                       |
| `files-panel.tsx`       | File tree for generated files | `chat/[id]/components/files-panel.tsx`                         |
| `document-renderer.tsx` | PDF/Word/Excel inline viewer  | `packages/ai/components/tools/renderers/document-renderer.tsx` |
| `website-preview.tsx`   | Website preview card          | `packages/ai/components/tools/renderers/website-preview.tsx`   |
| `chart-renderer.tsx`    | Data visualization            | `packages/ai/components/tools/renderers/chart-renderer.tsx`    |
| `browser-viewer.tsx`    | Browser use step viewer       | `packages/ai/components/tools/renderers/browser-viewer.tsx`    |
| `task-progress.tsx`     | Enhanced task progress        | `packages/ai/components/tools/renderers/task-progress.tsx`     |

---

## Testing

1. **Message persistence**: Send message → refresh page → messages still there
2. **Credit deduction**: Send message → credit balance decreases
3. **Tool rendering**: Agent uses web_search → search results rendered inline
4. **Code execution**: Agent writes code → terminal output shown
5. **Document generation**: "Create a PDF report" → PDF viewer rendered
6. **Planning UI**: Complex task → planning steps shown with progress
7. **Rubic Computer**: Code execution → splits screen → terminal visible
8. **Browser use**: "Go to example.com" → browser screenshots shown
9. **File creation**: Agent creates file → file card shown → downloadable
10. **Task segmentation**: Different prompts trigger different tool sets

## Priority Order

1. **P0**: Message persistence (data lost on refresh)
2. **P0**: Credit deduction (no billing without this)
3. **P0**: Agent service tool loop (no tools without this)
4. **P0**: Tool rendering in chat (existing renderers + wiring)
5. **P1**: Document renderer (PDF, Word, Excel, Markdown)
6. **P1**: Rubic Computer panel (split-screen)
7. **P1**: Progress/planning UI
8. **P1**: Task segmentation
9. **P1**: E2B sandbox integration
10. **P1**: Browser use integration
11. **P2**: Multi-model selector
12. **P2**: Conversation branching
13. **P2**: Export chat
