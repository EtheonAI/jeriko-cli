# Chat Page - Build Instructions

## Current State

The chat page has working AI streaming infrastructure. The key pieces are:

### Working Components

1. **API Route** (`apps/app/app/api/chat/route.ts`, 51 lines)

   - Accepts POST with `messages: UIMessage[]`
   - Sanitizes messages via `sanitizeMessages()` from `@repo/ai`
   - Converts to model messages via `aiConvertToModelMessages()`
   - Calls `streamText()` with `models.chat` (configured in `packages/ai/lib/models.ts`)
   - Returns `result.toTextStreamResponse()`
   - System prompt: "You are Rubic, a helpful AI assistant."

2. **Chat Page Client** (`apps/app/app/(authenticated)/chat/[id]/chat-page-client.tsx`, 327 lines)

   - Uses `useRealTimeChat` hook from `@repo/ai/hooks`
   - Integrates Redux via `useAppDispatch`/`useAppSelector` for state sync
   - Uses `useSocket()` for WebSocket room join/leave per session
   - Renders `ChatContainer`, `MessageList`, `ChatComposer`, `AgentDagPanel` from `@repo/ai/components`
   - Handles file attachments (`LocalAttachment` with `File` reference)
   - Handles tool approval via `addToolApprovalResponse()`
   - Has sources panel sidebar (`./components/sources-panel.tsx`)
   - Syncs messages back to Redux on `onFinish`

3. **Chat Slice** (`apps/app/lib/store/slices/chat.slice.ts`, 475 lines)

   - `ChatState` includes: `messages` (Record<sessionId, Message[]>), `isStreaming`, `taskMode` (standard/adaptive/agent), `inputMode` (text/voice), `files` (ChatFile[]), `chatExtData`, `dataVisualization`, `playbookInfo`, `imageStyleList`, `typingUsers`
   - Reducers: `setMessages`, `addMessage`, `addMessages`, `updateMessage`, `appendToMessage`, `setStreaming`, file management (`addChatFile`, `updateChatFile`, `removeChatFile`), `setTaskMode`, `setInputMode`, `setDataVisualization`

4. **WebSocket Provider** (`apps/app/lib/socket/provider.tsx`, 295 lines)

   - Listens for: `message:new`, `message:update`, `message:stream`, `agent:created`, `agent:update`, `agent:task:new`, `agent:task:update`, `session:new`, `session:update`, `file:new`, `file:deleted`
   - Dispatches to Redux slices: `chat.slice`, `agents.slice`, `sessions.slice`, `files.slice`

5. **Messages Router** (`apps/app/lib/trpc/routers/messages.router.ts`, 103 lines)

   - `list`: Fetches messages for a session (verifies ownership)
   - `send`: Creates user message in DB (has TODO for AI trigger)
   - `add`: Creates any role message (user/assistant/system/tool)

6. **AI Package Components** (`packages/ai/components/`)
   - Chat: `chat-container.tsx`, `message-list.tsx`, `message-item.tsx`, `assistant-message.tsx`, `user-message.tsx`, `streaming-indicator.tsx`, `scroll-to-bottom.tsx`
   - Input: `chat-composer.tsx`, `input-actions.tsx`, `attachment-dropzone.tsx`
   - Agents: `agent-dag-panel.tsx`, `agent-node.tsx`, `agent-connector.tsx`, `agent-status-badge.tsx`, `agent-task-list.tsx`
   - Tools: `tool-card.tsx`, `tool-registry.tsx`, `tool-states.tsx`
   - Tool Renderers: `code-block.tsx`, `terminal-output.tsx`, `file-preview.tsx`, `web-search.tsx`, `approval-card.tsx`, `progress-tracker.tsx`, `plan-tool.tsx`, `progress-tool.tsx`, `generic-tool.tsx`
   - Parts: `text-part.tsx`, `reasoning-part.tsx`, `file-part.tsx`, `tool-part.tsx`, `source-part.tsx`

### Database Schema

Messages table at `packages/database/src/schema/sessions.ts`:

- `messages` table: id, sessionId, role (user/assistant/system/tool), content, metadata (jsonb), createdAt
- `agentSessions` table: id, userId, title, status, modelId, systemPrompt, etc.

---

## What Needs Building

### 1. Agent Orchestration Visualization (DAG View)

