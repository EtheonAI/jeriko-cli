"use client";

/**
 * /chat/test — Comprehensive visual test page.
 *
 * Sections:
 * 1. Tool Renderers — All 33 tools rendered via MessageRenderer (no ToolCard wrapper)
 * 2. ToolCard Wrapper — Same tools wrapped in ToolCard for comparison testing
 * 3. Canvas Views — Mock browser, code, terminal, file preview canvas states
 * 4. Planner Bar — show_plan derived planner
 * 5. Sources — Inline pill labels with canvas trigger
 * 6. MSW Mock API — Interactive streaming test using mock SSE handlers
 */

import { useState, useCallback, useRef, useMemo } from "react";
import {
  ToolRegistry,
  usePlannerState,
  PlannerBar,
  AgentCanvas,
} from "@repo/ai/components";
import type { UIMessage as RepoUIMessage } from "@repo/ai/lib/types";
import { ToolCard } from "@repo/ai/components/tools/tool-card";
import { SourcesGroup } from "@repo/ai/components/parts/sources-group";
import { TEST_MESSAGES } from "../[id]/fixtures/test-messages";
import { MessageRenderer } from "../[id]/components/message-renderer";

// ============================================================================
// Section Header
// ============================================================================

function SectionHeader({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 mt-12 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {number}
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

// ============================================================================
// Mock data for ToolCard testing
// ============================================================================

function toolCardPart(
  toolName: string,
  toolCallId: string,
  state: string,
  input: unknown,
  output?: unknown,
  errorText?: string,
) {
  return {
    type: `tool-${toolName}` as const,
    toolCallId,
    toolName,
    state,
    input,
    ...(output !== undefined ? { output } : {}),
    ...(errorText ? { errorText } : {}),
  } as any;
}

const TOOLCARD_SAMPLES = [
  { label: "Shell (output)", part: toolCardPart("shell_exec", "tc-card-1", "output-available", { command: "ls -la" }, { output: "total 42\ndrwxr-xr-x 5 user staff 160 Feb 8 10:00 .", exit_code: 0 }) },
  { label: "Shell (streaming)", part: toolCardPart("shell_exec", "tc-card-2", "input-streaming", { command: "npm install..." }) },
  { label: "Shell (running)", part: toolCardPart("shell_exec", "tc-card-3", "input-available", { command: "npm run build" }) },
  { label: "Shell (error)", part: toolCardPart("shell_exec", "tc-card-4", "output-error", { command: "exit 1" }, undefined, "Process exited with code 1") },
  { label: "File Write (output)", part: toolCardPart("file_write", "tc-card-5", "output-available", { path: "/app/src/index.ts", content: "console.log('hello')" }, { success: true, path: "/app/src/index.ts" }) },
  { label: "Browser (output)", part: toolCardPart("browser_navigate", "tc-card-6", "output-available", { url: "https://example.com" }, { url: "https://example.com", title: "Example", screenshot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }) },
  { label: "Deploy (approval)", part: { ...toolCardPart("deploy_apply_deployment", "tc-card-7", "approval-requested", { type: "static", path: "/dist", domain: "prod.rubic.app" }), approval: { id: "a1" } } },
  { label: "Deploy (denied)", part: { ...toolCardPart("deploy_apply_deployment", "tc-card-8", "output-denied", { type: "static", path: "/dist" }), approval: { reason: "Not approved for production" } } },
];

// ============================================================================
// Mock sources
// ============================================================================

const MOCK_SOURCES = [
  { type: "source-url" as const, sourceId: "s1", url: "https://react.dev/blog/2025/12/react-19", title: "React 19 Release Notes" },
  { type: "source-url" as const, sourceId: "s2", url: "https://nextjs.org/docs", title: "Next.js Documentation" },
  { type: "source-url" as const, sourceId: "s3", url: "https://tailwindcss.com/docs", title: "Tailwind CSS" },
  { type: "source-url" as const, sourceId: "s4", url: "https://developer.mozilla.org", title: "MDN Web Docs" },
  { type: "source-url" as const, sourceId: "s5", url: "https://github.com/vercel/ai", title: "Vercel AI SDK" },
];

// ============================================================================
// MSW Streaming Section
// ============================================================================

function MSWStreamingSection() {
  const [prompt, setPrompt] = useState("");
  const [streamOutput, setStreamOutput] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runStream = useCallback(async (testPrompt: string) => {
    setStreamOutput([]);
    setIsStreaming(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: testPrompt }],
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setStreamOutput((prev) => [...prev, `Error: ${res.status} ${res.statusText}`]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            setStreamOutput((prev) => [...prev, "[DONE]"]);
          } else {
            try {
              const parsed = JSON.parse(data);
              setStreamOutput((prev) => [...prev, JSON.stringify(parsed, null, 2)]);
            } catch {
              setStreamOutput((prev) => [...prev, data]);
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setStreamOutput((prev) => [...prev, `Fetch error: ${err?.message ?? "unknown"}`]);
      }
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return (
    <div className="space-y-4">
      {/* Quick test buttons */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Text Stream", prompt: "hello" },
          { label: "Tool Stream", prompt: "test-tools" },
          { label: "All 33 Tools", prompt: "test-all-tools" },
          { label: "Error Stream", prompt: "test-error" },
          { label: "Browser Stream", prompt: "test-browser" },
          { label: "Quota Error", prompt: "test-quota" },
        ].map((btn) => (
          <button
            key={btn.prompt}
            type="button"
            disabled={isStreaming}
            onClick={() => runStream(btn.prompt)}
            className="rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/60 disabled:opacity-50"
          >
            {btn.label}
          </button>
        ))}
        {isStreaming && (
          <button
            type="button"
            onClick={stopStream}
            className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            Stop
          </button>
        )}
      </div>

      {/* Custom prompt */}
      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type a custom prompt..."
          className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && prompt.trim()) {
              runStream(prompt.trim());
              setPrompt("");
            }
          }}
        />
        <button
          type="button"
          disabled={isStreaming || !prompt.trim()}
          onClick={() => { runStream(prompt.trim()); setPrompt(""); }}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          Send
        </button>
      </div>

      {/* Stream output */}
      {streamOutput.length > 0 && (
        <div className="max-h-[400px] overflow-auto rounded-lg border border-border/40 bg-zinc-950 p-3">
          <div className="space-y-1 font-mono text-xs text-green-400">
            {streamOutput.map((line, i) => (
              <pre key={i} className="whitespace-pre-wrap break-all text-[11px] leading-relaxed">
                {line}
              </pre>
            ))}
            {isStreaming && (
              <span className="animate-pulse text-yellow-400">Streaming...</span>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground/50">
        Uses the MSW mock handlers from packages/testing/src/msw/handlers.ts.
        The mock API routes based on prompt: &quot;test-tools&quot;, &quot;test-error&quot;, &quot;test-browser&quot;, &quot;test-quota&quot;, or default text stream.
      </p>
    </div>
  );
}

// ============================================================================
// Mock file contents for IDE demo
// ============================================================================

const MOCK_FILE_CONTENTS: Record<string, string> = {
  "/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Todo App</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <header class="header">
      <h1>My Todos</h1>
      <p class="subtitle">Stay organized, stay productive</p>
    </header>
    <main class="container">
      <div class="input-group">
        <input type="text" id="todoInput" placeholder="What needs to be done?" />
        <button id="addBtn" onclick="addTodo()">Add</button>
      </div>
      <div class="filters">
        <button class="filter active" onclick="filterTodos('all')">All</button>
        <button class="filter" onclick="filterTodos('active')">Active</button>
        <button class="filter" onclick="filterTodos('completed')">Completed</button>
      </div>
      <ul id="todoList"></ul>
      <div class="footer">
        <span id="itemCount">0 items left</span>
        <button id="clearBtn" onclick="clearCompleted()">Clear completed</button>
      </div>
    </main>
  </div>
  <script src="app.js"></script>
</body>
</html>`,

  "/styles.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 40px 20px;
}

#app {
  width: 100%;
  max-width: 520px;
}

.header {
  text-align: center;
  margin-bottom: 32px;
  color: white;
}

.header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.subtitle {
  opacity: 0.8;
  margin-top: 4px;
}

.container {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  padding: 24px;
  overflow: hidden;
}

.input-group {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.input-group input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.input-group input:focus {
  border-color: #667eea;
}

.input-group button {
  padding: 12px 24px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.input-group button:hover {
  background: #5a6fd6;
}

.filters {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.filter {
  padding: 6px 14px;
  background: #f1f5f9;
  border: none;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter.active {
  background: #667eea;
  color: white;
}

#todoList {
  list-style: none;
}

#todoList li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

#todoList li.completed span {
  text-decoration: line-through;
  opacity: 0.5;
}

#todoList li input[type="checkbox"] {
  width: 20px;
  height: 20px;
  accent-color: #667eea;
  cursor: pointer;
}

#todoList li span {
  flex: 1;
  font-size: 14px;
}

#todoList li button {
  background: none;
  border: none;
  color: #e53e3e;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 18px;
}

#todoList li:hover button {
  opacity: 1;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

#itemCount {
  font-size: 12px;
  color: #94a3b8;
}

#clearBtn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 12px;
}

#clearBtn:hover {
  color: #e53e3e;
}`,

  "/app.js": `let todos = [];
let currentFilter = 'all';

function render() {
  const list = document.getElementById('todoList');
  const countEl = document.getElementById('itemCount');
  const filtered = todos.filter(t => {
    if (currentFilter === 'active') return !t.completed;
    if (currentFilter === 'completed') return t.completed;
    return true;
  });

  list.innerHTML = filtered.map((todo, i) => \`
    <li class="\${todo.completed ? 'completed' : ''}">
      <input type="checkbox" \${todo.completed ? 'checked' : ''}
        onchange="toggleTodo(\${todos.indexOf(todo)})" />
      <span>\${todo.text}</span>
      <button onclick="deleteTodo(\${todos.indexOf(todo)})">×</button>
    </li>
  \`).join('');

  const active = todos.filter(t => !t.completed).length;
  countEl.textContent = \`\${active} item\${active !== 1 ? 's' : ''} left\`;
}

function addTodo() {
  const input = document.getElementById('todoInput');
  const text = input.value.trim();
  if (!text) return;
  todos.push({ text, completed: false });
  input.value = '';
  render();
}

function toggleTodo(index) {
  todos[index].completed = !todos[index].completed;
  render();
}

function deleteTodo(index) {
  todos.splice(index, 1);
  render();
}

function filterTodos(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase() === filter);
  });
  render();
}

function clearCompleted() {
  todos = todos.filter(t => !t.completed);
  render();
}

// Allow Enter key to add todo
document.getElementById('todoInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTodo();
});

// Initial render
render();`,

  "/package.json": `{
  "name": "todo-app",
  "version": "1.0.0",
  "description": "A beautiful todo application",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {},
  "devDependencies": {
    "vite": "^6.1.0"
  }
}`,

  "/README.md": `# Todo App

A beautiful, responsive todo application with filtering and animations.

## Features

- Add, complete, and delete todos
- Filter by All / Active / Completed
- Clear completed items
- Smooth animations
- Responsive design with gradient background

## Getting Started

\\\`\\\`\\\`bash
npm install
npm run dev
\\\`\\\`\\\`
`,
};

// ============================================================================
// Canvas Demo Section (with interactive file selection)
// ============================================================================

type CanvasDemoView = "browser" | "code" | "terminal" | "filePreview" | "webDevIDE" | "empty";

function CanvasDemoSection() {
  const [activeView, setActiveView] = useState<CanvasDemoView>("code");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Interactive file state
  const allPaths = Object.keys(MOCK_FILE_CONTENTS);
  const [activeFilePath, setActiveFilePath] = useState<string>("/index.html");
  const [closedTabs, setClosedTabs] = useState<Set<string>>(new Set());

  const openPaths = allPaths.filter((p) => !closedTabs.has(p));

  const fileTree = useMemo(() => [
    { name: "index.html", path: "/index.html", type: "file" as const },
    { name: "styles.css", path: "/styles.css", type: "file" as const },
    { name: "app.js", path: "/app.js", type: "file" as const },
    { name: "package.json", path: "/package.json", type: "file" as const },
    { name: "README.md", path: "/README.md", type: "file" as const },
  ], []);

  const fileTabs = openPaths.map((p, i) => ({
    id: String(i),
    name: p.split("/").pop() || p,
    path: p,
    isActive: p === activeFilePath,
  }));

  const handleSelectFile = useCallback((path: string) => {
    setActiveFilePath(path);
    setClosedTabs((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  const handleSelectTab = useCallback((tabId: string) => {
    const idx = Number(tabId);
    if (!Number.isNaN(idx) && openPaths[idx]) {
      setActiveFilePath(openPaths[idx]);
    }
  }, [openPaths]);

  const handleCloseTab = useCallback((tabId: string) => {
    const idx = Number(tabId);
    const path = openPaths[idx];
    if (!path) return;
    setClosedTabs((prev) => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
    if (activeFilePath === path) {
      const remaining = openPaths.filter((p) => p !== path);
      setActiveFilePath(remaining.length > 0 ? remaining[remaining.length - 1]! : allPaths[0]!);
    }
  }, [openPaths, activeFilePath, allPaths]);

  const views: { key: CanvasDemoView; label: string }[] = [
    { key: "code", label: "Code Editor" },
    { key: "webDevIDE", label: "Web Dev IDE" },
    { key: "browser", label: "Browser" },
    { key: "terminal", label: "Terminal" },
    { key: "filePreview", label: "File Preview" },
    { key: "empty", label: "Empty" },
  ];

  // Language detection
  const ext = activeFilePath.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = { ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", py: "python", css: "css", html: "html", json: "json", md: "markdown" };
  const activeLanguage = langMap[ext ?? ""] ?? "text";

  return (
    <div className="space-y-4">
      {/* View switcher */}
      <div className="flex flex-wrap gap-2">
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setActiveView(v.key)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeView === v.key
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 bg-muted/30 hover:bg-muted/60"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Canvas container */}
      <div className="h-[600px] overflow-hidden rounded-xl border border-border/40">
        <AgentCanvas
          viewType={activeView}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((f) => !f)}
          onClose={() => setActiveView("empty")}
          // Browser view mock data
          browserUrl={activeView === "browser" ? "https://react.dev" : undefined}
          browserTitle={activeView === "browser" ? "React Documentation" : undefined}
          browserContent={activeView === "browser" ? "<h1>React</h1><p>The library for web and native user interfaces.</p>" : undefined}
          browserSearchResults={activeView === "browser" ? [
            { title: "React Documentation", url: "https://react.dev", snippet: "The library for web and native user interfaces" },
            { title: "React Tutorial", url: "https://react.dev/learn", snippet: "Quick start guide for building your first React app" },
          ] : undefined}
          canGoBack={activeView === "browser"}
          canGoForward={false}
          // Code & WebDevIDE view — interactive file selection
          fileTree={(activeView === "code" || activeView === "webDevIDE") ? fileTree : undefined}
          fileTabs={(activeView === "code" || activeView === "webDevIDE") ? fileTabs : undefined}
          activeFileContent={(activeView === "code" || activeView === "webDevIDE") ? MOCK_FILE_CONTENTS[activeFilePath] : undefined}
          activeFileLanguage={(activeView === "code" || activeView === "webDevIDE") ? activeLanguage : undefined}
          onSelectFile={(activeView === "code" || activeView === "webDevIDE") ? handleSelectFile : undefined}
          onSelectTab={(activeView === "code" || activeView === "webDevIDE") ? handleSelectTab : undefined}
          onCloseTab={(activeView === "code" || activeView === "webDevIDE") ? handleCloseTab : undefined}
          fileContents={(activeView === "webDevIDE") ? MOCK_FILE_CONTENTS : undefined}
          // Terminal view mock data
          terminalOutput={activeView === "terminal" ? [
            "$ npm create vite@latest my-app -- --template react-ts",
            "\x1b[32m✓\x1b[0m Project created successfully",
            "",
            "$ cd my-app && npm install",
            "added 142 packages in 4.2s",
            "",
            "$ npm run dev",
            "",
            "  \x1b[32mVITE\x1b[0m v6.1.0  ready in \x1b[1m312ms\x1b[0m",
            "",
            "  \x1b[32m➜\x1b[0m  Local:   \x1b[36mhttp://localhost:5173/\x1b[0m",
            "  \x1b[32m➜\x1b[0m  Network: \x1b[36mhttp://192.168.1.100:5173/\x1b[0m",
          ] : undefined}
          // File preview mock data
          previewFileName={activeView === "filePreview" ? "README.md" : undefined}
          previewContent={activeView === "filePreview" ? MOCK_FILE_CONTENTS["/README.md"] : undefined}
          previewFileType={activeView === "filePreview" ? "markdown" : undefined}
          // Common
          availableViews={new Set(["browser", "code", "terminal", "filePreview", "webDevIDE", "empty"] as CanvasDemoView[])}
          onSelectView={(v) => setActiveView(v as CanvasDemoView)}
          isWorking={activeView !== "empty"}
          statusText={activeView === "code" ? `Editing ${activeFilePath.split("/").pop()}` : activeView === "webDevIDE" ? `IDE: ${activeFilePath.split("/").pop()}` : activeView === "browser" ? "Browsing react.dev" : activeView === "terminal" ? "Running build" : undefined}
          currentAction={activeView === "code" ? { type: "editing", label: "Writing code" } : activeView === "webDevIDE" ? { type: "creating", label: "Building website" } : activeView === "browser" ? { type: "browsing", label: "Viewing page" } : undefined}
          timelinePercentage={activeView === "code" ? 60 : activeView === "webDevIDE" ? 75 : activeView === "browser" ? 35 : activeView === "terminal" ? 85 : 100}
          currentStep={activeView !== "empty" ? 3 : undefined}
          totalSteps={activeView !== "empty" ? 5 : undefined}
        />
      </div>

      <p className="text-xs text-muted-foreground/50">
        Click files in the explorer to switch between them. Close tabs with the X button. Try the &quot;Web Dev IDE&quot; view to see live preview with the Preview tab.
      </p>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function ChatTestPage() {
  const messages = TEST_MESSAGES;
  const repoMessages = messages as unknown as RepoUIMessage[];
  const plannerState = usePlannerState(repoMessages);
  const [plannerExpanded, setPlannerExpanded] = useState(true);
  const [sourcesLog, setSourcesLog] = useState<string | null>(null);

  return (
    <ToolRegistry>
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Page header */}
        <div className="mb-2 rounded-lg border border-dashed border-yellow-500/40 bg-yellow-500/5 p-4">
          <h1 className="text-lg font-semibold">Chat Pipeline Test Page</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Comprehensive visual testing: tool renderers (33), ToolCard wrapper, canvas views, planner, sources, and MSW mock streaming.
          </p>
        </div>

        {/* ============================================================ */}
        {/* Section 1: Tool Renderers (no ToolCard wrapper — chat mode)  */}
        {/* ============================================================ */}
        <SectionHeader
          number={1}
          title="Tool Renderers (Chat Mode)"
          description="All 33 tools rendered via MessageRenderer — no ToolCard wrapper. This is how tools appear in the actual chat."
        />
        <div className="space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-1">
              <div className="text-xs font-medium uppercase text-muted-foreground/60">
                {msg.role}
              </div>
              <div
                className={
                  msg.role === "user"
                    ? "rounded-2xl bg-muted/50 px-4 py-3"
                    : ""
                }
              >
                <MessageRenderer
                  message={msg}
                  isLastMessage={msg.id === messages[messages.length - 1]?.id}
                  isStreaming={false}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ============================================================ */}
        {/* Section 2: ToolCard Wrapper (Testing Mode)                   */}
        {/* ============================================================ */}
        <SectionHeader
          number={2}
          title="ToolCard Wrapper (Testing Mode)"
          description="Same tools wrapped in ToolCard for visual comparison. Shows header, status badge, expand/collapse, progress bar."
        />
        <div className="space-y-3">
          {TOOLCARD_SAMPLES.map((sample) => (
            <div key={sample.part.toolCallId}>
              <div className="mb-1 text-xs text-muted-foreground/50">{sample.label}</div>
              <ToolCard part={sample.part} defaultExpanded={true} />
            </div>
          ))}
        </div>

        {/* ============================================================ */}
        {/* Section 3: Canvas Views                                      */}
        {/* ============================================================ */}
        <SectionHeader
          number={3}
          title="IDE / Canvas Views (Interactive)"
          description="Full IDE with file explorer, tab bar, code highlighting, and live preview. Click files in the tree, switch tabs, close tabs, and try the Web Dev IDE view with live HTML preview."
        />
        <CanvasDemoSection />

        {/* ============================================================ */}
        {/* Section 4: Planner Bar                                       */}
        {/* ============================================================ */}
        <SectionHeader
          number={4}
          title="Planner Bar"
          description="Task progress bar derived from show_plan tool calls. Shows steps, progress percentage, and expand/collapse."
        />
        {plannerState.hasSteps && (
          <PlannerBar
            state={plannerState}
            isExpanded={plannerExpanded}
            onToggleExpanded={() => setPlannerExpanded((p) => !p)}
          />
        )}

        {/* ============================================================ */}
        {/* Section 5: Sources                                           */}
        {/* ============================================================ */}
        <SectionHeader
          number={5}
          title="Sources (Inline Pills)"
          description="Source pills with favicons. Click to trigger canvas or open URL. Tests the onViewSources callback."
        />
        <div className="rounded-lg border border-border/40 p-4">
          <SourcesGroup
            sources={MOCK_SOURCES}
            onViewSources={(sources) => {
              setSourcesLog(`onViewSources called with ${sources.length} sources: ${sources.map((s) => ("url" in s ? s.url : s.sourceId)).join(", ")}`);
            }}
          />
          {sourcesLog && (
            <div className="mt-3 rounded-md bg-muted/30 p-2 font-mono text-xs text-muted-foreground">
              {sourcesLog}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* Section 6: MSW Mock API Streaming                            */}
        {/* ============================================================ */}
        <SectionHeader
          number={6}
          title="MSW Mock API Streaming"
          description="Interactive SSE streaming test. Sends prompts to /api/chat and displays raw SSE events. Requires MSW service worker or live backend."
        />
        <MSWStreamingSection />

        {/* Spacer */}
        <div className="h-20" />
      </div>
    </ToolRegistry>
  );
}
