# Definitive Guide: Building a Manus-Style Chat Interface with AI SDK v6 + Elements AI

**Author:** Manus AI  
**Date:** February 8, 2026  
**Scope:** Complete architecture, state management, tool rendering, canvas/E2B integration, and data flow documentation.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [AI SDK v6 Core Concepts](#2-ai-sdk-v6-core-concepts)
3. [UIMessage Part Types — The Rendering Primitives](#3-uimessage-part-types)
4. [Tool Invocation States — The Lifecycle](#4-tool-invocation-states)
5. [Elements AI Component Inventory](#5-elements-ai-component-inventory)
6. [State Architecture — Redux Slices](#6-state-architecture)
7. [The Master Renderer — MessageParts Component](#7-the-master-renderer)
8. [Tool-by-Tool Mapping (All 33 + Dynamic)](#8-tool-by-tool-mapping)
9. [Canvas / Workspace Panel — E2B Integration](#9-canvas-workspace-panel)
10. [Backend API Route — streamText Configuration](#10-backend-api-route)
11. [Complete Data Flow — End to End](#11-complete-data-flow)
12. [Installation Checklist](#12-installation-checklist)

---

## 1. Architecture Overview

The system follows a three-layer architecture where the **AI SDK v6 backend** generates a stream of typed message parts, the **Redux store** manages session and workspace state, and the **React frontend** renders each part using the appropriate **Elements AI** component. The canvas panel (powered by E2B sandboxes) provides a persistent workspace that reflects the agent's file system, browser, terminal, and code execution in real time.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        BACKEND (API Route)                          │
│                                                                      │
│  streamText({                                                        │
│    model,                                                            │
│    messages: convertToModelMessages(uiMessages),                     │
│    tools: { show_plan, web_search, file_read, shell_exec, ... },     │
│    sendReasoning: true,                                              │
│    stopWhen: stepCountIs(25),                                        │
│  }) → toUIMessageStreamResponse()                                    │
└──────────────────────┬───────────────────────────────────────────────┘
                       │  UIMessage Stream (SSE)
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (useChat hook)                          │
│                                                                      │
│  const { messages, status, sendMessage, addToolOutput,               │
│          addToolApprovalResponse } = useChat({ transport })          │
│                                                                      │
│  messages[].parts[] → each part has a `type` and `state`             │
│                                                                      │
│  Part types:                                                         │
│    'text' | 'reasoning' | 'source-url' | 'source-document' |        │
│    'file' | 'step-start' | 'tool-{name}' | 'dynamic-tool'           │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────┐    ┌──────────────────────────┐
│   CHAT PANEL     │    │   CANVAS / WORKSPACE     │
│   (Left Side)    │    │   (Right Side)           │
│                  │    │                          │
│  <Conversation>  │    │  Driven by               │
│    <Message>     │    │  agentWorkspace.          │
│      parts.map() │    │  sidebarType:             │
│        → render  │    │                          │
│          each    │    │  'browser' → WebPreview   │
│          part    │    │  'terminal' → Terminal    │
│                  │    │  'code' → CodeBlock       │
│  <PromptInput>   │    │  'file' → FileTree        │
│  <Suggestion>    │    │  'preview' → WebPreview   │
│                  │    │  'image' → Image          │
└──────────────────┘    └──────────────────────────┘
```

The key insight is that **every tool call becomes a typed part** in the assistant message. The part's `type` field tells you *which* tool was called, and the `state` field tells you *where* it is in its lifecycle. Your renderer switches on both.

---

## 2. AI SDK v6 Core Concepts

### 2.1 The `useChat` Hook

In AI SDK v6, the `useChat` hook is the primary interface for managing chat state. It has been significantly updated from v4/v5 to use a transport-based architecture [1].

```tsx
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';

const {
  messages,          // UIMessage[] — the full conversation
  status,            // 'submitted' | 'streaming' | 'ready' | 'error'
  error,             // Error | undefined
  sendMessage,       // (msg) => Promise<void>
  stop,              // () => void
  addToolOutput,     // (opts) => void — provide tool results
  addToolApprovalResponse, // (opts) => void — approve/deny tools
  setMessages,       // (msgs) => void — optimistic updates
} = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  async onToolCall({ toolCall }) {
    // Handle client-side auto-executed tools
  },
  onFinish(options) {
    // Stream complete — update Redux state
  },
  onError(error) {
    // Handle errors
  },
});
```

### 2.2 UIMessage Structure

Each message in the `messages` array is a `UIMessage` object with the following shape:

```ts
interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;          // Legacy — use parts instead
  parts: UIMessagePart[];   // The rendering primitives
  status: 'submitting' | 'streaming' | 'ready' | 'error';
  metadata?: Record<string, unknown>;
}
```

The `parts` array is what you iterate over to render the message. Each part has a `type` discriminator that determines which component to use.

---

## 3. UIMessage Part Types — The Rendering Primitives

Every piece of content the AI produces arrives as a typed part. Here is the complete taxonomy:

| Part Type | Description | Key Properties | Elements AI Component |
|-----------|-------------|----------------|----------------------|
| `text` | Plain text / markdown content | `text: string` | Markdown renderer (built-in) |
| `reasoning` | Chain-of-thought thinking | `text: string`, `providerMetadata?` | `<Reasoning>` |
| `source-url` | Web source citation | `url: string`, `title?: string` | `<Sources>` + `<InlineCitation>` |
| `source-document` | Document source citation | `id: string`, `title?: string`, `sourceDocument` | `<Sources>` + `<Attachments>` |
| `file` | Generated file / image | `url: string`, `mediaType: string`, `filename?` | `<Image>` / `<Attachments>` / `<Artifact>` |
| `step-start` | Multi-step boundary marker | (none meaningful) | `<hr>` or hidden |
| `tool-{name}` | Typed tool invocation | `toolCallId`, `toolName`, `state`, `input`, `output` | Per-tool renderer (see Section 8) |
| `dynamic-tool` | Dynamic/unknown tool invocation | `toolCallId`, `toolName`, `state`, `input`, `output` | `<Tool>` generic |

The critical pattern is: **you iterate `message.parts`, switch on `part.type`, and render the appropriate component.** For tool parts, you further switch on `part.state` to show the correct lifecycle phase.

---

## 4. Tool Invocation States — The Lifecycle

Every tool part transitions through these states. Your UI must handle each one:

| State | Description | What to Render | Elements AI Pattern |
|-------|-------------|----------------|-------------------|
| `input-streaming` | LLM is generating the tool arguments | Shimmer / skeleton / "Thinking..." | `<Tool status="running">` with `<Shimmer>` |
| `input-available` | Arguments ready, execution starting | Tool name + input summary | `<Tool status="running">` |
| `approval-requested` | Waiting for user to approve | Approve/Deny buttons | `<Confirmation>` inside `<Tool>` |
| `approval-responded` | User responded, executing | "Executing..." | `<Tool status="running">` |
| `output-available` | Execution succeeded | Full result rendering | `<Tool status="completed">` |
| `output-error` | Execution failed | Error message | `<Tool status="error">` |
| `output-denied` | User denied execution | "Denied" message | `<Tool status="denied">` |

The `<Tool>` component from Elements AI maps these states to visual indicators via its `status` prop:

```tsx
import { Tool, ToolIcon, ToolTitle, ToolContent } from '@/components/ai-elements/tool';

// status mapping:
function getToolStatus(state: string) {
  switch (state) {
    case 'input-streaming':
    case 'input-available':
    case 'approval-responded':
      return 'running';
    case 'approval-requested':
      return 'pending';
    case 'output-available':
      return 'completed';
    case 'output-error':
      return 'error';
    case 'output-denied':
      return 'denied';
    default:
      return 'running';
  }
}
```

---

## 5. Elements AI Component Inventory

After auditing the full Elements AI registry [2], here are all 48 components organized by category, with their purpose and which Rubic tools they serve:

### 5.1 Chatbot Components (18)

| Component | Install Command | Purpose | Maps to Rubic Tool(s) |
|-----------|----------------|---------|----------------------|
| `<Attachments>` | `npx ai-elements add attachments` | File/image/video/audio display with grid/inline/list variants | User file uploads, `file` parts |
| `<ChainOfThought>` | `npx ai-elements add chain-of-thought` | Expandable thinking process | `show_plan` (standalone mode) |
| `<Checkpoint>` | `npx ai-elements add checkpoint` | Progress checkpoint markers | Step boundaries in multi-tool flows |
| `<Confirmation>` | `npx ai-elements add confirmation` | Approve/Deny dialog | Any tool with `approval-requested` state |
| `<Context>` | `npx ai-elements add context` | Context display panel | System context, knowledge base |
| `<Conversation>` | `npx ai-elements add conversation` | Message container with scroll management | Wraps all messages |
| `<InlineCitation>` | `npx ai-elements add inline-citation` | Inline source reference numbers | `source-url` parts in text |
| `<Message>` | `npx ai-elements add message` | Individual message bubble | Each UIMessage |
| `<ModelSelector>` | `npx ai-elements add model-selector` | Model picker dropdown | Model selection UI |
| `<Plan>` | `npx ai-elements add plan` | Task plan with phases | `show_plan` tool |
| `<PromptInput>` | `npx ai-elements add prompt-input` | User input area with file upload | Chat input |
| `<Queue>` | `npx ai-elements add queue` | Task queue display | Session queue management |
| `<Reasoning>` | `npx ai-elements add reasoning` | Collapsible reasoning display | `reasoning` parts |
| `<Shimmer>` | `npx ai-elements add shimmer` | Loading skeleton animation | `input-streaming` states |
| `<Sources>` | `npx ai-elements add sources` | Source citation cards | `web_search` results, `source-url` parts |
| `<Suggestion>` | `npx ai-elements add suggestion` | Clickable suggestion chips | Follow-up suggestions |
| `<Task>` | `npx ai-elements add task` | Individual task item (used inside Plan) | Each todo in `show_plan` |
| `<Tool>` | `npx ai-elements add tool` | Generic tool call display wrapper | **Every tool invocation** |

### 5.2 Code Components (15) — Used in Canvas Panel

| Component | Purpose | Maps to Rubic Tool(s) |
|-----------|---------|----------------------|
| `<Agent>` | Agent identity display | Agent header |
| `<Artifact>` | File/artifact preview with tabs | File outputs, generated content |
| `<CodeBlock>` | Syntax-highlighted code display | `code_execute`, `file_read`/`file_write` |
| `<Commit>` | Git commit display | Deployment commits |
| `<EnvironmentVariables>` | Env var key-value display | Sandbox environment |
| `<FileTree>` | File system tree navigator | `file_*` tools → canvas panel |
| `<JSXPreview>` | Live JSX component preview | Web dev preview |
| `<PackageInfo>` | Package information display | Dependency info |
| `<Sandbox>` | Code editor + output tabs | `code_execute` → canvas panel |
| `<SchemaDisplay>` | Schema visualization | Database schemas |
| `<Snippet>` | Compact code snippet | Inline code references |
| `<StackTrace>` | Error stack trace display | Error outputs |
| `<Terminal>` | Terminal output with ANSI colors | `shell_*` tools → canvas panel |
| `<TestResults>` | Test result display | Test execution outputs |
| `<WebPreview>` | Browser/iframe preview | `browser_*` tools → canvas panel |

### 5.3 Voice Components (6)

| Component | Purpose |
|-----------|---------|
| `<AudioPlayer>` | Audio playback |
| `<MicSelector>` | Microphone picker |
| `<Persona>` | Voice persona display |
| `<SpeechInput>` | Voice input |
| `<Transcription>` | Speech-to-text display |
| `<VoiceSelector>` | Voice picker |

### 5.4 Workflow Components (7) — Canvas/Workflow View

| Component | Purpose |
|-----------|---------|
| `<Canvas>` | Workflow canvas container |
| `<Connection>` | Node connections |
| `<Controls>` | Zoom/pan controls |
| `<Edge>` | Connection edges |
| `<Node>` | Workflow nodes |
| `<Panel>` | Side panel |
| `<Toolbar>` | Workflow toolbar |

### 5.5 Media Components (2)

| Component | Purpose | Maps to Rubic Tool(s) |
|-----------|---------|----------------------|
| `<Image>` | Image display with zoom | `generate_image` |
| `<OpenInChat>` | Open artifact in chat | Cross-panel navigation |

---

## 6. State Architecture — Redux Slices

Your Redux store mirrors the Manus state structure. The following table maps each state slice to its role in the chat/canvas system:

### 6.1 Core Chat State Slices

| Slice | Key Fields | Role in Rendering |
|-------|-----------|-------------------|
| `chat` | `files`, `taskMode`, `inputMode`, `chatExtData` | Controls input area behavior: which mode (text/voice), attached files, and task mode (standard/max) |
| `sessions` | `currentSessionId`, `sessions.entities[id]` | Each session holds `title`, `status`, `lastDisplayMessage`, `costedCredits`. The `currentSessionId` determines which conversation to display |
| `websocket` | `status`, `taskFinished`, `isVNCConnected`, `contextLengthStatus` | Real-time connection state. `taskFinished` controls whether the input is enabled. `isVNCConnected` determines if the VNC browser viewer is live |
| `agentWorkspace` | `sidebarType`, `isPlannerExpanded`, `isSidebarPreviewFullscreen` | **The most critical slice for canvas rendering.** `sidebarType` determines which panel to show in the workspace |
| `timeline` | `segmentEventsMap`, `percentage` | Timeline playback state for replaying agent actions |

### 6.2 The `agentWorkspace.sidebarType` — Canvas Panel Router

This single field drives the entire right-side canvas panel. When a tool executes, the backend (or a Redux action) sets `sidebarType` to the appropriate value, and the canvas panel renders the matching component:

| `sidebarType` Value | Canvas Component | Triggered By Tools |
|---------------------|-----------------|-------------------|
| `null` | Nothing (collapsed) | Initial state |
| `'browser'` | `<WebPreview>` with VNC stream | `browser_navigate`, `browser_view`, `browser_click`, all `browser_*` |
| `'terminal'` | `<Terminal>` with live output | `shell_exec`, `shell_view`, `shell_wait`, `shell_write_to_process`, `shell_kill_process` |
| `'code'` | `<CodeBlock>` / `<Sandbox>` | `code_execute` |
| `'file'` | `<FileTree>` + `<CodeBlock>` | `file_read`, `file_write`, `file_str_replace` |
| `'preview'` | `<WebPreview>` (deployed site) | `deploy_expose_port`, `deploy_apply_deployment` |
| `'image'` | `<Image>` (full-size) | `generate_image` |
| `'search'` | `<Sources>` (expanded) | `web_search` (optional) |

### 6.3 Other Supporting Slices

| Slice | Role |
|-------|------|
| `configs` | Theme, `chatSidebarMode` ('sidebar' vs 'overlay'), `agentWorkspaceAutoExpanded` |
| `ui` | `isMobile`, `windowWidth`, `chatSidebarWidth`, `isWebDevSidebarFullscreen` |
| `codeViewer` | `rootDirectory`, `directoryList`, `fileTabList`, `activeTabId` — drives the FileTree and code editor tabs |
| `webDev` | `activeTab` ('preview'/'database'/'settings'/'code'/'file'), `project`, `database` — drives the web dev workspace |
| `fileManagement` | `sessionFileList`, `spaces` — file panel data |
| `knowledge` | `userKnowledgeList` — knowledge base items |
| `scheduledTask` | Scheduled task state |
| `connectors` | Connected apps (Composio) and their tools |

### 6.4 Connecting useChat to Redux

The `useChat` hook manages the message stream, but your Redux store manages everything else. Here is how they connect:

```tsx
// In your chat component:
const dispatch = useAppDispatch();
const sidebarType = useAppSelector(s => s.agentWorkspace.sidebarType);
const currentSessionId = useAppSelector(s => s.sessions.currentSessionId);
const taskFinished = useAppSelector(s => s.websocket.taskFinished);

const { messages, status, sendMessage, addToolOutput, addToolApprovalResponse } = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,

  async onToolCall({ toolCall }) {
    // Auto-execute client-side tools and update Redux
    if (toolCall.dynamic) return;

    // Update sidebar based on tool type
    if (toolCall.toolName.startsWith('browser_')) {
      dispatch(setAgentWorkspace({ sidebarType: 'browser' }));
    } else if (toolCall.toolName.startsWith('shell_')) {
      dispatch(setAgentWorkspace({ sidebarType: 'terminal' }));
    } else if (toolCall.toolName === 'code_execute') {
      dispatch(setAgentWorkspace({ sidebarType: 'code' }));
    } else if (toolCall.toolName.startsWith('file_')) {
      dispatch(setAgentWorkspace({ sidebarType: 'file' }));
    } else if (toolCall.toolName === 'generate_image') {
      dispatch(setAgentWorkspace({ sidebarType: 'image' }));
    } else if (toolCall.toolName === 'web_search') {
      dispatch(setAgentWorkspace({ sidebarType: 'search' }));
    } else if (toolCall.toolName.startsWith('deploy_')) {
      dispatch(setAgentWorkspace({ sidebarType: 'preview' }));
    }
  },

  onFinish() {
    dispatch(setWebsocket({ taskFinished: true }));
  },
});
```

---

## 7. The Master Renderer — MessageParts Component

This is the single most important component in your application. It receives a `UIMessage` and renders every part using the correct Elements AI component.

```tsx
// components/message-parts.tsx
'use client';

import { UIMessage } from 'ai';
import { Reasoning } from '@/components/ai-elements/reasoning';
import { Sources, Source } from '@/components/ai-elements/sources';
import { InlineCitation } from '@/components/ai-elements/inline-citation';
import { Tool, ToolIcon, ToolTitle, ToolContent } from '@/components/ai-elements/tool';
import { Plan, PlanHeader, PlanContent } from '@/components/ai-elements/plan';
import { Task } from '@/components/ai-elements/task';
import { Confirmation, ConfirmationActions, ConfirmationAction } from '@/components/ai-elements/confirmation';
import { Image } from '@/components/ai-elements/image';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Attachments, Attachment, AttachmentPreview, AttachmentInfo } from '@/components/ai-elements/attachments';
import { Terminal } from '@/components/ai-elements/terminal';
import { CodeBlock } from '@/components/ai-elements/code-block';
import { FileTree } from '@/components/ai-elements/file-tree';
import { WebPreview } from '@/components/ai-elements/web-preview';
import { Sandbox } from '@/components/ai-elements/sandbox';
import { Markdown } from '@/components/markdown'; // your markdown renderer
import {
  Globe, Search, FileText, Terminal as TerminalIcon,
  Code, Eye, Image as ImageIcon, Rocket, Clock,
  BarChart, MessageSquare, HelpCircle, Cpu
} from 'lucide-react';

interface MessagePartsProps {
  message: UIMessage;
  isStreaming: boolean;
  addToolOutput: (opts: any) => void;
  addToolApprovalResponse: (opts: any) => void;
}

// ─── Helper: map tool state → Elements AI Tool status ───
function toolStatus(state: string): 'pending' | 'running' | 'completed' | 'error' | 'denied' {
  switch (state) {
    case 'input-streaming':
    case 'input-available':
    case 'approval-responded':
      return 'running';
    case 'approval-requested':
      return 'pending';
    case 'output-available':
      return 'completed';
    case 'output-error':
      return 'error';
    case 'output-denied':
      return 'denied';
    default:
      return 'running';
  }
}

// ─── Helper: get icon for tool category ───
function toolIcon(toolName: string) {
  if (toolName === 'show_plan') return <Cpu className="h-4 w-4" />;
  if (toolName === 'web_search') return <Search className="h-4 w-4" />;
  if (toolName.startsWith('browser_')) return <Globe className="h-4 w-4" />;
  if (toolName.startsWith('file_')) return <FileText className="h-4 w-4" />;
  if (toolName.startsWith('shell_')) return <TerminalIcon className="h-4 w-4" />;
  if (toolName === 'code_execute') return <Code className="h-4 w-4" />;
  if (toolName === 'generate_image') return <ImageIcon className="h-4 w-4" />;
  if (toolName.startsWith('deploy_')) return <Rocket className="h-4 w-4" />;
  if (toolName === 'schedule_recurring_task') return <Clock className="h-4 w-4" />;
  if (toolName === 'check_outcomes') return <BarChart className="h-4 w-4" />;
  if (toolName.startsWith('message_')) return <MessageSquare className="h-4 w-4" />;
  return <HelpCircle className="h-4 w-4" />;
}

// ─── Helper: human-readable tool label ───
function toolLabel(toolName: string): string {
  const labels: Record<string, string> = {
    show_plan: 'Planning',
    web_search: 'Searching the web',
    browser_navigate: 'Navigating to page',
    browser_view: 'Viewing page',
    browser_click: 'Clicking element',
    browser_input: 'Typing text',
    browser_scroll_up: 'Scrolling up',
    browser_scroll_down: 'Scrolling down',
    browser_press_key: 'Pressing key',
    browser_select_option: 'Selecting option',
    browser_move_mouse: 'Moving cursor',
    browser_console_exec: 'Running console script',
    browser_console_view: 'Viewing console',
    browser_screenshot: 'Taking screenshot',
    browser_restart: 'Restarting browser',
    file_read: 'Reading file',
    file_write: 'Writing file',
    file_str_replace: 'Editing file',
    file_find_in_content: 'Searching in file',
    file_find_by_name: 'Finding files',
    shell_exec: 'Running command',
    shell_view: 'Viewing terminal',
    shell_wait: 'Waiting for process',
    shell_write_to_process: 'Sending input',
    shell_kill_process: 'Stopping process',
    code_execute: 'Executing code',
    generate_image: 'Generating image',
    deploy_expose_port: 'Exposing port',
    deploy_apply_deployment: 'Deploying',
    message_notify_user: 'Notification',
    message_ask_user: 'Question',
    schedule_recurring_task: 'Scheduling task',
    check_outcomes: 'Checking results',
  };
  return labels[toolName] ?? toolName.replace(/_/g, ' ');
}

export function MessageParts({
  message,
  isStreaming,
  addToolOutput,
  addToolApprovalResponse,
}: MessagePartsProps) {
  // Collect sources from all parts for the Sources component
  const sources = message.parts
    .filter((p): p is Extract<typeof p, { type: 'source-url' }> => p.type === 'source-url')
    .map((p, i) => ({ url: p.url, title: p.title ?? new URL(p.url).hostname }));

  return (
    <div className="space-y-3">
      {message.parts.map((part, index) => {
        switch (part.type) {

          // ═══════════════════════════════════════
          // TEXT
          // ═══════════════════════════════════════
          case 'text':
            return (
              <div key={index} className="prose dark:prose-invert max-w-none">
                <Markdown>{part.text}</Markdown>
              </div>
            );

          // ═══════════════════════════════════════
          // REASONING (Chain of Thought)
          // ═══════════════════════════════════════
          case 'reasoning':
            return (
              <Reasoning
                key={index}
                isStreaming={isStreaming && index === message.parts.length - 1}
              >
                {part.text}
              </Reasoning>
            );

          // ═══════════════════════════════════════
          // SOURCE-URL (Web Citations)
          // ═══════════════════════════════════════
          case 'source-url':
            // Collected above, rendered as batch after text
            return null;

          // ═══════════════════════════════════════
          // SOURCE-DOCUMENT (Document Citations)
          // ═══════════════════════════════════════
          case 'source-document':
            return null; // Also batched

          // ═══════════════════════════════════════
          // FILE (Generated images, documents)
          // ═══════════════════════════════════════
          case 'file':
            if (part.mediaType?.startsWith('image/')) {
              return <Image key={index} src={part.url} alt={part.filename ?? 'Generated image'} />;
            }
            return (
              <Attachments key={index} variant="list">
                <Attachment data={{ ...part, id: `file-${index}` }}>
                  <AttachmentPreview />
                  <AttachmentInfo />
                </Attachment>
              </Attachments>
            );

          // ═══════════════════════════════════════
          // STEP-START (Multi-step boundary)
          // ═══════════════════════════════════════
          case 'step-start':
            return index > 0 ? <hr key={index} className="my-2 border-border" /> : null;

          // ═══════════════════════════════════════
          // TOOL: show_plan — STANDALONE (no Tool wrapper)
          // ═══════════════════════════════════════
          case 'tool-show_plan':
            return <ShowPlanRenderer key={index} part={part} />;

          // ═══════════════════════════════════════
          // TOOL: web_search
          // ═══════════════════════════════════════
          case 'tool-web_search':
            return <WebSearchRenderer key={index} part={part} />;

          // ═══════════════════════════════════════
          // TOOL: browser_* (all 13 browser tools)
          // ═══════════════════════════════════════
          case 'tool-browser_navigate':
          case 'tool-browser_view':
          case 'tool-browser_restart':
          case 'tool-browser_click':
          case 'tool-browser_input':
          case 'tool-browser_move_mouse':
          case 'tool-browser_press_key':
          case 'tool-browser_select_option':
          case 'tool-browser_scroll_up':
          case 'tool-browser_scroll_down':
          case 'tool-browser_console_exec':
          case 'tool-browser_console_view':
          case 'tool-browser_screenshot':
            return <BrowserToolRenderer key={index} part={part} />;

          // ═══════════════════════════════════════
          // TOOL: file_* (all 5 file tools)
          // ═══════════════════════════════════════
          case 'tool-file_read':
          case 'tool-file_write':
          case 'tool-file_str_replace':
          case 'tool-file_find_in_content':
          case 'tool-file_find_by_name':
            return <FileToolRenderer key={index} part={part} />;

          // ═══════════════════════════════════════
          // TOOL: shell_* (all 5 shell tools)
          // ═══════════════════════════════════════
          case 'tool-shell_exec':
          case 'tool-shell_view':
          case 'tool-shell_wait':
          case 'tool-shell_write_to_process':
          case 'tool-shell_kill_process':
            return <ShellToolRenderer key={index} part={part} />;

          // ═══════════════════════════════════════
          // TOOL: code_execute
          // ═══════════════════════════════════════
          case 'tool-code_execute':
            return <CodeExecuteRenderer key={index} part={part} />;

          // ═══════════════════════════════════════
          // TOOL: generate_image
          // ═══════════════════════════════════════
          case 'tool-generate_image':
            return <ImageGenerateRenderer key={index} part={part} />;

          // ═══════════════════════════════════════
          // TOOL: deploy_*
          // ═══════════════════════════════════════
          case 'tool-deploy_expose_port':
          case 'tool-deploy_apply_deployment':
            return <DeployToolRenderer key={index} part={part} />;

          // ═══════════════════════════════════════
          // TOOL: message_notify_user
          // ═══════════════════════════════════════
          case 'tool-message_notify_user':
            return <NotifyRenderer key={index} part={part} />;

          // ═══════════════════════════════════════
          // TOOL: message_ask_user
          // ═══════════════════════════════════════
          case 'tool-message_ask_user':
            return (
              <AskUserRenderer
                key={index}
                part={part}
                addToolOutput={addToolOutput}
              />
            );

          // ═══════════════════════════════════════
          // TOOL: schedule_recurring_task
          // ═══════════════════════════════════════
          case 'tool-schedule_recurring_task':
            return <ScheduleRenderer key={index} part={part} />;

          // ═══════════════════════════════════════
          // TOOL: check_outcomes
          // ═══════════════════════════════════════
          case 'tool-check_outcomes':
            return <AnalyticsRenderer key={index} part={part} />;

          // ═══════════════════════════════════════
          // DYNAMIC TOOLS (Composio, Devices, MCP)
          // ═══════════════════════════════════════
          case 'dynamic-tool':
            return <DynamicToolRenderer key={index} part={part} />;

          // ═══════════════════════════════════════
          // FALLBACK
          // ═══════════════════════════════════════
          default:
            // Handle any tool-* not explicitly listed
            if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
              return <GenericToolRenderer key={index} part={part} />;
            }
            return null;
        }
      })}

      {/* Render collected sources at the end */}
      {sources.length > 0 && (
        <Sources>
          {sources.map((src, i) => (
            <Source key={i} href={src.url} title={src.title} index={i + 1} />
          ))}
        </Sources>
      )}
    </div>
  );
}
```

---

## 8. Tool-by-Tool Mapping (All 33 + Dynamic)

This section provides the complete renderer for each tool category. Each renderer is a self-contained component that handles all lifecycle states.

### 8.1 show_plan — Planning Tool (Standalone, No Tool Wrapper)

The plan tool is unique: it renders **without** the `<Tool>` wrapper. It uses `<Plan>` + `<Task>` from Elements AI, which provides a timeline-style display with progress tracking.

```tsx
function ShowPlanRenderer({ part }: { part: any }) {
  if (part.state === 'input-streaming') {
    return <Shimmer className="h-20 w-full" />;
  }

  const input = part.input ?? {};
  const todos = input.todos ?? [];

  return (
    <Plan>
      <PlanHeader>
        <h3 className="font-semibold text-sm">{input.title ?? 'Task Plan'}</h3>
      </PlanHeader>
      <PlanContent>
        {todos.map((todo: any) => (
          <Task
            key={todo.id}
            status={
              todo.status === 'completed' ? 'completed' :
              todo.status === 'in_progress' ? 'in-progress' :
              todo.status === 'cancelled' ? 'cancelled' :
              'pending'
            }
          >
            {todo.label}
          </Task>
        ))}
      </PlanContent>
    </Plan>
  );
}
```

**State connection:** When the plan updates, dispatch `setAgentWorkspace({ isPlannerExpanded: true })` to auto-expand the planner in the sidebar.

### 8.2 web_search — Search Tool

Uses `<Tool>` wrapper with `<Sources>` for results. This is the primary tool that populates the sources panel.

```tsx
function WebSearchRenderer({ part }: { part: any }) {
  const status = toolStatus(part.state);

  return (
    <Tool status={status}>
      <ToolIcon><Search className="h-4 w-4" /></ToolIcon>
      <ToolTitle>
        {part.state === 'input-streaming' && 'Preparing search...'}
        {part.state === 'input-available' && `Searching: "${part.input?.query}"`}
        {part.state === 'output-available' && `Found ${part.output?.results?.length ?? 0} results`}
        {part.state === 'output-error' && 'Search failed'}
      </ToolTitle>
      {part.state === 'output-available' && part.output?.results && (
        <ToolContent>
          <Sources>
            {part.output.results.map((r: any, i: number) => (
              <Source key={i} href={r.url} title={r.title} index={i + 1}>
                {r.snippet}
              </Source>
            ))}
          </Sources>
        </ToolContent>
      )}
    </Tool>
  );
}
```

**State connection:** Optionally dispatch `setAgentWorkspace({ sidebarType: 'search', chatReplySearchResults: part.output?.results })` to populate the search panel.

### 8.3 browser_* — Browser Tools (13 tools, 1 renderer)

All 13 browser tools share one renderer. In the chat panel, they show a compact collapsed tool card. The actual browser view lives in the canvas panel.

```tsx
function BrowserToolRenderer({ part }: { part: any }) {
  const status = toolStatus(part.state);
  const name = part.toolName ?? 'browser';

  // Extract URL from navigate/restart tools
  const url = part.input?.url;

  return (
    <Tool status={status}>
      <ToolIcon><Globe className="h-4 w-4" /></ToolIcon>
      <ToolTitle>
        {toolLabel(name)}
        {url && <span className="ml-1 text-xs text-muted-foreground truncate max-w-[200px]">{url}</span>}
      </ToolTitle>
      {part.state === 'output-available' && part.output?.screenshot_url && (
        <ToolContent>
          <Image
            src={part.output.screenshot_url}
            alt="Browser screenshot"
            className="rounded-md border max-h-48 object-cover"
          />
        </ToolContent>
      )}
    </Tool>
  );
}
```

**State connection:** Every browser tool dispatches `setAgentWorkspace({ sidebarType: 'browser' })`. The canvas panel then renders `<WebPreview>` connected to the E2B sandbox's VNC stream or screenshot URL.

**Canvas panel rendering:**

```tsx
// In your AgentCanvas component:
case 'browser':
  return (
    <WebPreview
      url={currentBrowserUrl}
      // For VNC live view:
      src={`https://${sandboxId}-6080.e2b.dev`}
      // Or for screenshot-based view:
      screenshotUrl={latestScreenshotUrl}
    />
  );
```

### 8.4 file_* — File System Tools (5 tools, 1 renderer)

File tools show the file path and a snippet of content in the chat. The full file tree and editor live in the canvas panel.

```tsx
function FileToolRenderer({ part }: { part: any }) {
  const status = toolStatus(part.state);
  const name = part.toolName ?? 'file';
  const filePath = part.input?.file ?? part.input?.path ?? '';
  const fileName = filePath.split('/').pop() ?? filePath;

  return (
    <Tool status={status}>
      <ToolIcon><FileText className="h-4 w-4" /></ToolIcon>
      <ToolTitle>
        {toolLabel(name)}
        {fileName && (
          <code className="ml-1 text-xs bg-muted px-1 rounded">{fileName}</code>
        )}
      </ToolTitle>
      {part.state === 'output-available' && part.output?.content && (
        <ToolContent>
          <CodeBlock
            language={detectLanguage(fileName)}
            value={truncate(part.output.content, 500)}
            showLineNumbers
          />
        </ToolContent>
      )}
    </Tool>
  );
}
```

**State connection:** Dispatches `setAgentWorkspace({ sidebarType: 'file' })` and updates `codeViewer` slice:

```tsx
dispatch(setCodeViewer({
  activeTabId: filePath,
  fileDataSource: { [filePath]: part.output?.content },
}));
```

**Canvas panel rendering:**

```tsx
case 'file':
  return (
    <div className="flex h-full">
      <FileTree
        files={directoryList}
        onSelect={(path) => dispatch(setCodeViewer({ activeTabId: path }))}
      />
      <div className="flex-1">
        <CodeBlock
          language={detectLanguage(activeTabId)}
          value={fileDataSource[activeTabId] ?? ''}
          showLineNumbers
        />
      </div>
    </div>
  );
```

### 8.5 shell_* — Shell Session Tools (5 tools, 1 renderer)

Shell tools show terminal output with ANSI color support.

```tsx
function ShellToolRenderer({ part }: { part: any }) {
  const status = toolStatus(part.state);
  const name = part.toolName ?? 'shell';
  const command = part.input?.command ?? part.input?.input ?? '';

  return (
    <Tool status={status}>
      <ToolIcon><TerminalIcon className="h-4 w-4" /></ToolIcon>
      <ToolTitle>
        {toolLabel(name)}
        {command && (
          <code className="ml-1 text-xs bg-muted px-1 rounded font-mono">
            {truncate(command, 60)}
          </code>
        )}
      </ToolTitle>
      {part.state === 'output-available' && part.output && (
        <ToolContent>
          <Terminal
            lines={formatTerminalOutput(part.output)}
            className="max-h-48 overflow-auto"
          />
        </ToolContent>
      )}
    </Tool>
  );
}
```

**State connection:** Dispatches `setAgentWorkspace({ sidebarType: 'terminal' })`.

**Canvas panel rendering:**

```tsx
case 'terminal':
  return (
    <Terminal
      lines={terminalHistory}
      className="h-full"
      // For live terminal via E2B:
      // Connect to WebSocket at sandbox terminal endpoint
    />
  );
```

### 8.6 code_execute — Code Execution Tool

Uses `<Sandbox>` which provides a tabbed interface with code and output.

```tsx
function CodeExecuteRenderer({ part }: { part: any }) {
  const status = toolStatus(part.state);

  return (
    <Tool status={status}>
      <ToolIcon><Code className="h-4 w-4" /></ToolIcon>
      <ToolTitle>
        {part.state === 'input-streaming' && 'Writing code...'}
        {part.state === 'input-available' && `Running ${part.input?.language ?? 'code'}...`}
        {part.state === 'output-available' && 'Code executed'}
        {part.state === 'output-error' && 'Execution failed'}
      </ToolTitle>
      <ToolContent>
        {part.input?.code && (
          <Sandbox>
            <CodeBlock
              language={part.input.language ?? 'python'}
              value={part.input.code}
              showLineNumbers
            />
            {part.state === 'output-available' && (
              <Terminal lines={[{ text: part.output?.stdout ?? '' }]} />
            )}
            {part.state === 'output-error' && (
              <Terminal lines={[{ text: part.output?.stderr ?? part.errorText ?? 'Error', className: 'text-red-500' }]} />
            )}
          </Sandbox>
        )}
      </ToolContent>
    </Tool>
  );
}
```

**Canvas panel rendering:**

```tsx
case 'code':
  return (
    <Sandbox className="h-full">
      <CodeBlock
        language={currentLanguage}
        value={currentCode}
        showLineNumbers
      />
      <Terminal lines={executionOutput} />
    </Sandbox>
  );
```

### 8.7 generate_image — Image Generation Tool

```tsx
function ImageGenerateRenderer({ part }: { part: any }) {
  const status = toolStatus(part.state);

  return (
    <Tool status={status}>
      <ToolIcon><ImageIcon className="h-4 w-4" /></ToolIcon>
      <ToolTitle>
        {part.state === 'input-streaming' && 'Preparing image...'}
        {part.state === 'input-available' && `Generating: "${truncate(part.input?.prompt, 50)}"`}
        {part.state === 'output-available' && 'Image generated'}
        {part.state === 'output-error' && 'Generation failed'}
      </ToolTitle>
      {part.state === 'output-available' && part.output?.url && (
        <ToolContent>
          <Image
            src={part.output.url}
            alt={part.input?.prompt ?? 'Generated image'}
            className="rounded-lg max-h-80"
          />
        </ToolContent>
      )}
    </Tool>
  );
}
```

**Canvas panel:** `<Image>` component at full resolution.

### 8.8 deploy_* — Deployment Tools

```tsx
function DeployToolRenderer({ part }: { part: any }) {
  const status = toolStatus(part.state);

  return (
    <Tool status={status}>
      <ToolIcon><Rocket className="h-4 w-4" /></ToolIcon>
      <ToolTitle>
        {part.state === 'output-available'
          ? `Deployed: ${part.output?.url ?? 'Ready'}`
          : toolLabel(part.toolName)}
      </ToolTitle>
      {part.state === 'output-available' && part.output?.url && (
        <ToolContent>
          <a
            href={part.output.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline"
          >
            {part.output.url}
          </a>
        </ToolContent>
      )}
    </Tool>
  );
}
```

**Canvas panel:** `<WebPreview src={deployedUrl} />` showing the live deployed site.

### 8.9 message_notify_user — Notification Tool (Compact Pill)

```tsx
function NotifyRenderer({ part }: { part: any }) {
  if (part.state !== 'output-available' && part.state !== 'input-available') {
    return null;
  }
  const text = part.input?.text ?? '';
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-full text-sm">
      <MessageSquare className="h-3.5 w-3.5" />
      {text}
    </div>
  );
}
```

### 8.10 message_ask_user — User Question Tool (with Confirmation)

This tool requires user interaction. It uses `<Confirmation>` from Elements AI.

```tsx
function AskUserRenderer({ part, addToolOutput }: { part: any; addToolOutput: any }) {
  const [response, setResponse] = useState('');

  if (part.state === 'output-available') {
    return (
      <div className="p-3 bg-muted rounded-lg text-sm">
        <p className="font-medium">Q: {part.input?.text}</p>
        <p className="mt-1">A: {part.output}</p>
      </div>
    );
  }

  if (part.state === 'input-available') {
    return (
      <Confirmation>
        <p className="text-sm mb-3">{part.input?.text}</p>
        <div className="flex gap-2">
          <input
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Type your response..."
            className="flex-1 px-3 py-1.5 border rounded-md text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && response.trim()) {
                addToolOutput({
                  tool: 'message_ask_user',
                  toolCallId: part.toolCallId,
                  output: response,
                });
              }
            }}
          />
          <ConfirmationActions>
            <ConfirmationAction
              onClick={() => {
                if (response.trim()) {
                  addToolOutput({
                    tool: 'message_ask_user',
                    toolCallId: part.toolCallId,
                    output: response,
                  });
                }
              }}
            >
              Send
            </ConfirmationAction>
          </ConfirmationActions>
        </div>
      </Confirmation>
    );
  }

  return <Shimmer className="h-16 w-full" />;
}
```

### 8.11 schedule_recurring_task, check_outcomes — Utility Tools (Compact Pill)

```tsx
function ScheduleRenderer({ part }: { part: any }) {
  const status = toolStatus(part.state);
  return (
    <Tool status={status}>
      <ToolIcon><Clock className="h-4 w-4" /></ToolIcon>
      <ToolTitle>
        {part.state === 'output-available'
          ? `Scheduled: ${part.input?.name ?? 'Task'}`
          : 'Scheduling task...'}
      </ToolTitle>
    </Tool>
  );
}

function AnalyticsRenderer({ part }: { part: any }) {
  const status = toolStatus(part.state);
  return (
    <Tool status={status}>
      <ToolIcon><BarChart className="h-4 w-4" /></ToolIcon>
      <ToolTitle>
        {part.state === 'output-available'
          ? `Results from ${part.input?.source ?? 'analytics'}`
          : 'Checking outcomes...'}
      </ToolTitle>
      {part.state === 'output-available' && part.output && (
        <ToolContent>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(part.output, null, 2)}
          </pre>
        </ToolContent>
      )}
    </Tool>
  );
}
```

### 8.12 Dynamic Tools (Composio, Devices, MCP)

```tsx
function DynamicToolRenderer({ part }: { part: any }) {
  const status = toolStatus(part.state);
  const name = part.toolName ?? 'unknown';

  return (
    <Tool status={status}>
      <ToolIcon>{toolIcon(name)}</ToolIcon>
      <ToolTitle>{toolLabel(name)}</ToolTitle>
      {part.state === 'output-available' && part.output && (
        <ToolContent>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(part.output, null, 2)}
          </pre>
        </ToolContent>
      )}
      {part.state === 'output-error' && (
        <ToolContent>
          <p className="text-sm text-destructive">{part.errorText ?? 'Tool execution failed'}</p>
        </ToolContent>
      )}
    </Tool>
  );
}
```

### 8.13 Generic Fallback

```tsx
function GenericToolRenderer({ part }: { part: any }) {
  const status = toolStatus(part.state);
  const name = part.type?.replace('tool-', '') ?? 'unknown';

  return (
    <Tool status={status}>
      <ToolIcon><HelpCircle className="h-4 w-4" /></ToolIcon>
      <ToolTitle>{toolLabel(name)}</ToolTitle>
      {part.state === 'output-available' && part.output && (
        <ToolContent>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(part.output, null, 2)}
          </pre>
        </ToolContent>
      )}
    </Tool>
  );
}
```

---

## 9. Canvas / Workspace Panel — E2B Integration

The canvas panel is the right-side workspace that shows the agent's live environment. It is driven entirely by the `agentWorkspace.sidebarType` Redux field.

### 9.1 The AgentCanvas Component

```tsx
// components/agent-canvas.tsx
'use client';

