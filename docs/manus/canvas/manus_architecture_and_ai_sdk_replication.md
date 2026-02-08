# Manus Agent Architecture and AI SDK Replication Guide

This document provides a comprehensive analysis of the Manus agent's architecture, tool usage, and user interface, based on the provided files. It also offers a detailed guide on how to replicate a similar agent using the Vercel AI SDK and E2B for sandboxed code execution.

## 1. Manus Agent Architecture Analysis

Based on the `agentloop` and `modules` files, the Manus agent operates on a sophisticated, event-driven architecture. It's not a simple request-response model but a continuous, iterative process.

### 1.1. The Agent Loop

The core of the agent is a 6-step loop:

1.  **Analyze Events**: The agent consumes a chronological stream of events, including user messages, tool action results (observations), and inputs from internal modules like the Planner.
2.  **Select Tools**: Based on the current state and its plan, the agent chooses a single tool to execute. This is a crucial decision-making step.
3.  **Wait for Execution**: The selected tool is executed in the sandbox environment.
4.  **Iterate**: The result of the tool execution is added to the event stream as a new `Observation`, and the loop repeats. The agent patiently iterates, making one tool call at a time.
5.  **Submit Results**: Once the task is complete, the agent uses a `message` tool to deliver the final output and attachments to the user.
6.  **Enter Standby**: After delivering results, the agent goes into an idle state, awaiting new user input.

### 1.2. Key System Modules

The `modules` file reveals that the agent is supported by several internal systems that feed into its event stream:

*   **Planner Module**: This module is responsible for high-level task planning. It generates a pseudocode-like plan that the agent follows. The agent's `todo.md` file is a more detailed reflection of this plan.
*   **Knowledge Module**: Provides the agent with relevant best practices and contextual information for the current task.
*   **Datasource Module**: Gives the agent access to authoritative, proprietary data APIs, which are preferred over public web searches.

This modular architecture allows the agent to separate high-level planning from low-level tool execution, making it more robust and capable of handling complex, multi-step tasks.

## 2. Tool Analysis and Canvas/Sidebar Display

The agent's capabilities are defined by its tools. The `tools.json` file you provided, combined with the insights from the Redux state analysis, gives a clear picture of how the agent interacts with its environment and how the UI displays the results.

### 2.1. Tool Categories and Purpose

The 29 tools can be grouped into several categories:

| Category | Tools | Purpose |
|---|---|---|
| **Communication** | `message_notify_user`, `message_ask_user`, `idle` | Interacting with the user and managing the agent's lifecycle. |
| **File System** | `file_read`, `file_write`, `file_str_replace`, `file_find_in_content`, `file_find_by_name` | Full control over the local file system in the sandbox. |
| **Code Execution (E2B)** | `shell_exec`, `shell_view`, `shell_wait`, `shell_write_to_process`, `shell_kill_process` | Running commands, scripts, and managing processes within the E2B sandbox. This is the core of the code interpreter functionality. |
| **Web Browsing** | `browser_view`, `browser_navigate`, `browser_restart`, `browser_click`, `browser_input`, `browser_move_mouse`, `browser_press_key`, `browser_select_option`, `browser_scroll_up`, `browser_scroll_down`, `browser_console_exec`, `browser_console_view` | Comprehensive control over a headless browser for web automation and information gathering. |
| **Information** | `info_search_web` | Accessing external information via a dedicated search tool. |
| **Deployment** | `deploy_expose_port`, `deploy_apply_deployment`, `make_manus_page` | Making local services, websites, and pages publicly accessible. |

### 2.2. How the Canvas/Sidebar Displays Tool Output

You asked how the agent displays things like the E2B sandbox (Code IDE) or the browser in the canvas. The agent **doesn't directly control the UI**. Instead, the frontend application is responsible for rendering the appropriate view based on the agent's actions and the resulting state changes.

The Redux state analysis was key to understanding this. The frontend listens for changes in specific slices of the Redux store to decide what to show in the main content area (the "canvas" or sidebar):

*   **For E2B/Code Execution**: When the agent uses `shell_exec`, the frontend receives `sandboxUpdate` events via WebSocket. It also sees the `codeViewer` Redux slice being populated with file trees and file content. The frontend application would then render a component that looks like a Code IDE, displaying the file tree from `codeViewer.directoryList` and the code from `codeViewer.fileDataSource`. The output of the `shell_exec` command (from the `sandboxUpdate` event) would be displayed in a terminal panel within that IDE component.

*   **For Browser Use**: When the agent uses `browser_navigate`, the frontend sees the `agentWorkspace.vncDialogVisible` flag become true. The frontend application would then render a VNC viewer component that connects to the browser running in the agent's sandbox, showing the live view of the web page.

