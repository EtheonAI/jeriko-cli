// =============================================================================
// useManusCanvas.ts — React hook that maps AI SDK tool calls to canvas views
// =============================================================================
// This hook integrates with the Vercel AI SDK's useChat() hook. It listens
// to the stream of messages and tool calls, and maps them to the correct
// canvas view type and props. This is the "glue" between the AI backend
// and the ManusCanvas component.
//
// Usage:
//   const { messages, input, ... } = useChat();
//   const canvasProps = useManusCanvas(messages);
//   return <ManusCanvas {...canvasProps} />;
// =============================================================================

import { useState, useEffect, useMemo } from "react";
import type { Message } from "ai";

// Types matching ManusCanvas props
type CanvasViewType =
  | "browser"
  | "code"
  | "terminal"
  | "filePreview"
  | "slides"
  | "aiCanvas"
  | "webDevIDE"
  | "mapReduce"
  | "empty";

interface ToolAction {
  type: string;
  label: string;
}

interface CanvasState {
  viewType: CanvasViewType;
  browserUrl?: string;
  browserScreenshot?: string;
  browserLoading?: boolean;
  fileTree?: any[];
  fileTabs?: any[];
  activeFileContent?: string;
  activeFileLanguage?: string;
  terminalOutput?: string[];
  previewFileName?: string;
  previewContent?: string;
  previewFileType?: string;
  currentAction?: ToolAction;
  statusText?: string;
  isWorking?: boolean;
}

// =============================================================================
// TOOL NAME → VIEW TYPE MAPPING
// =============================================================================
// This maps the tool names from tools.json to the canvas view they should show.

const toolToViewMap: Record<string, CanvasViewType> = {
  // Browser tools → browser view
  browser_navigate: "browser",
  browser_view: "browser",
  browser_click: "browser",
  browser_input: "browser",
  browser_move_mouse: "browser",
  browser_press_key: "browser",
  browser_select_option: "browser",
  browser_scroll_up: "browser",
  browser_scroll_down: "browser",
  browser_console_exec: "browser",
  browser_console_view: "browser",
  browser_restart: "browser",

  // Shell tools → terminal view
  shell_exec: "terminal",
  shell_view: "terminal",
  shell_wait: "terminal",
  shell_write_to_process: "terminal",
  shell_kill_process: "terminal",

  // File tools → code view (or file preview depending on context)
  file_read: "code",
  file_write: "code",
  file_str_replace: "code",
  file_find_in_content: "code",
  file_find_by_name: "code",

  // Search → browser view (shows search results)
  info_search_web: "browser",

  // Deployment → browser view (shows deployed site)
  deploy_expose_port: "browser",
  deploy_apply_deployment: "browser",
  make_manus_page: "browser",
};

// =============================================================================
// TOOL NAME → ACTION LABEL MAPPING
// =============================================================================

const toolToActionMap: Record<string, (args: any) => ToolAction> = {
  browser_navigate: (args) => ({
    type: "browsing",
    label: `Browsing ${args?.url ? new URL(args.url).hostname : "..."}`,
  }),
  browser_view: () => ({ type: "viewing", label: "Viewing the page" }),
  browser_click: () => ({ type: "clicking", label: "Clicking element" }),
  browser_input: (args) => ({
    type: "typing",
    label: `Typing ${args?.text?.slice(0, 20) || "..."}`,
  }),
  browser_scroll_up: () => ({ type: "scrolling", label: "Scrolling up" }),
  browser_scroll_down: () => ({ type: "scrolling", label: "Scrolling down" }),
  browser_console_exec: () => ({
    type: "typing",
    label: "Executing console script",
  }),
  shell_exec: (args) => ({
    type: "typing",
    label: `Running ${args?.command?.split(" ")[0] || "command"}`,
  }),
  file_read: (args) => ({
    type: "reading",
    label: `Reading file ${args?.path?.split("/").pop() || ""}`,
  }),
  file_write: (args) => ({
    type: "editing",
    label: `Editing file ${args?.path?.split("/").pop() || ""}`,
  }),
  file_str_replace: (args) => ({
    type: "editing",
    label: `Editing file ${args?.path?.split("/").pop() || ""}`,
  }),
  file_find_in_content: () => ({
    type: "searching",
    label: "Searching in files",
  }),
  file_find_by_name: () => ({
    type: "searching",
    label: "Finding files",
  }),
  info_search_web: (args) => ({
    type: "searching",
    label: `Searching "${args?.query?.slice(0, 30) || "..."}"`,
  }),
  deploy_expose_port: () => ({
    type: "browsing",
    label: "Exposing port",
  }),
  deploy_apply_deployment: () => ({
    type: "creating",
    label: "Deploying application",
  }),
};

