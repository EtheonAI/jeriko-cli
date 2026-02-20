"use client";

import * as React from "react";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useSession } from "@repo/auth/client";
import {
  PlayIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  FolderIcon,
  FolderOpenIcon,
  FileIcon,
  TerminalIcon,
  GlobeIcon,
  MonitorIcon,
  CodeIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
  MinusCircleIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SmartphoneIcon,
  TabletIcon,
  StopCircleIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

type StepStatus = "pending" | "running" | "success" | "error" | "skipped";

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  output?: string;
  duration?: number;
}

interface SandboxState {
  sandboxId: string | null;
  e2bSandboxId: string | null;
  nekoUrl: string | null;
  previewUrl: string | null;
  codeServerUrl: string | null;
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
}

// ============================================================================
// Constants
// ============================================================================

const ORCHESTRATOR = "http://localhost:4014";
const SANDBOX_API = "/api/sandbox";

// Language detection by extension (used by syntax highlighting when code-server is not available)
function _getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    json: "json",
    css: "css",
    html: "html",
    md: "markdown",
    py: "python",
    sh: "bash",
    yaml: "yaml",
    yml: "yaml",
    sql: "sql",
    env: "bash",
    gitignore: "bash",
    toml: "toml",
  };
  return map[ext] || "text";
}
void _getLanguage;

// File icon heuristic
function getFileIconColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const colors: Record<string, string> = {
    ts: "text-blue-400",
    tsx: "text-blue-400",
    js: "text-yellow-400",
    jsx: "text-yellow-400",
    json: "text-yellow-500",
    css: "text-purple-400",
    html: "text-orange-400",
    md: "text-zinc-400",
    py: "text-green-400",
    sql: "text-cyan-400",
    env: "text-zinc-500",
  };
  return colors[ext] || "text-zinc-500";
}

// ============================================================================
// Helpers
// ============================================================================

async function fetchJson(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}

// ============================================================================
// File Tree Component
// ============================================================================

