/**
 * WebDev Routes — Manages webdev projects inside E2B sandboxes.
 *
 * Follows the Manus pattern (from webDev docs):
 *   - init_project: Scaffold from template (web-static, web-db-user)
 *   - status: Dev server + build health checks
 *   - checkpoint: Git commit + screenshot (webdev_save_checkpoint)
 *   - rollback: Revert to previous checkpoint
 *   - restore: Restore project from checkpoint
 *   - config: Update project configuration
 *   - database: SQL execution proxied to TiDB (push/pull/query)
 *   - restart: Restart dev server
 *   - versions: List git log checkpoints
 *
 * TiDB Integration (from tidb_integration_audit.txt):
 *   - Sandbox NEVER gets raw DB credentials
 *   - All DB access proxied through /api/webdev/database
 *   - Operations: push (drizzle-kit push), pull (drizzle-kit pull), query (raw SQL)
 *   - Connection string from TIDB_DATABASE_URL env var
 *
 * Routes:
 *   POST /api/webdev/init       — Initialize project from template
 *   POST /api/webdev/status     — Get project health
 *   POST /api/webdev/checkpoint — Save checkpoint (git commit + screenshot)
 *   POST /api/webdev/rollback   — Rollback to version
 *   POST /api/webdev/restore    — Restore project from checkpoint
 *   POST /api/webdev/config     — Update project config
 *   POST /api/webdev/database   — Execute DB operation (push/pull/query)
 *   POST /api/webdev/restart    — Restart dev server
 *   POST /api/webdev/versions   — List checkpoints
 */

import type { FastifyInstance } from "fastify";
import { createLogger } from "@repo/service-utils";
import { getSessionIdBySandboxId, setSandboxDatabaseName, setSandboxProjectPath, getProjectPathBySandboxId, registerDatabaseCleanup, getTerminalServerUrlBySandboxId, getE2bSandboxIdBySandboxId } from "../lib/e2b-manager.js";
import { getRsaHeaders } from "../lib/rsa-auth.js";

const logger = createLogger({ service: "webdev" });

// TiDB connection — proxied through this endpoint (sandbox never gets raw creds)
const TIDB_DATABASE_URL = process.env.TIDB_DATABASE_URL || "";
const TIDB_HOST = process.env.TIDB_HOST || "";
const TIDB_PORT = parseInt(process.env.TIDB_PORT || "4000", 10);
const TIDB_USERNAME = process.env.TIDB_USERNAME || "";
const TIDB_PASSWORD = process.env.TIDB_PASSWORD || "";
const TIDB_DATABASE = process.env.TIDB_DATABASE || "";

/** Build mysql2 connection config with SSL for TiDB Cloud */
function getTiDBConnectionConfig(): { host: string; port: number; user: string; password: string; database: string; ssl: { rejectUnauthorized: boolean } } | null {
  if (TIDB_HOST) {
    return {
      host: TIDB_HOST,
      port: TIDB_PORT,
      user: TIDB_USERNAME,
      password: TIDB_PASSWORD,
      database: TIDB_DATABASE,
      ssl: { rejectUnauthorized: true },
    };
  }
  return null;
}

/** Create an isolated database for a project. Returns database name. */
async function createProjectDatabase(appName: string, userId: string): Promise<string> {
  const safeProject = appName.replace(/[^a-z0-9_]/gi, "_").slice(0, 30);
  const userPrefix = userId.replace(/[^a-z0-9]/gi, "").slice(0, 8);
  const dbName = `rubic_${userPrefix}_${safeProject}`;

  const { default: mysql } = await import("mysql2/promise");
  // Connect WITHOUT database param so CREATE DATABASE works
  const conn = TIDB_HOST
    ? await mysql.createConnection({
        host: TIDB_HOST,
        port: TIDB_PORT,
        user: TIDB_USERNAME,
        password: TIDB_PASSWORD,
        ssl: { rejectUnauthorized: true },
      })
    : await mysql.createConnection(TIDB_DATABASE_URL.replace(/\/[^/?]+(\?|$)/, "/$1"));

  await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await conn.end();
  logger.info({ dbName, appName, userId }, "Created project database");
  return dbName;
}

/** Drop a project database. Safety: only rubic_ prefix allowed. */
async function dropProjectDatabase(dbName: string): Promise<void> {
  if (!dbName.startsWith("rubic_")) return; // Safety guard
  const { default: mysql } = await import("mysql2/promise");
  const conn = TIDB_HOST
    ? await mysql.createConnection({
        host: TIDB_HOST,
        port: TIDB_PORT,
        user: TIDB_USERNAME,
        password: TIDB_PASSWORD,
        ssl: { rejectUnauthorized: true },
      })
    : await mysql.createConnection(TIDB_DATABASE_URL.replace(/\/[^/?]+(\?|$)/, "/$1"));
  await conn.execute(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await conn.end();
  logger.info({ dbName }, "Dropped project database");
}

// Register cleanup so e2b-manager can drop project DBs on sandbox destroy
registerDatabaseCleanup(dropProjectDatabase);

// ─── Terminal server helpers ─────────────────────────────────────────────
// Call the terminal server DIRECTLY at port 8330 (via E2B proxy URL).
// This is the same pattern as sandbox-executor.ts — avoids the sandbox
// service which uses incompatible API endpoints (POST /terminals vs
// POST /terminal/create) causing 502 errors.

/** POST JSON to terminal server with RSA signing */
async function tsPost(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 30000
): Promise<Record<string, unknown>> {
  const jsonBody = JSON.stringify(body);
  const rsaHeaders = getRsaHeaders(jsonBody);
  const resp = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...rsaHeaders },
    body: jsonBody,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new Error(`Terminal server error (${resp.status}): ${text}`);
  }
  return (await resp.json()) as Record<string, unknown>;
}

