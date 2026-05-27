/**
 * Dynamic Composio connector tools — fetched per-user at session start.
 *
 * Pattern:
 *   1. Orchestrator calls GET /users/:userId/tools on connector service
 *   2. Connector service queries DB for user's connected apps → Composio SDK → tool specs
 *   3. Each spec is converted to an AI SDK tool() with jsonSchema() for input
 *   4. tool.execute() calls POST /tools/execute on connector service
 *
 * This is the generalised version of the gmail_send / outlook_send bridges
 * in extra-tools.ts — same pattern, but dynamic instead of hardcoded.
 */

import { tool, jsonSchema } from "ai";
import type { ToolSet } from "ai";
import type { ToolContext } from "./types.js";

// ── Types ────────────────────────────────────────────────────────────────────

/** Shape returned by connector service GET /users/:userId/tools */
export interface ComposioToolSpec {
  name: string; // e.g. "GITHUB_CREATE_ISSUE"
  description: string; // e.g. "Create an issue in a GitHub repository"
  parameters: Record<string, unknown>; // JSON Schema object
  appName: string; // e.g. "github"
  source: "composio";
}

interface FetchToolsResult {
  tools: ComposioToolSpec[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const CONNECTOR_SERVICE_URL = process.env.CONNECTOR_SERVICE_URL || "http://localhost:4009";

/** Timeout for fetching tool specs (not execution — just the catalog) */
const FETCH_TIMEOUT_MS = 10_000;

/** Timeout for executing a single tool action */
const EXECUTE_TIMEOUT_MS = 30_000;

/**
 * Tools that are already registered as static tools in extra-tools.ts.
 * Skip these to avoid duplicate tool names in the registry.
 */
const STATIC_TOOL_NAMES = new Set([
  "GMAIL_SEND_EMAIL",
  "GMAIL_CREATE_EMAIL_DRAFT",
  "GMAIL_GET_ATTACHMENT",
  "OUTLOOK_SEND_EMAIL",
  "OUTLOOK_CREATE_DRAFT",
  "OUTLOOK_GET_ATTACHMENT",
]);

// ── Fetch tool specs from connector service ──────────────────────────────────

/**
 * Fetch all Composio tools available to a user from the connector service.
 * Returns an empty array on failure (graceful degradation — agent still works
 * with static tools even if connector service is down).
 */
export async function fetchComposioTools(userId: string, projectId?: string): Promise<ComposioToolSpec[]> {
  try {
    const url = new URL(`${CONNECTOR_SERVICE_URL}/users/${encodeURIComponent(userId)}/tools`);
    if (projectId) url.searchParams.set("projectId", projectId);

    const response = await fetch(
      url.toString(),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      console.warn(
        `[connector-tools] Failed to fetch tools for user ${userId}: ${response.status}`
      );
      return [];
    }

    const result = (await response.json()) as FetchToolsResult;
    return result.tools ?? [];
  } catch (error) {
    // Connector service down or unreachable — degrade gracefully
    console.warn(
      `[connector-tools] Connector service unavailable for user ${userId}:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

// ── Convert Composio tool specs → AI SDK tools ──────────────────────────────

/**
 * Convert an array of Composio tool specs into AI SDK tools.
 *
 * Each tool:
 *   - Uses `jsonSchema()` to wrap the Composio input_parameters JSON schema
 *   - Routes execution through connector service POST /tools/execute
 *   - Handles 403 (not connected) gracefully with user-friendly message
 *   - Skips tools that are already registered as static tools
 */
export function createConnectorTools(ctx: ToolContext, specs: ComposioToolSpec[]): ToolSet {
  const tools: ToolSet = {};

  for (const spec of specs) {
    // Skip tools already handled by static email bridges
    if (STATIC_TOOL_NAMES.has(spec.name.toUpperCase())) {
      continue;
    }

    // Sanitise the tool name for AI SDK (lowercase, underscores only)
    const toolName = sanitiseToolName(spec.name);

    // Skip tools with empty or invalid names (Composio SDK sometimes returns hollow objects)
    if (!toolName) {
      continue;
    }

    // Skip if name collision with static tools (after sanitisation)
    if (
      toolName === "gmail_send" ||
      toolName === "gmail_download" ||
      toolName === "outlook_send" ||
      toolName === "outlook_download"
    ) {
      continue;
    }

    // Build JSON schema for input — Composio returns a JSON Schema object.
    // If it's empty or malformed, fall back to a permissive schema.
    const inputParams = normaliseJsonSchema(spec.parameters);

    try {
      tools[toolName] = tool({
        description: buildToolDescription(spec),
        inputSchema: jsonSchema(inputParams),
        execute: createToolExecutor(ctx, spec),
      });
    } catch (error) {
      // If jsonSchema fails (malformed schema), skip this tool
      console.warn(
        `[connector-tools] Skipping tool ${spec.name}: invalid schema`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return tools;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitise Composio tool name to AI SDK compatible format.
 * "GITHUB_CREATE_ISSUE" → "github_create_issue"
 * "SLACK_SEND_MESSAGE"  → "slack_send_message"
 */
function sanitiseToolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_") // Replace non-alphanumeric with underscore
    .replace(/_+/g, "_") // Collapse multiple underscores
    .replace(/^_|_$/g, ""); // Trim leading/trailing underscores
}

/**
 * Build a description string for the tool that includes the app name
 * and a note about the connected account requirement.
 */
function buildToolDescription(spec: ComposioToolSpec): string {
  const appLabel = spec.appName.charAt(0).toUpperCase() + spec.appName.slice(1);
  const base = spec.description || `Execute ${spec.name} action via ${appLabel}`;
  return `${base}\n\nRequires the user to have connected their ${appLabel} account in Settings > Applications.`;
}

/**
 * Normalise JSON Schema from Composio to ensure it's valid.
 * Composio sometimes returns schemas without "type": "object" at the root.
 */
function normaliseJsonSchema(params: Record<string, unknown>): Record<string, unknown> {
  // If it's already a valid JSON Schema object, return as-is
  if (params && typeof params === "object" && Object.keys(params).length > 0) {
    // Ensure it has type: object at root if it has properties
    if (params.properties && !params.type) {
      return { type: "object", ...params };
    }
    return params;
  }

  // Fallback: accept any object
  return {
    type: "object",
    properties: {},
    additionalProperties: true,
  };
}

/**
 * Create the execute function for a Composio tool.
 * Routes through connector service POST /tools/execute.
 */
function createToolExecutor(
  ctx: ToolContext,
  spec: ComposioToolSpec
): (params: unknown) => Promise<Record<string, unknown>> {
  return async (params: unknown) => {
    try {
      const response = await fetch(`${CONNECTOR_SERVICE_URL}/tools/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": ctx.userId,
        },
        body: JSON.stringify({
          toolName: spec.name,
          arguments: params as Record<string, unknown>,
          ...(ctx.projectId ? { projectId: ctx.projectId } : {}),
        }),
        signal: AbortSignal.timeout(EXECUTE_TIMEOUT_MS),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");

        // 403 = user doesn't have this app connected
        if (response.status === 403) {
          const appLabel = spec.appName.charAt(0).toUpperCase() + spec.appName.slice(1);
          return {
            status: "error" as const,
            error: `${appLabel} not connected. Ask the user to connect their ${appLabel} account in Settings > Applications.`,
          };
        }

        return {
          status: "error" as const,
          error: `Connector error (${response.status}): ${text}`,
        };
      }

      const result = (await response.json()) as Record<string, unknown>;

      // Connector service returns { success, result, error }
      if (result.error) {
        return {
          status: "error" as const,
          error: String(result.error),
        };
      }

      return {
        status: "success" as const,
        data: result.result ?? result.data ?? result,
      };
    } catch (error) {
      return {
        status: "error" as const,
        error: error instanceof Error ? error.message : `Failed to execute ${spec.name}`,
      };
    }
  };
}

// ── Public utility ──────────────────────────────────────────────────────────

/**
 * Get the list of loaded Composio tool names (for system prompt injection).
 * Returns tool names in the format the LLM will call them (lowercase).
 */
export function getComposioToolNames(specs: ComposioToolSpec[]): string[] {
  return specs
    .filter((s) => !STATIC_TOOL_NAMES.has(s.name.toUpperCase()))
    .map((s) => sanitiseToolName(s.name));
}

/**
 * Group Composio tools by app name for system prompt display.
 * Returns: { "github": ["github_create_issue", ...], "slack": [...] }
 */
export function groupToolsByApp(specs: ComposioToolSpec[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const spec of specs) {
    if (STATIC_TOOL_NAMES.has(spec.name.toUpperCase())) continue;
    const app = spec.appName.toLowerCase();
    if (!groups[app]) groups[app] = [];
    groups[app]!.push(sanitiseToolName(spec.name));
  }
  return groups;
}