function FileTreeItem({
  node,
  depth = 0,
  selectedPath,
  onSelect,
  expandedPaths,
  onToggle,
}: {
  node: FileNode;
  depth?: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
}) {
  const isDir = node.type === "dir";
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = node.path === selectedPath;

  return (
    <>
      <button
        type="button"
        className={`flex w-full items-center gap-1.5 py-[3px] pr-2 text-[11px] transition-colors hover:bg-white/5 ${
          isSelected ? "bg-indigo-500/15 text-zinc-100" : "text-zinc-400"
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => {
          if (isDir) onToggle(node.path);
          else onSelect(node.path);
        }}
      >
        {isDir ? (
          isExpanded ? (
            <ChevronDownIcon className="size-3 flex-shrink-0 text-zinc-500" />
          ) : (
            <ChevronRightIcon className="size-3 flex-shrink-0 text-zinc-500" />
          )
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        {isDir ? (
          isExpanded ? (
            <FolderOpenIcon className="size-3.5 flex-shrink-0 text-yellow-400/70" />
          ) : (
            <FolderIcon className="size-3.5 flex-shrink-0 text-yellow-400/70" />
          )
        ) : (
          <FileIcon className={`size-3.5 flex-shrink-0 ${getFileIconColor(node.name)}`} />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isDir &&
        isExpanded &&
        node.children?.map((child) => (
          <FileTreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
            expandedPaths={expandedPaths}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

// ============================================================================
// IDE Tab Types
// ============================================================================

type IDEView = "preview" | "code" | "editor" | "terminal" | "browser";

const IDE_VIEWS: {
  id: IDEView;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "preview", label: "Preview", Icon: GlobeIcon },
  { id: "code", label: "Code", Icon: CodeIcon },
  { id: "editor", label: "Editor", Icon: MonitorIcon },
  { id: "terminal", label: "Terminal", Icon: TerminalIcon },
  { id: "browser", label: "Desktop", Icon: MonitorIcon },
];

// ============================================================================
// Main Component
// ============================================================================

export default function TestIDEPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id || "test-user";

  // ── State ──────────────────────────────────────────────────────────────
  const [steps, setSteps] = useState<Step[]>([
    { id: "health", label: "Check orchestrator health", status: "pending" },
    { id: "sandbox", label: "Create E2B sandbox", status: "pending" },
    { id: "bootstrap", label: "Verify Node.js + pnpm", status: "pending" },
    { id: "init", label: "Init webdev project (web-db-user)", status: "pending" },
    { id: "write", label: "Write full-stack todo app files", status: "pending" },
    { id: "schema", label: "Push Drizzle schema to TiDB", status: "pending" },
    { id: "devserver", label: "Start Vite dev server", status: "pending" },
    { id: "preview", label: "Verify preview is live", status: "pending" },
    { id: "codeserver", label: "Start code-server (VS Code)", status: "pending" },
    { id: "checkpoint", label: "Save git checkpoint", status: "pending" },
    { id: "stream", label: "Test LLM completion stream", status: "pending" },
  ]);

  const [sandbox, setSandbox] = useState<SandboxState>({
    sandboxId: null,
    e2bSandboxId: null,
    nekoUrl: null,
    previewUrl: null,
    codeServerUrl: null,
  });

  const [activeView, setActiveView] = useState<IDEView>("preview");
  const [showSteps, setShowSteps] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  // File tree state
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [fileLoading, setFileLoading] = useState(false);

  // Terminal state
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [terminalCmd, setTerminalCmd] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Stream test output (used in stream test step)
  const [, setStreamText] = useState("");

  // Render-safe mirrors of refs (refs can't be read in JSX in React 19)
  const [sandboxIdDisplay, setSandboxIdDisplay] = useState<string | null>(null);
  const [databaseNameDisplay, setDatabaseNameDisplay] = useState<string | null>(null);

  // Refs (use refs to avoid stale closures in sequential async loop)
  const sandboxIdRef = useRef<string | null>(null);
  const e2bSandboxIdRef = useRef<string | null>(null);
  const databaseNameRef = useRef<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // ── Step helpers ───────────────────────────────────────────────────────

  const updateStep = useCallback((id: string, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const runStep = useCallback(
    async (id: string, fn: () => Promise<string>): Promise<boolean> => {
      updateStep(id, { status: "running", output: undefined });
      const t0 = Date.now();
      try {
        const output = await fn();
        updateStep(id, { status: "success", output, duration: Date.now() - t0 });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateStep(id, { status: "error", output: msg, duration: Date.now() - t0 });
        return false;
      }
    },
    [updateStep]
  );

  // ── Step implementations ──────────────────────────────────────────────

  const checkHealth = useCallback(async (): Promise<string> => {
    const res = await fetchJson(`${ORCHESTRATOR}/health`);
    if (!res.ok) throw new Error(`Health: ${res.status}`);
    return JSON.stringify(res.data, null, 2);
  }, []);

  const createSandbox = useCallback(async (): Promise<string> => {
    // Create sandbox via orchestrator (registers in session cache for code-server)
    const res = await fetchJson(`${ORCHESTRATOR}/api/sandbox/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "test-ide-session",
        userId,
      }),
    });
    if (!res.ok) throw new Error(`Create: ${res.status} ${JSON.stringify(res.data)}`);

    const { sandboxId, e2bSandboxId, nekoUrl } = res.data as {
      sandboxId: string;
      e2bSandboxId: string | null;
      nekoUrl: string | null;
    };

    sandboxIdRef.current = sandboxId;
    e2bSandboxIdRef.current = e2bSandboxId;
    setSandboxIdDisplay(sandboxId);

    setSandbox((prev) => ({
      ...prev,
      sandboxId,
      e2bSandboxId,
      nekoUrl: nekoUrl || null,
    }));

    await new Promise((r) => setTimeout(r, 5000));
    return `Sandbox: ${sandboxId}\nE2B: ${e2bSandboxId}`;
  }, [userId]);

  const bootstrapNode = useCallback(async (): Promise<string> => {
    const sbx = sandboxIdRef.current;
    if (!sbx) throw new Error("No sandbox");

    // Node.js 22 and pnpm are pre-installed in the E2B desktop template
    const res = await fetchJson(`${SANDBOX_API}/${sbx}/shell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "node --version && pnpm --version", timeout: 10000 }),
    });

    if (!res.ok) {
      throw new Error(`Shell request failed: ${res.status} - ${JSON.stringify(res.data)}`);
    }

    const d = res.data?.data || res.data;

    if (!d || typeof d !== 'object') {
      throw new Error(`Invalid response format: ${JSON.stringify(res.data)}`);
    }

    if (d.exitCode !== 0) {
      throw new Error(`Command failed (exit ${d.exitCode}): ${d.stderr || d.stdout || "No output"}`);
    }

    return d.stdout?.trim() || "Node.js and pnpm verified";
  }, []);

  const initProject = useCallback(async (): Promise<string> => {
    const sbx = sandboxIdRef.current;
    if (!sbx) throw new Error("No sandbox");
    const res = await fetchJson(`${ORCHESTRATOR}/api/webdev/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sandboxId: sbx,
        userId,
        template_id: "web-db-user",
        app_name: "my-app",
      }),
    });
    if (!res.ok) throw new Error(`Init: ${res.status} ${JSON.stringify(res.data)}`);
    if (res.data?.databaseName) {
      databaseNameRef.current = res.data.databaseName;
      setDatabaseNameDisplay(res.data.databaseName);
    }
    return JSON.stringify(res.data, null, 2);
  }, [userId]);

  const pushSchema = useCallback(async (): Promise<string> => {
    const sbx = sandboxIdRef.current;
    if (!sbx) throw new Error("No sandbox");
    const res = await fetchJson(`${ORCHESTRATOR}/api/webdev/database`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sandboxId: sbx,
        userId,
        operation: "push",
        projectPath: "/home/user/my-app",
        databaseName: databaseNameRef.current || undefined,
      }),
    });
    if (!res.ok) throw new Error(`Schema: ${JSON.stringify(res.data)}`);
    return JSON.stringify(res.data, null, 2);
  }, [userId]);

  const writeFiles = useCallback(async (): Promise<string> => {
    const sbx = sandboxIdRef.current;
    if (!sbx) throw new Error("No sandbox");

    // ── Drizzle schema with todos table ──
    const schemaTs = `import { mysqlTable, varchar, int, timestamp, boolean } from "drizzle-orm/mysql-core";

export const todos = mysqlTable("todos", {
  id: int("id").primaryKey().autoincrement(),
  text: varchar("text", { length: 500 }).notNull(),
  done: boolean("done").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Todo = typeof todos.$inferSelect;
export type InsertTodo = typeof todos.$inferInsert;
`;

    // ── Express API server with error handling ──
    const serverTs = `import express from "express";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import { todos } from "../drizzle/schema.js";

const app = express();
app.use(express.json());

let db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (!db && process.env.DATABASE_URL) {
    try {
      const dbUrl = new URL(process.env.DATABASE_URL);
      const connection = await mysql.createConnection({
        host: dbUrl.hostname,
        port: Number(dbUrl.port) || 4000,
        user: decodeURIComponent(dbUrl.username),
        password: decodeURIComponent(dbUrl.password),
        database: dbUrl.pathname.slice(1),
        ssl: {},
      });
      db = drizzle(connection);
    } catch (e) {
      console.error("DB connect failed:", e);
    }
  }
  return db;
}

app.get("/api/todos", async (_req, res) => {
  const d = await getDb();
  if (!d) return res.json([]);
  const rows = await d.select().from(todos).orderBy(todos.id);
  res.json(rows);
});

app.post("/api/todos", async (req, res) => {
  const d = await getDb();
  if (!d) return res.status(503).json({ error: "No database" });
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "text required" });
  const result = await d.insert(todos).values({ text: text.trim() });
  res.json({ id: result[0].insertId, text: text.trim(), done: false });
});

app.patch("/api/todos/:id", async (req, res) => {
  const d = await getDb();
  if (!d) return res.status(503).json({ error: "No database" });
  const id = Number(req.params.id);
  await d.update(todos).set({ done: req.body.done }).where(eq(todos.id, id));
  res.json({ ok: true });
});

app.delete("/api/todos/:id", async (req, res) => {
  const d = await getDb();
  if (!d) return res.status(503).json({ error: "No database" });
  const id = Number(req.params.id);
  await d.delete(todos).where(eq(todos.id, id));
  res.json({ ok: true });
});

app.listen(3001, "0.0.0.0", () => console.log("API on :3001"));
`;

    // ── Frontend — fetches from /api/todos ──
    const mainTs = `import './style.css'

interface Todo { id: number; text: string; done: boolean }

const API = '/api/todos'
let todos: Todo[] = []
let dbStatus = 'connecting...'

async function loadTodos() {
  try {
    todos = await fetch(API).then(r => r.json())
    dbStatus = 'connected to TiDB'
  } catch {
    dbStatus = 'API unavailable (offline mode)'
  }
  render()
}

async function addTodo(text: string) {
  const res = await fetch(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const todo = await res.json()
  todos.push(todo)
  render()
}

async function toggleTodo(id: number, done: boolean) {
  await fetch(API + '/' + id, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done }),
  })
  const t = todos.find(t => t.id === id)
  if (t) t.done = done
  render()
}

async function deleteTodo(id: number) {
  await fetch(API + '/' + id, { method: 'DELETE' })
  todos = todos.filter(t => t.id !== id)
  render()
}

function render() {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = \`
    <div class="container">
      <h1>Rubic Todo</h1>
      <p class="subtitle">Full-stack: Vite + Express + Drizzle + TiDB</p>
      <form id="add-form" class="add-form">
        <input type="text" id="todo-input" placeholder="What needs to be done?" autofocus />
        <button type="submit">Add</button>
      </form>
      <ul class="todo-list">
        \${todos.map(t => \`
          <li class="todo-item \${t.done ? 'done' : ''}">
            <input type="checkbox" \${t.done ? 'checked' : ''} data-id="\${t.id}" />
            <span>\${t.text}</span>
            <button class="delete" data-id="\${t.id}">&times;</button>
          </li>
        \`).join('')}
      </ul>
      <p class="count">\${todos.filter(t => !t.done).length} items left &middot; \${dbStatus}</p>
    </div>
  \`
  document.querySelector('#add-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const input = document.querySelector<HTMLInputElement>('#todo-input')!
    if (input.value.trim()) { addTodo(input.value.trim()); input.value = '' }
  })
  document.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => toggleTodo(Number(cb.dataset.id), cb.checked))
  })
  document.querySelectorAll<HTMLButtonElement>('.delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTodo(Number(btn.dataset.id)))
  })
}

render()
loadTodos()
`;

    const styleCss = `:root { font-family: system-ui, -apple-system, sans-serif; }
body { margin: 0; background: #0a0a0a; color: #e0e0e0; display: flex; justify-content: center; padding-top: 60px; }
.container { max-width: 500px; width: 100%; padding: 0 20px; }
h1 { font-size: 2rem; margin-bottom: 4px; }
.subtitle { color: #888; font-size: 0.85rem; margin-bottom: 24px; }
.add-form { display: flex; gap: 8px; margin-bottom: 20px; }
.add-form input { flex: 1; padding: 10px 14px; border: 1px solid #333; border-radius: 8px; background: #1a1a1a; color: #e0e0e0; font-size: 1rem; outline: none; }
.add-form input:focus { border-color: #646cff; }
.add-form button { padding: 10px 20px; background: #646cff; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; }
.add-form button:hover { background: #535bf2; }
.todo-list { list-style: none; padding: 0; }
.todo-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid #222; }
.todo-item.done span { text-decoration: line-through; color: #666; }
.todo-item span { flex: 1; }
.todo-item .delete { background: none; border: none; color: #666; cursor: pointer; font-size: 1.1rem; padding: 4px 8px; border-radius: 4px; }
.todo-item .delete:hover { color: #ff4444; background: #1a1a1a; }
.count { color: #666; font-size: 0.85rem; margin-top: 16px; }
`;

    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Rubic Todo</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;

    // Vite config: allow all hosts + proxy /api to Express on 3001
    const viteConfig = `import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
`;

    const files = [
      { path: "/home/user/my-app/vite.config.ts", content: viteConfig },
      { path: "/home/user/my-app/drizzle/schema.ts", content: schemaTs },
      { path: "/home/user/my-app/server/index.ts", content: serverTs },
      { path: "/home/user/my-app/src/main.ts", content: mainTs },
      { path: "/home/user/my-app/src/style.css", content: styleCss },
      { path: "/home/user/my-app/index.html", content: indexHtml },
    ];

    const results: string[] = [];
    for (const { path, content } of files) {
      const res = await fetchJson(`${SANDBOX_API}/${sbx}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
      });
      results.push(`${res.ok ? "OK" : "FAIL"} ${path.split("/").pop()} (${content.length}b)`);
    }
    return results.join("\n");
  }, []);

  const startDevServer = useCallback(async (): Promise<string> => {
    const sbx = sandboxIdRef.current;
    if (!sbx) throw new Error("No sandbox");

    // Kill any existing dev servers
    await fetchJson(`${SANDBOX_API}/${sbx}/shell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: "pkill -f 'vite|tsx server' 2>/dev/null; sleep 1",
        timeout: 5000,
      }),
    });

    // Start Express API server on port 3001 (background)
    // Must export .env vars — Node.js doesn't auto-load .env files
    await fetchJson(`${SANDBOX_API}/${sbx}/shell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command:
          "cd /home/user/my-app && export $(grep -v '^#' .env | xargs) && npx tsx server/index.ts > /tmp/api.log 2>&1 &",
        timeout: 10000,
      }),
    });

    // Start Vite dev server on port 3000 (proxies /api → :3001)
    const res = await fetchJson(`${SANDBOX_API}/${sbx}/shell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command:
          "cd /home/user/my-app && npx vite --host 0.0.0.0 --port 3000 > /tmp/vite.log 2>&1 & sleep 5 && curl -s -o /dev/null -w '%{http_code}' http://localhost:3000",
        timeout: 25000,
      }),
    });
    const d = res.data?.data || res.data;
    const code = d?.stdout?.trim();

    // Also check API health
    const apiRes = await fetchJson(`${SANDBOX_API}/${sbx}/shell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command:
          "curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/todos 2>/dev/null || echo '000'",
        timeout: 5000,
      }),
    });
    const apiCode = (apiRes.data?.data || apiRes.data)?.stdout?.trim();

    if (code === "200") return `Vite: :3000 (HTTP 200)\nExpress API: :3001 (HTTP ${apiCode})`;
    throw new Error(`Vite returned ${code || "no response"}. stderr: ${d?.stderr?.slice(0, 200)}`);
  }, []);

  const verifyPreview = useCallback(async (): Promise<string> => {
    const e2bId = e2bSandboxIdRef.current;
    if (!e2bId) throw new Error("No E2B sandbox ID");
    const sandboxDomain = process.env.NEXT_PUBLIC_SANDBOX_DOMAIN || "e2b.dev";
    const previewUrl = `https://3000-${e2bId}.${sandboxDomain}`;
    setSandbox((prev) => ({ ...prev, previewUrl }));

    const sbx = sandboxIdRef.current;
    const status = await fetchJson(`${ORCHESTRATOR}/api/webdev/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sandboxId: sbx, userId, projectPath: "/home/user/my-app" }),
    });
    return `Preview: ${previewUrl}\nServer: ${JSON.stringify(status.data?.devServer)}`;
  }, [userId]);

  const saveCheckpoint = useCallback(async (): Promise<string> => {
    const sbx = sandboxIdRef.current;
    if (!sbx) throw new Error("No sandbox");
    const res = await fetchJson(`${ORCHESTRATOR}/api/webdev/checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sandboxId: sbx,
        userId,
        projectPath: "/home/user/my-app",
        message: "Todo app with Rubic IDE",
      }),
    });
    return JSON.stringify(res.data, null, 2);
  }, [userId]);

  const startCodeServer = useCallback(async (): Promise<string> => {
    const sbx = sandboxIdRef.current;
    const e2bId = e2bSandboxIdRef.current;
    if (!sbx || !e2bId) throw new Error("No sandbox");

    // Manus 3-layer code-server architecture:
    //   Layer 1: code-server with auth: password on port 8329 (random per-sandbox password)
    //   Layer 2: Terminal server reverse proxy at /cs/ on port 8330 (auto auth-cookie injection)
    //   Layer 3: E2B port proxy (unguessable URL)
    //
    // Flow: pre-auth → start code-server → terminal server logs in → proxy serves editor

    // Step 1: Call orchestrator pre-auth (triggers code-server start + generates token)
    const preAuthRes = await fetchJson(
      `${ORCHESTRATOR}/api/code-server/pre-auth?sessionId=test-ide-session&userId=${userId}`
    );
    if (!preAuthRes.ok) {
      throw new Error(`Pre-auth failed: ${JSON.stringify(preAuthRes.data)}`);
    }

    const { pre_auth_token, url: proxyUrl, ready } = preAuthRes.data as {
      pre_auth_token: string;
      url: string | null;
      ready: boolean;
    };

    if (!ready) {
      throw new Error("Code-server failed to start within timeout");
    }

    // Step 2: Validate token and get password (for debugging/verification)
    const authRes = await fetchJson(`${ORCHESTRATOR}/api/code-server/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pre_auth_token,
        sessionId: "test-ide-session",
        userId,
      }),
    });
    if (!authRes.ok) {
      throw new Error(`Auth validation failed: ${JSON.stringify(authRes.data)}`);
    }

    const { password, proxy_path } = authRes.data as {
      password: string;
      proxy_path: string;
    };

    // Step 3: Use the terminal server proxy URL (port 8330 + /cs/ path)
    // The reverse proxy in terminal-server.mjs handles code-server authentication
    // by logging in once, caching the session cookie, and injecting it for all requests.
    // No login page is ever shown to the user.
    const csDomain = process.env.NEXT_PUBLIC_SANDBOX_DOMAIN || "e2b.dev";
    const csUrl = proxyUrl || `https://8330-${e2bId}.${csDomain}/cs/`;
    setSandbox((prev) => ({ ...prev, codeServerUrl: csUrl }));

    return [
      `Code-server ready (auth: password)`,
      `Password: ${password}`,
      `Proxy path: ${proxy_path}`,
      `URL: ${csUrl}`,
      `Architecture: code-server:8329 ← terminal-server:8330/cs/ ← E2B proxy`,
    ].join("\n");
  }, [userId]);

  const testStream = useCallback(async (): Promise<string> => {
    const res = await fetch(`${ORCHESTRATOR}/v1/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Say hello in 10 words or less." }],
        userId,
        sessionId: "test-ide-stream",
        maxSteps: 1,
      }),
    });
    if (!res.ok) throw new Error(`Stream: ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No body");
    const decoder = new TextDecoder();
    let full = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      for (const line of chunk.split("\n")) {
        if (line.startsWith("d:")) {
          try {
            const d = JSON.parse(line.slice(2));
            if (typeof d === "string") text += d;
          } catch {
            /* skip */
          }
        }
      }
    }
    setStreamText(text || full.slice(0, 300));
    return `${full.length} bytes, text: ${text.slice(0, 200)}`;
  }, [userId]);

  // ── Run all ───────────────────────────────────────────────────────────

  // ── File tree loading ─────────────────────────────────────────────────

  const loadFileTree = useCallback(async (sbxId: string, basePath = "/home/user/my-app") => {
    const res = await fetchJson(
      `${SANDBOX_API}/${sbxId}/files/list?path=${encodeURIComponent(basePath)}`
    );
    const files = res.data?.data?.files || [];

    // Sort: dirs first, then files alphabetically
    const sorted = [...files].sort((a: FileNode, b: FileNode) => {
      if (a.type === "dir" && b.type !== "dir") return -1;
      if (a.type !== "dir" && b.type === "dir") return 1;
      return a.name.localeCompare(b.name);
    });

    // Recursively load child directories (2 levels deep)
    const tree: FileNode[] = [];
    for (const f of sorted) {
      const node: FileNode = { name: f.name, path: `${basePath}/${f.name}`, type: f.type };
      if (f.type === "dir" && !f.name.startsWith(".") && f.name !== "node_modules") {
        const childRes = await fetchJson(
          `${SANDBOX_API}/${sbxId}/files/list?path=${encodeURIComponent(node.path)}`
        );
        const childFiles = childRes.data?.data?.files || [];
        node.children = childFiles
          .sort((a: FileNode, b: FileNode) => {
            if (a.type === "dir" && b.type !== "dir") return -1;
            if (a.type !== "dir" && b.type === "dir") return 1;
            return a.name.localeCompare(b.name);
          })
          .map((c: FileNode) => ({
            name: c.name,
            path: `${node.path}/${c.name}`,
            type: c.type,
            children: c.type === "dir" ? [] : undefined,
          }));
      }
      tree.push(node);
    }

    setFileTree(tree);
    // Auto-expand src/ and server/
    setExpandedPaths(new Set(tree.filter((n) => n.type === "dir").map((n) => n.path)));
  }, []);

  const runAll = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setSteps((prev) =>
      prev.map((s) => ({
        ...s,
        status: "pending" as StepStatus,
        output: undefined,
        duration: undefined,
      }))
    );
    setTerminalLines([]);
    setStreamText("");
    setFileTree([]);
    setSelectedFile(null);
    setFileContent("");
    databaseNameRef.current = null;
    setDatabaseNameDisplay(null);

    const fns: [string, () => Promise<string>][] = [
      ["health", checkHealth],
      ["sandbox", createSandbox],
      ["bootstrap", bootstrapNode],
      ["init", initProject],
      ["write", writeFiles],
      ["schema", pushSchema],
      ["devserver", startDevServer],
      ["preview", verifyPreview],
      ["codeserver", startCodeServer],
      ["checkpoint", saveCheckpoint],
      ["stream", testStream],
    ];

    for (const [id, fn] of fns) {
      const ok = await runStep(id, fn);
      // Non-fatal steps: schema (no TiDB), stream (no API key)
      if (!ok && (id === "schema" || id === "stream" || id === "codeserver")) continue;
      if (!ok && ["health", "sandbox", "bootstrap"].includes(id)) {
        for (const [skipId] of fns) {
          setSteps((prev) =>
            prev.map((s) =>
              s.id === skipId && s.status === "pending" ? { ...s, status: "skipped" } : s
            )
          );
        }
        break;
      }
    }

    // Auto-load file tree after steps complete
    if (sandboxIdRef.current) await loadFileTree(sandboxIdRef.current);
    setIsRunning(false);
  }, [
    isRunning,
    runStep,
    checkHealth,
    createSandbox,
    bootstrapNode,
    initProject,
    pushSchema,
    writeFiles,
    startDevServer,
    verifyPreview,
    startCodeServer,
    saveCheckpoint,
    testStream,
    loadFileTree,
  ]);

  // ── Read file on select ───────────────────────────────────────────────

  const handleSelectFile = useCallback(async (path: string) => {
    setSelectedFile(path);
    setFileLoading(true);
    setActiveView("code");
    const sbx = sandboxIdRef.current;
    if (!sbx) {
      setFileLoading(false);
      return;
    }

    const res = await fetchJson(`${SANDBOX_API}/${sbx}/files?path=${encodeURIComponent(path)}`);
    const content = res.data?.data?.content ?? res.data?.content ?? "";
    setFileContent(typeof content === "string" ? content : JSON.stringify(content, null, 2));
    setFileLoading(false);
  }, []);

  const handleToggleDir = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // ── Terminal ──────────────────────────────────────────────────────────

  const runCommand = useCallback(
    async (cmd?: string) => {
      const command = cmd || terminalCmd.trim();
      if (!command || !sandboxIdRef.current) return;

      setCmdHistory((prev) => [...prev, command]);
      setHistoryIdx(-1);
      setTerminalCmd("");
      setTerminalLines((prev) => [...prev, `$ ${command}`]);

      const res = await fetchJson(`${SANDBOX_API}/${sandboxIdRef.current}/shell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, timeout: 15000 }),
      });
      const d = res.data?.data || res.data;
      const out = d?.stdout || d?.stderr || "(no output)";
      setTerminalLines((prev) => [...prev, ...out.split("\n")]);
    },
    [terminalCmd]
  );

  const handleTerminalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runCommand();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (cmdHistory.length > 0) {
          const idx = historyIdx < 0 ? cmdHistory.length - 1 : Math.max(0, historyIdx - 1);
          setHistoryIdx(idx);
          setTerminalCmd(cmdHistory[idx] || "");
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIdx >= 0) {
          const idx = historyIdx + 1;
          if (idx >= cmdHistory.length) {
            setHistoryIdx(-1);
            setTerminalCmd("");
          } else {
            setHistoryIdx(idx);
            setTerminalCmd(cmdHistory[idx] || "");
          }
        }
      }
    },
    [runCommand, cmdHistory, historyIdx]
  );

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalLines]);

  // ── Cleanup on unmount ────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      const sbx = sandboxIdRef.current;
      if (sbx)
        fetch(`${SANDBOX_API}/${sbx}/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch(() => {});
    };
  }, []);

  // ── Step progress summary ─────────────────────────────────────────────

  const stepCounts = useMemo(() => {
    const success = steps.filter((s) => s.status === "success").length;
    const error = steps.filter((s) => s.status === "error").length;
    const running = steps.filter((s) => s.status === "running").length;
    return { success, error, running, total: steps.length };
  }, [steps]);

  const selectedFileName = selectedFile?.split("/").pop() || "";

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-[#0e1117] text-zinc-200">
      {/* ── Left: Steps + File Tree ──────────────────────────────────────── */}
      <div
        className={`flex flex-col border-r border-zinc-800 transition-all ${showSteps ? "w-[280px]" : "w-0 overflow-hidden"}`}
      >
        {/* Steps section */}
        <div className="border-b border-zinc-800">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Setup
              </h2>
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                {stepCounts.success}/{stepCounts.total}
              </span>
            </div>
            <button
              type="button"
              onClick={runAll}
              disabled={isRunning}
              className="flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {isRunning ? (
                <Loader2Icon className="size-3 animate-spin" />
              ) : (
                <PlayIcon className="size-3" />
              )}
              {isRunning ? "Running" : "Run All"}
            </button>
          </div>

          {/* Step list */}
          <div className="max-h-[280px] overflow-y-auto px-1 pb-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className="group flex items-start gap-2 rounded px-2 py-1 hover:bg-white/[0.02]"
              >
                <div className="mt-0.5 flex-shrink-0">
                  {step.status === "success" && (
                    <CheckCircle2Icon className="size-3.5 text-green-400" />
                  )}
                  {step.status === "error" && <XCircleIcon className="size-3.5 text-red-400" />}
                  {step.status === "running" && (
                    <Loader2Icon className="size-3.5 animate-spin text-blue-400" />
                  )}
                  {step.status === "pending" && (
                    <MinusCircleIcon className="size-3.5 text-zinc-700" />
                  )}
                  {step.status === "skipped" && (
                    <StopCircleIcon className="size-3.5 text-zinc-700" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between">
                    <span
                      className={`text-[11px] ${step.status === "success" ? "text-zinc-300" : step.status === "error" ? "text-red-300" : step.status === "running" ? "text-blue-300" : "text-zinc-600"}`}
                    >
                      {step.label}
                    </span>
                    {step.duration !== undefined && (
                      <span className="ml-1 flex-shrink-0 text-[9px] text-zinc-700">
                        {(step.duration / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                  {step.output && step.status === "error" && (
                    <pre className="mt-0.5 max-h-16 overflow-auto text-[9px] leading-tight text-red-400/80">
                      {step.output.slice(0, 200)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* File tree section */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Explorer
            </h2>
            {sandboxIdDisplay && (
              <button
                type="button"
                onClick={() => sandboxIdRef.current && loadFileTree(sandboxIdRef.current)}
                className="text-zinc-600 hover:text-zinc-400"
              >
                <RefreshCwIcon className="size-3" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {fileTree.length > 0 ? (
              fileTree.map((node) => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  selectedPath={selectedFile}
                  onSelect={handleSelectFile}
                  expandedPaths={expandedPaths}
                  onToggle={handleToggleDir}
                />
              ))
            ) : (
              <div className="px-3 py-8 text-center text-[11px] text-zinc-700">
                {isRunning ? "Loading..." : "Run setup to load files"}
              </div>
            )}
          </div>
        </div>

        {/* Sandbox info */}
        {sandbox.sandboxId && (
          <div className="border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-600">
            <div className="truncate">sbx: {sandbox.sandboxId}</div>
            {sandbox.previewUrl && <div className="truncate">url: {sandbox.previewUrl}</div>}
            {databaseNameDisplay && <div className="truncate">db: {databaseNameDisplay}</div>}
          </div>
        )}
      </div>

      {/* ── Right: IDE Area ──────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center border-b border-zinc-800 bg-[#0d1017]">
          <button
            type="button"
            onClick={() => setShowSteps(!showSteps)}
            className="border-r border-zinc-800 px-2.5 py-2.5 text-zinc-600 hover:text-zinc-400"
          >
            {showSteps ? (
              <PanelLeftCloseIcon className="size-4" />
            ) : (
              <PanelLeftOpenIcon className="size-4" />
            )}
          </button>

          {IDE_VIEWS.map((view) => (
            <button
              type="button"
              key={view.id}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
                activeView === view.id
                  ? "border-b-2 border-indigo-500 text-zinc-200"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
              onClick={() => setActiveView(view.id)}
            >
              <view.Icon className="size-3.5" />
              {view.label}
            </button>
          ))}

          <div className="flex-1" />

          {/* Open in new tab */}
          {sandbox.previewUrl && activeView === "preview" && (
            <a
              href={sandbox.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mr-2 flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              <ExternalLinkIcon className="size-3" />
              Open
            </a>
          )}
          {sandbox.codeServerUrl && activeView === "editor" && (
            <a
              href={sandbox.codeServerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mr-2 flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              <ExternalLinkIcon className="size-3" />
              Open
            </a>
          )}
        </div>

        {/* View content */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Preview view ──────────────────────────────────────────── */}
          {activeView === "preview" && (
            <div className="flex flex-1 flex-col">
              {/* URL bar */}
              <div className="flex items-center gap-2 border-b border-zinc-800 bg-[#0d1017] px-3 py-1.5">
                <div className="flex items-center gap-1.5 rounded bg-zinc-800/50 px-2 py-1">
                  <SmartphoneIcon className="size-3 text-zinc-600 cursor-pointer hover:text-zinc-400" />
                  <TabletIcon className="size-3 text-zinc-600 cursor-pointer hover:text-zinc-400" />
                  <MonitorIcon className="size-3 text-zinc-400" />
                </div>
                <div className="flex-1 rounded bg-zinc-800/50 px-3 py-1 text-[11px] text-zinc-500 font-mono">
                  {sandbox.previewUrl || "Waiting for preview..."}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const iframe = document.querySelector<HTMLIFrameElement>("#preview-iframe");
                    if (iframe && sandbox.previewUrl) iframe.src = sandbox.previewUrl;
                  }}
                  className="text-zinc-600 hover:text-zinc-400"
                >
                  <RefreshCwIcon className="size-3.5" />
                </button>
              </div>

              {/* Preview iframe */}
              <div className="flex-1 bg-white">
                {sandbox.previewUrl ? (
                  <iframe
                    id="preview-iframe"
                    src={sandbox.previewUrl}
                    className="h-full w-full border-0"
                    allow="clipboard-read; clipboard-write"
                    title="App Preview"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[#0e1117]">
                    <div className="text-center">
                      <GlobeIcon className="mx-auto mb-3 size-10 text-zinc-800" />
                      <p className="text-sm text-zinc-600">Run setup to see the live preview</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Code view ─────────────────────────────────────────────── */}
          {activeView === "code" && (
            <div className="flex flex-1 flex-col">
              {/* File tab */}
              {selectedFile && (
                <div className="flex items-center border-b border-zinc-800 bg-[#0d1017]">
                  <div className="flex items-center gap-1.5 border-b-2 border-indigo-500 bg-[#0e1117] px-3 py-2">
                    <FileIcon className={`size-3 ${getFileIconColor(selectedFileName)}`} />
                    <span className="text-[11px] text-zinc-300">{selectedFileName}</span>
                  </div>
                  <div className="flex-1 px-2 text-[10px] text-zinc-700 font-mono truncate">
                    {selectedFile}
                  </div>
                </div>
              )}

              {/* Code content */}
              <div className="flex-1 overflow-auto bg-[#0e1117] p-4">
                {fileLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2Icon className="size-5 animate-spin text-zinc-600" />
                  </div>
                ) : fileContent ? (
                  <pre className="font-mono text-[12px] leading-relaxed text-zinc-300">
                    {fileContent.split("\n").map((line, i) => (
                      <div key={i} className="flex hover:bg-white/[0.02]">
                        <span className="mr-4 inline-block w-8 flex-shrink-0 select-none text-right text-zinc-700">
                          {i + 1}
                        </span>
                        <span className="whitespace-pre-wrap break-all">{line || " "}</span>
                      </div>
                    ))}
                  </pre>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <CodeIcon className="mx-auto mb-3 size-10 text-zinc-800" />
                      <p className="text-sm text-zinc-600">Select a file from the explorer</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Editor view (code-server iframe) ────────────────────── */}
          {activeView === "editor" && (
            <div className="flex flex-1 flex-col">
              {sandbox.codeServerUrl ? (
                <iframe
                  src={sandbox.codeServerUrl}
                  className="h-full w-full border-0"
                  allow="clipboard-read; clipboard-write"
                  title="Code Editor"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-[#0e1117]">
                  <div className="text-center">
                    <CodeIcon className="mx-auto mb-3 size-10 text-zinc-800" />
                    <p className="text-sm text-zinc-600">Run setup to open VS Code</p>
                    <p className="mt-1 text-[11px] text-zinc-700">code-server on port 8329</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Terminal view ─────────────────────────────────────────── */}
          {activeView === "terminal" && (
            <div className="flex flex-1 flex-col">
              {/* Terminal header */}
              <div className="flex items-center gap-2 border-b border-zinc-800 bg-[#0d1017] px-3 py-1.5">
                <TerminalIcon className="size-3.5 text-green-400" />
                <span className="text-[11px] font-medium text-zinc-500">bash</span>
                <span className="text-[10px] text-zinc-700">sandbox</span>
              </div>

              {/* Terminal output */}
              <div
                ref={terminalRef}
                className="flex-1 overflow-y-auto bg-[#0a0d12] p-3 font-mono text-[12px] leading-relaxed"
              >
                {terminalLines.map((line, i) => (
                  <div
                    key={i}
                    className={line.startsWith("$") ? "text-green-400/80" : "text-zinc-400"}
                  >
                    {line}
                  </div>
                ))}
                {terminalLines.length === 0 && (
                  <div className="text-zinc-700">
                    <span className="text-green-400/60">user@sandbox</span>
                    <span className="text-zinc-700">:</span>
                    <span className="text-blue-400/60">~/my-app</span>
                    <span className="text-zinc-700">$ </span>
                    <span className="animate-pulse">▊</span>
                  </div>
                )}
              </div>

              {/* Command input */}
              <div className="flex items-center gap-2 border-t border-zinc-800 bg-[#0d1017] px-3 py-2">
                <span className="text-[11px] text-green-400/60">$</span>
                <input
                  value={terminalCmd}
                  onChange={(e) => setTerminalCmd(e.target.value)}
                  onKeyDown={handleTerminalKeyDown}
                  className="flex-1 bg-transparent text-[12px] font-mono text-zinc-300 outline-none placeholder:text-zinc-700"
                  placeholder="Type a command..."
                  disabled={!sandbox.sandboxId}
                />
                <button
                  type="button"
                  onClick={() => runCommand()}
                  disabled={!sandbox.sandboxId || !terminalCmd.trim()}
                  className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-700 disabled:opacity-30"
                >
                  Run
                </button>
              </div>
            </div>
          )}

          {/* ── Desktop/Browser view (Neko WebRTC) ────────────────────── */}
          {activeView === "browser" && (
            <div className="flex flex-1 flex-col">
              {sandbox.nekoUrl ? (
                <iframe
                  src={sandbox.nekoUrl}
                  className="h-full w-full border-0"
                  allow="autoplay; fullscreen; clipboard-read; clipboard-write"
                  title="Desktop"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-[#0e1117]">
                  <div className="text-center">
                    <MonitorIcon className="mx-auto mb-3 size-10 text-zinc-800" />
                    <p className="text-sm text-zinc-600">Run setup to connect to the desktop</p>
                    <p className="mt-1 text-[11px] text-zinc-700">Neko WebRTC on port 8080</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
