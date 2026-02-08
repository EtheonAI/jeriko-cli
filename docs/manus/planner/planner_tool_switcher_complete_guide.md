# Manus Planner + Tool Switcher: Complete Architecture & AI SDK Implementation

**Author:** Manus AI
**Date:** February 7, 2026

---

## 1. How Manus's Planning System Works (Actual Redux State)

The planner UI that appears above the prompt is not driven by a dedicated `plan` slice. Instead, it is a **derived view** built from 5 WebSocket event types stored in the `websocket.entities` normalized store, plus a single boolean in `agentWorkspace`.

### 1.1 The State Slices That Power the Planner

| Slice | Property | Type | Purpose |
|---|---|---|---|
| `agentWorkspace` | `isPlannerExpanded` | `boolean` (default: `false`) | Controls whether the planner panel is visible/expanded above the prompt |
| `websocket` | `entities` | `Record<string, WebSocketEvent>` | Normalized store of ALL events — plan, tool, status, explanation |
| `websocket` | `ids` | `string[]` | Ordered list of event IDs (chronological) |
| `timeline` | `percentage` | `number` (0-100) | Overall progress percentage |

### 1.2 The 5 Event Types That Build the Plan

I extracted these directly from the Redux state. Here is the exact shape of each event:

#### Event 1: `planUpdate` — The Master Plan

This is the primary event. It contains the **full list of all plan steps** with their current statuses. It is emitted whenever the plan is created or any step changes status.

```json
{
  "type": "event",
  "event": {
    "type": "planUpdate",
    "tasks": [
      { "status": "doing",  "title": "Read and analyze the Redux state JSON file", "startedAt": 1770456589171 },
      { "status": "todo",   "title": "Extract state slices and their keys into structured JSON", "startedAt": 0 },
      { "status": "todo",   "title": "Deliver the extracted state slices to the user", "startedAt": 0 }
    ]
  }
}
```

**Status values:** `"todo"` | `"doing"` | `"done"`

#### Event 2: `newPlanStep` — Step Activation