*   **For Other Tools**: Similarly, when the agent is working on a presentation, the `slideEditor` slice is active, and the frontend renders a slide editor UI. When it's using the AI Canvas, the `aiCanvasEditor` slice is active, and the frontend renders the drawing canvas.

This is a powerful, decoupled architecture. The agent focuses on performing tasks, and the frontend is responsible for providing the user with a rich, contextual visualization of what the agent is doing.

## 3. Replicating the Architecture with Vercel AI SDK

Replicating this sophisticated agent architecture is entirely possible with modern tools like the Vercel AI SDK and E2B. Here’s a step-by-step guide.

### 3.1. Setting up the Agent Loop with `streamText`

The core of the Manus agent loop—iteratively calling tools until a task is complete—can be elegantly replicated using the `streamText` function from the Vercel AI SDK, combined with its `maxSteps` option (or a similar looping construct).

First, you would define your tools using the `tool` helper, wrapping your E2B and other functions.

```typescript
// /app/api/chat/tools.ts
import { Sandbox } from '@e2b/code-interpreter';
import { tool } from 'ai';
import { z } from 'zod';

// It's recommended to create a single, long-lived sandbox for the session
const sandbox = await Sandbox.create();

export const tools = {
  execute_python: tool({
    description: 'Execute python code in a Jupyter notebook cell and return the stdout, stderr, and results.',
    parameters: z.object({ code: z.string() }),
    execute: async ({ code }) => {
      const { logs, results } = await sandbox.runCode(code);
      return { logs, results };
    }
  }),
  // ... define other tools for file system, browser, etc.
};
```

Then, in your API route, you use `streamText` to run the agent loop. The `onStepFinish` callback is crucial for streaming intermediate steps to the client, allowing you to build a real-time UI like Manus's.

```typescript
// /app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createStreamableValue } from 'ai/rsc';
import { tools } from './tools';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai('gpt-4o'),
    messages,
    tools,
    maxSteps: 15, // Set a max number of steps to prevent infinite loops
    onStepFinish: async ({ step, isLast }) => {
      // This callback is called after each step of the agent loop
      // Here you can stream the step to the client to update the UI
      console.log('Finished step:', step);
    },
  });

  return result.toAIStreamResponse();
}
```

### 3.2. Integrating E2B for Code Execution

As shown in the code above, integrating E2B is straightforward. You create a `Sandbox` instance and wrap its `runCode` method within an AI SDK `tool`. This `execute_python` tool effectively becomes your agent's E2B-powered code interpreter.

To display the output in your UI, you would stream the `logs` (stdout/stderr) and `results` from the `execute` function's return value back to the client. Your React component would then render these outputs in a terminal-like view.

### 3.3. Building the Canvas/Sidebar UI in React

Your frontend, likely built with React and the `useChat` hook from the Vercel AI SDK, would be responsible for rendering the "canvas."

1.  **Listen for Tool Calls**: The `useChat` hook provides the stream of messages and tool calls from the backend.
2.  **Conditional Rendering**: Your main UI component would have a `switch` statement or conditional logic that looks at the `name` of the tool currently being called.
    *   If the tool is `execute_python`, render your `CodeIDE` component, passing it the code being executed and the streaming output.
    *   If the tool is `browser_navigate`, you could render an `iframe` pointing to the URL. For a true VNC-like experience similar to Manus, you would need a more advanced setup involving a VNC server in your sandbox and a VNC client component (like `react-vnc`) on the frontend.
    *   If the tool is `file_write` with a markdown file, you could render a Markdown preview component.
3.  **State Management**: You would use React state (e.g., `useState`, `useReducer`, or a library like Zustand) to manage the UI state, similar to how Manus uses its extensive Redux store.

Here is a simplified conceptual example of such a React component:

```jsx
'use client';

import { useChat } from 'ai/react';
import { CodeIDE } from './components/CodeIDE';
import { BrowserView } from './components/BrowserView';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  // Find the latest tool call in the message history
  const latestToolCall = messages.slice().reverse().find(m => m.role === 'tool');

  const renderCanvas = () => {
    if (!latestToolCall) return <DefaultView />;

    switch (latestToolCall.name) {
      case 'execute_python':
        return <CodeIDE code={latestToolCall.content} output={...} />;
      case 'browser_navigate':
        return <BrowserView url={latestToolCall.content} />;
      default:
        return <DefaultView />;
    }
  }

  return (
    <div className="flex">
      <div className="chat-history">{/* ... chat messages ... */}</div>
      <div className="canvas-sidebar">
        {renderCanvas()}
      </div>
    </div>
  );
}
```

By combining the power of the Vercel AI SDK's tool-calling agent loop, E2B's secure sandboxing, and a reactive frontend, you can successfully replicate the core architecture of a sophisticated AI agent like Manus.
