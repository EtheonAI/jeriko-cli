/**
 * Seed script — inserts a test chat session with all 33 tools rendered.
 *
 * Run with: npx tsx apps/app/app/\(authenticated\)/chat/\[id\]/fixtures/seed-test-chat.ts
 *
 * Prerequisites: DATABASE_URL must be set (or packages/database/.env loaded).
 */

// @ts-ignore — dotenv is a devDep used only when running this script standalone
import { config } from "dotenv";
import { resolve } from "path";

// Load DATABASE_URL from packages/database/.env
config({ path: resolve(__dirname, "../../../../../../packages/database/.env") });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

// Test session + message IDs
const SESSION_ID = "test-tool-showcase-001";
const USER_MSG_ID = "test-msg-user-001";
const ASST_MSG_ID = "test-msg-asst-001";

// Helper
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

// Build the parts array — all 33 tools
const assistantParts = [
  { type: "reasoning", text: "The user wants a full demo. Let me plan and execute step by step." },

  // show_plan
  toolPart("show_plan", "tc-plan", "output-available",
    { title: "Build React 19 Demo", todos: [
      { id: "s1", label: "Research React 19", status: "completed" },
      { id: "s2", label: "Set up project", status: "completed" },
      { id: "s3", label: "Build todo app", status: "in_progress" },
      { id: "s4", label: "Style with Tailwind", status: "pending" },
      { id: "s5", label: "Deploy", status: "pending" },
    ]},
    { title: "Build React 19 Demo", todos: [
      { id: "s1", label: "Research React 19", status: "completed" },
      { id: "s2", label: "Set up project", status: "completed" },
      { id: "s3", label: "Build todo app", status: "in_progress" },
      { id: "s4", label: "Style with Tailwind", status: "pending" },
      { id: "s5", label: "Deploy", status: "pending" },
    ]},
  ),

  { type: "text", text: "Let me research React 19 and build the app.\n\n" },

  toolPart("web_search", "tc-ws", "output-available",
    { query: "React 19 features" },
    { results: [{ title: "React 19 Release", url: "https://react.dev/blog/react-19", snippet: "New features..." }], query: "React 19 features" }),

  toolPart("shell_exec", "tc-se", "output-available",
    { command: "npm create vite@latest app -- --template react-ts" },
    { output: "Project created", exit_code: 0 }),

  toolPart("shell_view", "tc-sv", "output-available", { session_id: "s0" }, { output: "added 142 packages" }),
  toolPart("shell_wait", "tc-sw", "output-available", { session_id: "s0", timeout: 5 }, { output: "Server running", status: "completed" }),
  toolPart("shell_write_to_process", "tc-swp", "output-available", { session_id: "s0", input: "y\\n" }, { success: true }),
  toolPart("shell_kill_process", "tc-sk", "output-available", { session_id: "s0" }, { success: true }),

  toolPart("file_write", "tc-fw", "output-available",
    { path: "/app/src/App.tsx", content: "function App() { return <h1>Hello</h1>; }" },
    { success: true, bytes_written: 42 }),
  toolPart("file_read", "tc-fr", "output-available",
    { path: "/app/package.json" },
    { content: '{"name":"app","version":"0.1.0"}', path: "/app/package.json" }),
  toolPart("file_str_replace", "tc-fsr", "output-available",
    { path: "/app/src/App.tsx", old_str: "Hello", new_str: "Todo App" },
    { success: true, replacements: 1 }),
  toolPart("file_find_in_content", "tc-ffic", "output-available",
    { pattern: "useState", path: "/app/src" },
    { matches: [{ file: "/app/src/App.tsx", line: 1, content: "import { useState } from 'react';" }] }),
  toolPart("file_find_by_name", "tc-ffbn", "output-available",
    { pattern: "*.tsx", path: "/app/src" },
    { files: ["/app/src/App.tsx", "/app/src/main.tsx"] }),

  toolPart("code_execute", "tc-ce", "output-available",
    { language: "python", code: "print('hello')" },
    { output: "hello", exit_code: 0 }),

  toolPart("browser_navigate", "tc-bn", "output-available",
    { url: "http://localhost:5173" },
    { url: "http://localhost:5173", title: "Todo App" }),
  toolPart("browser_view", "tc-bv", "output-available", {}, { url: "http://localhost:5173", title: "Todo App", content: "<h1>Todo App</h1>" }),
  toolPart("browser_click", "tc-bc", "output-available", { coordinate: [200, 350] }, { success: true }),
  toolPart("browser_input", "tc-bi", "output-available", { coordinate: [200, 300], text: "Buy groceries" }, { success: true }),
  toolPart("browser_scroll_up", "tc-bsu", "output-available", { coordinate: [640, 400], amount: 3 }, { success: true }),
  toolPart("browser_scroll_down", "tc-bsd", "output-available", { coordinate: [640, 400], amount: 3 }, { success: true }),
  toolPart("browser_move_mouse", "tc-bmm", "output-available", { coordinate: [200, 350] }, { success: true }),
  toolPart("browser_press_key", "tc-bpk", "output-available", { key: "Enter" }, { success: true }),
  toolPart("browser_select_option", "tc-bso", "output-available", { coordinate: [300, 200], option: "dark" }, { success: true }),
  toolPart("browser_console_exec", "tc-bce", "output-available", { javascript: "document.title" }, { output: "Todo App" }),
  toolPart("browser_console_view", "tc-bcv", "output-available", {}, { logs: ["App mounted"] }),
  toolPart("browser_screenshot", "tc-bs", "output-available", {}, { screenshot: "data:image/png;base64,iVBORw0KGgo=" }),
  toolPart("browser_restart", "tc-br", "output-available", {}, { success: true }),

  toolPart("generate_image", "tc-gi", "output-available",
    { prompt: "Todo app UI mockup" },
    { url: "data:image/png;base64,iVBORw0KGgo=" }),

  toolPart("deploy_expose_port", "tc-dep", "output-available",
    { port: 5173 },
    { url: "https://app.e2b.dev", port: 5173 }),
  toolPart("deploy_apply_deployment", "tc-dad", "output-available",
    { type: "static", path: "/app/dist" },
    { url: "https://todo.rubic.app", status: "deployed" }),

  toolPart("message_notify_user", "tc-mnu", "output-available",
    { text: "App deployed!" },
    { delivered: true }),
  toolPart("message_ask_user", "tc-mau", "output-available",
    { text: "Add auth?", options: ["Yes", "No"] },
    { response: "Yes" }),

  toolPart("schedule_recurring_task", "tc-srt", "output-available",
    { name: "Daily check", cron: "0 9 * * *" },
    { scheduled: true }),
  toolPart("check_outcomes", "tc-co", "output-available",
    { task_id: "tc-dad" },
    { summary: "All healthy", status: "healthy" }),

  // Error state
  toolPart("shell_exec", "tc-err", "output-error",
    { command: "npm run bad" },
    undefined,
    "Missing script"),

  { type: "source-url", sourceId: "s1", url: "https://react.dev/blog/react-19", title: "React 19 Release" },
  { type: "text", text: "\n\nAll 33 tools rendered! Your app is live at https://todo.rubic.app" },
];