Fired when a new step becomes the active step. Contains the `stepId` (which matches the `planUpdate` event's ID) and the step's title.

```json
{
  "type": "event",
  "event": {
    "type": "newPlanStep",
    "stepId": "OqdHDrG5fhKhAX5vrXAdjJ",
    "title": "Read and analyze the Redux state JSON file"
  }
}
```

#### Event 3: `toolUsed` — Tool Execution (Linked to Plan Step)

Every tool call is linked to the current plan step via `planStepId`. This is the critical link between the planner and the canvas.

```json
{
  "type": "event",
  "event": {
    "type": "toolUsed",
    "tool": "text_editor",
    "planStepId": "OqdHDrG5fhKhAX5vrXAdjJ",
    "brief": "Read the content of the uploaded state(7).json file.",
    "description": "Reading file `upload/state(7).json`",
    "message": { "action": "Reading file", "param": "upload/state(7).json" },
    "detail": {
      "textEditor": {
        "action": "read",
        "path": "/home/ubuntu/upload/state(7).json",
        "content": "..."
      }
    }
  }
}
```

#### Event 4: `explanation` — Agent Reasoning (Linked to Plan Step)

```json
{
  "type": "event",
  "event": {
    "type": "explanation",
    "planStepId": "OqdHDrG5fhKhAX5vrXAdjJ",
    "content": "Analyzing the Redux state JSON to identify all state slices...",
    "status": "end"
  }
}
```

#### Event 5: `liveStatus` — Real-Time Activity

```json
{ "type": "event", "event": { "type": "liveStatus", "text": "Thinking" } }
{ "type": "event", "event": { "type": "liveStatus", "text": "Using terminal" } }
{ "type": "event", "event": { "type": "liveStatus", "text": "Editing file extract_slices.py" } }
```

### 1.3 How the Frontend Derives the Planner UI

```
websocket.entities (all events)
       │
       ├── Filter by type === "planUpdate"
       │   └── Take the LAST one → tasks[] → Plan steps
       │
       ├── Filter by type === "newPlanStep"
       │   └── Take the LAST one → stepId → Active step
       │
       ├── Filter by type === "toolUsed"
       │   └── Group by planStepId → Tools used per step
       │
       ├── Filter by type === "explanation"
       │   └── Group by planStepId → Reasoning per step
       │
       └── Filter by type === "liveStatus"
           └── Take the LAST one → Current activity text

agentWorkspace.isPlannerExpanded → Show/hide the panel
timeline.percentage → Overall progress bar
```

### 1.4 The Plan → Tool → Canvas Connection

This is the key relationship you asked about:

```
User clicks a plan step
  → Step has toolsUsed[] (from toolUsed events with matching planStepId)
  → Each tool has a "tool" field (e.g., "text_editor", "terminal", "browser")
  → The tool field determines the canvas view:
      "text_editor"  → CodeIDE view
      "terminal"     → Terminal view
      "browser"      → Browser view
  → The tool's "detail" field contains the data to display:
      detail.textEditor.content → file content for CodeIDE
      detail.terminal.output   → terminal output for Terminal
      detail.browser.screenshot → screenshot for Browser
```

---

## 2. Mapping to AI SDK v6 + tool-ui `Plan` Component

### 2.1 Status Mapping

| Manus `planUpdate` Status | tool-ui `PlanTodo` Status |
|---|---|
| `"todo"` | `"pending"` |
| `"doing"` | `"in_progress"` |
| `"done"` | `"completed"` |
| *(no equivalent)* | `"cancelled"` |

### 2.2 The `showPlan` Tool Definition

In AI SDK v6, the plan is created by a dedicated tool that the agent calls. Instead of WebSocket events, the tool's return value is streamed as a `tool-result` part in the message.

```typescript
// app/api/chat/tools/showPlan.ts
import { tool } from 'ai';
import { z } from 'zod';

const PlanStepToolSchema = z.object({
  toolName: z.string().describe('Name of the tool used (e.g., shell_exec, browser_navigate)'),
  toolCallId: z.string().describe('The unique ID of the tool call'),
  canvasView: z.enum(['Terminal', 'Browser', 'CodeIDE', 'FilePreview', 'Empty'])
    .describe('Which canvas view this tool maps to'),
  brief: z.string().optional().describe('Short description of what the tool did'),
});

const PlanTodoSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  description: z.string().optional(),
  toolsUsed: z.array(PlanStepToolSchema).optional(),
});

export const showPlan = tool({
  description: `Display or update the implementation plan. Call this tool:
  1. At the start of a task to show the initial plan.
  2. After completing each step to update the status and add toolsUsed.
  3. When the plan needs to be revised.`,
  inputSchema: z.object({
    title: z.string(),
    description: z.string().optional(),
    todos: z.array(PlanTodoSchema).min(1),
  }),
  execute: async ({ title, description, todos }) => {
    return {
      id: `plan-${Date.now()}`,
      title,
      description,
      todos,
    };
  },
});
```

### 2.3 How the Agent Uses It (Multi-Step Flow)

```
Step 1: Agent calls showPlan with initial todos (all "pending")
Step 2: Agent calls shell_exec to run a command
Step 3: Agent calls showPlan again with step 1 → "completed" + toolsUsed: [{ toolName: "shell_exec", ... }]
Step 4: Agent calls browser_navigate to browse a page
Step 5: Agent calls showPlan again with step 2 → "completed" + toolsUsed: [{ toolName: "browser_navigate", ... }]
...and so on
```

Each `showPlan` call replaces the previous plan in the UI, creating a live-updating planner.

---

## 3. The Complete JSX Components

### 3.1 `PlannerWithToolSwitcher.tsx`

This component wraps the tool-ui `Plan` component and adds clickable tool tabs to each step. When a user clicks a tool tab, it fires `onToolSelect`, which changes the canvas view.

```tsx
'use client';

import React, { useMemo } from 'react';
import {
  Loader2,
  Check,
  X,
  MoreHorizontal,
  ChevronRight,
  Terminal,
  Code,
  Globe,
  FileText,
  Monitor,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

export type PlanTodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type PlanStepTool = {
  toolName: string;
  toolCallId: string;
  canvasView: 'Terminal' | 'Browser' | 'CodeIDE' | 'FilePreview' | 'Empty';
  brief?: string;
};

export type PlanTodoWithTools = {
  id: string;
  label: string;
  status: PlanTodoStatus;
  description?: string;
  toolsUsed?: PlanStepTool[];
};

export type PlannerProps = {
  id: string;
  title: string;
  description?: string;
  todos: PlanTodoWithTools[];
  onToolSelect: (toolCallId: string, canvasView: PlanStepTool['canvasView']) => void;
  activeToolCallId?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  liveStatusText?: string;
};

// ============================================================
// Sub-Components
// ============================================================

function TodoIcon({ status }: { status: PlanTodoStatus }) {
  if (status === 'pending') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[#333] bg-[#16162a]" />
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-[#16162a] shadow-[0_0_0_4px_rgba(59,130,246,0.1)]">
        <Loader2 className="size-4 text-blue-400 animate-spin" style={{ animationDuration: '0.7s' }} />
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-emerald-500 bg-emerald-500 shadow-sm">
        <Check className="size-4 text-white" strokeWidth={3} />
      </span>
    );
  }
  if (status === 'cancelled') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-red-500 bg-red-500 shadow-sm">
        <X className="size-4 text-white" strokeWidth={3} />
      </span>
    );
  }
  return null;
}

function ToolIcon({ canvasView }: { canvasView: PlanStepTool['canvasView'] }) {
  switch (canvasView) {
    case 'Terminal':
      return <Terminal className="size-3" />;
    case 'CodeIDE':
      return <Code className="size-3" />;
    case 'Browser':
      return <Globe className="size-3" />;
    case 'FilePreview':
      return <FileText className="size-3" />;
    default:
      return <Monitor className="size-3" />;
  }
}

function ToolTab({
  tool,
  isActive,
  onClick,
}: {
  tool: PlanStepTool;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`
        flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium
        transition-all duration-150 cursor-pointer
        ${isActive
          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
          : 'bg-[#1e1e2e] text-gray-400 hover:bg-[#2a2a3e] hover:text-gray-200'
        }
      `}
    >
      <ToolIcon canvasView={tool.canvasView} />
      <span>{formatToolName(tool.toolName)}</span>
    </button>
  );
}

function formatToolName(name: string): string {
  // shell_exec → Terminal, browser_navigate → Browser, file_write → Editor
  if (name.startsWith('shell_')) return 'Terminal';
  if (name.startsWith('browser_')) return 'Browser';
  if (name.startsWith('file_')) return 'Editor';
  if (name === 'info_search_web') return 'Search';
  return name.replace(/_/g, ' ');
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="relative h-1.5 overflow-hidden rounded-full bg-[#1e1e2e]">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          progress === 100
            ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400'
            : 'bg-blue-500'
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function PlannerWithToolSwitcher({
  id,
  title,
  description,
  todos,
  onToolSelect,
  activeToolCallId,
  isExpanded = true,
  onToggleExpand,
  liveStatusText,
}: PlannerProps) {
  const { completedCount, progress } = useMemo(() => {
    const completed = todos.filter(t => t.status === 'completed').length;
    return {
      completedCount: completed,
      progress: Math.round((completed / todos.length) * 100),
    };
  }, [todos]);

  const allComplete = completedCount === todos.length;

  return (
    <div
      className="w-full rounded-xl border border-[#1e1e2e] bg-[#0d0d1a] overflow-hidden"
      data-plan-id={id}
    >
      {/* Header — always visible, clickable to expand/collapse */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#12121e] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <ChevronRight
            className={`size-4 text-gray-500 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
          <div className="text-left">
            <h3 className="text-sm font-medium text-gray-200">{title}</h3>
            {liveStatusText && (
              <p className="text-xs text-blue-400 mt-0.5 animate-pulse">{liveStatusText}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {completedCount}/{todos.length}
          </span>
          {allComplete && <Check className="size-4 text-emerald-500" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <ProgressBar progress={progress} />
          </div>

          {/* Description */}
          {description && (
            <p className="text-xs text-gray-500 mb-3">{description}</p>
          )}

          {/* Todo List */}
          <ul className="space-y-1">
            {todos.map((todo, index) => (
              <li key={todo.id} className="relative">
                {/* Connector line */}
                {index < todos.length - 1 && (
                  <div
                    className="absolute left-3 top-7 w-px bg-[#1e1e2e]"
                    style={{ height: 'calc(100% + 0.25rem)' }}
                  />
                )}

                {/* Todo Item */}
                <div className="flex items-start gap-3 py-1.5 px-2 rounded-md hover:bg-[#12121e] transition-colors">
                  <div className="relative z-10 mt-0.5">
                    <TodoIcon status={todo.status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Label */}
                    <span
                      className={`text-sm font-medium leading-6 ${
                        todo.status === 'pending'
                          ? 'text-gray-500'
                          : todo.status === 'in_progress'
                          ? 'text-gray-200'
                          : todo.status === 'completed'
                          ? 'text-gray-500 line-through'
                          : 'text-red-400 line-through'
                      }`}
                    >
                      {todo.label}
                    </span>

                    {/* Description */}
                    {todo.description && (
                      <p className="text-xs text-gray-600 mt-0.5">{todo.description}</p>
                    )}

                    {/* Tool Tabs — THE KEY FEATURE */}
                    {todo.toolsUsed && todo.toolsUsed.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {todo.toolsUsed.map(tool => (
                          <ToolTab
                            key={tool.toolCallId}
                            tool={tool}
                            isActive={activeToolCallId === tool.toolCallId}
                            onClick={() => onToolSelect(tool.toolCallId, tool.canvasView)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

### 3.2 `usePlannerCanvas.ts` — The Hook That Connects Plan to Canvas

This hook processes the AI SDK messages to extract the plan data AND the tool results, creating a unified state that powers both the planner and the canvas.

```typescript
// app/hooks/usePlannerCanvas.ts
import { UIMessage } from 'ai';
import { useMemo, useState, useCallback } from 'react';
import type { PlanTodoWithTools, PlanStepTool } from '../components/PlannerWithToolSwitcher';

type CanvasView = 'Terminal' | 'Browser' | 'CodeIDE' | 'FilePreview' | 'Empty';

interface ToolSnapshot {
  toolCallId: string;
  toolName: string;
  canvasView: CanvasView;
  input: any;
  result: any;
}

interface PlannerCanvasState {
  // Planner props
  planId: string;
  planTitle: string;
  planDescription: string;
  todos: PlanTodoWithTools[];
  liveStatusText: string;

  // Canvas props (derived from selected tool)
  activeToolCallId: string | null;
  canvasViewType: CanvasView;
  canvasBrowserUrl: string;
  canvasBrowserScreenshot: string;
  canvasTerminalHistory: string[];
  canvasActiveFileName: string;
  canvasActiveFileContent: string;
  canvasIsWorking: boolean;

  // Actions
  selectTool: (toolCallId: string, canvasView: CanvasView) => void;
}

export function usePlannerCanvas(messages: UIMessage[]): PlannerCanvasState {
  const [selectedToolCallId, setSelectedToolCallId] = useState<string | null>(null);
  const [selectedCanvasView, setSelectedCanvasView] = useState<CanvasView>('Empty');

  const selectTool = useCallback((toolCallId: string, canvasView: CanvasView) => {
    setSelectedToolCallId(toolCallId);
    setSelectedCanvasView(canvasView);
  }, []);

  return useMemo(() => {
    // 1. Find the latest showPlan tool result
    let latestPlan: any = null;
    const toolSnapshots = new Map<string, ToolSnapshot>();

    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        // Collect showPlan results
        if (part.type === 'tool-showPlan' && part.state === 'result-available') {
          latestPlan = part.result;
        }

        // Collect ALL tool results as snapshots
        if (part.type?.startsWith('tool-') && part.state === 'result-available') {
          const toolName = part.toolName;
          const canvasView = toolNameToCanvasView(toolName);
          toolSnapshots.set(part.toolCallId, {
            toolCallId: part.toolCallId,
            toolName,
            canvasView,
            input: part.input,
            result: part.result,
          });
        }
      }
    }

    // 2. Build the plan todos
    const todos: PlanTodoWithTools[] = latestPlan?.todos ?? [];

    // 3. Get the selected tool's snapshot
    const selectedSnapshot = selectedToolCallId
      ? toolSnapshots.get(selectedToolCallId)
      : null;

    // 4. Derive canvas props from the selected snapshot
    let browserUrl = '';
    let browserScreenshot = '';
    let terminalHistory: string[] = [];
    let activeFileName = '';
    let activeFileContent = '';

    if (selectedSnapshot) {
      switch (selectedSnapshot.canvasView) {
        case 'Browser':
          browserUrl = selectedSnapshot.input?.url ?? '';
          browserScreenshot = selectedSnapshot.result?.screenshot ?? '';
          break;
        case 'Terminal':
          terminalHistory = [
            `$ ${selectedSnapshot.input?.command ?? ''}\n${selectedSnapshot.result?.stdout ?? ''}${selectedSnapshot.result?.stderr ?? ''}`,
          ];
          break;
        case 'CodeIDE':
          activeFileName = selectedSnapshot.input?.file ?? '';
          activeFileContent = selectedSnapshot.result?.content ?? selectedSnapshot.input?.content ?? '';
          break;
      }
    }

    // 5. Get the latest liveStatus-like text
    let liveStatusText = '';
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (part.type === 'text') {
          // The last text chunk can serve as a live status
        }
        if (part.state === 'executing') {
          liveStatusText = `Using ${part.toolName?.replace(/_/g, ' ')}...`;
        }
      }
    }

    return {
      planId: latestPlan?.id ?? 'plan-default',
      planTitle: latestPlan?.title ?? 'Working...',
      planDescription: latestPlan?.description ?? '',
      todos,
      liveStatusText,

      activeToolCallId: selectedToolCallId,
      canvasViewType: selectedSnapshot?.canvasView ?? selectedCanvasView,
      canvasBrowserUrl: browserUrl,
      canvasBrowserScreenshot: browserScreenshot,
      canvasTerminalHistory: terminalHistory,
      canvasActiveFileName: activeFileName,
      canvasActiveFileContent: activeFileContent,
      canvasIsWorking: liveStatusText !== '',

      selectTool,
    };
  }, [messages, selectedToolCallId, selectedCanvasView, selectTool]);
}

function toolNameToCanvasView(toolName: string): CanvasView {
  if (toolName.startsWith('shell_')) return 'Terminal';
  if (toolName.startsWith('browser_')) return 'Browser';
  if (toolName.startsWith('file_')) return 'CodeIDE';
  if (toolName === 'info_search_web') return 'Browser';
  return 'Empty';
}
```

### 3.3 `page.tsx` — The Full Page Wiring Everything Together

```tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import { PlannerWithToolSwitcher } from './components/PlannerWithToolSwitcher';
import { ManusCanvas } from './components/ManusCanvas';
import { usePlannerCanvas } from './hooks/usePlannerCanvas';

export default function AgentPage() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  const [isPlannerExpanded, setIsPlannerExpanded] = useState(true);

  const {
    planId,
    planTitle,
    planDescription,
    todos,
    liveStatusText,
    activeToolCallId,
    canvasViewType,
    canvasBrowserUrl,
    canvasBrowserScreenshot,
    canvasTerminalHistory,
    canvasActiveFileName,
    canvasActiveFileContent,
    canvasIsWorking,
    selectTool,
  } = usePlannerCanvas(messages);

  return (
    <div className="flex h-screen bg-[#0a0a14] text-white">
      {/* ===== LEFT PANEL: Planner + Chat ===== */}
      <div className="w-1/2 flex flex-col border-r border-[#1e1e2e]">

        {/* Planner — sits ABOVE the chat, just like in Manus */}
        <div className="border-b border-[#1e1e2e]">
          <PlannerWithToolSwitcher
            id={planId}
            title={planTitle}
            description={planDescription}
            todos={todos}
            onToolSelect={selectTool}
            activeToolCallId={activeToolCallId}
            isExpanded={isPlannerExpanded}
            onToggleExpand={() => setIsPlannerExpanded(!isPlannerExpanded)}
            liveStatusText={liveStatusText}
          />
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(m => (
            <div key={m.id} className="space-y-1">
              <span className="text-xs text-gray-500 font-medium">
                {m.role === 'user' ? 'You' : 'Manus'}
              </span>
              {m.parts.map((part, i) => {
                if (part.type === 'text') {
                  return <p key={i} className="text-sm text-gray-300">{part.text}</p>;
                }
                // Don't render showPlan tool calls in the chat — they're in the planner
                if (part.toolName === 'showPlan') return null;
                // Render other tool calls as compact badges
                if (part.type?.startsWith('tool-')) {
                  return (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#16162a] rounded text-xs text-gray-400 cursor-pointer hover:bg-[#1e1e2e]"
                      onClick={() => selectTool(part.toolCallId, toolNameToView(part.toolName))}
                    >
                      {part.toolName?.replace(/_/g, ' ')}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-[#1e1e2e]">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask Manus to do something..."
              className="flex-1 p-3 bg-[#12121e] rounded-lg border border-[#1e1e2e] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              className="px-5 py-3 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* ===== RIGHT PANEL: Canvas ===== */}
      <div className="w-1/2 p-4">
        <ManusCanvas
          viewType={canvasViewType}
          isWorking={canvasIsWorking}
          statusText={liveStatusText || 'Idle'}
          currentAction={activeToolCallId ? `Viewing tool result` : ''}
          browserUrl={canvasBrowserUrl}
          browserScreenshot={canvasBrowserScreenshot}
          terminalHistory={canvasTerminalHistory}
          activeFileName={canvasActiveFileName}
          activeFileContent={canvasActiveFileContent}
        />
      </div>
    </div>
  );
}

function toolNameToView(name: string): any {
  if (name?.startsWith('shell_')) return 'Terminal';
  if (name?.startsWith('browser_')) return 'Browser';
  if (name?.startsWith('file_')) return 'CodeIDE';
  return 'Empty';
}
```

---

## 4. The Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (API Route)                       │
│                                                                   │
│  ToolLoopAgent {                                                  │
│    tools: {                                                       │
│      showPlan,        ← Creates/updates the plan                  │
│      shell_exec,      ← Runs commands in E2B sandbox              │
│      browser_navigate,← Browses pages in sandbox browser          │
│      file_write,      ← Writes files in sandbox                   │
│      file_read,       ← Reads files from sandbox                  │
│      ...              ← All 29 tools                              │
│    }                                                              │
│  }                                                                │
│                                                                   │
│  Agent loop:                                                      │
│  1. Call showPlan({ todos: [step1: pending, step2: pending, ...] })│
│  2. Call shell_exec({ command: "..." })                           │
│  3. Call showPlan({ todos: [step1: completed + toolsUsed, ...] }) │
│  4. Call browser_navigate({ url: "..." })                         │
│  5. Call showPlan({ todos: [step2: completed + toolsUsed, ...] }) │
│  ...                                                              │
│                                                                   │
│  Each tool call is streamed as a UIMessage part via SSE            │
└───────────────────────────────┬─────────────────────────────────┘
                                │ SSE Stream
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js Page)                     │
│                                                                   │
│  useChat() → messages[]                                           │
│       │                                                           │
│       ▼                                                           │
│  usePlannerCanvas(messages)                                       │
│       │                                                           │
│       ├── Extracts latest showPlan result → plan todos            │
│       ├── Collects ALL tool snapshots (input + result)            │
│       ├── Tracks selectedToolCallId (user clicks)                 │
│       └── Derives canvas props from selected snapshot             │
│                                                                   │
│       ▼                              ▼                            │
│  ┌──────────────────┐    ┌──────────────────────┐                 │
│  │ PlannerWithTool   │    │ ManusCanvas           │                │
│  │ Switcher          │    │                       │                │
│  │                   │    │ Shows:                │                │
│  │ Step 1 ✓          │    │ - Terminal output     │                │
│  │   [Terminal]      │◄──►│ - Browser screenshot  │                │
│  │                   │    │ - Code editor         │                │
│  │ Step 2 ●          │    │ - File preview        │                │
│  │   [Browser][IDE]  │    │                       │                │
│  │                   │    │ Based on which tool   │                │
│  │ Step 3 ○          │    │ tab the user clicked  │                │
│  └──────────────────┘    └──────────────────────┘                 │
│                                                                   │
│  User clicks [Terminal] tab on Step 1                             │
│  → selectTool("tool-1", "Terminal")                               │
│  → Canvas switches to Terminal view with that tool's output       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Key Architectural Differences

| Aspect | Manus (Redux + WebSocket) | AI SDK v6 + tool-ui |
|---|---|---|
| **Plan storage** | `planUpdate` events in `websocket.entities` | `showPlan` tool results in `messages[].parts` |
| **Plan updates** | New `planUpdate` WebSocket event replaces the old one | Agent calls `showPlan` again with updated todos |
| **Tool-to-step linking** | `toolUsed.planStepId` field | `todos[].toolsUsed[]` array returned by `showPlan` |
| **Planner visibility** | `agentWorkspace.isPlannerExpanded` (Redux) | Local `useState` in the page component |
| **Live status** | `liveStatus` WebSocket event | Derived from `part.state === 'executing'` |
| **Canvas view switching** | `agentWorkspace.sidebarType` (Redux) | Local `useState` driven by `onToolSelect` callback |
| **State management** | 8 Redux slices + WebSocket | Zero Redux — just `useChat` + `usePlannerCanvas` hook |

---

## References

[1]: https://ai-sdk.dev/docs/agents/building-agents "AI SDK v6: Building Agents"
[2]: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage "AI SDK v6: Chatbot Tool Usage"
[3]: https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces "AI SDK v6: Generative User Interfaces"
[4]: https://github.com/assistant-ui/tool-ui/tree/main/components/tool-ui/plan "tool-ui Plan Component Source"
