# Deep Dive: Manus Chat Flow, State, and Component Architecture

This document provides a technical breakdown of how the Manus chat interface functions, how it handles state updates (especially the plan), and the exact JSX/logic for the key components.

## 1. The Core State Model

The chat interface relies on a unified state object (often managed via `useChat` or a custom `useChatSession` hook). The state is driven by the SSE (Server-Sent Events) stream from the backend.

### Key State Objects:
*   **`messages`**: An array of message objects (User or Assistant).
*   **`plan`**: A structured object representing the current task's progress.
*   **`canvas`**: State for the side panel (visibility, active tab, tool data).

## 2. The Plan Component (`TaskPlan.tsx`)

The plan is the "brain" of the UI. It updates in real-time as the agent progresses.

### State Update Flow:
1.  **Backend** emits a `plan-update` event (custom SSE) or updates the `messages` metadata.
2.  **Frontend** parses the plan JSON and updates the local `plan` state.
3.  **Component** re-renders to show new steps, updated status (pending/working/done), and time estimates.

### JSX Structure (Simplified):
```jsx
const TaskPlan = ({ plan }) => {
  return (
    <div className="task-plan-container">
      <div className="plan-header">
        <span className="goal">{plan.goal}</span>
        <span className="progress">{plan.completedCount}/{plan.totalCount}</span>
      </div>
      <div className="steps-list">
        {plan.phases.map((phase) => (
          <PlanPhase 
            key={phase.id} 
            title={phase.title} 
            status={phase.status} // 'pending' | 'working' | 'completed'
            active={phase.id === plan.currentPhaseId}
          />
        ))}
      </div>
    </div>
  );
};
```

## 3. Inline Tool Rendering (`MessageRenderer.tsx`)

This is where the "live" feel comes from. As tool calls are streamed, the UI renders them immediately.

### The "Live" Animation Logic:
*   **`tool-input-delta`**: As the LLM writes the tool arguments (e.g., a search query), the frontend streams this text into the tool card.
*   **`tool-output-available`**: Once the tool finishes, the output (results, images, etc.) replaces the loading state.

### JSX for Tool Card:
```jsx
const ToolCard = ({ toolCall, state }) => {
  const isWorking = state === 'in-progress';
  
  return (
    <div className={`tool-card ${isWorking ? 'animating' : ''}`}>
      <div className="tool-header">
        <Icon name={toolCall.name} />
        <span>{getToolLabel(toolCall.name)}</span>
        {isWorking && <Spinner />}
      </div>
      <div className="tool-content">
        {/* Streamed arguments appear here */}
        <pre>{toolCall.arguments}</pre>
        {toolCall.output && <ToolOutput output={toolCall.output} />}
      </div>
    </div>
  );
};
```

## 4. Canvas State & Window Management (`useCanvas.ts`)

The canvas is synchronized with the tool calls.

1.  **Detection:** When a message contains a tool call mapped to the canvas (e.g., `browser_navigate`), the `useCanvas` hook triggers.
2.  **Activation:** The `canvas.isOpen` state is set to `true`, and `canvas.activeTab` is set to the tool's view type.
3.  **Data Flow:** The canvas component subscribes to the WebSocket for live data (Neko frames or Terminal stdout) while the message itself provides the tool context.

## 5. API Trace: The Lifecycle of a Message

1.  **`POST /api/chat`**: User sends a message.
2.  **SSE Response**:
    *   `text-delta`: "I'll help you with that..." (Animated in `ChatMessage.tsx`)
    *   `plan-update`: Plan appears in the sidebar.
    *   `tool-input-start`: Tool card appears inline.
    *   `tool-input-delta`: Query text streams into the tool card.
    *   `tool-output-available`: Tool results appear; Canvas opens automatically.
3.  **WebSocket (`/ws/sandbox`)**: Live browser frames start streaming to the Canvas.

## 6. Summary of Component Updates

| Component | Trigger | Update Logic |
| :--- | :--- | :--- |
| `TaskPlan` | `plan-update` SSE | Deep merge new plan phases into current state. |
| `ToolCard` | `tool-input-delta` SSE | Append text to `toolCall.arguments` string. |
| `CanvasPanel` | `tool-output-available` | Switch `activeTab` based on `TOOL_VIEW_MAP`. |
| `LiveView` | WebSocket Event | Draw new frame/text to canvas/terminal buffer. |