The `AgentDagPanel` component exists at `packages/ai/components/agents/agent-dag-panel.tsx` but needs real integration with the orchestration system.

**Build:**

- Real-time DAG visualization showing agent hierarchy: Orchestrator -> Researcher, Coder, Browser agents
- Each agent node shows: name, status (idle/thinking/working/complete/error), current task, progress percentage
- Connections between nodes animate when data flows between agents
- Clicking an agent node expands to show its task list and output
- Wire to `agents.slice.ts` (`apps/app/lib/store/slices/agents.slice.ts`) which tracks agents per session

**Files to modify:**

- `packages/ai/components/agents/agent-dag-panel.tsx` - Enhance with real data flow visualization
- `packages/ai/components/agents/agent-node.tsx` - Add expanded state, task preview
- `packages/ai/components/agents/agent-connector.tsx` - Animate data flow
- `apps/app/lib/store/slices/agents.slice.ts` - Ensure all agent states tracked

### 2. Tool Call Rendering (Rich UI)

Tool renderers exist at `packages/ai/components/tools/renderers/` but need completion and additional types.

**Existing renderers to enhance:**

- `code-block.tsx` - Add syntax highlighting via Shiki or Prism, copy button, language badge, line numbers
- `terminal-output.tsx` - Add ANSI color support, scrollable output, collapsible long output
- `file-preview.tsx` - Add image thumbnails, PDF preview, download button
- `web-search.tsx` - Show search results with favicons, snippets, source links
- `approval-card.tsx` - Tool approval/rejection with reason input
- `progress-tracker.tsx` - Multi-step progress with status per step

**New renderers to create in `packages/ai/components/tools/renderers/`:**

- `data-table.tsx` - Render tabular data with sorting, filtering, pagination
- `chart-renderer.tsx` - Render charts (bar, line, pie) via Recharts or Chart.js
- `website-preview.tsx` - Sandboxed iframe preview of generated websites
- `image-gallery.tsx` - Grid of generated/found images with lightbox
- `file-card.tsx` - Card showing file metadata, type icon, quick actions
- `diff-view.tsx` - Side-by-side or unified diff view for code changes
- `map-view.tsx` - Render location data on a map (if relevant tool)

**Register in** `packages/ai/components/tools/tool-registry.tsx`

### 3. File Attachment Upload + Preview

The `ChatComposer` at `packages/ai/components/input/chat-composer.tsx` accepts attachments. The `attachment-dropzone.tsx` exists.

**Build:**

- Drag-and-drop zone over entire chat area (not just input)
- Upload progress indicator per file
- Preview thumbnails: images inline, PDFs as icon+name, code files show first few lines
- Paste images from clipboard
- Size limit enforcement (show error for files > 100MB per `services/file/src/index.ts` limit config)
- Wire upload to file service: `POST /upload` at `services/file/src/index.ts` (needs S3 implementation first)
- After upload, attach file reference to message via `files.router.ts` `create` mutation

**Files to modify:**

- `packages/ai/components/input/chat-composer.tsx`
- `packages/ai/components/input/attachment-dropzone.tsx`
- `apps/app/app/(authenticated)/chat/[id]/chat-page-client.tsx` - `handleFileSelect` callback
- `apps/app/lib/store/slices/chat.slice.ts` - `ChatFile` type and `addChatFile`/`updateChatFile` actions

### 4. Message Persistence

Currently messages stream via the API route but are NOT saved to the database.

**Build:**

- After each completed assistant response (in `onFinish` callback of `useRealTimeChat`), persist both the user message and assistant response via `messages.router.ts` `add` mutation
- On page load, fetch existing messages via `messages.router.ts` `list` query and pass as `initialMessages`
- Add optimistic updates: show message immediately in UI, persist in background
- Handle message metadata: model used, token count, agent type, tool calls

**Files to modify:**

- `apps/app/app/(authenticated)/chat/[id]/chat-page-client.tsx` - Add tRPC calls in `onFinish`
- `apps/app/app/(authenticated)/chat/[id]/page.tsx` - Server-side fetch of initial messages
- `apps/app/lib/trpc/routers/messages.router.ts` - Add `bulkAdd` mutation for batch persistence
- `apps/app/app/api/chat/route.ts` - Include metadata in stream (model, tokens)

### 5. Credit Deduction After Responses

