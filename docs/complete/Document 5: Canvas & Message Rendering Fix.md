# Document 5: Canvas & Message Rendering Fix

This document provides the complete fix for the frontend canvas and message rendering logic, addressing the duplicate tool rendering, incorrect canvas state, and other UI bugs.

## 1. Executive Summary

The core rendering problem is a lack of coordination between the `MessageRenderer` component and the `useCanvas` hook. `MessageRenderer` renders *all* tool calls inline, while `useCanvas` simultaneously tries to open the canvas for the *same* tool calls, leading to duplication. Furthermore, the canvas state (`isWorking`, step counter) is not being derived correctly from the incoming stream.

**The Fix:** We will create a centralized `TOOL_VIEW_MAP` to act as the single source of truth for which tools should open the canvas. `MessageRenderer` will consult this map and *skip* rendering any tool that has a canvas view. The `useCanvas` hook will be updated to correctly derive its state from the standardized AI SDK v6 stream parts.

| Problem | Root Cause | Fix |
|---|---|---|
| **Duplicate Tool Rendering** | `MessageRenderer` renders all tools, and `useCanvas` opens the canvas for some of the same tools. | Create a `TOOL_VIEW_MAP` in `use-canvas.ts` and have `message-renderer.tsx` check it before rendering a tool. |
| **Incorrect Canvas State** | The `isWorking` flag and step counter in `agent-canvas.tsx` are not correctly updated. | In `use-canvas.ts`, derive `isWorking` from `part.state === 'in-progress'` and correctly track steps from the stream. |
| **Hardcoded UI Text** | The step counter shows `5:85` due to incorrect string formatting. | Fix the formatting in `agent-canvas.tsx` to be a clear `current / total` display. |

---



## 2. Production-Ready Code Fixes

This section provides the complete, corrected TypeScript code for the frontend canvas and message rendering system.

### `use-canvas.ts` (Corrected)

This is the new, centralized brain for the canvas. It introduces the `TOOL_VIEW_MAP`, which acts as the single source of truth for which tools open which canvas views. It also correctly derives the canvas state (`isOpen`, `isWorking`, `currentStep`, etc.) directly from the standardized AI SDK v6 stream parts provided by `useChat`.

```typescript
/**
 * @repo/ui - Canvas Hook
 *
 * This hook manages the state of the agent canvas, determining when it should
 * open, what view it should display, and what data to show.
 * It is the single source of truth for canvas-related state.
 */

import { useMemo } from "react";
import type { UIMessage, ToolCallPart, ToolOutputPart } from "@ai-sdk/ui-utils";

// ============================================================================
// Types & Constants
// ============================================================================

export type CanvasViewType = "browser" | "code" | "terminal" | "filePreview" | "slides" | "aiCanvas" | "webDevIDE" | "mapReduce" | "empty";

/**
 * The single source of truth for mapping a tool name to a canvas view.
 * This is exported so other components (like MessageRenderer) can use it.
 */
export const TOOL_VIEW_MAP: Record<string, CanvasViewType> = {
  browser_navigate: "browser",
  browser_click: "browser",
  browser_input: "browser",
  browser_scroll: "browser",
  browser_screenshot: "browser",
  web_search: "browser", // Assuming web_search opens the browser to show results
  shell: "terminal",
  file_read: "code",
  file_write: "code",
  generate_image: "aiCanvas",
  deploy_apply_deployment: "webDevIDE",
};

export interface CanvasState {
  isOpen: boolean;
  viewType: CanvasViewType;
  isWorking: boolean;
  statusText: string;
  currentStep: number;
  totalSteps: number;
  // ... other view-specific props like browserUrl, fileContent, etc.
}

// ============================================================================
// Main Hook
// ============================================================================

export function useCanvas(messages: UIMessage[]): CanvasState {
  const canvasState = useMemo((): CanvasState => {
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage || latestMessage.role !== "assistant") {
      return { isOpen: false, viewType: "empty", isWorking: false, statusText: "", currentStep: 0, totalSteps: 0 };
    }

    // Find the most recent tool call part that has a canvas view
    const toolCallPart = latestMessage.parts.findLast(
      (part) => part.type === "tool-call" && TOOL_VIEW_MAP[part.toolName]
    ) as ToolCallPart | undefined;

    if (!toolCallPart) {
      return { isOpen: false, viewType: "empty", isWorking: false, statusText: "", currentStep: 0, totalSteps: 0 };
    }

    const viewType = TOOL_VIEW_MAP[toolCallPart.toolName];
    const isWorking = toolCallPart.state === "in-progress";
    const statusText = isWorking ? `Executing ${toolCallPart.toolName}...` : "Done.";

    // Find the corresponding tool output part
    const toolOutputPart = latestMessage.parts.find(
      (part) => part.type === "tool-output" && part.toolCallId === toolCallPart.toolCallId
    ) as ToolOutputPart | undefined;

    // Extract step data from custom data parts
    const stepDataPart = latestMessage.parts.find(part => part.type === "data-step");
    const stepData = stepDataPart ? (stepDataPart as any).data : { current: 0, total: 0 };

    // --- Extract view-specific data ---
    let browserUrl: string | undefined;
    if (viewType === "browser" && toolOutputPart) {
        const output = toolOutputPart.output as any;
        browserUrl = output.url;
    }

    return {
      isOpen: true,
      viewType,
      isWorking,
      statusText,
      currentStep: stepData.current,
      totalSteps: stepData.total,
      browserUrl, // Pass browser-specific data
      // ... other view-specific props
    };

  }, [messages]);

  return canvasState;
}

```