import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setAgentWorkspace } from '@/store/slices/agentWorkspace';
import { WebPreview } from '@/components/ai-elements/web-preview';
import { Terminal } from '@/components/ai-elements/terminal';
import { CodeBlock } from '@/components/ai-elements/code-block';
import { FileTree } from '@/components/ai-elements/file-tree';
import { Sandbox } from '@/components/ai-elements/sandbox';
import { Image } from '@/components/ai-elements/image';
import { Sources, Source } from '@/components/ai-elements/sources';
import { X, Maximize2, Minimize2 } from 'lucide-react';

export function AgentCanvas() {
  const dispatch = useAppDispatch();
  const sidebarType = useAppSelector(s => s.agentWorkspace.sidebarType);
  const isFullscreen = useAppSelector(s => s.agentWorkspace.isSidebarPreviewFullscreen);

  // Data from various slices
  const codeViewer = useAppSelector(s => s.codeViewer);
  const searchResults = useAppSelector(s => s.agentWorkspace.chatReplySearchResults);

  if (!sidebarType) return null;

  return (
    <div className={`flex flex-col border-l bg-background ${
      isFullscreen ? 'fixed inset-0 z-50' : 'w-1/2'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="text-sm font-medium capitalize">{sidebarType}</span>
        <div className="flex gap-1">
          <button onClick={() => dispatch(setAgentWorkspace({
            isSidebarPreviewFullscreen: !isFullscreen
          }))}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button onClick={() => dispatch(setAgentWorkspace({ sidebarType: null }))}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderCanvasContent(sidebarType, { codeViewer, searchResults })}
      </div>
    </div>
  );
}

function renderCanvasContent(
  type: string,
  data: { codeViewer: any; searchResults: any }
) {
  switch (type) {
    case 'browser':
      // Connect to E2B sandbox VNC or screenshot stream
      return (
        <WebPreview
          src={`https://${getSandboxId()}-6080.e2b.dev`}
          className="h-full w-full"
        />
      );

    case 'terminal':
      // Connect to E2B sandbox terminal WebSocket
      return (
        <Terminal
          className="h-full"
          // lines from WebSocket stream
        />
      );

    case 'code':
      return (
        <Sandbox className="h-full">
          <CodeBlock
            language="python"
            value={data.codeViewer.fileDataSource[data.codeViewer.activeTabId] ?? ''}
            showLineNumbers
          />
          <Terminal lines={[]} />
        </Sandbox>
      );

    case 'file':
      return (
        <div className="flex h-full">
          <div className="w-60 border-r overflow-auto">
            <FileTree files={data.codeViewer.directoryList} />
          </div>
          <div className="flex-1 overflow-auto">
            <CodeBlock
              language={detectLanguage(data.codeViewer.activeTabId ?? '')}
              value={data.codeViewer.fileDataSource[data.codeViewer.activeTabId] ?? ''}
              showLineNumbers
            />
          </div>
        </div>
      );

    case 'preview':
      return (
        <WebPreview
          src={getDeployedUrl()}
          className="h-full w-full"
        />
      );

    case 'image':
      return (
        <div className="flex items-center justify-center h-full p-4">
          <Image
            src={getLatestImageUrl()}
            alt="Generated image"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      );

    case 'search':
      return (
        <div className="p-4 overflow-auto h-full">
          <Sources>
            {(data.searchResults ?? []).map((r: any, i: number) => (
              <Source key={i} href={r.url} title={r.title} index={i + 1}>
                {r.snippet}
              </Source>
            ))}
          </Sources>
        </div>
      );

    default:
      return <div className="p-4 text-muted-foreground">No content</div>;
  }
}
```

### 9.2 E2B Sandbox Connection

The E2B sandbox provides the execution environment. Here is how to connect:

```tsx
// lib/e2b.ts
import { Sandbox } from '@e2b/code-interpreter';

