"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { useAppDispatch } from "@/lib/store/hooks";
import { upsertToolEvent } from "@/lib/store/slices/websocket.slice";
import type { ToolEventEntity } from "@/lib/store/slices/websocket.slice";
import { setWorkspaceSidebarType } from "@/lib/store/slices/agentWorkspace.slice";
import type { WorkspaceSidebarType } from "@/lib/store/slices/agentWorkspace.slice";
import { updateSession } from "@/lib/store/slices/sessions.slice";

/**
 * Manus-parity: Normalize AI SDK tool parts into websocket.toolEvents.
 *
 * In Manus, WebSocket events are upserted into `websocket.entities` via
 * EntityAdapter. Canvas selectors then read from that normalized store.
 *
 * In Rubic, the AI SDK SSE stream produces `messages[]` with tool parts.
 * This hook bridges the gap: it watches messages for tool parts and
 * dispatches them as normalized `ToolEventEntity` objects into
 * `websocket.toolEvents`. Canvas selectors read from there.
 *
 * Also auto-sets `agentWorkspace.sidebarType` based on tool type
 * (Manus: WebSocket middleware does this).
 *
 * Uses a Set ref to track processed `toolCallId:state` pairs —
 * only dispatches when a tool part is genuinely new or changed state.
 *
 * CRITICAL: This hook ONLY dispatches — it does NOT read from Redux via
 * useAppSelector. This prevents infinite re-render loops during streaming.
 */

// Tool name → view type (inline to avoid cross-package import)
const TOOL_VIEW_MAP: Record<string, string> = {
  browser_navigate: "browser", browser_view: "browser", browser_click: "browser",
  browser_input: "browser", browser_scroll: "browser", browser_scroll_up: "browser",
  browser_scroll_down: "browser", browser_move_mouse: "browser", browser_key_press: "browser",
  browser_press_key: "browser", browser_select_option: "browser", browser_console_exec: "browser",
  browser_console_view: "browser", browser_screenshot: "browser", browser_restart: "browser",
  shell_exec: "terminal", shell_view: "terminal", shell_wait: "terminal",
  shell_write_to_process: "terminal", shell_kill_process: "terminal",
  file_read: "editor", file_write: "editor", file_str_replace: "editor",
  file_find_in_content: "editor", file_find_by_name: "editor",
  code_execute: "terminal",
  info_search_web: "browser", web_search: "browser", search_web: "browser",
  deploy_expose_port: "browser", deploy_apply_deployment: "browser",
  make_manus_page: "browser", text_editor: "editor", slide_present: "browser",
  webdev_init_project: "webDevIDE", webdev_save_checkpoint: "webDevIDE",
  webdev_check_status: "webDevIDE", webdev_restart_server: "webDevIDE",
  webdev_rollback_checkpoint: "webDevIDE", webdev_execute_sql: "webDevIDE",
  webdev_push_schema: "webDevIDE", webdev_list_versions: "webDevIDE",
  webdev_add_feature: "webDevIDE",
};

// View type → agentWorkspace.sidebarType
const VIEW_TO_SIDEBAR: Record<string, WorkspaceSidebarType> = {
  browser: "browser",
  terminal: "computer",
  editor: "files",
  webDevIDE: "webdev",
};

// Screenshot extraction helpers (inline to avoid cross-package import)
const BASE64_IMAGE_PREFIXES = ["iVBOR", "/9j/", "R0lGO", "UklGR"];