// =============================================================================
// THE HOOK
// =============================================================================

export function useManusCanvas(messages: Message[]): CanvasState {
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});

  // Find the latest tool invocation in the message stream
  const latestToolState = useMemo(() => {
    // Walk backwards through messages to find the most recent tool call
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];

      // AI SDK stores tool calls in assistant messages
      if (msg.role === "assistant" && msg.toolInvocations) {
        for (
          let j = msg.toolInvocations.length - 1;
          j >= 0;
          j--
        ) {
          const invocation = msg.toolInvocations[j];
          const toolName = invocation.toolName;
          const args = invocation.args;
          const result = invocation.state === "result" ? invocation.result : null;

          const viewType = toolToViewMap[toolName] || "empty";
          const actionFn = toolToActionMap[toolName];
          const currentAction = actionFn ? actionFn(args) : undefined;

          return {
            toolName,
            args,
            result,
            viewType,
            currentAction,
            isWorking: invocation.state !== "result",
          };
        }
      }
    }
    return null;
  }, [messages]);

  // Accumulate terminal output from shell_exec results
  useEffect(() => {
    if (
      latestToolState?.toolName === "shell_exec" &&
      latestToolState.result
    ) {
      const output =
        typeof latestToolState.result === "string"
          ? latestToolState.result
          : JSON.stringify(latestToolState.result, null, 2);
      setTerminalHistory((prev) => [
        ...prev,
        `$ ${latestToolState.args?.command || ""}`,
        ...output.split("\n"),
      ]);
    }
  }, [latestToolState]);

  // Track file contents from file_read/file_write results
  useEffect(() => {
    if (latestToolState?.toolName === "file_read" && latestToolState.result) {
      const path = latestToolState.args?.path || "unknown";
      setFileContents((prev) => ({
        ...prev,
        [path]:
          typeof latestToolState.result === "string"
            ? latestToolState.result
            : JSON.stringify(latestToolState.result),
      }));
    }
    if (latestToolState?.toolName === "file_write") {
      const path = latestToolState.args?.path || "unknown";
      const content = latestToolState.args?.content || "";
      setFileContents((prev) => ({ ...prev, [path]: content }));
    }
  }, [latestToolState]);

  // Build the canvas state
  if (!latestToolState) {
    return { viewType: "empty", isWorking: false };
  }

  const state: CanvasState = {
    viewType: latestToolState.viewType as CanvasViewType,
    currentAction: latestToolState.currentAction,
    isWorking: latestToolState.isWorking,
    statusText: latestToolState.currentAction
      ? `Manus is working: ${latestToolState.currentAction.label}`
      : "Manus is working...",
  };

  // Enrich with view-specific data
  if (state.viewType === "browser") {
    state.browserUrl = latestToolState.args?.url;
    state.browserLoading = latestToolState.isWorking;
    // In a real implementation, browserScreenshot would come from the
    // VNC stream or a screenshot returned by the tool
    if (latestToolState.result?.screenshot) {
      state.browserScreenshot = latestToolState.result.screenshot;
    }
  }

  if (state.viewType === "terminal") {
    state.terminalOutput = terminalHistory;
  }

  if (state.viewType === "code") {
    const activePath = latestToolState.args?.path;
    if (activePath && fileContents[activePath]) {
      state.activeFileContent = fileContents[activePath];
      state.fileTabs = Object.keys(fileContents).map((p, i) => ({
        id: String(i),
        name: p.split("/").pop() || p,
        path: p,
        isActive: p === activePath,
      }));
    }
  }

  return state;
}

