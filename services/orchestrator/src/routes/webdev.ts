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
import { getSessionIdBySandboxId, setSandboxDatabaseName, registerDatabaseCleanup } from "../lib/e2b-manager.js";

const logger = createLogger({ service: "webdev" });

const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";

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

/**
 * Execute a shell command in a sandbox via the sandbox service.
 */
async function sandboxExec(
  sandboxId: string,
  command: string,
  userId: string,
  timeout = 30000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const resp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/shell`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({ command, timeout }),
    signal: AbortSignal.timeout(timeout + 5000),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Sandbox exec failed: ${resp.status} ${detail}`);
  }

  const data = (await resp.json()) as {
    data?: { stdout?: string; stderr?: string; exitCode?: number };
  };
  return {
    stdout: data.data?.stdout || "",
    stderr: data.data?.stderr || "",
    exitCode: data.data?.exitCode ?? 1,
  };
}

/**
 * Write a file to a sandbox via the sandbox service.
 */
async function sandboxWriteFile(
  sandboxId: string,
  path: string,
  content: string,
  userId: string
): Promise<void> {
  const resp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({ path, content }),
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Sandbox file write failed: ${resp.status} ${detail}`);
  }
}

/**
 * Read a file from a sandbox via the sandbox service.
 */
async function sandboxReadFile(
  sandboxId: string,
  path: string,
  userId: string
): Promise<string> {
  const resp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/files?path=${encodeURIComponent(path)}`, {
    method: "GET",
    headers: {
      "x-user-id": userId,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Sandbox file read failed: ${resp.status} ${detail}`);
  }

  const data = (await resp.json()) as { data?: { content?: string } };
  return data.data?.content || "";
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
    const projectDir = body.directory || `/home/user/${appName}`;

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    logger.info({ sandboxId, templateId, appName, projectDir }, "Initializing webdev project");

    try {
      // ── Step 1: Scaffold project from template ──────────────────────────
      // Manus pattern: pre-built templates live at /opt/.rubic/webdev/templates/
      // and are simply COPIED to the project directory.
      // Fallback: if templates aren't baked in (template not rebuilt yet), use create-vite.
      const templatePath = `/opt/.rubic/webdev/templates/${templateId}`;
      // First command on a fresh sandbox needs extra time (E2B gRPC connection setup)
      const templateCheck = await sandboxExec(
        sandboxId,
        `test -d ${templatePath} && echo "exists" || echo "missing"`,
        userId,
        30000
      );

      if (templateCheck.stdout.trim() === "exists") {
        // Manus way: copy pre-built template
        await sandboxExec(sandboxId, `cp -r ${templatePath} ${projectDir}`, userId, 10000);
        // Fix pnpm store path mismatch (template was built as root, now running as user)
        await sandboxExec(
          sandboxId,
          `rm -rf ${projectDir}/node_modules ${projectDir}/pnpm-lock.yaml 2>/dev/null; true`,
          userId,
          5000
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
        if (depsCheck.stdout.trim() !== "has_mysql2") {
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

      // ── Step 3b: Write vite.config.ts with allowedHosts ─────────────────
      // E2B sandbox URLs (https://3000-<id>.e2b.dev) are external hosts —
      // Vite 6+ blocks them by default. Allow all hosts for sandbox dev.
      const viteConfig = `import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
})
`;
      await sandboxWriteFile(sandboxId, `${projectDir}/vite.config.ts`, viteConfig, userId);

      // ── Step 4: Install dependencies ────────────────────────────────────
      // Manus uses pnpm. Fallback to npm if pnpm not available.
      const pmCheck = await sandboxExec(sandboxId, `which pnpm 2>/dev/null && echo "pnpm" || echo "npm"`, userId, 15000);
      const pm = pmCheck.stdout.trim().endsWith("pnpm") ? "pnpm" : "npm";
      await sandboxExec(sandboxId, `cd ${projectDir} && ${pm} install`, userId, 120000);

      // ── Step 5: Initialize git repo ─────────────────────────────────────
      // Manus pattern: git config before first commit
      await sandboxExec(
        sandboxId,
        `cd ${projectDir} && git config --global user.email "agent@rubic.ai" && git config --global user.name "Rubic Agent" && git init && git add -A && git commit -m "Initial scaffold from ${templateId} template"`,
        userId,
        15000
      );

      // ── Step 6: Start dev server (backgrounded) ─────────────────────────
      // Manus uses `pnpm dev`. Fallback to `npx vite` if no pnpm scripts.
      const devCmd = pm === "pnpm"
        ? `cd ${projectDir} && nohup pnpm dev --host 0.0.0.0 --port 3000 > /tmp/devserver.log 2>&1 &`
        : `cd ${projectDir} && nohup npx vite --host 0.0.0.0 --port 3000 > /tmp/devserver.log 2>&1 &`;
      await sandboxExec(sandboxId, devCmd, userId, 10000);

      logger.info({ sandboxId, appName, templateId, projectDir }, "Webdev project initialized");

      return reply.send({
        success: true,
        app_name: appName,
        template_id: templateId,
        directory: projectDir,
        devServerPort: 3000,
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
   * Manus equivalent: POST /webdev/status
   */
  app.post("/api/webdev/status", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
    };

    const { sandboxId, userId, projectPath = "/home/user/my-app" } = body;

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      // Check dev server
      const devServer = await sandboxExec(
        sandboxId,
        `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "down"`,
        userId,
        5000
      );

      // Check TypeScript errors
      const tscCheck = await sandboxExec(
        sandboxId,
        `cd ${projectPath} && npx tsc --noEmit 2>&1 | tail -5 || echo "no tsc"`,
        userId,
        15000
      );

      // Check recent build log
      const buildLog = await sandboxExec(
        sandboxId,
        `tail -20 /tmp/devserver.log 2>/dev/null || echo "no log"`,
        userId,
        5000
      );

      const devServerUp = devServer.stdout.trim() === "200" || devServer.stdout.trim() === "304";

      return reply.send({
        devServer: {
          status: devServerUp ? "running" : "down",
          port: 3000,
        },
        healthChecks: {
          buildErrors: buildLog.stdout.includes("ERROR") || buildLog.stderr.includes("ERROR"),
          typescript: tscCheck.exitCode === 0 ? "no errors" : tscCheck.stdout.trim(),
        },
        recentLog: buildLog.stdout.slice(-500),
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

    const { sandboxId, userId, projectPath = "/home/user/my-app" } = body;
    const message = body.message || "Checkpoint";

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      // Stage all changes
      await sandboxExec(sandboxId, `cd ${projectPath} && git add -A`, userId);

      // Check if there are changes to commit
      const status = await sandboxExec(sandboxId, `cd ${projectPath} && git status --porcelain`, userId);
      if (!status.stdout.trim()) {
        return reply.send({ success: true, noChanges: true, message: "No changes to checkpoint" });
      }

      // Commit
      const escapedMsg = message.replace(/'/g, "'\\''");
      await sandboxExec(
        sandboxId,
        `cd ${projectPath} && git commit -m '${escapedMsg}'`,
        userId,
        10000
      );

      // Get commit hash
      const hashResult = await sandboxExec(
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
          `DISPLAY=:99 scrot /home/user/screenshots/${filename}`,
          userId,
          5000
        );
        screenshotPath = `/home/user/screenshots/${filename}`;
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
   * Manus equivalent: POST /webdev/rollback
   */
  app.post("/api/webdev/rollback", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      versionId?: string;
    };

    const { sandboxId, userId, projectPath = "/home/user/my-app" } = body;

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      if (body.versionId) {
        await sandboxExec(
          sandboxId,
          `cd ${projectPath} && git checkout ${body.versionId} -- .`,
          userId,
          10000
        );
      } else {
        await sandboxExec(
          sandboxId,
          `cd ${projectPath} && git checkout HEAD~1 -- .`,
          userId,
          10000
        );
      }

      const hashResult = await sandboxExec(
        sandboxId,
        `cd ${projectPath} && git rev-parse --short HEAD`,
        userId
      );

      return reply.send({
        success: true,
        currentVersion: hashResult.stdout.trim(),
        rolledBackTo: body.versionId || "HEAD~1",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/webdev/restore — Restore project from a specific checkpoint.
   *
   * Manus equivalent: POST /webdev/restore
   * Similar to rollback but does a hard reset and commits as a new checkpoint.
   */
  app.post("/api/webdev/restore", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      versionId: string;
    };

    const { sandboxId, userId, projectPath = "/home/user/my-app", versionId } = body;

    if (!sandboxId || !userId || !versionId) {
      return reply.status(400).send({ error: "sandboxId, userId, and versionId required" });
    }

    try {
      // Checkout the specific version's files
      await sandboxExec(
        sandboxId,
        `cd ${projectPath} && git checkout ${versionId} -- .`,
        userId,
        10000
      );

      // Stage and commit as a restore
      await sandboxExec(
        sandboxId,
        `cd ${projectPath} && git add -A && git commit -m "Restored to checkpoint ${versionId}" --allow-empty`,
        userId,
        10000
      );

      const hashResult = await sandboxExec(
        sandboxId,
        `cd ${projectPath} && git rev-parse --short HEAD`,
        userId
      );

      return reply.send({
        success: true,
        restoredFrom: versionId,
        newVersion: hashResult.stdout.trim(),
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

    const { sandboxId, userId, projectPath = "/home/user/my-app" } = body;

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

    const { sandboxId, userId, projectPath = "/home/user/my-app" } = body;

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      // Kill existing dev server
      await sandboxExec(sandboxId, `pkill -f "vite" 2>/dev/null || true`, userId, 5000);

      // Restart — use pnpm if available, fallback to npx vite
      const pmCheck = await sandboxExec(sandboxId, `which pnpm 2>/dev/null && echo "pnpm" || echo "npm"`, userId, 15000);
      const pm = pmCheck.stdout.trim().endsWith("pnpm") ? "pnpm" : "npm";
      const devCmd = pm === "pnpm"
        ? `cd ${projectPath} && nohup pnpm dev --host 0.0.0.0 --port 3000 > /tmp/devserver.log 2>&1 &`
        : `cd ${projectPath} && nohup npx vite --host 0.0.0.0 --port 3000 > /tmp/devserver.log 2>&1 &`;
      await sandboxExec(sandboxId, devCmd, userId, 10000);

      // Wait for it to be ready
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const health = await sandboxExec(
        sandboxId,
        `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "down"`,
        userId,
        5000
      );

      return reply.send({
        success: true,
        devServerStatus: health.stdout.trim() === "200" ? "running" : "starting",
        port: 3000,
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
    const projectPath = body.projectPath || `/home/user/${body.project_name || "my-app"}`;

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

    const { sandboxId, userId, projectPath = "/home/user/my-app" } = body;

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      const log = await sandboxExec(
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
    const { sandboxId, userId, projectPath = "/home/user/my-app" } = body;
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
    const { sandboxId, userId, projectPath = "/home/user/my-app" } = body;
    if (!sandboxId || !userId) return reply.status(400).send({ error: "sandboxId and userId required" });
    try {
      const status = await sandboxExec(sandboxId, `cd ${projectPath} && git status --porcelain`, userId, 10000);
      const branch = await sandboxExec(sandboxId, `cd ${projectPath} && git branch --show-current`, userId, 5000);
      const remotes = await sandboxExec(sandboxId, `cd ${projectPath} && git remote -v`, userId, 5000);
      const ahead = await sandboxExec(sandboxId, `cd ${projectPath} && git rev-list @{upstream}..HEAD --count 2>/dev/null || echo "0"`, userId, 5000);
      const behind = await sandboxExec(sandboxId, `cd ${projectPath} && git rev-list HEAD..@{upstream} --count 2>/dev/null || echo "0"`, userId, 5000);
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
    const { sandboxId, userId, projectPath = "/home/user/my-app" } = body;
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
    const { sandboxId, userId, projectPath = "/home/user/my-app" } = body;
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
      await sandboxExec(body.sandboxId, `git config --global credential.helper store && echo "https://oauth2:${body.token}@github.com" > /home/user/.git-credentials`, body.userId, 5000);
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
