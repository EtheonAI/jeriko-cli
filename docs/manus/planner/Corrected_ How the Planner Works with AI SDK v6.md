# Corrected: How the Planner Works with AI SDK v6

You are **100% correct**. My previous explanation was based on how Manus works internally with Redux and WebSockets. With AI SDK, the approach is different and much cleaner. The planner state is derived **directly from the `messages` array** from `useChat()`.

Here is the corrected, proper way to implement the planner.

---

## 1. The Core Concept: The Plan is a Tool Result

In the AI SDK v6 paradigm, the plan is not a separate state slice. It is the **result of a tool call**. The agent has a tool, let's call it `showPlan`, that it calls to display and update the plan.

```typescript
// In your agent.ts or API route
import { tool, z } from 'ai';

export const showPlan = tool({
  description: 'Display and update the implementation plan for the user.',
  inputSchema: z.object({
    title: z.string(),
    todos: z.array(z.object({
      id: z.string(),
      label: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
      toolsUsed: z.array(z.object({ toolCallId: z.string(), toolName: z.string() })).optional(),
    })),
  }),
  async execute({ title, todos }) {
    // This tool's primary purpose is to get the plan into the message history.
    // The execute function can simply return the input.
    return { title, todos };
  },
});
```

### The Agent's Workflow:

1.  **Initial Call**: After the user gives a task, the agent's first action is to call `showPlan` with the initial list of steps, all marked as `"pending"`.
2.  **Execute a Step**: The agent then calls the tools needed for the first step (e.g., `shell_exec`, `file_write`).
3.  **Update Call**: After completing the step, the agent calls `showPlan` **again**, this time with the first step marked as `"completed"` and the second as `"in_progress"`.

This loop continues, creating a history of `tool-showPlan` parts in the `messages` array.

---

## 2. Deriving State from Messages: The `usePlannerState` Hook

This is the crucial part. The frontend does not need Redux. A custom hook iterates through the `messages` from `useChat` and extracts the latest plan and all associated tool calls.

```typescript
// app/hooks/usePlannerState.ts
import { useMemo } from 'react';
import { type Message } from 'ai';

// Define your Plan and Todo types

export function usePlannerState(messages: Message[]) {
  return useMemo(() => {
    let latestPlan = null;
    const allToolCalls = [];

    // Iterate through all messages and their parts
    for (const message of messages) {
      if (message.role !== 'assistant') continue;

      for (const part of message.parts) {
        if (part.type === 'tool-showPlan' && part.state === 'output-available') {
          // Found a plan, save it as the latest one
          latestPlan = part.output;
        }
        // Collect all other tool calls
        if (part.type.startsWith('tool-') && part.type !== 'tool-showPlan') {
          allToolCalls.push(part);
        }
      }
    }

    if (!latestPlan) {
      return { plan: null, toolsByStep: {} };
    }

    // Now, link tool calls to their plan steps
    const toolsByStep: Record<string, any[]> = {};
    // This requires a way to link tools to steps. The simplest way is to have the agent
    // include a `planStepId` in the tool call itself, or infer it by order.
    // For this example, we'll assume the agent adds a `planStepId` to the tool's output or input.

    for (const toolCall of allToolCalls) {
        // Assuming the agent adds a planStepId to the tool's result
        const stepId = toolCall.output?.planStepId || toolCall.input?.planStepId;
        if (stepId) {
            if (!toolsByStep[stepId]) {
                toolsByStep[stepId] = [];
            }
            toolsByStep[stepId].push(toolCall);
        }
    }

    return { plan: latestPlan, toolsByStep };

  }, [messages]);
}
```

---

## 3. The UI: Rendering the Plan and Tool Switcher

Your UI components now receive their props from this hook.

### The Main Page

```tsx
// app/page.tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { ChatLayout } from '@/app/components/ChatLayout';
import { PlannerBottomBar } from '@/app/components/PlannerBottomBar';
import { usePlannerState } from '@/app/hooks/usePlannerState';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  const { plan, toolsByStep } = usePlannerState(messages);

  return (
    <ChatLayout
      messages={messages} // Pass messages to the chat display
      plannerBar={
        <PlannerBottomBar 
          plan={plan} 
          toolsByStep={toolsByStep} 
          onToolSelect={(toolCallId) => {
            // Logic to switch the canvas view
            console.log('Show tool:', toolCallId);
          }}
        />
      }
      promptForm={
        <form onSubmit={handleSubmit}>{/* ... */}</form>
      }
    />
  );
}
```

### The `PlannerBottomBar` Component

This component now gets the plan directly. When a user clicks a tool tab, it calls back to the parent to handle the view switching.

```tsx
// app/components/PlannerBottomBar.tsx

// ... (imports)

export function PlannerBottomBar({ plan, toolsByStep, onToolSelect }) {
  if (!plan) return null;

  const currentStep = plan.todos.find(t => t.status === 'in_progress');

  return (
    <div className="p-4 bg-gray-800 text-white">
      <h3>{currentStep ? currentStep.label : 'Plan Complete'}</h3>
      {/* ... progress bar ... */}

      {/* Expanded view */}
      <div>
        {plan.todos.map(todo => (
          <div key={todo.id}>
            <h4>{todo.label}</h4>
            <div className="flex gap-2">
              {(toolsByStep[todo.id] || []).map(tool => (
                <button key={tool.toolCallId} onClick={() => onToolSelect(tool.toolCallId)}>
                  [{tool.toolName}]
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

This is the correct, modern AI SDK v6 pattern. It's more robust, requires less state management, and keeps all the data flow within the `useChat` hook's `messages` array, which is the single source of truth.