// =============================================================================
// FULL INTEGRATION EXAMPLE
// =============================================================================
//
// Here's how you'd wire it all together in a Next.js page:
//
// ```tsx
// 'use client';
//
// import { useChat } from 'ai/react';
// import { ManusCanvas } from './ManusCanvas';
// import { useManusCanvas } from './useManusCanvas';
//
// export default function AgentPage() {
//   const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
//     api: '/api/chat',
//     maxSteps: 20,  // Allow up to 20 tool-call iterations
//   });
//
//   const canvasProps = useManusCanvas(messages);
//
//   return (
//     <div className="flex h-screen bg-[#0a0a14]">
//       {/* Left: Chat Panel */}
//       <div className="w-1/2 flex flex-col border-r border-white/5">
//         <div className="flex-1 overflow-y-auto p-4 space-y-4">
//           {messages.map((msg) => (
//             <div key={msg.id} className={`${msg.role === 'user' ? 'text-right' : ''}`}>
//               <div className={`inline-block px-4 py-2 rounded-lg text-sm ${
//                 msg.role === 'user'
//                   ? 'bg-blue-600 text-white'
//                   : 'bg-white/10 text-gray-300'
//               }`}>
//                 {msg.content}
//               </div>
//             </div>
//           ))}
//         </div>
//         <form onSubmit={handleSubmit} className="p-4 border-t border-white/5">
//           <input
//             value={input}
//             onChange={handleInputChange}
//             placeholder="Message Manus..."
//             className="w-full px-4 py-3 rounded-xl bg-white/5 text-white text-sm
//                        border border-white/10 focus:border-blue-500 focus:outline-none"
//           />
//         </form>
//       </div>
//
//       {/* Right: Canvas Panel */}
//       <div className="w-1/2 p-4">
//         <ManusCanvas {...canvasProps} />
//       </div>
//     </div>
//   );
// }
// ```
//
// And the API route (/app/api/chat/route.ts):
//
// ```ts
// import { streamText, tool } from 'ai';
// import { openai } from '@ai-sdk/openai';
// import { Sandbox } from '@e2b/code-interpreter';
// import { z } from 'zod';
//
// const sandbox = await Sandbox.create();
//
// export async function POST(req: Request) {
//   const { messages } = await req.json();
//
//   const result = streamText({
//     model: openai('gpt-4o'),
//     system: `You are an AI agent with access to a computer...`,
//     messages,
//     maxSteps: 20,
//     tools: {
//       shell_exec: tool({
//         description: 'Execute a shell command in the sandbox',
//         parameters: z.object({
//           command: z.string().describe('The shell command to execute'),
//         }),
//         execute: async ({ command }) => {
//           const result = await sandbox.commands.run(command);
//           return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
//         },
//       }),
//       browser_navigate: tool({
//         description: 'Navigate the browser to a URL',
//         parameters: z.object({
//           url: z.string().describe('The URL to navigate to'),
//         }),
//         execute: async ({ url }) => {
//           // Use Playwright or similar in the sandbox
//           const result = await sandbox.commands.run(
//             `node -e "const { chromium } = require('playwright'); ..."`
//           );
//           return { url, screenshot: result.stdout };
//         },
//       }),
//       file_write: tool({
//         description: 'Write content to a file',
//         parameters: z.object({
//           path: z.string(),
//           content: z.string(),
//         }),
//         execute: async ({ path, content }) => {
//           await sandbox.files.write(path, content);
//           return { success: true, path };
//         },
//       }),
//       file_read: tool({
//         description: 'Read content from a file',
//         parameters: z.object({
//           path: z.string(),
//         }),
//         execute: async ({ path }) => {
//           const content = await sandbox.files.read(path);
//           return { path, content };
//         },
//       }),
//     },
//   });
//
//   return result.toDataStreamResponse();
// }
// ```
