/**
 * Test fixture — mock UIMessage[] covering all 33 agent tools in various states.
 *
 * Import this from `/chat/test/page.tsx` to visually verify the full tool
 * rendering pipeline without running the agent service.
 */

import type { UIMessage } from "ai";

// Helper to make tool parts
function toolPart(
  toolName: string,
  toolCallId: string,
  state: string,
  input: unknown,
  output?: unknown,
  errorText?: string,
) {
  return {
    type: `tool-${toolName}`,
    toolCallId,
    toolName,
    state,
    input,
    ...(output !== undefined ? { output } : {}),
    ...(errorText ? { errorText } : {}),
  };
}

// ============================================================================
// Messages
// ============================================================================

export const TEST_MESSAGES: UIMessage[] = [
  // ──────────────── User message ────────────────
  {
    id: "msg-user-1",
    role: "user",
    parts: [{ type: "text", text: "Search for React 19 features, then build me a demo app with a todo list. Deploy it when done." }],
    createdAt: new Date("2026-02-08T10:00:00Z"),
  },

  // ──────────────── Assistant: plan + tools ────────────────
  {
    id: "msg-assistant-1",
    role: "assistant",
    parts: [
      // Reasoning
      {
        type: "reasoning",
        text: "The user wants me to search for React 19 features, build a demo todo app, and deploy it. Let me plan this out step by step.",
      },

      // show_plan — 5 steps in mixed states
      toolPart("show_plan", "tc-plan-1", "output-available", {
        title: "Build React 19 Todo Demo",
        todos: [
          { id: "s1", label: "Research React 19 new features", status: "completed" },
          { id: "s2", label: "Set up project with Vite + React 19", status: "completed" },
          { id: "s3", label: "Implement todo list with useActionState", status: "in_progress" },
          { id: "s4", label: "Add styling with Tailwind CSS", status: "pending" },
          { id: "s5", label: "Deploy to production", status: "pending" },
        ],
      }, {
        title: "Build React 19 Todo Demo",
        todos: [
          { id: "s1", label: "Research React 19 new features", status: "completed" },
          { id: "s2", label: "Set up project with Vite + React 19", status: "completed" },
          { id: "s3", label: "Implement todo list with useActionState", status: "in_progress" },
          { id: "s4", label: "Add styling with Tailwind CSS", status: "pending" },
          { id: "s5", label: "Deploy to production", status: "pending" },
        ],
      }),

      // Text part
      { type: "text", text: "I'll start by researching React 19 features and then build the app.\n\n" },

      // ── web_search (output-available) ──
      toolPart("web_search", "tc-search-1", "output-available",
        { query: "React 19 new features 2026" },
        {
          results: [
            { title: "React 19 Release Notes", url: "https://react.dev/blog/2025/12/react-19", snippet: "React 19 introduces useActionState, use() hook, and Server Components..." },
            { title: "What's New in React 19", url: "https://blog.example.com/react-19", snippet: "Key features include improved Suspense, React Compiler, and Actions API." },
            { title: "React 19 Migration Guide", url: "https://react.dev/blog/react-19-upgrade-guide", snippet: "Step by step guide for upgrading from React 18 to React 19." },
          ],
          query: "React 19 new features 2026",
        },
      ),

      // ── shell_exec (output-available) ──
      toolPart("shell_exec", "tc-shell-1", "output-available",
        { command: "npm create vite@latest react-todo -- --template react-ts", session_id: "session-0" },
        { output: "✓ Project created successfully\n  cd react-todo\n  npm install\n  npm run dev", exit_code: 0 },
      ),

      // ── shell_exec (running) ──
      toolPart("shell_exec", "tc-shell-2", "input-available",
        { command: "cd react-todo && npm install", session_id: "session-0" },
      ),

      // ── file_write (output-available) ──
      toolPart("file_write", "tc-file-1", "output-available",
        { path: "/home/user/react-todo/src/App.tsx", content: "import { useState } from 'react';\n\nfunction App() {\n  const [todos, setTodos] = useState<string[]>([]);\n  const [input, setInput] = useState('');\n\n  const addTodo = () => {\n    if (input.trim()) {\n      setTodos([...todos, input.trim()]);\n      setInput('');\n    }\n  };\n\n  return (\n    <div className=\"max-w-md mx-auto mt-10 p-6\">\n      <h1 className=\"text-2xl font-bold mb-4\">Todo App</h1>\n      <div className=\"flex gap-2 mb-4\">\n        <input\n          value={input}\n          onChange={(e) => setInput(e.target.value)}\n          className=\"flex-1 border rounded px-3 py-2\"\n          placeholder=\"Add a todo...\"\n        />\n        <button onClick={addTodo} className=\"bg-blue-500 text-white px-4 py-2 rounded\">\n          Add\n        </button>\n      </div>\n      <ul className=\"space-y-2\">\n        {todos.map((todo, i) => (\n          <li key={i} className=\"p-2 bg-gray-100 rounded\">{todo}</li>\n        ))}\n      </ul>\n    </div>\n  );\n}\n\nexport default App;" },
        { success: true, path: "/home/user/react-todo/src/App.tsx", bytes_written: 742 },
      ),

      // ── file_read (output-available) ──
      toolPart("file_read", "tc-file-2", "output-available",
        { path: "/home/user/react-todo/package.json" },
        { content: '{\n  "name": "react-todo",\n  "version": "0.1.0",\n  "dependencies": {\n    "react": "^19.0.0",\n    "react-dom": "^19.0.0"\n  }\n}', path: "/home/user/react-todo/package.json" },
      ),

      // ── file_str_replace (output-available) ──
      toolPart("file_str_replace", "tc-file-3", "output-available",
        { path: "/home/user/react-todo/src/App.tsx", old_str: "const [todos, setTodos] = useState<string[]>([]);", new_str: "const [todos, setTodos] = useState<{id: number; text: string; done: boolean}[]>([]);" },
        { success: true, replacements: 1 },
      ),

      // ── file_find_in_content (output-available) ──
      toolPart("file_find_in_content", "tc-file-4", "output-available",
        { pattern: "useActionState", path: "/home/user/react-todo/src" },
        { matches: [{ file: "/home/user/react-todo/src/App.tsx", line: 3, content: "import { useActionState } from 'react';" }] },
      ),

      // ── file_find_by_name (output-available) ──
      toolPart("file_find_by_name", "tc-file-5", "output-available",
        { pattern: "*.tsx", path: "/home/user/react-todo/src" },
        { files: ["/home/user/react-todo/src/App.tsx", "/home/user/react-todo/src/main.tsx"] },
      ),

      // ── code_execute (output-available) ──
      toolPart("code_execute", "tc-code-1", "output-available",
        { language: "python", code: "import json\ndata = {'features': ['useActionState', 'use()', 'Server Components']}\nprint(json.dumps(data, indent=2))" },
        { output: '{\n  "features": [\n    "useActionState",\n    "use()",\n    "Server Components"\n  ]\n}', exit_code: 0 },
      ),

      // ── shell_view (output-available) ──
      toolPart("shell_view", "tc-shell-3", "output-available",
        { session_id: "session-0" },
        { output: "added 142 packages, and audited 143 packages in 4s\n\n21 packages are looking for funding\n  run `npm fund` for details\n\nfound 0 vulnerabilities" },
      ),

      // ── shell_wait (output-available) ──
      toolPart("shell_wait", "tc-shell-4", "output-available",
        { session_id: "session-0", timeout: 5 },
        { output: "Server running on http://localhost:5173", status: "completed" },
      ),

      // ── shell_write_to_process (output-available) ──
      toolPart("shell_write_to_process", "tc-shell-5", "output-available",
        { session_id: "session-0", input: "y\n" },
        { success: true },
      ),

      // ── shell_kill_process (output-available) ──
      toolPart("shell_kill_process", "tc-shell-6", "output-available",
        { session_id: "session-0" },
        { success: true, message: "Process terminated" },
      ),

      // ── browser_navigate (output-available) ──
      toolPart("browser_navigate", "tc-browser-1", "output-available",
        { url: "http://localhost:5173" },
        { url: "http://localhost:5173", title: "React Todo App", screenshot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" },
      ),

      // ── browser_view (output-available) ──
      toolPart("browser_view", "tc-browser-2", "output-available",
        {},
        { url: "http://localhost:5173", title: "React Todo App", content: "<h1>Todo App</h1><input placeholder='Add a todo...' /><button>Add</button>" },
      ),

      // ── browser_click (output-available) ──
      toolPart("browser_click", "tc-browser-3", "output-available",
        { coordinate: [200, 350], description: "Click the Add button" },
        { success: true, screenshot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==" },
      ),

      // ── browser_input (output-available) ──
      toolPart("browser_input", "tc-browser-4", "output-available",
        { coordinate: [200, 300], text: "Buy groceries" },
        { success: true },
      ),

      // ── browser_scroll_up (output-available) ──
      toolPart("browser_scroll_up", "tc-browser-5", "output-available",
        { coordinate: [640, 400], amount: 3 },
        { success: true },
      ),

      // ── browser_scroll_down (output-available) ──
      toolPart("browser_scroll_down", "tc-browser-6", "output-available",
        { coordinate: [640, 400], amount: 3 },
        { success: true },
      ),

      // ── browser_move_mouse (output-available) ──
      toolPart("browser_move_mouse", "tc-browser-7", "output-available",
        { coordinate: [200, 350] },
        { success: true },
      ),

      // ── browser_press_key (output-available) ──
      toolPart("browser_press_key", "tc-browser-8", "output-available",
        { key: "Enter" },
        { success: true },
      ),

      // ── browser_select_option (output-available) ──
      toolPart("browser_select_option", "tc-browser-9", "output-available",
        { coordinate: [300, 200], option: "dark-theme" },
        { success: true },
      ),

      // ── browser_console_exec (output-available) ──
      toolPart("browser_console_exec", "tc-browser-10", "output-available",
        { javascript: "document.querySelectorAll('li').length" },
        { output: "3" },
      ),

      // ── browser_console_view (output-available) ──
      toolPart("browser_console_view", "tc-browser-11", "output-available",
        {},
        { logs: ["[info] App mounted", "[info] Todos loaded: 3 items"] },
      ),

      // ── browser_screenshot (output-available) ──
      toolPart("browser_screenshot", "tc-browser-12", "output-available",
        {},
        { screenshot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" },
      ),

      // ── browser_restart (output-available) ──
      toolPart("browser_restart", "tc-browser-13", "output-available",
        {},
        { success: true, message: "Browser restarted" },
      ),

      // ── generate_image (output-available) ──
      toolPart("generate_image", "tc-image-1", "output-available",
        { prompt: "A beautiful modern todo app interface with React branding", size: "1024x1024" },
        { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==" },
      ),

      // ── deploy_expose_port (output-available) ──
      toolPart("deploy_expose_port", "tc-deploy-1", "output-available",
        { port: 5173, name: "react-todo-dev" },
        { url: "https://react-todo-dev.e2b.dev", port: 5173 },
      ),

      // ── deploy_apply_deployment (output-available) ──
      toolPart("deploy_apply_deployment", "tc-deploy-2", "output-available",
        { type: "static", path: "/home/user/react-todo/dist" },
        { url: "https://react-todo.rubic.app", status: "deployed" },
      ),

      // ── message_notify_user (compact) ──
      toolPart("message_notify_user", "tc-notify-1", "output-available",
        { text: "Your React 19 todo app has been deployed successfully!" },
        { delivered: true },
      ),

      // ── message_ask_user (compact) ──
      toolPart("message_ask_user", "tc-ask-1", "output-available",
        { text: "Would you like me to add authentication to the app?", options: ["Yes", "No", "Later"] },
        { response: "Yes" },
      ),

      // ── schedule_recurring_task (compact) ──
      toolPart("schedule_recurring_task", "tc-schedule-1", "output-available",
        { name: "Daily dependency check", cron: "0 9 * * *", task: "Check for npm dependency updates" },
        { scheduled: true, next_run: "2026-02-09T09:00:00Z" },
      ),

      // ── check_outcomes (compact) ──
      toolPart("check_outcomes", "tc-analytics-1", "output-available",
        { task_id: "tc-deploy-2" },
        { summary: "Deployment successful — 0 errors, 100% uptime", status: "healthy" },
      ),

      // ── Error state tool ──
      toolPart("shell_exec", "tc-error-1", "output-error",
        { command: "npm run build-nonexistent", session_id: "session-0" },
        undefined,
        "Command failed: npm ERR! Missing script: \"build-nonexistent\"",
      ),

      // ── Streaming state tool ──
      toolPart("code_execute", "tc-streaming-1", "input-streaming",
        { language: "typescript", code: "// generating..." },
      ),

      // ── Approval state tool ──
      {
        type: "tool-deploy_apply_deployment",
        toolCallId: "tc-approval-1",
        toolName: "deploy_apply_deployment",
        state: "approval-requested",
        input: { type: "static", path: "/home/user/react-todo/dist", domain: "production.rubic.app" },
        approval: { id: "approval-1" },
      },

      // Sources
      { type: "source-url", sourceId: "src-1", url: "https://react.dev/blog/2025/12/react-19", title: "React 19 Release Notes" },
      { type: "source-url", sourceId: "src-2", url: "https://blog.example.com/react-19", title: "What's New in React 19" },

      // Final text
      { type: "text", text: "\n\nYour React 19 todo app is live! The demo includes all the latest features including `useActionState` and the new compiler optimizations. You can access it at https://react-todo.rubic.app" },
    ] as any[],
    createdAt: new Date("2026-02-08T10:00:05Z"),
  },
];