/** GET JSON from terminal server with RSA signing */
async function tsGet(baseUrl: string, path: string, timeoutMs = 15000): Promise<Record<string, unknown>> {
  const rsaHeaders = getRsaHeaders("");
  const resp = await fetch(`${baseUrl}${path}`, {
    headers: { ...rsaHeaders },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new Error(`Terminal server error (${resp.status}): ${text}`);
  }
  return (await resp.json()) as Record<string, unknown>;
}

/** Track which terminals have been created per base URL */
const createdTerminals = new Set<string>();

/** Ensure a terminal session exists for a given terminal ID */
async function ensureTerminal(baseUrl: string, terminalId: string): Promise<void> {
  const key = `${baseUrl}:${terminalId}`;
  if (createdTerminals.has(key)) return;
  try {
    await tsPost(baseUrl, "/terminal/create", { id: terminalId }, 10000);
  } catch {
    // Terminal may already exist — not fatal
  }
  createdTerminals.add(key);
}

/** Ensure a terminal session exists for the "webdev" ID */
async function ensureWebdevTerminal(baseUrl: string): Promise<void> {
  await ensureTerminal(baseUrl, "webdev");
}

/**
 * Start the dev server in a DEDICATED terminal session ("devserver").
 *
 * Instead of backgrounding with nohup (which is unreliable in PTY terminals),
 * the dev server runs as the foreground process in its own terminal session.
 * This is the Manus pattern — each long-running process gets its own terminal.
 *
 * Returns true if the dev server responds on localhost:3000 within the timeout.
 */
async function startDevServer(
  sandboxId: string,
  projectDir: string,
  pm: string,
  maxWaitMs = 30000
): Promise<{ started: boolean; log: string }> {
  const baseUrl = resolveTerminalUrl(sandboxId);

  // Kill any existing dev server first
  try {
    await ensureWebdevTerminal(baseUrl);
    await tsPost(baseUrl, "/terminal/webdev/write", { text: `pkill -f "vite|tsx|node.*dev" 2>/dev/null; true\n` }, 5000);
    await new Promise((r) => setTimeout(r, 1000));
  } catch { /* best effort */ }

  // Kill the old devserver terminal if it exists (to get a clean PTY)
  const devTermKey = `${baseUrl}:devserver`;
  if (createdTerminals.has(devTermKey)) {
    try {
      await tsPost(baseUrl, "/terminal/devserver/kill", {}, 5000);
    } catch { /* may not exist */ }
    createdTerminals.delete(devTermKey);
  }

  // Create a fresh "devserver" terminal
  await ensureTerminal(baseUrl, "devserver");

  // Write the dev server command as a foreground process.
  // Also tee to /tmp/devserver.log for the status endpoint.
  const cmd = `cd ${projectDir} && ${pm} run dev 2>&1 | tee /tmp/devserver.log\n`;
  await tsPost(baseUrl, "/terminal/devserver/write", { text: cmd }, 10000);

  // Poll for server readiness on localhost:3000
  const pollStart = Date.now();
  await new Promise((r) => setTimeout(r, 3000)); // Give it a head start

  while (Date.now() - pollStart < maxWaitMs) {
    try {
      // Use the webdev terminal to curl (not devserver, which is busy running the server)
      await ensureWebdevTerminal(baseUrl);
      const marker = `__HEALTH_${Date.now()}__`;
      await tsPost(baseUrl, "/terminal/webdev/write", {
        text: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null && echo "${marker}_OK" || echo "${marker}_FAIL"\n`
      }, 5000);
      await new Promise((r) => setTimeout(r, 2000));
      const view = await tsGet(baseUrl, "/terminal/webdev/view");
      const output = (view.output ?? view.content ?? "") as string;
      if (output.includes(`${marker}_OK`) && output.includes("200")) {
        return { started: true, log: "Dev server running on port 3000" };
      }
    } catch { /* curl failed, server not ready yet */ }
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Server didn't respond in time — check devserver terminal for errors
  let log = "";
  try {
    const view = await tsGet(baseUrl, "/terminal/devserver/view");
    log = ((view.output ?? view.content ?? "") as string).slice(-1000);
  } catch { /* terminal view failed */ }

  return { started: false, log };
}

/**
 * Resolve the terminal server URL for a sandbox.
 * Tries e2b-manager cache first, falls back to request body.
 */
function resolveTerminalUrl(sandboxId: string, bodyTerminalUrl?: string): string {
  const cached = getTerminalServerUrlBySandboxId(sandboxId);
  if (cached) return cached;
  if (bodyTerminalUrl) return bodyTerminalUrl;
  throw new Error(`No terminal server URL available for sandbox ${sandboxId}`);
}

/**
 * Execute a shell command in a sandbox via the terminal server directly.
 */
async function sandboxExec(
  sandboxId: string,
  command: string,
  _userId: string,
  timeout = 30000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const baseUrl = resolveTerminalUrl(sandboxId);

  await ensureWebdevTerminal(baseUrl);

  // Snapshot current output before writing
  const preView = await tsGet(baseUrl, "/terminal/webdev/view");
  const preLen = ((preView.output ?? preView.content ?? "") as string).length;

  // Append a unique marker so we know when the command is truly done.
  // The terminal echoes the command text (containing marker once) and then
  // the real "echo" output prints marker a second time. Wait for 2 occurrences.
  const marker = `__DONE_${Date.now()}__`;
  const wrappedCmd = `${command}; echo "${marker}"`;
  await tsPost(baseUrl, "/terminal/webdev/write", { text: wrappedCmd + "\n" }, timeout);

  // Poll until marker appears at least 2 times (once in command echo, once in output).
  // Fallback: if only 1 occurrence but terminal shows a shell prompt after it, also done
  // (the command echo may have scrolled off the buffer for long-running commands).
  const pollStart = Date.now();
  await new Promise((r) => setTimeout(r, 2000));
  let finalOutput = "";
  while (Date.now() - pollStart < timeout) {
    const result = await tsGet(baseUrl, "/terminal/webdev/view");
    const cur = (result.output ?? result.content ?? "") as string;
    finalOutput = cur;
    const newPortion = cur.length > preLen ? cur.slice(preLen) : cur;
    const markerCount = newPortion.split(marker).length - 1;
    if (markerCount >= 2) break;
    // Fallback: marker echo scrolled off buffer, but output line + prompt visible
    if (markerCount === 1 && /\$\s*$/.test(newPortion.trimEnd())) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Return only new portion of output
  const newOutput = finalOutput.length > preLen ? finalOutput.slice(preLen) : finalOutput.slice(-2000);

  return {
    stdout: newOutput,
    stderr: "",
    exitCode: 0,
  };
}

/**
 * Write a file to a sandbox via the terminal server's text_editor endpoint.
 */
async function sandboxWriteFile(
  sandboxId: string,
  path: string,
  content: string,
  _userId: string
): Promise<void> {
  const baseUrl = resolveTerminalUrl(sandboxId);
  await tsPost(baseUrl, "/text_editor", {
    command: "create",
    path,
    file_text: content,
  }, 15000);
}

/**
 * Read a file from a sandbox via the terminal server's text_editor endpoint.
 */
async function sandboxReadFile(
  sandboxId: string,
  path: string,
  _userId: string
): Promise<string> {
  const baseUrl = resolveTerminalUrl(sandboxId);
  const result = await tsPost(baseUrl, "/text_editor", {
    command: "view",
    path,
  }, 15000);
  return (result.content ?? result.output ?? "") as string;
}

/**
 * Execute a command and get CLEAN stdout (no ANSI, no terminal echo).
 *
 * Writes command output to a temp file, reads it back via text_editor.
 * Use for commands where you need to PARSE the output (git hash, git log, curl status, etc.).
 * For fire-and-forget commands (install, kill, mkdir), use sandboxExec() instead.
 */
async function sandboxExecClean(
  sandboxId: string,
  command: string,
  _userId: string,
  timeout = 30000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const baseUrl = resolveTerminalUrl(sandboxId);
  const tmpFile = `/tmp/rubic_exec_${Date.now()}`;

  // Run command, capture stdout+stderr to temp file, capture exit code
  await sandboxExec(
    sandboxId,
    `(${command}) > ${tmpFile} 2>&1; echo $? > ${tmpFile}.exit`,
    _userId,
    timeout
  );

  // Read stdout from temp file (clean, no ANSI noise)
  let stdout = "";
  try {
    const result = await tsPost(baseUrl, "/text_editor", { command: "view", path: tmpFile }, 5000);
    stdout = String(result.content || "");
    // text_editor returns numbered lines like "     1\tcontents" — strip line numbers
    stdout = stdout.replace(/^\s*\d+\t/gm, "");
  } catch { /* file read failed */ }

  // Read exit code
  let exitCode = 0;
  try {
    const exitResult = await tsPost(baseUrl, "/text_editor", { command: "view", path: `${tmpFile}.exit` }, 5000);
    const exitStr = String(exitResult.content || "").replace(/^\s*\d+\t/gm, "").trim();
    exitCode = parseInt(exitStr) || 0;
  } catch { /* default to 0 */ }

  return { stdout: stdout.trim(), stderr: "", exitCode };
}

// ─── Drizzle template files (from Manus tidb_template_files.txt) ────────

const DRIZZLE_CONFIG_TS = `import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// Parse URL — mysql2 URL parser can't handle ssl as a boolean,
// so we extract fields and pass ssl as an object.
const url = new URL(connectionString);

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: url.hostname,
    port: Number(url.port) || 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: {},
  },
});
`;

const DRIZZLE_SCHEMA_TS = `import { mysqlTable, varchar, int, timestamp, text, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  openId: varchar("open_id", { length: 255 }).unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  role: varchar("role", { length: 50 }).default("user"),
  loginMethod: varchar("login_method", { length: 50 }),
  lastSignedIn: timestamp("last_signed_in").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const todos = mysqlTable("todos", {
  id: int("id").primaryKey().autoincrement(),
  text: varchar("text", { length: 500 }).notNull(),
  done: boolean("done").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Todo = typeof todos.$inferSelect;
export type InsertTodo = typeof todos.$inferInsert;
`;

const SERVER_DB_TS = `import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
// Parses DATABASE_URL and adds SSL config for TiDB Cloud.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      const connection = await mysql.createConnection({
        host: url.hostname,
        port: Number(url.port) || 4000,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: {},
      });
      _db = drizzle(connection);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
`;

export async function webdevRoutes(app: FastifyInstance) {
  /**
   * POST /api/webdev/init — Initialize a webdev project from template.
   *
   * Manus equivalent: webdev_init_project
   * Templates: web-static (Vite + React + TS), web-db-user (full-stack with Drizzle + TiDB)
   *
   * Body: { sandboxId, userId, template_id?, app_name?, directory? }
   */
  app.post("/api/webdev/init", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      template_id?: string;
      app_name?: string;
      directory?: string;
    };

    const { sandboxId, userId } = body;
    const appName = body.app_name || "my-app";
    const templateId = body.template_id || "web-static";
    const projectDir = body.directory || `/home/ubuntu/${appName}`;

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    logger.info({ sandboxId, templateId, appName, projectDir }, "Initializing webdev project");

    try {
      // ── Step 1: Scaffold project from template ──────────────────────────
      // Manus pattern: pre-built templates live at /opt/.rubic/webdev/templates/
      // and are simply COPIED to the project directory.
      // Fallback: if templates aren't baked in (template not rebuilt yet), use create-vite.
      const templatePath = `/opt/.rubic/webdev/templates/web-dev-templates/templates/${templateId}`;
      // First command on a fresh sandbox needs extra time (E2B gRPC connection setup)
      const templateCheck = await sandboxExec(
        sandboxId,
        `test -d ${templatePath} && echo "exists" || echo "missing"`,
        userId,
        30000
      );

      if (templateCheck.stdout.includes("exists")) {
        // Manus way: copy pre-built template
        await sandboxExec(sandboxId, `cp -r ${templatePath} ${projectDir}`, userId, 10000);
        // Fix ownership (template was built as root) + remove node_modules/lockfile
        // to avoid pnpm store path mismatch. Also fix corepack cache perms.
        await sandboxExec(
          sandboxId,
          `sudo chown -R ubuntu:ubuntu ${projectDir} /home/ubuntu/.cache 2>/dev/null; rm -rf ${projectDir}/node_modules ${projectDir}/pnpm-lock.yaml 2>/dev/null; true`,
          userId,
          10000
        );
        logger.info({ sandboxId, templateId }, "Copied pre-built template");
      } else {
        // Fallback: scaffold with create-vite (CI=true for non-TTY E2B shells)
        const parentDir = projectDir.substring(0, projectDir.lastIndexOf("/")) || "/home/user";
        await sandboxExec(
          sandboxId,
          `cd ${parentDir} && CI=true pnpm create vite ${appName} --template react-ts`,
          userId,
          60000
        );
        logger.info({ sandboxId, templateId }, "Scaffolded with create-vite (fallback)");
      }

      // ── Step 2: Full-stack extras for web-db-user ───────────────────────
      if (templateId === "web-db-user") {
        // Create dirs first, then write Drizzle config files
        await sandboxExec(sandboxId, `mkdir -p ${projectDir}/drizzle ${projectDir}/server`, userId);

        // Add Drizzle + mysql2 + backend deps
        // Always install — even pre-built templates may not have mysql2 in package.json
        const depsCheck = await sandboxExec(
          sandboxId,
          `cd ${projectDir} && node -e "require('mysql2')" 2>/dev/null && echo "has_mysql2" || echo "missing"`,
          userId,
          10000
        );
        if (!depsCheck.stdout.includes("has_mysql2")) {
          // Use pnpm (fast, available in E2B template) with --no-frozen-lockfile
          await sandboxExec(
            sandboxId,
            `cd ${projectDir} && pnpm add drizzle-orm mysql2 express zod && pnpm add -D drizzle-kit @types/express tsx`,
            userId,
            120000
          );
        }

        // Write Drizzle config files (from Manus tidb_template_files.txt)
        await sandboxWriteFile(sandboxId, `${projectDir}/drizzle.config.ts`, DRIZZLE_CONFIG_TS, userId);
        await sandboxWriteFile(sandboxId, `${projectDir}/drizzle/schema.ts`, DRIZZLE_SCHEMA_TS, userId);
        await sandboxWriteFile(sandboxId, `${projectDir}/server/db.ts`, SERVER_DB_TS, userId);
      }

      // ── Step 3: Inject environment variables ────────────────────────────
      // Manus pattern: DATABASE_URL and secrets injected to project .env
      const envLines: string[] = [];
      let dbName: string | undefined;

      if (templateId === "web-db-user" && (TIDB_HOST || TIDB_DATABASE_URL)) {
        // Per-project database isolation (Manus pattern)
        dbName = await createProjectDatabase(appName, userId);

        // Track database name in sandbox cache for cleanup
        const sessionId = getSessionIdBySandboxId(sandboxId);
        if (sessionId) {
          setSandboxDatabaseName(sessionId, dbName);
        }

        const tidbUrl = TIDB_HOST
          ? `mysql://${TIDB_USERNAME}:${TIDB_PASSWORD}@${TIDB_HOST}:${TIDB_PORT}/${dbName}`
          : TIDB_DATABASE_URL; // Fallback if only URL provided
        envLines.push(`DATABASE_URL="${tidbUrl}"`);
      } else if (TIDB_HOST || TIDB_DATABASE_URL) {
        // web-static or no template — shared DB (backward compat)
        const tidbUrl = TIDB_HOST
          ? `mysql://${TIDB_USERNAME}:${TIDB_PASSWORD}@${TIDB_HOST}:${TIDB_PORT}/${TIDB_DATABASE}`
          : TIDB_DATABASE_URL;
        if (tidbUrl) envLines.push(`DATABASE_URL="${tidbUrl}"`);
      }

      envLines.push(`NODE_ENV=development`);
      envLines.push(`PORT=3000`);
      if (envLines.length > 0) {
        await sandboxWriteFile(sandboxId, `${projectDir}/.env`, envLines.join("\n") + "\n", userId);
      }

      // ── Step 3b: Write clean vite.config.ts ──────────────────────────────
      // The Manus templates ship with proprietary plugins (vite-plugin-manus-runtime,
      // @builder.io/vite-plugin-jsx-loc) that may not be installable from npm,
      // and have allowedHosts restricted to Manus domains. We write a clean config
      // with React + Tailwind + path aliases + allowedHosts: true for E2B URLs.
      const isFullStack = templateId === "web-db-user";
      const cleanViteConfig = `import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),${isFullStack ? `\n  publicDir: path.resolve(import.meta.dirname, "client", "public"),` : ""}
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 3000,
    allowedHosts: true,
  },
});
`;
      await sandboxWriteFile(sandboxId, `${projectDir}/vite.config.ts`, cleanViteConfig, userId);

      // ── Step 3c: Strip Manus-specific devDependencies from package.json ─
      // Remove proprietary Manus plugins that may not be on npm and aren't
      // needed for Rubic projects. This prevents pnpm install from failing.
      await sandboxExec(
        sandboxId,
        `cd ${projectDir} && node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (pkg.devDependencies) {
  delete pkg.devDependencies['@builder.io/vite-plugin-jsx-loc'];
  delete pkg.devDependencies['vite-plugin-manus-runtime'];
}
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
console.log('stripped Manus devDependencies');
"`,
        userId,
        10000
      );

      // ── Step 4: Install dependencies ────────────────────────────────────
      // Detect package manager via file-based approach (terminal echo is unreliable).
      // Write result to /tmp/pm_check and read back via text_editor endpoint.
      await sandboxExec(sandboxId, `mkdir -p /home/ubuntu/.cache/node/corepack/v1 2>/dev/null; pnpm --version > /tmp/pm_check 2>&1 || echo "FAIL" > /tmp/pm_check`, userId, 30000);
      let pm = "npm"; // default to npm
      try {
        const pmResult = await tsPost(resolveTerminalUrl(sandboxId), "/text_editor", { command: "view", path: "/tmp/pm_check" }, 5000);
        const pmContent = String(pmResult.content || "");
        if (/^\s*\d+\.\d+/.test(pmContent)) {
          pm = "pnpm"; // pnpm --version returned a version number
        }
      } catch { /* file read failed, use npm */ }
      logger.info({ sandboxId, pm }, "Starting package install");

      // Install with retry — verify via file check (not terminal output, which has echo noise)
      let installSuccess = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        await sandboxExec(sandboxId, `cd ${projectDir} && ${pm} install --no-frozen-lockfile 2>&1`, userId, 180000);
        logger.info({ sandboxId, attempt }, "Install attempt done");

        // Verify node_modules via text_editor (bypasses terminal echo issue)
        try {
          const checkResult = await tsPost(resolveTerminalUrl(sandboxId), "/file/list_dir", { path: `${projectDir}/node_modules` }, 5000);
          const entries = (checkResult.entries || []) as unknown[];
          if (entries.length > 0) {
            installSuccess = true;
            logger.info({ sandboxId, attempt, entries: entries.length }, "node_modules verified");
            break;
          }
        } catch {
          // list_dir failed — node_modules doesn't exist
        }
        logger.warn({ sandboxId, attempt }, "Install failed, node_modules missing or empty");

        // On first failure, try fixing permissions and retrying
        if (attempt === 1) {
          await sandboxExec(sandboxId, `chmod -R 755 /home/ubuntu/.cache 2>/dev/null; true`, userId, 5000);
        }
      }

      if (!installSuccess) {
        // Last resort: try npm if pnpm failed
        if (pm === "pnpm") {
          logger.warn({ sandboxId }, "pnpm failed, falling back to npm");
          await sandboxExec(sandboxId, `cd ${projectDir} && npm install 2>&1`, userId, 180000);
        }
      }

      // ── Step 5: Create .rubic-logs directory (Manus: .manus-logs) ──────
      await sandboxExec(
        sandboxId,
        `mkdir -p ${projectDir}/.rubic-logs`,
        userId,
        5000
      );

      // ── Step 6: Initialize git repo ─────────────────────────────────────
      // Manus pattern: git config before first commit
      await sandboxExec(
        sandboxId,
        `cd ${projectDir} && git config --global user.email "agent@rubic.ai" && git config --global user.name "Rubic Agent" && git init && git add -A && git commit -m "Initial scaffold from ${templateId} template"`,
        userId,
        15000
      );

      // Get initial versionId (git commit hash — Manus pattern)
      const initHash = await sandboxExecClean(
        sandboxId,
        `cd ${projectDir} && git rev-parse --short HEAD`,
        userId
      );
      const versionId = initHash.stdout.trim();

      // ── Step 7: Start dev server in dedicated terminal ─────────────────
      const devResult = await startDevServer(sandboxId, projectDir, pm, 30000);
      logger.info({ sandboxId, devServerStarted: devResult.started }, "Dev server start result");

      // ── Step 8: Build Manus-compatible response ────────────────────────
      // List created files
      let createdFiles: string[] = [];
      try {
        const fileList = await sandboxExecClean(
          sandboxId,
          `cd ${projectDir} && git ls-files`,
          userId,
          10000
        );
        createdFiles = fileList.stdout.trim().split("\n").filter(Boolean);
      } catch { /* best effort */ }

      // Build features array (Manus pattern)
      const features: string[] = [];
      if (templateId === "web-db-user") {
        features.push("server", "db", "user");
      }

      // Build dev server URL (public preview via E2B port proxy)
      const e2bId = getE2bSandboxIdBySandboxId(sandboxId);
      const E2B_DOMAIN = process.env.E2B_DOMAIN || "e2b.dev";
      const devServerUrl = e2bId ? `https://3000-${e2bId}.${E2B_DOMAIN}` : undefined;

      logger.info({ sandboxId, appName, templateId, projectDir, versionId }, "Webdev project initialized");

      // Store project path in sandbox cache for other routes to find
      const sessionId = getSessionIdBySandboxId(sandboxId);
      if (sessionId) {
        setSandboxProjectPath(sessionId, projectDir);
      }

      return reply.send({
        success: true,
        app_name: appName,
        template_id: templateId,
        directory: projectDir,
        projectPath: projectDir,
        versionId,
        devServerPort: 3000,
        devServerUrl,
        devServerStatus: devResult.started ? "running" : "starting",
        features,
        createdFiles,
        hasDatabase: templateId === "web-db-user" && !!(TIDB_DATABASE_URL || TIDB_HOST),
        databaseName: dbName,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ sandboxId, error: msg }, "Failed to init webdev project");
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/webdev/status — Get project health status.
   *
   * Manus equivalent: webdev_check_status
   * Returns: devServer, healthChecks (buildErrors, dependencies, lsp, typescript),
   *          projectPath, versionId, features
   */
  app.post("/api/webdev/status", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
    };

    const { sandboxId, userId, projectPath: rawPath } = body;
    const projectPath = rawPath || getProjectPathBySandboxId(sandboxId) || "/home/ubuntu/my-app";

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    // Sanitize strings for JSON safety (strip ANSI codes + control chars + newlines)
    const sanitize = (s: string) => s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/[\x00-\x1f]/g, (ch) => ch === "\n" ? " | " : ch === "\t" ? " " : "");

    try {
      // Check dev server — use sandboxExecClean for parseable output
      const devServer = await sandboxExecClean(
        sandboxId,
        `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "down"`,
        userId,
        5000
      );

      // Check TypeScript errors — only if tsc is actually installed locally
      const tscCheck = await sandboxExecClean(
        sandboxId,
        `cd ${projectPath} && (node_modules/.bin/tsc --noEmit 2>&1 | tail -5 || echo "no tsc")`,
        userId,
        15000
      );

      // Check recent build log (last 50 lines — Manus pattern)
      const buildLog = await sandboxExecClean(
        sandboxId,
        `tail -50 /tmp/devserver.log 2>/dev/null || echo "no log"`,
        userId,
        5000
      );

      // Dependencies health check (Manus: scans node_modules for missing/outdated)
      const depsCheck = await sandboxExecClean(
        sandboxId,
        `cd ${projectPath} && (node_modules/.bin/tsc --version > /dev/null 2>&1 && ls node_modules/.package-lock.json > /dev/null 2>&1 && echo "OK" || echo "missing")`,
        userId,
        10000
      );

      // Get current versionId
      const versionResult = await sandboxExecClean(
        sandboxId,
        `cd ${projectPath} && git rev-parse --short HEAD 2>/dev/null || echo ""`,
        userId,
        5000
      );

      // Detect features from project structure
      const featureCheck = await sandboxExecClean(
        sandboxId,
        `cd ${projectPath} && (test -d server && echo "server") ; (test -f drizzle.config.ts && echo "db") ; (test -d server && grep -l "auth\\|user\\|login" server/*.ts 2>/dev/null && echo "user") ; true`,
        userId,
        5000
      );
      const features = featureCheck.stdout.trim().split("\n").filter((f) => ["server", "db", "user"].includes(f));

      const devServerUp = devServer.stdout.includes("200") || devServer.stdout.includes("304");

      // Build dev server URL
      const e2bId = getE2bSandboxIdBySandboxId(sandboxId);
      const E2B_DOMAIN = process.env.E2B_DOMAIN || "e2b.dev";
      const devServerUrl = e2bId ? `https://3000-${e2bId}.${E2B_DOMAIN}` : undefined;

      return reply.send({
        devServer: {
          status: devServerUp ? "running" : "stopped",
          port: 3000,
          url: devServerUrl,
          recentOutput: buildLog.stdout.split("\n").filter(Boolean).slice(-50),
        },
        healthChecks: {
          buildErrors: buildLog.stdout.includes("ERROR") || buildLog.stderr.includes("ERROR"),
          dependencies: depsCheck.stdout.includes("OK") ? "OK" : "missing",
          typescript: tscCheck.exitCode === 0 ? "no errors" : sanitize(tscCheck.stdout.trim()),
        },
        projectPath,
        versionId: versionResult.stdout.trim() || undefined,
        features,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/webdev/checkpoint — Save a checkpoint (git commit + screenshot).
   *
   * Manus equivalent: POST /webdev/checkpoint
   */
  app.post("/api/webdev/checkpoint", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      message?: string;
    };

    const { sandboxId, userId, projectPath: rawPath } = body;
    const projectPath = rawPath || getProjectPathBySandboxId(sandboxId) || "/home/ubuntu/my-app";
    const message = body.message || "Checkpoint";

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      // Stage all changes
      await sandboxExec(sandboxId, `cd ${projectPath} && git add -A`, userId);

      // Check if there are changes to commit (use clean exec for parseable output)
      const status = await sandboxExecClean(sandboxId, `cd ${projectPath} && git status --porcelain`, userId);
      if (!status.stdout.trim()) {
        // No changes — still return current HEAD as versionId (Manus pattern)
        const currentHash = await sandboxExecClean(sandboxId, `cd ${projectPath} && git rev-parse --short HEAD`, userId);
        return reply.send({
          success: true,
          noChanges: true,
          message: "No changes to checkpoint",
          versionId: currentHash.stdout.trim(),
          commitHash: currentHash.stdout.trim(),
          timestamp: Date.now(),
        });
      }

      // Commit
      const escapedMsg = message.replace(/'/g, "'\\''");
      await sandboxExec(
        sandboxId,
        `cd ${projectPath} && git commit -m '${escapedMsg}'`,
        userId,
        10000
      );

      // Get commit hash (clean exec for parseable output)
      const hashResult = await sandboxExecClean(
        sandboxId,
        `cd ${projectPath} && git rev-parse --short HEAD`,
        userId
      );
      const commitHash = hashResult.stdout.trim();

      // Capture screenshot (best effort — uses Xvfb display)
      let screenshotPath: string | null = null;
      try {
        const filename = `checkpoint-${commitHash}.png`;
        await sandboxExec(
          sandboxId,
          `DISPLAY=:0 scrot /home/ubuntu/screenshots/${filename}`,
          userId,
          5000
        );
        screenshotPath = `/home/ubuntu/screenshots/${filename}`;
      } catch {
        // Screenshot is best-effort
      }

      logger.info({ sandboxId, commitHash, message }, "Checkpoint saved");

      return reply.send({
        success: true,
        versionId: commitHash,
        commitHash,
        message,
        screenshotPath,
        timestamp: Date.now(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ sandboxId, error: msg }, "Failed to save checkpoint");
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/webdev/rollback — Rollback to a previous checkpoint.
   *
   * Manus pattern (NOT git checkout -- .):
   *   1. Delete project directory contents (except .git)
   *   2. Git checkout the target version
   *   3. Reinstall dependencies
   *   4. Restart dev server
   * This ensures clean state with no orphaned files, rebuilt node_modules,
   * and cleared build cache.
   */
  app.post("/api/webdev/rollback", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      versionId?: string;
    };

    const { sandboxId, userId, projectPath: rawPath } = body;
    const projectPath = rawPath || getProjectPathBySandboxId(sandboxId) || "/home/ubuntu/my-app";

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      const targetVersion = body.versionId || "HEAD~1";

      // Step 1: Delete all non-.git contents (Manus: rm -rf /home/ubuntu/{project}/*)
      await sandboxExec(
        sandboxId,
        `cd ${projectPath} && find . -maxdepth 1 ! -name . ! -name .git -exec rm -rf {} +`,
        userId,
        15000
      );

      // Step 2: Checkout the target version
      await sandboxExec(
        sandboxId,
        `cd ${projectPath} && git checkout ${targetVersion} -- .`,
        userId,
        10000
      );

      // Step 3: Reinstall dependencies
      // Detect PM
      let pm = "npm";
      try {
        const pmResult = await sandboxExecClean(sandboxId, `pnpm --version`, userId, 10000);
        if (/^\d+\.\d+/.test(pmResult.stdout.trim())) pm = "pnpm";
      } catch { /* use npm */ }

      await sandboxExec(
        sandboxId,
        `cd ${projectPath} && ${pm} install --no-frozen-lockfile 2>&1`,
        userId,
        120000
      );

      // Step 4: Restart dev server
      const devResult = await startDevServer(sandboxId, projectPath, pm, 30000);

      const hashResult = await sandboxExecClean(
        sandboxId,
        `cd ${projectPath} && git rev-parse --short HEAD`,
        userId
      );

      return reply.send({
        success: true,
        currentVersion: hashResult.stdout.trim(),
        rolledBackTo: targetVersion,
        devServerStatus: devResult.started ? "running" : "starting",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/webdev/restore — Restore project from a specific checkpoint.
   *
   * Manus pattern: full delete + re-checkout + commit as new checkpoint.
   * Ensures clean state (no orphaned files), rebuilt node_modules, cleared cache.
   */
  app.post("/api/webdev/restore", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      versionId: string;
    };

    const { sandboxId, userId, versionId } = body;
    const projectPath = body.projectPath || getProjectPathBySandboxId(sandboxId) || "/home/ubuntu/my-app";

    if (!sandboxId || !userId || !versionId) {
      return reply.status(400).send({ error: "sandboxId, userId, and versionId required" });
    }

    try {
      // Step 1: Delete all non-.git contents
      await sandboxExec(
        sandboxId,
        `cd ${projectPath} && find . -maxdepth 1 ! -name . ! -name .git -exec rm -rf {} +`,
        userId,
        15000
      );

      // Step 2: Checkout the specific version's files
      await sandboxExec(
        sandboxId,
        `cd ${projectPath} && git checkout ${versionId} -- .`,
        userId,
        10000
      );

      // Step 3: Reinstall dependencies
      let pm = "npm";
      try {
        const pmResult = await sandboxExecClean(sandboxId, `pnpm --version`, userId, 10000);
        if (/^\d+\.\d+/.test(pmResult.stdout.trim())) pm = "pnpm";
      } catch { /* use npm */ }

      await sandboxExec(
        sandboxId,
        `cd ${projectPath} && ${pm} install --no-frozen-lockfile 2>&1`,
        userId,
        120000
      );

      // Step 4: Stage and commit as a restore
      await sandboxExec(
        sandboxId,
        `cd ${projectPath} && git add -A && git commit -m "Restored to checkpoint ${versionId}" --allow-empty`,
        userId,
        10000
      );

      // Step 5: Restart dev server
      const devResult = await startDevServer(sandboxId, projectPath, pm, 30000);

      const hashResult = await sandboxExecClean(
        sandboxId,
        `cd ${projectPath} && git rev-parse --short HEAD`,
        userId
      );

      return reply.send({
        success: true,
        restoredFrom: versionId,
        newVersion: hashResult.stdout.trim(),
        devServerStatus: devResult.started ? "running" : "starting",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/webdev/config — Update project configuration.
   *
   * Manus equivalent: POST /webdev/config
   * Updates project-level settings (env vars, database config, etc.)
   */
  app.post("/api/webdev/config", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      env?: Record<string, string>;
      database?: { connection_string?: string };
    };

    const { sandboxId, userId, projectPath: rawPath } = body;
    const projectPath = rawPath || getProjectPathBySandboxId(sandboxId) || "/home/ubuntu/my-app";

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      const updates: string[] = [];

      // Update .env file with provided env vars
      if (body.env && Object.keys(body.env).length > 0) {
        const envContent = Object.entries(body.env)
          .map(([k, v]) => `${k}="${v}"`)
          .join("\n");
        await sandboxWriteFile(sandboxId, `${projectPath}/.env`, envContent + "\n", userId);
        updates.push("env");
      }

      // Update DATABASE_URL if database config provided
      if (body.database?.connection_string) {
        // Append/update DATABASE_URL in .env
        await sandboxExec(
          sandboxId,
          `cd ${projectPath} && grep -q "DATABASE_URL" .env 2>/dev/null && sed -i 's|DATABASE_URL=.*|DATABASE_URL="${body.database.connection_string}"|' .env || echo 'DATABASE_URL="${body.database.connection_string}"' >> .env`,
          userId,
          5000
        );
        updates.push("database");
      }

      return reply.send({
        success: true,
        updated: updates,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/webdev/add-feature — Add a feature to an existing project.
   *
   * Manus equivalent: webdev_add_feature
   * Supported features:
   *   - web-db-user: Upgrade web-static to full-stack (Express + Drizzle + TiDB)
   *   - stripe: Add Stripe SDK, webhook endpoint, payment helpers
   */
  app.post("/api/webdev/add-feature", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      feature: "web-db-user" | "stripe";
    };

    const { sandboxId, userId } = body;
    const projectPath = body.projectPath || getProjectPathBySandboxId(sandboxId) || "/home/ubuntu/my-app";

    if (!sandboxId || !userId || !body.feature) {
      return reply.status(400).send({ error: "sandboxId, userId, and feature required" });
    }

    try {
      const newFiles: string[] = [];
      const envVars: string[] = [];
      let instructions = "";

      if (body.feature === "web-db-user") {
        // Upgrade from web-static to full-stack with Express + Drizzle + TiDB
        await sandboxExec(sandboxId, `mkdir -p ${projectPath}/drizzle ${projectPath}/server`, userId);

        // Install backend deps
        await sandboxExec(
          sandboxId,
          `cd ${projectPath} && pnpm add drizzle-orm mysql2 express zod 2>/dev/null || npm install drizzle-orm mysql2 express zod && pnpm add -D drizzle-kit @types/express tsx 2>/dev/null || npm install -D drizzle-kit @types/express tsx`,
          userId,
          120000
        );

        // Write Drizzle config files
        await sandboxWriteFile(sandboxId, `${projectPath}/drizzle.config.ts`, DRIZZLE_CONFIG_TS, userId);
        await sandboxWriteFile(sandboxId, `${projectPath}/drizzle/schema.ts`, DRIZZLE_SCHEMA_TS, userId);
        await sandboxWriteFile(sandboxId, `${projectPath}/server/db.ts`, SERVER_DB_TS, userId);
        newFiles.push("drizzle.config.ts", "drizzle/schema.ts", "server/db.ts");

        // Create per-project database if TiDB configured
        if (TIDB_HOST || TIDB_DATABASE_URL) {
          const appName = projectPath.split("/").pop() || "my-app";
          const dbName = await createProjectDatabase(appName, userId);
          const sessionId = getSessionIdBySandboxId(sandboxId);
          if (sessionId) setSandboxDatabaseName(sessionId, dbName);

          const tidbUrl = TIDB_HOST
            ? `mysql://${TIDB_USERNAME}:${TIDB_PASSWORD}@${TIDB_HOST}:${TIDB_PORT}/${dbName}`
            : TIDB_DATABASE_URL;
          // Append DATABASE_URL to .env
          await sandboxExec(
            sandboxId,
            `echo 'DATABASE_URL="${tidbUrl}"' >> ${projectPath}/.env`,
            userId,
            5000
          );
          envVars.push("DATABASE_URL");
        }

        instructions = "Full-stack upgrade complete. Server files in server/, Drizzle schema in drizzle/. Run `pnpm db:push` to apply schema to TiDB.";
      } else if (body.feature === "stripe") {
        // Add Stripe integration
        await sandboxExec(
          sandboxId,
          `cd ${projectPath} && pnpm add stripe @stripe/stripe-js 2>/dev/null || npm install stripe @stripe/stripe-js`,
          userId,
          60000
        );

        // Write Stripe webhook endpoint
        const stripeWebhook = `import Stripe from "stripe";
import type { Request, Response } from "express";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-12-18.acacia" });

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return res.status(400).send("Webhook Error");
  }

  switch (event.type) {
    case "checkout.session.completed":
      console.log("Payment successful:", event.data.object);
      break;
    case "customer.subscription.updated":
      console.log("Subscription updated:", event.data.object);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }

  res.json({ received: true });
}
`;
        await sandboxExec(sandboxId, `mkdir -p ${projectPath}/server`, userId);
        await sandboxWriteFile(sandboxId, `${projectPath}/server/stripe-webhook.ts`, stripeWebhook, userId);
        newFiles.push("server/stripe-webhook.ts");

        // Write Stripe client helper
        const stripeClient = `import { loadStripe } from "@stripe/stripe-js";

let stripePromise: ReturnType<typeof loadStripe> | null = null;

export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");
  }
  return stripePromise;
}
`;
        await sandboxExec(sandboxId, `mkdir -p ${projectPath}/client/src/lib`, userId);
        await sandboxWriteFile(sandboxId, `${projectPath}/client/src/lib/stripe.ts`, stripeClient, userId);
        newFiles.push("client/src/lib/stripe.ts");

        envVars.push("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "VITE_STRIPE_PUBLISHABLE_KEY");
        instructions = "Stripe integration added. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, VITE_STRIPE_PUBLISHABLE_KEY in .env. Webhook handler at server/stripe-webhook.ts.";
      } else {
        return reply.status(400).send({ error: `Unknown feature: ${body.feature}. Supported: web-db-user, stripe` });
      }

      // Restart dev server to pick up new deps
      let pm = "npm";
      try {
        const pmResult = await sandboxExecClean(sandboxId, `pnpm --version`, userId, 10000);
        if (/^\d+\.\d+/.test(pmResult.stdout.trim())) pm = "pnpm";
      } catch { /* use npm */ }
      await startDevServer(sandboxId, projectPath, pm, 30000);

      return reply.send({
        success: true,
        feature: body.feature,
        instructions,
        newFiles,
        envVars,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ sandboxId, feature: body.feature, error: msg }, "Failed to add feature");
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/webdev/restart — Restart the dev server.
   *
   * Manus equivalent: POST /webdev/restart
   */
  app.post("/api/webdev/restart", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
    };

    const { sandboxId, userId, projectPath: rawPath } = body;
    const projectPath = rawPath || getProjectPathBySandboxId(sandboxId) || "/home/ubuntu/my-app";

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      // Detect PM via file (terminal echo is unreliable for output checks)
      await sandboxExec(sandboxId, `pnpm --version > /tmp/pm_check 2>&1 || echo "FAIL" > /tmp/pm_check`, userId, 30000);
      let pm = "npm";
      try {
        const pmResult = await tsPost(resolveTerminalUrl(sandboxId), "/text_editor", { command: "view", path: "/tmp/pm_check" }, 5000);
        if (/^\s*\d+\.\d+/.test(String(pmResult.content || ""))) pm = "pnpm";
      } catch { /* use npm */ }

      // Ensure dependencies are installed before starting dev server
      // (node_modules may be missing after rollback/restore)
      const nmCheck = await sandboxExecClean(
        sandboxId,
        `test -d ${projectPath}/node_modules && echo "exists" || echo "missing"`,
        userId,
        5000
      );
      if (nmCheck.stdout.includes("missing")) {
        logger.info({ sandboxId }, "node_modules missing, reinstalling before restart");
        await sandboxExec(
          sandboxId,
          `cd ${projectPath} && ${pm} install --no-frozen-lockfile 2>&1`,
          userId,
          120000
        );
      }

      // Use dedicated terminal session (same as init)
      const devResult = await startDevServer(sandboxId, projectPath, pm, 30000);

      return reply.send({
        success: true,
        devServerStatus: devResult.started ? "running" : "starting",
        port: 3000,
        log: devResult.started ? undefined : devResult.log.slice(-500),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/webdev/database — Execute database operation against TiDB.
   *
   * Manus equivalent: POST /webdev/database
   * Operations (from tidb_integration_audit.txt):
   *   - push: Run drizzle-kit push (apply schema to TiDB)
   *   - pull: Run drizzle-kit pull (pull schema from TiDB)
   *   - query: Execute raw SQL query
   *
   * The sandbox NEVER gets direct TiDB credentials.
   * For push/pull: we inject DATABASE_URL temporarily and run drizzle-kit in sandbox.
   * For query: we execute SQL server-side via mysql2.
   */
  app.post("/api/webdev/database", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      operation: "push" | "pull" | "query";
      project_name?: string;
      projectPath?: string;
      databaseName?: string;
      query?: string;
      params?: unknown[];
    };

    const { sandboxId, userId, operation } = body;
    const projectPath = body.projectPath || `/home/ubuntu/${body.project_name || "my-app"}`;

    if (!sandboxId || !userId || !operation) {
      return reply.status(400).send({ error: "sandboxId, userId, and operation required" });
    }

    if (!TIDB_DATABASE_URL && !TIDB_HOST) {
      return reply.status(503).send({ error: "TiDB not configured (TIDB_DATABASE_URL or TIDB_HOST missing)" });
    }

    // Use project-specific database if provided, otherwise shared
    const targetDb = body.databaseName || TIDB_DATABASE;

    // Build a connection URL for drizzle-kit (used in push/pull operations inside sandbox)
    // TiDB Cloud requires SSL, which mysql2 handles via the URL + ssl=true param
    const dbUrlForDrizzle = TIDB_HOST
      ? `mysql://${TIDB_USERNAME}:${TIDB_PASSWORD}@${TIDB_HOST}:${TIDB_PORT}/${targetDb}`
      : TIDB_DATABASE_URL;

    try {
      if (operation === "push") {
        // Run drizzle-kit push with DATABASE_URL injected
        const result = await sandboxExec(
          sandboxId,
          `cd ${projectPath} && DATABASE_URL="${dbUrlForDrizzle}" npx drizzle-kit push 2>&1`,
          userId,
          30000
        );

        return reply.send({
          success: result.exitCode === 0,
          operation: "push",
          output: result.stdout.slice(-1000),
          errors: result.stderr.slice(-500) || undefined,
        });
      } else if (operation === "pull") {
        // Run drizzle-kit pull with DATABASE_URL injected
        const result = await sandboxExec(
          sandboxId,
          `cd ${projectPath} && DATABASE_URL="${dbUrlForDrizzle}" npx drizzle-kit pull 2>&1`,
          userId,
          30000
        );

        return reply.send({
          success: result.exitCode === 0,
          operation: "pull",
          output: result.stdout.slice(-1000),
          errors: result.stderr.slice(-500) || undefined,
        });
      } else if (operation === "query") {
        if (!body.query) {
          return reply.status(400).send({ error: "query is required for 'query' operation" });
        }

        // Basic SQL safety — only allow standard SQL statements
        const normalizedQuery = body.query.trim().toUpperCase();
        const allowedPrefixes = [
          "SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP",
          "SHOW", "DESCRIBE", "EXPLAIN", "SET", "BEGIN", "COMMIT", "ROLLBACK",
        ];
        const isAllowed = allowedPrefixes.some((p) => normalizedQuery.startsWith(p));
        if (!isAllowed) {
          return reply.status(400).send({ error: "Only standard SQL statements are allowed" });
        }

        // Execute SQL server-side using mysql2
        const { default: mysql } = await import("mysql2/promise");
        const tidbConfig = getTiDBConnectionConfig();
        let connection;
        if (tidbConfig) {
          // Override database if per-project DB specified
          connection = await mysql.createConnection({
            ...tidbConfig,
            database: targetDb,
          });
        } else {
          connection = await mysql.createConnection(TIDB_DATABASE_URL);
        }
        const [rows] = await connection.execute(body.query, body.params || []);
        await connection.end();

        logger.info({ sandboxId, queryPrefix: body.query.slice(0, 50) }, "SQL executed via TiDB proxy");

        return reply.send({
          success: true,
          operation: "query",
          data: rows,
          rowCount: Array.isArray(rows) ? rows.length : 0,
        });
      } else {
        return reply.status(400).send({ error: `Unknown operation: ${operation}. Use push, pull, or query.` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ sandboxId, operation, error: msg }, "Database operation failed");
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/webdev/versions — List all checkpoints (git log).
   */
  app.post("/api/webdev/versions", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
    };

    const { sandboxId, userId, projectPath: rawPath } = body;
    const projectPath = rawPath || getProjectPathBySandboxId(sandboxId) || "/home/ubuntu/my-app";

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      const log = await sandboxExecClean(
        sandboxId,
        `cd ${projectPath} && git log --oneline --format='{"hash":"%h","message":"%s","date":"%ci"}' -20`,
        userId,
        10000
      );

      const versions = log.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      return reply.send({ versions });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/webdev/git-push — Push to GitHub.
   *
   * Pushes the current branch to a remote (default: origin/main).
   */
  app.post("/api/webdev/git-push", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      remote?: string;
      branch?: string;
    };
    const { sandboxId, userId, projectPath: rawPath } = body;
    const projectPath = rawPath || getProjectPathBySandboxId(sandboxId) || "/home/ubuntu/my-app";
    const remote = body.remote || "origin";
    const branch = body.branch || "main";
    if (!sandboxId || !userId) return reply.status(400).send({ error: "sandboxId and userId required" });
    try {
      const result = await sandboxExec(sandboxId, `cd ${projectPath} && git push ${remote} ${branch} 2>&1`, userId, 30000);
      return reply.send({ success: result.exitCode === 0, output: result.stdout.slice(-1000), errors: result.stderr.slice(-500) || undefined });
    } catch (err) { return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) }); }
  });

  /**
   * POST /api/webdev/git-sync-check — Check git sync status.
   *
   * Returns branch, clean/dirty, ahead/behind counts, and remote info.
   */
  app.post("/api/webdev/git-sync-check", async (request, reply) => {
    const body = request.body as { sandboxId: string; userId: string; projectPath?: string };
    const { sandboxId, userId, projectPath: rawPath } = body;
    const projectPath = rawPath || getProjectPathBySandboxId(sandboxId) || "/home/ubuntu/my-app";
    if (!sandboxId || !userId) return reply.status(400).send({ error: "sandboxId and userId required" });
    try {
      const status = await sandboxExecClean(sandboxId, `cd ${projectPath} && git status --porcelain`, userId, 10000);
      const branch = await sandboxExecClean(sandboxId, `cd ${projectPath} && git branch --show-current`, userId, 5000);
      const remotes = await sandboxExecClean(sandboxId, `cd ${projectPath} && git remote -v`, userId, 5000);
      const ahead = await sandboxExecClean(sandboxId, `cd ${projectPath} && git rev-list @{upstream}..HEAD --count 2>/dev/null || echo "0"`, userId, 5000);
      const behind = await sandboxExecClean(sandboxId, `cd ${projectPath} && git rev-list HEAD..@{upstream} --count 2>/dev/null || echo "0"`, userId, 5000);
      return reply.send({
        clean: !status.stdout.trim(),
        branch: branch.stdout.trim(),
        hasRemote: !!remotes.stdout.trim(),
        ahead: parseInt(ahead.stdout.trim()) || 0,
        behind: parseInt(behind.stdout.trim()) || 0,
        changes: status.stdout.trim().split("\n").filter(Boolean).length,
      });
    } catch (err) { return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) }); }
  });

  /**
   * POST /api/webdev/apply-edits — Apply webpage edits (Manus apply_webpage_edits).
   *
   * Applies search-and-replace edits to files in the project.
   */
  app.post("/api/webdev/apply-edits", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      edits: Array<{ file: string; search: string; replace: string }>;
    };
    const { sandboxId, userId, projectPath: rawPath } = body;
    const projectPath = rawPath || getProjectPathBySandboxId(sandboxId) || "/home/ubuntu/my-app";
    if (!sandboxId || !userId || !body.edits?.length) return reply.status(400).send({ error: "sandboxId, userId, and edits required" });
    try {
      const results: Array<{ file: string; success: boolean; error?: string }> = [];
      for (const edit of body.edits) {
        const fullPath = edit.file.startsWith("/") ? edit.file : `${projectPath}/${edit.file}`;
        try {
          const content = await sandboxReadFile(sandboxId, fullPath, userId);
          if (!content.includes(edit.search)) {
            results.push({ file: edit.file, success: false, error: "search string not found" });
            continue;
          }
          const updated = content.replace(edit.search, edit.replace);
          await sandboxWriteFile(sandboxId, fullPath, updated, userId);
          results.push({ file: edit.file, success: true });
        } catch (e) {
          results.push({ file: edit.file, success: false, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return reply.send({ success: results.every(r => r.success), results });
    } catch (err) { return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) }); }
  });

  /**
   * POST /api/webdev/setup-imported-template — Setup imported template.
   *
   * Clones from git URL or downloads from template URL, installs deps, inits git.
   */
  app.post("/api/webdev/setup-imported-template", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      templateUrl?: string;
      gitUrl?: string;
    };
    const { sandboxId, userId, projectPath: rawPath } = body;
    const projectPath = rawPath || getProjectPathBySandboxId(sandboxId) || "/home/ubuntu/my-app";
    if (!sandboxId || !userId) return reply.status(400).send({ error: "sandboxId and userId required" });
    try {
      if (body.gitUrl) {
        await sandboxExec(sandboxId, `git clone ${body.gitUrl} ${projectPath}`, userId, 60000);
      } else if (body.templateUrl) {
        await sandboxExec(sandboxId, `mkdir -p ${projectPath} && cd ${projectPath} && curl -L "${body.templateUrl}" -o template.zip && unzip template.zip && rm template.zip`, userId, 60000);
      }
      // Install deps
      await sandboxExec(sandboxId, `cd ${projectPath} && pnpm install 2>/dev/null || npm install`, userId, 120000);
      // Init git if not already
      await sandboxExec(sandboxId, `cd ${projectPath} && git init 2>/dev/null && git add -A && git commit -m "Imported template" 2>/dev/null || true`, userId, 10000);
      return reply.send({ success: true, projectPath });
    } catch (err) { return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) }); }
  });

  /**
   * POST /api/webdev/refresh-github-token — Refresh GitHub OAuth token in sandbox.
   *
   * Sets up gh CLI auth and git credential helper with the provided token.
   */
  app.post("/api/webdev/refresh-github-token", async (request, reply) => {
    const body = request.body as { sandboxId: string; userId: string; token: string };
    if (!body.sandboxId || !body.userId || !body.token) return reply.status(400).send({ error: "sandboxId, userId, and token required" });
    try {
      // Write GitHub token to sandbox for git operations
      await sandboxExec(body.sandboxId, `echo "${body.token}" | gh auth login --with-token 2>&1`, body.userId, 10000);
      // Also set as credential helper
      await sandboxExec(body.sandboxId, `git config --global credential.helper store && echo "https://oauth2:${body.token}@github.com" > /home/ubuntu/.git-credentials`, body.userId, 5000);
      return reply.send({ success: true });
    } catch (err) { return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) }); }
  });

  /**
   * POST /api/webdev/refresh-s3-token — Refresh S3 presigned URLs.
   *
   * Re-generates presigned URLs for existing S3 keys (24h expiry).
   */
  app.post("/api/webdev/refresh-s3-token", async (request, reply) => {
    const body = request.body as { sandboxId: string; userId: string; s3Keys?: string[] };
    if (!body.sandboxId || !body.userId) return reply.status(400).send({ error: "sandboxId and userId required" });
    try {
      // Re-generate presigned URLs for existing S3 keys
      if (!body.s3Keys?.length) return reply.send({ success: true, urls: [] });
      // Lazy-load storage
      const mod = await import("@repo/storage");
      const storage: any = (mod as any).default ?? mod;
      const urls = await Promise.all(body.s3Keys.map(async (key: string) => ({
        key,
        url: await storage.getPresignedUrl(key, 86400, true),
      })));
      return reply.send({ success: true, urls });
    } catch (err) { return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) }); }
  });
}