The billing system exists (`apps/app/lib/trpc/routers/billing.router.ts`, 534 lines) with credit balance and usage records.

**Build:**

- After each AI response completes, calculate credit cost based on tokens used
- Deduct from `creditBalances` table via new `billing.router.ts` mutation `deductCredits`
- Show remaining credits in chat header (already have `credits-button.tsx` and `credits-dropdown.tsx` at `apps/app/app/(authenticated)/components/header/`)
- Block sending if zero credits (show upgrade prompt)
- Real-time credit balance update via WebSocket after deduction

**Files to modify:**

- `apps/app/lib/trpc/routers/billing.router.ts` - Add `deductCredits` and `recordUsage` mutations
- `apps/app/app/api/chat/route.ts` - Calculate token cost after stream completes
- `apps/app/app/(authenticated)/components/header/credits-button.tsx` - Live credit display
- `apps/app/lib/store/slices/billing.slice.ts` - Track credit balance in Redux

### 6. Multi-Model Selector

Models are configured in `packages/ai/lib/models.ts`. The provider system is comprehensive (`packages/ai/lib/providers/`).

**Build:**

- Dropdown in chat composer to select model (Claude, GPT-4, Gemini, etc.)
- Show model capabilities, pricing per 1K tokens, context window
- Pass selected model to `/api/chat` route
- Update route to use dynamic model: `models[selectedModel]` instead of hardcoded `models.chat`
- Store user's preferred model in preferences

**Files to modify:**

- `packages/ai/components/input/chat-composer.tsx` - Add model selector dropdown
- `apps/app/app/api/chat/route.ts` - Accept `model` parameter, use `getModel()` from `packages/ai/lib/providers`
- `packages/ai/lib/models.ts` - Expose available models list
- `apps/app/lib/store/slices/chat.slice.ts` - Add `selectedModel` state

### 7. Conversation Branching

**Build:**

- Allow editing a previous user message to create a branch
- Show branch indicator on messages with multiple versions
- Branch navigation (previous/next version arrows)
- Store branches as separate message chains in the same session
- UI: slight indent or visual indicator for branched conversations

**Files to modify:**

- `apps/app/app/(authenticated)/chat/[id]/chat-page-client.tsx` - `handleMessageAction` for "edit"
- `packages/ai/components/chat/message-item.tsx` - Add branch navigation UI
- `apps/app/lib/trpc/routers/messages.router.ts` - Add `branch` mutation, `parentMessageId` field
- `packages/database/src/schema/sessions.ts` - Add `parentMessageId` column to messages table

### 8. Export Chat

**Build:**

- "Export" button in chat header
- Export as Markdown: format all messages with role headers, code blocks, tool outputs
- Export as PDF: use a library like `@react-pdf/renderer` or `html2pdf.js`
- Export as JSON: raw message data
- Include attachments and tool outputs in export

**Files to create:**

- `apps/app/app/(authenticated)/chat/[id]/components/export-chat.tsx`
- `apps/app/lib/utils/export-chat.ts` - Export formatting utilities

---

## Reference

- Manus chat UI specification: `docs/features_manus_reverse_engineering/Manus_Application_Feature_Specification.md`
- AI package exports: `packages/ai/index.ts` - Full list of available agents, tools, middleware, providers, orchestration utilities
- Agent types: `packages/ai/lib/agents/types.ts`
- Orchestration: `packages/ai/lib/orchestration/` (DAGExecutor, TaskPlanner, ParallelRunner)
- Design system components: `packages/design-system/`

## Architecture Pattern

```
User Input -> ChatComposer -> handleSendMessage()
  -> useRealTimeChat.sendMessage() -> POST /api/chat
  -> streamText() -> toTextStreamResponse()
  -> Client receives stream -> Updates UIMessages
  -> onFinish -> Sync to Redux + Persist to DB via tRPC
  -> WebSocket broadcasts to other clients in room
```

## Priority Order

1. Message persistence (critical - data is lost on page refresh)
2. Credit deduction (critical - no billing without this)
3. Multi-model selector (high - users need model choice)
4. File attachment upload (high - core feature)
5. Tool call rendering enhancements (medium - existing renderers work)
6. Agent orchestration visualization (medium - needs backend agent system)
7. Conversation branching (low - complex, nice-to-have)
8. Export chat (low - nice-to-have)