async function seed() {
  // First, find a valid user ID to assign the session to
  const users = await sql`SELECT id FROM users LIMIT 1`;
  if (users.length === 0) {
    console.error("No users found in DB. Please create a user first.");
    process.exit(1);
  }
  const userId = users[0]!.id as string;
  console.log(`Using user: ${userId}`);

  // Delete existing test data
  await sql`DELETE FROM messages WHERE session_id = ${SESSION_ID}`;
  await sql`DELETE FROM agent_sessions WHERE id = ${SESSION_ID}`;

  // Create session
  await sql`
    INSERT INTO agent_sessions (id, user_id, title, status, created_at, updated_at)
    VALUES (${SESSION_ID}, ${userId}, 'Tool Showcase — All 33 Tools', 'active', NOW(), NOW())
  `;
  console.log(`Created session: ${SESSION_ID}`);

  // Insert user message
  await sql`
    INSERT INTO messages (id, session_id, role, content, parts, created_at)
    VALUES (
      ${USER_MSG_ID},
      ${SESSION_ID},
      'user',
      'Search for React 19 features, build a demo app, deploy it.',
      ${JSON.stringify([{ type: "text", text: "Search for React 19 features, build a demo app, deploy it." }])}::jsonb,
      NOW()
    )
  `;
  console.log("Inserted user message");

  // Insert assistant message with all tool parts
  const fullText = assistantParts
    .filter((p: any) => p.type === "text")
    .map((p: any) => p.text)
    .join("");

  await sql`
    INSERT INTO messages (id, session_id, role, content, parts, metadata, created_at)
    VALUES (
      ${ASST_MSG_ID},
      ${SESSION_ID},
      'assistant',
      ${fullText},
      ${JSON.stringify(assistantParts)}::jsonb,
      ${{ model: "agent" }}::jsonb,
      NOW()
    )
  `;
  console.log("Inserted assistant message with all 33 tools");

  console.log(`\nDone! Navigate to /chat/${SESSION_ID} to see all tools rendered.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