function normalizeScreenshot(raw: string): string {
  if (raw.startsWith("data:") || raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  for (const prefix of BASE64_IMAGE_PREFIXES) {
    if (raw.startsWith(prefix)) {
      const mime = raw.startsWith("/9j/") ? "image/jpeg" : raw.startsWith("UklGR") ? "image/webp" : raw.startsWith("R0lGO") ? "image/gif" : "image/png";
      return `data:${mime};base64,${raw}`;
    }
  }
  if (raw.length > 100 && /^[A-Za-z0-9+/=]+$/.test(raw.slice(0, 100))) {
    return `data:image/webp;base64,${raw}`;
  }
  return raw;
}

function extractScreenshot(output: Record<string, unknown> | undefined): string | undefined {
  if (!output) return undefined;
  const candidates = [output.screenshot, output.data, (output.result as Record<string, unknown>)?.screenshot, output.image, output.base64];
  for (const val of candidates) {
    if (typeof val === "string" && val.length > 0) return normalizeScreenshot(val);
  }
  return undefined;
}

function extractUrl(output: Record<string, unknown> | undefined, args: Record<string, unknown>): string | undefined {
  if (output?.url && typeof output.url === "string") return output.url;
  if (args?.url && typeof args.url === "string") return args.url;
  return undefined;
}

function extractTitle(output: Record<string, unknown> | undefined): string | undefined {
  if (!output) return undefined;
  if (typeof output.title === "string" && output.title.length > 0) return output.title;
  return undefined;
}

function extractContent(output: Record<string, unknown> | undefined): string | undefined {
  if (!output) return undefined;
  if (typeof output.content === "string" && output.content.length > 0) return output.content;
  if (typeof output.text === "string" && output.text.length > 0) return output.text;
  return undefined;
}

/** Type guard for tool UI parts */
function isToolUIPart(part: unknown): part is { type: string; toolCallId: string; toolName?: string; state: string; input?: unknown; output?: unknown } {
  if (!part || typeof part !== "object") return false;
  const p = part as Record<string, unknown>;
  return typeof p.type === "string" && p.type.startsWith("tool-") && typeof p.toolCallId === "string";
}

function getToolName(part: { type: string; toolName?: string }): string {
  return part.toolName || part.type.slice(5) || "unknown";
}

export function useSSEToEntities(
  messages: UIMessage[],
  sessionId: string,
  isStreaming: boolean,
) {
  const dispatch = useAppDispatch();

  // Track processed `toolCallId:state` pairs to avoid redundant dispatches
  const processedRef = useRef(new Set<string>());
  // Track last dispatched sidebar type to avoid redundant dispatches
  const lastSidebarTypeRef = useRef<string | null>(null);
  // Track metadata already dispatched to session
  const processedMetaRef = useRef<string>("");

  useEffect(() => {
    let latestViewType: string | null = null;

    for (const msg of messages) {
      // Extract metadata (sandboxId, nekoUrl, streamUrl) from message metadata
      const meta = msg.metadata as Record<string, unknown> | undefined;
      if (meta) {
        const metaKey = `${meta.sandboxId ?? ""}:${meta.nekoUrl ?? ""}:${meta.streamUrl ?? meta.vncUrl ?? ""}`;
        if (metaKey !== processedMetaRef.current && metaKey !== "::") {
          processedMetaRef.current = metaKey;
          const updates: Record<string, unknown> = {};
          if (typeof meta.sandboxId === "string" && meta.sandboxId) updates.sandboxId = meta.sandboxId;
          if (typeof meta.nekoUrl === "string" && meta.nekoUrl) updates.nekoUrl = meta.nekoUrl;
          if (typeof meta.streamUrl === "string" && meta.streamUrl) updates.streamUrl = meta.streamUrl;
          else if (typeof meta.vncUrl === "string" && meta.vncUrl) updates.streamUrl = meta.vncUrl;
          if (Object.keys(updates).length > 0) {
            dispatch(updateSession({ id: sessionId, updates: { metadata: updates } }));
          }
        }
      }

      if (msg.role !== "assistant" || !msg.parts) continue;

      for (const part of msg.parts) {
        if (!isToolUIPart(part)) continue;

        const toolName = getToolName(part);
        const viewType = TOOL_VIEW_MAP[toolName];
        if (!viewType) continue; // Skip tools that don't map to canvas

        const key = `${part.toolCallId}:${part.state}`;
        if (processedRef.current.has(key)) continue;
        processedRef.current.add(key);

        const args = (part.input ?? {}) as Record<string, unknown>;
        const output = part.output as Record<string, unknown> | undefined;

        // Map AI SDK states to our entity states
        let entityState: ToolEventEntity["state"];
        switch (part.state) {
          case "input-streaming":
            entityState = "pending";
            break;
          case "input-available":
          case "approval-responded":
            entityState = "running";
            break;
          case "output-available":
            entityState = "complete";
            break;
          case "error":
            entityState = "error";
            break;
          default:
            entityState = "running";
        }

        const entity: ToolEventEntity = {
          id: part.toolCallId,
          sessionId,
          timestamp: Date.now(),
          toolName,
          state: entityState,
          input: args,
          output,
          screenshot: output ? extractScreenshot(output) : undefined,
          url: extractUrl(output, args),
          title: extractTitle(output),
          content: extractContent(output),
        };

        dispatch(upsertToolEvent(entity));
        latestViewType = viewType;
      }
    }

    // Auto-set agentWorkspace.sidebarType based on latest tool (Manus parity)
    if (latestViewType && isStreaming) {
      const sidebarType = VIEW_TO_SIDEBAR[latestViewType] ?? null;
      if (sidebarType && sidebarType !== lastSidebarTypeRef.current) {
        lastSidebarTypeRef.current = sidebarType;
        dispatch(setWorkspaceSidebarType(sidebarType));
      }
    }

    // When streaming ends, clear sidebar type (agent is done)
    if (!isStreaming && lastSidebarTypeRef.current) {
      lastSidebarTypeRef.current = null;
      // Don't clear — keep the last view visible until user navigates away
    }
  }, [messages, sessionId, isStreaming, dispatch]);

  // Clear processed set when session changes
  const prevSessionRef = useRef(sessionId);
  useEffect(() => {
    if (prevSessionRef.current !== sessionId) {
      processedRef.current.clear();
      processedMetaRef.current = "";
      lastSidebarTypeRef.current = null;
      prevSessionRef.current = sessionId;
    }
  }, [sessionId]);
}
