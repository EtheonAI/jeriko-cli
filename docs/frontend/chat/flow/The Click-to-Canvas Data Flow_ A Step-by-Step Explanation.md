## The Click-to-Canvas Data Flow: A Step-by-Step Explanation

Excellent question. The canvas doesn't open on a click. It opens **automatically** when the AI uses a tool that has a canvas view. Here is the exact, in-depth data flow from the moment a tool is used to the moment the canvas appears with the correct view.

### The Core Principle: The Canvas is a **Reaction** to the Message Stream

The single most important thing to understand is that the canvas is not controlled by click events. It is a **read-only, reactive component** that derives its entire state from the `messages` array provided by the AI SDK's `useChat` hook. 

Here is the complete, end-to-end flow:

--- 

### Step 1: AI Backend Sends a Tool Call Part

It all starts when your AI backend uses a tool. The `streamText` function sends a new message part to the frontend with `type: 'tool-call'`.

```json
// Part of the SSE stream from the backend
{
  "type": "tool-call",
  "toolCallId": "tool_01hry...",
  "toolName": "browser_navigate",
  "args": { "url": "https://google.com" }
}
```

### Step 2: `useChat` Updates the `messages` Array

The AI SDK's `useChat` hook on the frontend receives this part and updates its internal `messages` state. Your top-level `<ChatClient>` component now has a new `messages` array containing this tool call part.

```tsx
// apps/web/components/chat/chat-client.tsx

// This `messages` array is the source of truth for everything
const { messages, isStreaming } = useChatSession(...);
```

### Step 3: `useCanvas` Hook Scans the `messages` Array

This is the heart of the logic. The `useCanvas` hook is called inside `<ChatClient>` and receives the new `messages` array. It immediately does the following:

1.  **Scans `messages` backwards** to find the most recent tool call part.
2.  Gets the `toolName` from that part (e.g., `"browser_navigate"`).
3.  Looks up this `toolName` in its `TOOL_VIEW_MAP`.

```typescript
// @repo/ai/components/canvas/use-canvas.ts

// The map that connects a tool to a view
export const TOOL_VIEW_MAP: Record<string, CanvasViewType> = {
  browser_navigate: "browser",
  shell_exec: "terminal",
  file_read: "code",
  // ... and so on
};

// Inside the useCanvas hook...
const { latestTool, ... } = useMemo(() => {
  // ... scans messages backwards ...
  const toolName = getToolName(latestToolPart);
  const viewType = TOOL_VIEW_MAP[toolName]; // Finds "browser"
  
  return { latestTool: { viewType, ... } };
}, [messages]);
```

4.  It finds a match: `browser_navigate` maps to `"browser"`.
5.  The hook now returns a state object: `canvasState = { isVisible: true, viewType: "browser", ... }`.

### Step 4: `useCanvasPanel` Hook Decides to Open the Panel

The `<ChatClient>` also calls the `useCanvasPanel` hook, passing in the `isVisible` flag from `useCanvas`.

```tsx
// apps/web/components/chat/chat-client.tsx

const canvasState = useCanvas(repoMessages);
const { showCanvas, ... } = useCanvasPanel({
  isVisible: canvasState.isVisible, // This is now true
  isStreaming: isStreaming,
});
```

This hook contains the logic to automatically open the panel:

```typescript
// apps/web/hooks/use-canvas-panel.ts

useEffect(() => {
  // If the agent is working (isStreaming) AND the canvas has something to show (isVisible)
  if (isStreaming && isVisible && !prevVisible.current) {
    setCanvasOpen(true); // Open the panel!
  }
  prevVisible.current = isVisible;
}, [isVisible, isStreaming]);
```

Because `isVisible` and `isStreaming` are both `true`, it sets its internal `canvasOpen` state to `true`. This hook returns `showCanvas: true`.

### Step 5: `<ChatClient>` Renders the `<AgentCanvas>`

Back in `<ChatClient>`, the `showCanvas` flag is now true, so it renders the `<AgentCanvas>` component, passing down the `viewType` it got from `useCanvas`.

```tsx
// apps/web/components/chat/chat-client.tsx

<ChatLayout
  canvas={
    showCanvas ? (
      <AgentCanvas
        viewType={canvasState.viewType} // viewType is "browser"
        // ... other props
      />
    ) : undefined
  }
>
  {/* ... chat messages ... */}
</ChatLayout>
```

### Step 6: `<AgentCanvas>` Renders the Correct View

Finally, the `<AgentCanvas>` component receives `viewType="browser"` and uses a simple switch to render the correct view component.

```tsx
// @repo/ai/components/canvas/agent-canvas.tsx

export function AgentCanvas({ viewType, ...props }: AgentCanvasProps) {
  // ... header and footer ...
  return (
    <div className="... a container ...">
      {viewType === "browser" && <BrowserView {...props} />}
      {viewType === "code" && <CodeView {...props} />}
      {viewType === "terminal" && <TerminalView {...props} />}
      {/* ... etc ... */}
    </div>
  );
}
```

It matches `viewType === "browser"` and renders the `<BrowserView>`, which then displays the screenshot, URL, and other browser-related state that was also derived by the `useCanvas` hook.

--- 

## Summary: The Unidirectional Data Flow

This is a classic unidirectional data flow pattern, which is why it's so robust:

**AI Backend Stream** → **`useChat` (messages array)** → **`useCanvas` (derives `viewType`)** → **`useCanvasPanel` (sets `isOpen`)** → **`<AgentCanvas>` (renders the view)**

There is no `onClick` handler that opens the canvas. The user doesn't control the canvas directly. The canvas is a **visualization of the agent's current state**, derived entirely from the stream of messages. When you see "Manus is using browser," it's because the latest tool call in the message stream was a browser tool, and the entire UI has simply reacted to that fact.
