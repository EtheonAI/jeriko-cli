/**
 * WebDev agent tools — 9 tools for web application development.
 *
 * Each tool calls the orchestrator's own /api/webdev/* routes via localhost HTTP.
 * This is the same pattern test-ide uses (proven to work).
 *
 * Manus equivalent tools:
 *   webdev_init_project, webdev_save_checkpoint, webdev_check_status,
 *   webdev_restart_server, webdev_rollback_checkpoint, webdev_execute_sql,
 *   webdev_push_schema, webdev_list_versions, webdev_add_feature
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./types.js";
import { buildPreviewUrl } from "../e2b-manager.js";

const ORCHESTRATOR_URL = `http://localhost:${process.env.PORT || 4014}`;

async function callWebdevRoute(
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const resp = await fetch(`${ORCHESTRATOR_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
  return (await resp.json()) as Record<string, unknown>;
}

// ── Tool factories ──────────────────────────────────────────────────────────

function createWebdevInitProjectTool(ctx: ToolContext) {
  return tool({
    description:
      "Initialize a new web development project from a pre-built template. " +
      "Handles template scaffolding, dependency installation, git init, database creation, and dev server start. " +
      "Use this tool when the user wants to build a website, web app, or full-stack application. " +
      "Two templates: 'web-static' (Vite + React + TS + Tailwind + shadcn/ui) and " +
      "'web-db-user' (full-stack with Express + Drizzle ORM + TiDB). " +
      "ALWAYS use this tool instead of manually scaffolding with shell commands.",
    inputSchema: z.object({
      template_id: z
        .enum(["web-static", "web-db-user"])
        .default("web-static")
        .describe(
          "Template to use. 'web-static' for static sites, 'web-db-user' for apps with database."
        ),
      app_name: z
        .string()
        .default("my-app")
        .describe("Name of the application (used as directory name)."),
    }),
    execute: async (params) => {
      const directory = `/home/ubuntu/${params.app_name}`;
      const result = await callWebdevRoute("/api/webdev/init", {
        sandboxId: ctx.sandboxId,
        userId: ctx.userId,
        template_id: params.template_id,
        app_name: params.app_name,
        directory,
      });
      // Use centralized URL builder (respects PROXY_DOMAIN, SANDBOX_PROXY_URL)
      const port = (result.devServerPort as number) || 3000;
      const previewUrl = buildPreviewUrl(ctx.e2bSandboxId, port) || (result.previewUrl as string);
      return {
        ...result,
        previewUrl,
        // Ensure name + directory are always in output for frontend SSE handler
        name: params.app_name,
        directory,
        projectPath: directory,
      };
    },
  });
}

function createWebdevSaveCheckpointTool(ctx: ToolContext) {
  return tool({
    description:
      "Save a checkpoint (git commit) of the current project state. " +
      "Use after making significant changes to create a version that can be rolled back to.",
    inputSchema: z.object({
      message: z
        .string()
        .default("Checkpoint")
        .describe("Commit message describing the changes."),
      project_path: z
        .string()
        .optional()
        .describe("Absolute path to the project directory. Defaults to /home/ubuntu/my-app."),
    }),
    execute: async (params) => {
      return callWebdevRoute("/api/webdev/checkpoint", {
        sandboxId: ctx.sandboxId,
        userId: ctx.userId,
        message: params.message,
        projectPath: params.project_path,
      });
    },
  });
}

function createWebdevCheckStatusTool(ctx: ToolContext) {
  return tool({
    description:
      "Check the health status of a webdev project: dev server status, TypeScript errors, and build log. " +
      "Use to diagnose build errors or verify the dev server is running.",
    inputSchema: z.object({
      project_path: z
        .string()
        .optional()
        .describe("Absolute path to the project directory. Defaults to /home/ubuntu/my-app."),
    }),
    execute: async (params) => {
      return callWebdevRoute("/api/webdev/status", {
        sandboxId: ctx.sandboxId,
        userId: ctx.userId,
        projectPath: params.project_path,
      });
    },
  });
}

function createWebdevRestartServerTool(ctx: ToolContext) {
  return tool({
    description:
      "Restart the Vite dev server. Use when the dev server crashes, stops, or needs a fresh start after config changes.",
    inputSchema: z.object({
      project_path: z
        .string()
        .optional()
        .describe("Absolute path to the project directory. Defaults to /home/ubuntu/my-app."),
    }),
    execute: async (params) => {
      return callWebdevRoute("/api/webdev/restart", {
        sandboxId: ctx.sandboxId,
        userId: ctx.userId,
        projectPath: params.project_path,
      });
    },
  });
}

function createWebdevRollbackCheckpointTool(ctx: ToolContext) {
  return tool({
    description:
      "Rollback the project to a previous checkpoint (git version). " +
      "Use webdev_list_versions first to see available checkpoints.",
    inputSchema: z.object({
      version_id: z
        .string()
        .optional()
        .describe("Git commit hash to rollback to. If omitted, rolls back one version."),
      project_path: z
        .string()
        .optional()
        .describe("Absolute path to the project directory. Defaults to /home/ubuntu/my-app."),
    }),
    execute: async (params) => {
      return callWebdevRoute("/api/webdev/rollback", {
        sandboxId: ctx.sandboxId,
        userId: ctx.userId,
        versionId: params.version_id,
        projectPath: params.project_path,
      });
    },
  });
}

function createWebdevExecuteSqlTool(ctx: ToolContext) {
  return tool({
    description:
      "Execute a SQL query against the project's TiDB (MySQL-compatible) database. " +
      "Use for direct database operations: SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, etc. " +
      "Only available for projects created with the 'web-db-user' template.",
    inputSchema: z.object({
      query: z.string().describe("SQL query to execute."),
      params: z
        .array(z.unknown())
        .optional()
        .describe("Parameterized query values for safe SQL execution."),
    }),
    execute: async (params) => {
      return callWebdevRoute("/api/webdev/database", {
        sandboxId: ctx.sandboxId,
        userId: ctx.userId,
        operation: "query",
        query: params.query,
        params: params.params,
      });
    },
  });
}

function createWebdevPushSchemaTool(ctx: ToolContext) {
  return tool({
    description:
      "Push the Drizzle ORM schema to the TiDB database (runs drizzle-kit push). " +
      "Use after modifying drizzle/schema.ts to apply schema changes to the database. " +
      "Only available for projects created with the 'web-db-user' template.",
    inputSchema: z.object({
      project_path: z
        .string()
        .optional()
        .describe("Absolute path to the project directory. Defaults to /home/ubuntu/my-app."),
    }),
    execute: async (params) => {
      return callWebdevRoute("/api/webdev/database", {
        sandboxId: ctx.sandboxId,
        userId: ctx.userId,
        operation: "push",
        projectPath: params.project_path,
      });
    },
  });
}

function createWebdevListVersionsTool(ctx: ToolContext) {
  return tool({
    description:
      "List all saved checkpoints (git commit history) for the project. " +
      "Returns commit hashes, messages, and dates. Use before rollback to see available versions.",
    inputSchema: z.object({
      project_path: z
        .string()
        .optional()
        .describe("Absolute path to the project directory. Defaults to /home/ubuntu/my-app."),
    }),
    execute: async (params) => {
      return callWebdevRoute("/api/webdev/versions", {
        sandboxId: ctx.sandboxId,
        userId: ctx.userId,
        projectPath: params.project_path,
      });
    },
  });
}

function createWebdevAddFeatureTool(ctx: ToolContext) {
  return tool({
    description:
      "Add a feature to an existing web project. " +
      "Supported features: 'web-db-user' (upgrade to full-stack with Express + Drizzle + TiDB) " +
      "and 'stripe' (add Stripe payment SDK, webhook endpoint, and client helpers). " +
      "Installs deps, writes boilerplate files, and restarts dev server.",
    inputSchema: z.object({
      feature: z
        .enum(["web-db-user", "stripe"])
        .describe("Feature to add: 'web-db-user' for database/backend, 'stripe' for payments."),
      project_path: z
        .string()
        .optional()
        .describe("Absolute path to the project directory. Defaults to /home/ubuntu/my-app."),
    }),
    execute: async (params) => {
      return callWebdevRoute("/api/webdev/add-feature", {
        sandboxId: ctx.sandboxId,
        userId: ctx.userId,
        feature: params.feature,
        projectPath: params.project_path,
      });
    },
  });
}

function createWebdevReadDebugLogsTool(ctx: ToolContext) {
  return tool({
    description:
      "Read browser debug logs collected from the running webdev app. " +
      "Returns console output (errors, warnings, logs), failed network requests, " +
      "UI events, and uncaught exceptions. Use to diagnose client-side bugs, " +
      "broken API calls, or rendering errors. Call with clear=true to clear logs after reading.",
    inputSchema: z.object({
      clear: z
        .boolean()
        .optional()
        .describe("If true, clear the debug logs after reading. Default: false."),
    }),
    execute: async (params) => {
      return callWebdevRoute("/api/webdev/debug-logs", {
        sandboxId: ctx.sandboxId,
        userId: ctx.userId,
        clear: params.clear,
      });
    },
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

export function createWebdevTools(ctx: ToolContext) {
  return {
    webdev_init_project: createWebdevInitProjectTool(ctx),
    webdev_save_checkpoint: createWebdevSaveCheckpointTool(ctx),
    webdev_check_status: createWebdevCheckStatusTool(ctx),
    webdev_restart_server: createWebdevRestartServerTool(ctx),
    webdev_rollback_checkpoint: createWebdevRollbackCheckpointTool(ctx),
    webdev_execute_sql: createWebdevExecuteSqlTool(ctx),
    webdev_push_schema: createWebdevPushSchemaTool(ctx),
    webdev_list_versions: createWebdevListVersionsTool(ctx),
    webdev_add_feature: createWebdevAddFeatureTool(ctx),
    webdev_read_debug_logs: createWebdevReadDebugLogsTool(ctx),
  } as const;
}