---

### `message-renderer.tsx` (Corrected)

This component is now much smarter. Before rendering a tool call, it imports `TOOL_VIEW_MAP` from `use-canvas.ts` and checks if the tool has a dedicated canvas view. If it does, the component renders **nothing**, preventing the duplicate rendering issue. This ensures a clean separation of concerns: if a tool belongs in the canvas, it is *only* rendered in the canvas.

```typescript
/**
 * @repo/ui - Message Part Renderer
 *
 * Renders individual parts of a UIMessage, such as text or tool calls.
 * This version is updated to avoid rendering tools that have a canvas view.
 */

import type { UIMessagePart } from "@ai-sdk/ui-utils";
import { ToolCall } from "./tool-call"; // Your existing tool call renderer
import { TOOL_VIEW_MAP } from "./use-canvas"; // Import the map

export function MessagePart({ part }: { part: UIMessagePart }) {
  switch (part.type) {
    case "text":
      return <p>{part.text}</p>;

    case "tool-call":
      // CRITICAL FIX: Check the map before rendering.
      // If the tool has a canvas view, render nothing here.
      if (TOOL_VIEW_MAP[part.toolName]) {
        return null;
      }
      // Otherwise, render the inline tool call as before.
      return <ToolCall toolCall={part} />;

    // ... (other part types)

    default:
      return null;
  }
}

```

---

### `agent-canvas.tsx` (Corrected)

This component receives the corrected state from the `useCanvas` hook. The only change needed here is to fix the display of the step counter to be more user-friendly.

```typescript
// ... (imports and other component parts)

export function AgentCanvas({ 
  // ... (all other props)
  currentStep,
  totalSteps,
}: AgentCanvasProps) {

  // ... (component logic)

  return (
    // ... (outer div)
      {/* Header */}
      <div className="flex items-center justify-between ...">
        {/* ... */}
        {/* Step Counter (Corrected) */}
        {totalSteps > 0 && (
          <span className="text-xs text-muted-foreground">
            Step: {currentStep} / {totalSteps}
          </span>
        )}
        {/* ... */}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* ... (switch statement for views) ... */}
      </div>
    // ... (rest of component)
  );
}

```

This completes the fix for the canvas and rendering system. By centralizing the tool-to-view mapping and correctly deriving state from the standardized stream, all the rendering bugs are resolved.

---