let sandbox: Sandbox | null = null;

export async function getOrCreateSandbox(sessionId: string) {
  if (!sandbox) {
    sandbox = await Sandbox.create({
      template: 'your-template-id',
      metadata: { sessionId },
    });
  }
  return sandbox;
}

// For terminal streaming:
export function connectTerminal(sandboxId: string) {
  const ws = new WebSocket(`wss://${sandboxId}-terminal.e2b.dev`);
  return ws;
}

// For browser VNC:
export function getBrowserUrl(sandboxId: string) {
  return `https://${sandboxId}-6080.e2b.dev`;
}

// For file operations:
export async function listFiles(sandbox: Sandbox, path: string) {
  return await sandbox.filesystem.list(path);
}

export async function readFile(sandbox: Sandbox, path: string) {
  return await sandbox.filesystem.read(path);
}
```

---

## 10. Backend API Route — streamText Configuration

Here is the complete backend API route that defines all 33 tools with proper AI SDK v6 patterns:

```tsx
// app/api/chat/route.ts
import { convertToModelMessages, streamText, UIMessage, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { getOrCreateSandbox } from '@/lib/e2b';

export const maxDuration = 120; // Agent tasks can be long

export async function POST(req: Request) {
  const { messages, sessionId }: { messages: UIMessage[]; sessionId: string } = await req.json();

  const sandbox = await getOrCreateSandbox(sessionId);

  const result = streamText({
    model: 'your-model-provider',
    messages: await convertToModelMessages(messages),
    sendReasoning: true,
    stopWhen: stepCountIs(25),

    tools: {
      // ─── 1. PLANNING ───
      show_plan: tool({
        description: 'Create/update a progress plan for multi-step tasks',
        inputSchema: z.object({
          title: z.string(),
          todos: z.array(z.object({
            id: z.string(),
            label: z.string(),
            status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
          })),
        }),
        execute: async (input) => input, // Echo back — no sandbox needed
      }),

      // ─── 2. COMMUNICATION ───
      message_notify_user: tool({
        description: 'Send a notification to the user without requiring a response',
        inputSchema: z.object({
          text: z.string(),
          attachments: z.array(z.string()).optional(),
        }),
        execute: async (input) => ({ notified: true, text: input.text }),
      }),

      message_ask_user: {
        description: 'Ask the user a question and wait for their response',
        inputSchema: z.object({
          text: z.string(),
          attachments: z.array(z.string()).optional(),
          suggest_user_takeover: z.enum(['none', 'browser']).optional(),
        }),
        // No execute — client-side tool requiring user interaction
      },

      // ─── 3. FILE SYSTEM ───
      file_read: tool({
        description: 'Read file content from sandbox',
        inputSchema: z.object({
          file: z.string(),
          start_line: z.number().optional(),
          end_line: z.number().optional(),
        }),
        execute: async ({ file, start_line, end_line }) => {
          const content = await sandbox.filesystem.read(file);
          if (start_line || end_line) {
            const lines = content.split('\n');
            return { content: lines.slice((start_line ?? 1) - 1, end_line).join('\n') };
          }
          return { content };
        },
      }),

      file_write: tool({
        description: 'Write or append content to a file',
        inputSchema: z.object({
          file: z.string(),
          content: z.string(),
          append: z.boolean().optional(),
        }),
        execute: async ({ file, content, append }) => {
          if (append) {
            const existing = await sandbox.filesystem.read(file).catch(() => '');
            await sandbox.filesystem.write(file, existing + content);
          } else {
            await sandbox.filesystem.write(file, content);
          }
          return { success: true, file };
        },
      }),

      file_str_replace: tool({
        description: 'Find and replace a string in a file',
        inputSchema: z.object({
          file: z.string(),
          old_str: z.string(),
          new_str: z.string(),
        }),
        execute: async ({ file, old_str, new_str }) => {
          const content = await sandbox.filesystem.read(file);
          const updated = content.replace(old_str, new_str);
          await sandbox.filesystem.write(file, updated);
          return { success: true, file };
        },
      }),

      file_find_in_content: tool({
        description: 'Search for a regex pattern within a file',
        inputSchema: z.object({ file: z.string(), regex: z.string() }),
        execute: async ({ file, regex }) => {
          const result = await sandbox.process.startAndWait(`grep -n -E '${regex}' ${file}`);
          return { matches: result.stdout };
        },
      }),

      file_find_by_name: tool({
        description: 'Find files matching a glob pattern',
        inputSchema: z.object({ path: z.string(), glob: z.string() }),
        execute: async ({ path, glob }) => {
          const result = await sandbox.process.startAndWait(`find ${path} -name '${glob}'`);
          return { files: result.stdout.split('\n').filter(Boolean) };
        },
      }),

      // ─── 4. SHELL SESSIONS ───
      shell_exec: tool({
        description: 'Execute a command in a shell session',
        inputSchema: z.object({
          id: z.string(),
          exec_dir: z.string().optional(),
          command: z.string(),
        }),
        execute: async ({ command, exec_dir }) => {
          const cmd = exec_dir ? `cd ${exec_dir} && ${command}` : command;
          const result = await sandbox.process.startAndWait(cmd);
          return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
        },
      }),

      // shell_view, shell_wait, shell_write_to_process, shell_kill_process
      // follow the same pattern...

      // ─── 5. CODE EXECUTION ───
      code_execute: tool({
        description: 'Run code in the sandbox',
        inputSchema: z.object({
          code: z.string(),
          language: z.enum(['python', 'javascript', 'bash']).optional(),
          timeout: z.number().optional(),
        }),
        execute: async ({ code, language }) => {
          const execution = await sandbox.runCode(code, { language: language ?? 'python' });
          return {
            stdout: execution.logs.stdout.join('\n'),
            stderr: execution.logs.stderr.join('\n'),
            results: execution.results,
          };
        },
      }),

      // ─── 6. WEB SEARCH ───
      web_search: tool({
        description: 'Search the web for information',
        inputSchema: z.object({
          query: z.string(),
          date_range: z.string().optional(),
          num_results: z.number().max(10).optional(),
        }),
        execute: async ({ query, num_results }) => {
          const res = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: { 'X-API-KEY': process.env.SERPER_API_KEY!, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query, num: num_results ?? 5 }),
          });
          const data = await res.json();
          return { results: data.organic ?? [] };
        },
      }),

      // ─── 7. BROWSER (13 tools) ───
      browser_navigate: tool({
        description: 'Navigate the browser to a URL',
        inputSchema: z.object({ url: z.string() }),
        execute: async ({ url }) => {
          const result = await sandbox.process.startAndWait(
            `curl -s http://localhost:9821/navigate -d '{"url":"${url}"}'`
          );
          return { url, screenshot_url: JSON.parse(result.stdout).screenshot };
        },
      }),
      // browser_view, browser_click, etc. follow the same Playwright controller pattern...

      // ─── 8. DEPLOYMENT ───
      deploy_expose_port: tool({
        description: 'Expose a sandbox port publicly',
        inputSchema: z.object({ port: z.number() }),
        execute: async ({ port }) => {
          const url = `https://${sandbox.getHostname(port)}`;
          return { url, port };
        },
      }),

      deploy_apply_deployment: tool({
        description: 'Deploy to production',
        inputSchema: z.object({
          type: z.enum(['static', 'nextjs']),
          local_dir: z.string(),
        }),
        execute: async ({ type, local_dir }) => {
          // Tar, upload, deploy logic
          return { url: `https://deployed-site.example.com`, type };
        },
      }),

      // ─── 9. IMAGE GENERATION ───
      generate_image: tool({
        description: 'Generate an image using AI',
        inputSchema: z.object({
          prompt: z.string(),
          filename: z.string().optional(),
        }),
        execute: async ({ prompt, filename }) => {
          // Call image generation API
          return { url: 'https://...', filename: filename ?? 'generated.png' };
        },
      }),

      // ─── 10. SCHEDULING ───
      schedule_recurring_task: tool({
        description: 'Schedule a recurring agent task',
        inputSchema: z.object({
          name: z.string(),
          description: z.string(),
          schedule: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
          day_of_week: z.string().optional(),
          time: z.string().optional(),
        }),
        execute: async (input) => {
          // POST to task service
          return { scheduled: true, ...input };
        },
      }),

      // ─── 11. ANALYTICS ───
      check_outcomes: tool({
        description: 'Check results/engagement from previous work',
        inputSchema: z.object({
          source: z.enum(['social_media', 'email', 'website', 'custom']),
          platform: z.string().optional(),
          timeframe: z.string().optional(),
        }),
        execute: async (input) => {
          // Call analytics API
          return { source: input.source, metrics: {} };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
```

---

## 11. Complete Data Flow — End to End

Here is the complete lifecycle of a user message through the system:

```
1. USER TYPES MESSAGE
   └─→ <PromptInput> captures text + files
   └─→ sendMessage({ text, files })

2. REQUEST SENT
   └─→ useChat status: 'submitted'
   └─→ DefaultChatTransport POSTs to /api/chat
   └─→ Redux: dispatch(setWebsocket({ taskFinished: false }))

3. BACKEND PROCESSES
   └─→ streamText() calls the LLM
   └─→ LLM generates reasoning tokens → streamed as 'reasoning' parts
   └─→ LLM generates text → streamed as 'text' parts
   └─→ LLM calls tools → streamed as 'tool-{name}' parts
       └─→ Server-side tools: execute() runs, output streamed back
       └─→ Client-side tools: input streamed, waiting for addToolOutput

4. FRONTEND RECEIVES STREAM
   └─→ useChat status: 'streaming'
   └─→ messages[] updated with new parts
   └─→ MessageParts component re-renders

5. PART RENDERING (for each part in message.parts)
   └─→ 'reasoning' → <Reasoning> (collapsible)
   └─→ 'text' → <Markdown>
   └─→ 'source-url' → collected → <Sources> at end
   └─→ 'tool-show_plan' → <Plan> + <Task> (standalone)
   └─→ 'tool-web_search' → <Tool> + <Sources>
   └─→ 'tool-browser_*' → <Tool> (compact) + dispatch sidebarType='browser'
   └─→ 'tool-file_*' → <Tool> + <CodeBlock> + dispatch sidebarType='file'
   └─→ 'tool-shell_*' → <Tool> + <Terminal> + dispatch sidebarType='terminal'
   └─→ 'tool-code_execute' → <Tool> + <Sandbox> + dispatch sidebarType='code'
   └─→ 'tool-generate_image' → <Tool> + <Image> + dispatch sidebarType='image'
   └─→ 'tool-deploy_*' → <Tool> + URL + dispatch sidebarType='preview'
   └─→ 'tool-message_ask_user' → <Confirmation> → user responds → addToolOutput
   └─→ 'dynamic-tool' → <Tool> generic

6. CANVAS PANEL UPDATES
   └─→ agentWorkspace.sidebarType changes
   └─→ AgentCanvas re-renders with matching component
   └─→ E2B sandbox provides live data (VNC, terminal WS, filesystem)

7. TOOL APPROVAL (if needsApproval: true)
   └─→ part.state === 'approval-requested'
   └─→ <Confirmation> renders Approve/Deny buttons
   └─→ User clicks → addToolApprovalResponse({ id, approved })
   └─→ sendAutomaticallyWhen triggers re-submission

8. MULTI-STEP CONTINUATION
   └─→ sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls
   └─→ When all tool outputs available, auto-sends to continue
   └─→ Loop back to step 3

9. STREAM COMPLETE
   └─→ useChat status: 'ready'
   └─→ onFinish callback fires
   └─→ Redux: dispatch(setWebsocket({ taskFinished: true }))
   └─→ <Suggestion> chips appear for follow-up actions
```

---

## 12. Installation Checklist

### 12.1 Install Elements AI Components

```bash
# Core chatbot components
npx ai-elements@latest add conversation message reasoning sources \
  inline-citation suggestion plan task tool confirmation shimmer \
  attachments prompt-input queue checkpoint

# Code/workspace components
npx ai-elements@latest add code-block terminal file-tree sandbox \
  web-preview artifact agent snippet stack-trace test-results

# Media
npx ai-elements@latest add image

# Workflow (if using canvas workflow view)
npx ai-elements@latest add canvas node edge connection controls panel toolbar
```

### 12.2 Install Dependencies

```bash
# AI SDK v6
npm install ai @ai-sdk/react

# E2B
npm install @e2b/code-interpreter

# State management
npm install @reduxjs/toolkit react-redux

# Icons
npm install lucide-react

# Markdown rendering
npm install react-markdown remark-gfm rehype-highlight
```

### 12.3 File Structure

```
app/
  api/
    chat/
      route.ts          ← Backend: streamText + all 33 tools
  chat/
    page.tsx            ← Chat page
components/
  ai-elements/          ← Auto-generated by npx ai-elements
  message-parts.tsx     ← The master renderer (Section 7)
  agent-canvas.tsx      ← Canvas panel (Section 9)
  markdown.tsx          ← Markdown renderer
lib/
  e2b.ts               ← E2B sandbox management
store/
  slices/
    agentWorkspace.ts   ← sidebarType, isPlannerExpanded, etc.
    sessions.ts         ← currentSessionId, session entities
    websocket.ts        ← status, taskFinished
    codeViewer.ts       ← directoryList, fileDataSource
    chat.ts             ← files, inputMode, taskMode
    ui.ts               ← isMobile, windowWidth
  hooks.ts              ← useAppSelector, useAppDispatch
  store.ts              ← configureStore
```

---

## References

[1] AI SDK v6 Documentation — useChat Reference. https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat

[2] Elements AI Component Registry. https://elements.ai-sdk.dev/

[3] AI SDK v6 — Chatbot Tool Usage. https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage

[4] AI SDK v6 — Chatbot Guide. https://ai-sdk.dev/docs/ai-sdk-ui/chatbot

[5] E2B Code Interpreter SDK. https://e2b.dev/docs
