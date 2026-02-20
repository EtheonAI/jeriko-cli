"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { UIMessage } from "ai";
import type { AppDispatch } from "@/lib/store";
import { useAppDispatch } from "@/lib/store/hooks";
import { upsertToolEvent, clearLiveTerminalChunks } from "@/lib/store/slices/websocket.slice";
import type { ToolEventEntity } from "@/lib/store/slices/websocket.slice";
import { setWorkspaceSidebarType } from "@/lib/store/slices/agentWorkspace.slice";
import type { WorkspaceSidebarType } from "@/lib/store/slices/agentWorkspace.slice";
import { updateSession } from "@/lib/store/slices/sessions.slice";
// Timeline slice — Manus parity: event-based session history
import {
  addSegmentEvent,
  setTimelineSessionId,
  resetTimeline,
} from "@/lib/store/slices/timeline.slice";
import type { TimelineEvent, TimelineEventType } from "@/lib/store/slices/timeline.slice";
// ToolCalls slice — Manus parity: tool execution lifecycle tracking
import {
  startToolCall,
  completeToolCall,
  failToolCall,
  cancelToolCall,
  clearSessionToolCalls,
} from "@/lib/store/slices/toolCalls.slice";
// CodeViewer slice — Manus parity: file tree + tabs from file tool output
import {
  openFileTab,
  setFileContent,
  setDirectoryList,
  resetCodeViewer,
} from "@/lib/store/slices/codeViewer.slice";
import type { DirectoryEntry, CodeViewerTab } from "@/lib/store/slices/codeViewer.slice";
// WebDev slice — Manus parity: webdev IDE project state
import {
  setProject,
  updateProject,
  setActiveTab as setWebDevActiveTab,
  resetWebDev,
} from "@/lib/store/slices/webDev.slice";
import type { WebDevProject } from "@/lib/store/slices/webDev.slice";
// SlideEditor slice — Manus parity: slide presentation state
import {
  setSlides,
  setIsPresentationMode,
  resetSlideEditor,
} from "@/lib/store/slices/slideEditor.slice";
import type { Slide } from "@/lib/store/slices/slideEditor.slice";
// MapReduce slice — Manus parity: parallel task tracking
import {
  startTask as startMapReduceTask,
  updateProgress as updateMapReduceProgress,
  completeTask as completeMapReduceTask,
  failTask as failMapReduceTask,
  resetMapReduce,
} from "@/lib/store/slices/mapReduce.slice";
// AI Canvas slice — image generation shapes
import {
  addShape as addCanvasShape,
  updateShape as updateCanvasShape,
  resetAICanvas,
} from "@/lib/store/slices/aiCanvas.slice";
import type { CanvasShape } from "@/lib/store/slices/aiCanvas.slice";
// WebDev Auth slice — secret injection from webdev tools
import {
  setEnvVars as setWebDevEnvVars,
} from "@/lib/store/slices/webdevAuth.slice";

/**
 * Manus-parity SSE → Redux Bridge
 *
 * This hook is THE central bridge between AI SDK SSE events and the Redux store.
 * It normalizes AI SDK tool parts and dispatches to ALL Manus-aligned slices:
 *
 *   1. websocket.toolEvents    — Normalized tool entities for canvas selectors
 *   2. agentWorkspace           — Sidebar type, workspace layout
 *   3. sessions                 — Metadata (sandboxId, nekoUrl, streamUrl)
 *   4. timeline                 — Event-based session history (messages + tools)
 *   5. toolCalls                — Tool execution lifecycle (start/complete/fail)
 *   6. codeViewer               — File tree + tabs from file tool output
 *   7. webDev                   — WebDev IDE project state from webdev_* tools
 *   8. slideEditor              — Slide presentation state from slide_present tool
 *   9. mapReduce                — Parallel task tracking from message metadata
 *  10. aiCanvas                 — Image shapes from generate_image / image_rmbg tools
 *  11. webdevAuth               — Env vars / secrets from webdev_request_secrets tool
 *
 * CRITICAL: This hook ONLY dispatches — it does NOT read from Redux via
 * useAppSelector. This prevents infinite re-render loops during streaming.
 *
 * CRITICAL: Uses useLayoutEffect for initial message processing (page refresh)
 * so entities are in Redux BEFORE the browser paints.
 */

// ============================================================================
// Constants
// ============================================================================

// Tool name → view type (inline to avoid cross-package import)
// Single source of truth — imported from packages/ai via canvas.selectors re-export
import { TOOL_VIEW_MAP } from "@/lib/store/selectors/canvas.selectors";

const SEARCH_TOOLS_SET = new Set(["info_search_web", "web_search", "search_web"]);

// File tools that should populate codeViewer slice
const FILE_TOOLS_SET = new Set(["file_read", "file_write", "file_str_replace", "text_editor"]);
const FILE_FIND_TOOLS_SET = new Set(["file_find_by_name", "file_find_in_content"]);

// WebDev tools that should populate webDev slice
const WEBDEV_TOOLS_SET = new Set([
  "webdev_init_project", "webdev_save_checkpoint", "webdev_check_status",
  "webdev_restart_server", "webdev_rollback_checkpoint", "webdev_execute_sql",
  "webdev_push_schema", "webdev_list_versions", "webdev_add_feature",
]);

// Deploy tools that may return a published URL
const DEPLOY_TOOLS_SET = new Set(["deploy_apply_deployment", "deploy_expose_port"]);

// Slide tools that should populate slideEditor slice (ALL 4 slide tools, not just present)
const SLIDE_TOOLS_SET = new Set(["slide_present", "slide_init", "slide_modify", "slide_add_notes"]);

// Tool name → timeline event type (Manus parity)
const TOOL_TO_TIMELINE_TYPE: Record<string, TimelineEventType> = {
  browser_navigate: "browser_navigate",
  browser_click: "browser_click",
  browser_input: "browser_input",
  browser_view: "browser_navigate",
  browser_scroll: "browser_navigate",
  browser_scroll_up: "browser_navigate",
  browser_scroll_down: "browser_navigate",
  browser_move_mouse: "browser_navigate",
  browser_key_press: "browser_input",
  browser_press_key: "browser_input",
  browser_select_option: "browser_click",
  browser_console_exec: "shell_exec",
  browser_console_view: "browser_navigate",
  browser_screenshot: "browser_navigate",
  browser_restart: "browser_navigate",
  browser_save_image: "file_create",
  browser_upload_file: "browser_click",
  browser_fill_form: "browser_input",
  browser_find_keyword: "browser_navigate",
  browser_close: "browser_navigate",
  shell_exec: "shell_exec",
  shell_view: "shell_exec",
  shell_wait: "shell_exec",
  shell_write_to_process: "shell_exec",
  shell_kill_process: "shell_exec",
  code_execute: "shell_exec",
  file_read: "file_edit",
  file_write: "file_create",
  file_str_replace: "file_edit",
  file_find_in_content: "file_edit",
  file_find_by_name: "file_edit",
  file_view: "file_edit",
  text_editor: "file_edit",
  info_search_web: "browser_navigate",
  web_search: "browser_navigate",
  search_web: "browser_navigate",
  deploy_expose_port: "deploy",
  deploy_apply_deployment: "deploy",
  make_manus_page: "deploy",
  slide_present: "deploy",
  webdev_init_project: "file_create",
  webdev_save_checkpoint: "file_create",
  webdev_check_status: "status_change",
  webdev_restart_server: "shell_exec",
  webdev_rollback_checkpoint: "file_edit",
  webdev_execute_sql: "shell_exec",
  webdev_push_schema: "file_create",
  webdev_list_versions: "status_change",
  webdev_add_feature: "file_create",
  generate_image: "file_create",
  image_rmbg: "file_edit",
  image_search_upload: "browser_navigate",
  slide_init: "file_create",
  slide_modify: "file_edit",
  slide_add_notes: "file_edit",
  parallel_tasks: "tool_call",
};

// Parallel tasks tool that populates mapReduce slice from tool output
const PARALLEL_TASKS_SET = new Set(["parallel_tasks"]);

// AI Canvas tools that populate aiCanvas slice with image shapes
const AI_CANVAS_IMAGE_TOOLS_SET = new Set(["generate_image", "image_rmbg"]);

// WebDev Auth tools that inject secrets/env vars
const WEBDEV_AUTH_TOOLS_SET = new Set(["webdev_request_secrets"]);

// View type → agentWorkspace.sidebarType (Manus parity)
const VIEW_TO_SIDEBAR: Record<string, WorkspaceSidebarType> = {
  browser: "browser",
  terminal: "computer",
  editor: "files",
  webDevIDE: "webdev",
  slides: "browser",
  aiCanvas: "browser",
  mapReduce: "computer",
};

// ============================================================================
// Extraction Helpers
// ============================================================================

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

function extractUrl(output: Record<string, unknown> | undefined, args: Record<string, unknown>, toolName: string): string | undefined {
  if (SEARCH_TOOLS_SET.has(toolName)) {
    const query = (args.query as string) ?? (args.search_query as string) ?? "";
    if (query) return `search://${query}`;
  }
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

/** Extract file path from tool input args */
function extractFilePath(args: Record<string, unknown>): string | undefined {
  if (typeof args.path === "string") return args.path;
  if (typeof args.file_path === "string") return args.file_path;
  if (typeof args.file === "string") return args.file;
  return undefined;
}

/** Extract file content from tool output */
function extractFileContent(output: Record<string, unknown> | undefined): string | undefined {
  if (!output) return undefined;
  if (typeof output.content === "string") return output.content;
  if (typeof output.text === "string") return output.text;
  if (typeof output.result === "string") return output.result;
  return undefined;
}

/** Derive language from file extension */
function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", rs: "rust", go: "go", java: "java", rb: "ruby",
    css: "css", html: "html", json: "json", yaml: "yaml", yml: "yaml",
    md: "markdown", sql: "sql", sh: "bash", bash: "bash", zsh: "bash",
    xml: "xml", svg: "xml", toml: "toml", ini: "ini", env: "plaintext",
  };
  return map[ext] ?? "plaintext";
}

/** Build a human-readable title for a timeline event */
function buildTimelineTitle(toolName: string, args: Record<string, unknown>): string {
  const path = extractFilePath(args);
  const url = typeof args.url === "string" ? args.url : undefined;
  const command = typeof args.command === "string" ? args.command : undefined;
  const query = typeof args.query === "string" ? args.query : (typeof args.search_query === "string" ? args.search_query : undefined);

  switch (toolName) {
    case "browser_navigate": return url ? `Navigate to ${url}` : "Browser navigate";
    case "browser_click": return `Click ${typeof args.element === "string" ? args.element : "element"}`;
    case "browser_input": return `Type "${typeof args.text === "string" ? args.text.slice(0, 50) : "..."}"`;
    case "browser_view": return "View page";
    case "browser_screenshot": return "Take screenshot";
    case "browser_save_image": return path ? `Save image to ${path}` : "Save image";
    case "browser_upload_file": return "Upload file";
    case "browser_fill_form": return "Fill form";
    case "browser_find_keyword": return `Find "${typeof args.keyword === "string" ? args.keyword.slice(0, 50) : "..."}"`;
    case "browser_close": return "Close browser";
    case "shell_exec": return command ? `Run: ${command.slice(0, 60)}` : "Execute command";
    case "shell_view": return "View terminal";
    case "file_read": return path ? `Read ${path}` : "Read file";
    case "file_write": return path ? `Write ${path}` : "Write file";
    case "file_str_replace": return path ? `Edit ${path}` : "Edit file";
    case "file_find_by_name": return `Find files: ${typeof args.pattern === "string" ? args.pattern : "..."}`;
    case "file_find_in_content": return `Search: ${typeof args.pattern === "string" ? args.pattern : "..."}`;
    case "text_editor": return path ? `Edit ${path}` : "Edit file";
    case "code_execute": return command ? `Execute: ${command.slice(0, 60)}` : "Execute code";
    case "info_search_web":
    case "web_search":
    case "search_web": return query ? `Search: ${query.slice(0, 60)}` : "Web search";
    case "deploy_expose_port": return `Expose port ${args.port ?? ""}`;
    case "deploy_apply_deployment": return "Deploy application";
    case "generate_image": return `Generate image: ${typeof args.prompt === "string" ? args.prompt.slice(0, 50) : "..."}`;
    case "image_rmbg": return "Remove image background";
    case "image_search_upload": return "Reverse image search";
    case "slide_init": return `Create presentation: ${typeof args.title === "string" ? args.title : "..."}`;
    case "slide_modify": return "Modify slide";
    case "slide_add_notes": return "Add speaker notes";
    case "parallel_tasks": return `Parallel: ${typeof args.description === "string" ? args.description.slice(0, 50) : "run subtasks"}`;
    default: return toolName.replace(/_/g, " ");
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/** Type guard for tool UI parts */
function isToolUIPart(part: unknown): part is { type: string; toolCallId: string; toolName?: string; state: string; input?: unknown; output?: unknown } {
  if (!part || typeof part !== "object") return false;
  const p = part as Record<string, unknown>;
  return typeof p.type === "string" && p.type.startsWith("tool-") && typeof p.toolCallId === "string";
}

function getToolName(part: { type: string; toolName?: string }): string {
  return part.toolName || part.type.slice(5) || "unknown";
}

// ============================================================================
// Core Processing
// ============================================================================

/**
 * Core message processing — extracted so it can be called from both
 * useLayoutEffect (initial sync, before paint) and useEffect (streaming updates).
 *
 * Dispatches to ALL 9 Manus-aligned slices:
 * - websocket.toolEvents (canvas entities)
 * - timeline (event history)
 * - toolCalls (lifecycle tracking)
 * - codeViewer (file tree + tabs)
 * - agentWorkspace (sidebar type)
 * - sessions (metadata)
 * - webDev (IDE project state)
 * - slideEditor (presentation state)
 * - mapReduce (parallel task tracking, from metadata)
 */
function processMessages(
  messages: UIMessage[],
  sessionId: string,
  isStreaming: boolean,
  dispatch: AppDispatch,
  processedRef: React.MutableRefObject<Set<string>>,
  processedMetaRef: React.MutableRefObject<string>,
  lastSidebarTypeRef: React.MutableRefObject<string | null>,
  processedTimelineRef: React.MutableRefObject<Set<string>>,
  processedToolCallsRef: React.MutableRefObject<Set<string>>,
  processedCodeViewerRef: React.MutableRefObject<Set<string>>,
  processedWebDevRef: React.MutableRefObject<Set<string>>,
  processedSlideRef: React.MutableRefObject<Set<string>>,
  processedMapReduceRef: React.MutableRefObject<string>,
  processedAICanvasRef: React.MutableRefObject<Set<string>>,
  processedWebDevAuthRef: React.MutableRefObject<Set<string>>,
) {
  let latestViewType: string | null = null;

  for (const msg of messages) {
    // ── Session metadata (sandboxId, nekoUrl, streamUrl) ──
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

      // ── 9. mapReduce (parallel task tracking from metadata) ──
      const mr = meta.mapReduce as Record<string, unknown> | undefined;
      if (mr && typeof mr.action === "string") {
        const mrKey = `${msg.id}:${mr.action}:${mr.taskId ?? ""}`;
        if (mrKey !== processedMapReduceRef.current) {
          processedMapReduceRef.current = mrKey;
          switch (mr.action) {
            case "start":
              dispatch(startMapReduceTask({
                id: typeof mr.taskId === "string" ? mr.taskId : msg.id,
                name: typeof mr.name === "string" ? mr.name : "Parallel task",
                totalItems: typeof mr.totalItems === "number" ? mr.totalItems : 0,
              }));
              break;
            case "progress":
              dispatch(updateMapReduceProgress({
                processedItems: typeof mr.processedItems === "number" ? mr.processedItems : 0,
                progress: typeof mr.progress === "number" ? mr.progress : 0,
              }));
              break;
            case "complete":
              dispatch(completeMapReduceTask());
              break;
            case "fail":
              dispatch(failMapReduceTask(
                typeof mr.error === "string" ? mr.error : "Parallel task failed",
              ));
              break;
          }
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
      const isInputStreaming = part.state === "input-streaming";
      // During input-streaming, content grows each delta — always re-dispatch.
      // For all other states, dedup normally.
      if (!isInputStreaming && processedRef.current.has(key)) continue;
      if (!isInputStreaming) processedRef.current.add(key);

      const args = (part.input ?? {}) as Record<string, unknown>;
      const output = part.output as Record<string, unknown> | undefined;

      // ── Map AI SDK states to entity states ──
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
        case "output-error":
          entityState = "error";
          break;
        default:
          entityState = "running";
      }

      // ── 1. websocket.toolEvents (canvas) ──
      const entity: ToolEventEntity = {
        id: part.toolCallId,
        sessionId,
        timestamp: Date.now(),
        toolName,
        state: entityState,
        input: args,
        output,
        screenshot: output ? extractScreenshot(output) : undefined,
        url: extractUrl(output, args, toolName),
        title: extractTitle(output),
        content: extractContent(output),
      };
      dispatch(upsertToolEvent(entity));
      latestViewType = viewType;

      // ── 2. timeline.addSegmentEvent (event history) ──
      const timelineKey = `${part.toolCallId}:${part.state}`;
      if (!isInputStreaming && !processedTimelineRef.current.has(timelineKey)) {
        processedTimelineRef.current.add(timelineKey);
        const eventType = TOOL_TO_TIMELINE_TYPE[toolName] ?? "tool_call";
        const timelineEvent: TimelineEvent = {
          id: `${part.toolCallId}-${part.state}`,
          sessionId,
          segmentId: sessionId, // One segment per session (flat timeline)
          type: eventType,
          title: buildTimelineTitle(toolName, args),
          description: entityState === "error" ? (typeof output?.error === "string" ? output.error : "Tool failed") : undefined,
          data: { toolName, toolCallId: part.toolCallId, state: entityState },
          timestamp: new Date().toISOString(),
          durationMs: undefined,
        };
        dispatch(addSegmentEvent({ segmentId: sessionId, event: timelineEvent }));
      }

      // ── 3. toolCalls lifecycle (start/complete/fail) ──
      const toolCallKey = `${part.toolCallId}:${part.state}`;
      if (!processedToolCallsRef.current.has(toolCallKey)) {
        processedToolCallsRef.current.add(toolCallKey);

        switch (part.state) {
          case "input-available":
          case "input-streaming":
            // Start tool call (only on first transition, dedup handles rest)
            if (!processedToolCallsRef.current.has(`${part.toolCallId}:started`)) {
              processedToolCallsRef.current.add(`${part.toolCallId}:started`);
              dispatch(startToolCall({
                correlationId: part.toolCallId,
                toolName,
                sessionId,
                input: args,
              }));
            }
            break;
          case "output-available":
            dispatch(completeToolCall({
              correlationId: part.toolCallId,
              output: output ?? {},
            }));
            break;
          case "output-error":
            dispatch(failToolCall({
              correlationId: part.toolCallId,
              error: typeof output?.error === "string" ? output.error : "Tool execution failed",
            }));
            break;
        }
      }

      // ── 3b. Clear live terminal chunks when shell tool completes ──
      // The orchestrator emits sandbox.terminal.chunk WebSocket events during execution.
      // When the tool finishes, clear the accumulated live chunks so the selector
      // uses the final tool output instead.
      if (
        (part.state === "output-available" || part.state === "output-error") &&
        (toolName === "shell_exec" || toolName === "shell_view" || toolName === "shell_wait" ||
         toolName === "shell_write_to_process" || toolName === "shell_kill_process" || toolName === "code_execute")
      ) {
        const terminalId = (args.id as string) || (args.session as string) || "default";
        dispatch(clearLiveTerminalChunks({ sessionId, terminalId }));
      }

      // ── 4. codeViewer (file tree + tabs) ──
      if (part.state === "output-available" && output) {
        const filePath = extractFilePath(args);

        // File read/write/edit → populate file content + open tab
        if (FILE_TOOLS_SET.has(toolName) && filePath) {
          const codeViewerKey = `${part.toolCallId}:cv`;
          if (!processedCodeViewerRef.current.has(codeViewerKey)) {
            processedCodeViewerRef.current.add(codeViewerKey);

            // For file_write/create, content is in INPUT (not output).
            // file_write output only has {status, file, bytesWritten}.
            // For file_read, content is in OUTPUT. For text_editor, varies by command.
            let fileContent = extractFileContent(output);
            if (
              fileContent === undefined &&
              (toolName === "file_write" || (toolName === "text_editor" && (args.command === "create" || args.command === "insert")))
            ) {
              fileContent = typeof args.content === "string" ? args.content
                : typeof args.file_text === "string" ? args.file_text
                : undefined;
            }
            const fileName = filePath.split("/").pop() ?? filePath;
            const language = getLanguageFromPath(filePath);

            // Set file content in codeViewer store
            if (fileContent !== undefined) {
              dispatch(setFileContent({ path: filePath, content: fileContent }));
            }

            // Open file tab
            const tab: CodeViewerTab = {
              id: filePath,
              path: filePath,
              name: fileName,
              language,
              isModified: toolName === "file_write" || toolName === "file_str_replace",
            };
            dispatch(openFileTab(tab));
          }
        }

        // file_find_by_name → populate directory tree
        if (FILE_FIND_TOOLS_SET.has(toolName)) {
          const codeViewerKey = `${part.toolCallId}:dir`;
          if (!processedCodeViewerRef.current.has(codeViewerKey)) {
            processedCodeViewerRef.current.add(codeViewerKey);

            // Extract file list from output (varies by format)
            const files = output.files ?? output.matches ?? output.results;
            if (Array.isArray(files)) {
              const entries: DirectoryEntry[] = files
                .filter((f: unknown): f is Record<string, unknown> => typeof f === "object" && f !== null)
                .map((f) => ({
                  name: typeof f.name === "string" ? f.name : (typeof f.path === "string" ? f.path.split("/").pop() ?? "" : ""),
                  path: typeof f.path === "string" ? f.path : "",
                  type: (f.type === "directory" ? "directory" : "file") as "file" | "directory",
                  size: typeof f.size === "number" ? f.size : undefined,
                }));
              if (entries.length > 0) {
                dispatch(setDirectoryList(entries));
              }
            }
          }
        }

        // ── 7. webDev (WebDev IDE project state) ──
        if (WEBDEV_TOOLS_SET.has(toolName)) {
          const webDevKey = `${part.toolCallId}:wd`;
          if (!processedWebDevRef.current.has(webDevKey)) {
            processedWebDevRef.current.add(webDevKey);

            if (toolName === "webdev_init_project") {
              // Init creates a new project — set full project state
              const project: WebDevProject = {
                id: typeof output.projectId === "string" ? output.projectId : part.toolCallId,
                name: typeof output.name === "string" ? output.name
                  : typeof output.app_name === "string" ? output.app_name
                  : typeof args.app_name === "string" ? args.app_name
                  : "Untitled",
                description: typeof output.description === "string" ? output.description : undefined,
                url: typeof output.url === "string" ? output.url : undefined,
                previewUrl: typeof output.previewUrl === "string" ? output.previewUrl
                  : typeof output.devServerUrl === "string" ? output.devServerUrl : undefined,
                projectPath: typeof output.directory === "string" ? output.directory
                  : typeof output.projectPath === "string" ? output.projectPath : undefined,
                status: "deployed",
                framework: typeof output.framework === "string" ? output.framework : (typeof args.framework === "string" ? args.framework : undefined),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              dispatch(setProject(project));
            } else if (toolName === "webdev_check_status") {
              // Status check → update project status + URLs
              const status = typeof output.status === "string" ? output.status as WebDevProject["status"] : undefined;
              const updates: Partial<WebDevProject> = { updatedAt: new Date().toISOString() };
              if (status) updates.status = status;
              if (typeof output.url === "string") updates.url = output.url;
              if (typeof output.previewUrl === "string") updates.previewUrl = output.previewUrl;
              else if (typeof output.devServerUrl === "string") updates.previewUrl = output.devServerUrl;
              else if (typeof (output.devServer as Record<string, unknown>)?.url === "string") {
                updates.previewUrl = (output.devServer as Record<string, unknown>).url as string;
              }
              if (typeof output.projectPath === "string") updates.projectPath = output.projectPath;
              dispatch(updateProject(updates));
            } else if (toolName === "webdev_restart_server") {
              dispatch(updateProject({ status: "building", updatedAt: new Date().toISOString() }));
            } else if (toolName === "webdev_execute_sql") {
              // SQL execution → switch to database tab
              dispatch(setWebDevActiveTab("database"));
            } else if (toolName === "webdev_push_schema") {
              dispatch(setWebDevActiveTab("database"));
              dispatch(updateProject({ updatedAt: new Date().toISOString() }));
            } else {
              // save_checkpoint, rollback_checkpoint, list_versions, add_feature
              dispatch(updateProject({ updatedAt: new Date().toISOString() }));
            }
          }
        }

        // ── 7b. Deploy tools — capture published URL for preview persistence ──
        if (DEPLOY_TOOLS_SET.has(toolName)) {
          const deployUrl = typeof output.url === "string" ? output.url
            : typeof output.deployedUrl === "string" ? output.deployedUrl
            : typeof output.s3Url === "string" ? output.s3Url
            : undefined;
          if (deployUrl) {
            dispatch(updateProject({ previewUrl: deployUrl, updatedAt: new Date().toISOString() }));
          }
        }

        // ── 8. slideEditor (slide presentation + authoring state) ──
        if (SLIDE_TOOLS_SET.has(toolName)) {
          const slideKey = `${part.toolCallId}:sl`;
          if (!processedSlideRef.current.has(slideKey)) {
            processedSlideRef.current.add(slideKey);

            // slide_present → enter presentation mode
            if (toolName === "slide_present") {
              dispatch(setIsPresentationMode(true));
            }

            // Extract slides from output if available (slide_init, slide_present return slides)
            const rawSlides = output.slides;
            if (Array.isArray(rawSlides) && rawSlides.length > 0) {
              const slides: Slide[] = rawSlides
                .filter((s: unknown): s is Record<string, unknown> => typeof s === "object" && s !== null)
                .map((s, index) => ({
                  id: typeof s.id === "string" ? s.id : `slide-${index}`,
                  index,
                  elements: Array.isArray(s.elements) ? s.elements : [],
                  background: s.background as Slide["background"],
                  notes: typeof s.notes === "string" ? s.notes : undefined,
                  thumbnail: typeof s.thumbnail === "string" ? s.thumbnail : undefined,
                }));
              dispatch(setSlides(slides));
            }

            // slide_modify → update individual slide (output may have updated slide)
            if (toolName === "slide_modify" && output.slide && typeof output.slide === "object") {
              const s = output.slide as Record<string, unknown>;
              const updatedSlide: Slide = {
                id: typeof s.id === "string" ? s.id : `slide-${typeof s.index === "number" ? s.index : 0}`,
                index: typeof s.index === "number" ? s.index : 0,
                elements: Array.isArray(s.elements) ? s.elements : [],
                background: s.background as Slide["background"],
                notes: typeof s.notes === "string" ? s.notes : undefined,
                thumbnail: typeof s.thumbnail === "string" ? s.thumbnail : undefined,
              };
              // Dispatch single slide update as a full slides set (with the updated one merged)
              dispatch(setSlides([updatedSlide]));
            }
          }
        }

        // ── 10. parallel_tasks → mapReduce (from tool output, not just metadata) ──
        if (PARALLEL_TASKS_SET.has(toolName)) {
          const ptKey = `${part.toolCallId}:pt`;
          if (!processedMapReduceRef.current.includes(ptKey)) {
            processedMapReduceRef.current = ptKey;

            // Extract subtask data from parallel_tasks output
            const subtasks = output.subtasks ?? output.tasks ?? output.results;
            const totalItems = typeof output.total === "number" ? output.total : (Array.isArray(subtasks) ? subtasks.length : 0);

            if (entityState === "running" || entityState === "pending") {
              dispatch(startMapReduceTask({
                id: part.toolCallId,
                name: typeof args.description === "string" ? args.description : "Parallel tasks",
                totalItems,
              }));
            } else if (entityState === "complete") {
              // If we haven't started yet, start then complete
              dispatch(startMapReduceTask({
                id: part.toolCallId,
                name: typeof args.description === "string" ? args.description : "Parallel tasks",
                totalItems,
              }));
              dispatch(updateMapReduceProgress({
                processedItems: totalItems,
                progress: 100,
              }));
              dispatch(completeMapReduceTask());
            } else if (entityState === "error") {
              dispatch(failMapReduceTask(
                typeof output?.error === "string" ? output.error : "Parallel tasks failed",
              ));
            }
          }
        }

        // ── 11. AI Canvas (generate_image → addShape, image_rmbg → updateShape) ──
        if (AI_CANVAS_IMAGE_TOOLS_SET.has(toolName)) {
          const acKey = `${part.toolCallId}:ac`;
          if (!processedAICanvasRef.current.has(acKey)) {
            processedAICanvasRef.current.add(acKey);

            if (toolName === "generate_image") {
              // Extract image URL from output
              const imageUrl = typeof output.url === "string" ? output.url
                : typeof output.image_url === "string" ? output.image_url
                : typeof output.imageUrl === "string" ? output.imageUrl
                : extractScreenshot(output);

              if (imageUrl) {
                const shapeId = `img-${part.toolCallId}`;
                const shape: CanvasShape = {
                  id: shapeId,
                  type: "image",
                  x: 100,
                  y: 100,
                  width: 512,
                  height: 512,
                  rotation: 0,
                  imageUrl,
                  style: { opacity: 1 },
                  locked: false,
                  visible: true,
                  zIndex: Object.keys(output).length,
                };
                dispatch(addCanvasShape(shape));
              }
            } else if (toolName === "image_rmbg") {
              // Update existing image shape with background-removed URL
              const newUrl = typeof output.url === "string" ? output.url
                : typeof output.image_url === "string" ? output.image_url
                : typeof output.imageUrl === "string" ? output.imageUrl
                : undefined;
              const targetId = typeof args.image_id === "string" ? args.image_id
                : typeof args.imageId === "string" ? args.imageId
                : undefined;

              if (newUrl && targetId) {
                dispatch(updateCanvasShape({ id: targetId, updates: { imageUrl: newUrl } }));
              }
            }
          }
        }

        // ── 12. WebDev Auth (webdev_request_secrets → setEnvVars) ──
        if (WEBDEV_AUTH_TOOLS_SET.has(toolName)) {
          const waKey = `${part.toolCallId}:wa`;
          if (!processedWebDevAuthRef.current.has(waKey)) {
            processedWebDevAuthRef.current.add(waKey);

            // Extract env vars / secrets from tool output
            const envVars = output.env_vars ?? output.envVars ?? output.secrets ?? output.variables;
            const projectId = typeof output.project_id === "string" ? output.project_id
              : typeof output.projectId === "string" ? output.projectId
              : typeof args.project_id === "string" ? args.project_id
              : typeof args.projectId === "string" ? args.projectId
              : sessionId; // fallback to session

            if (envVars && typeof envVars === "object" && !Array.isArray(envVars)) {
              dispatch(setWebDevEnvVars({
                projectId,
                vars: envVars as Record<string, string>,
              }));
            }
          }
        }
      }
    }
  }

  // ── 5. agentWorkspace.sidebarType (auto-set based on latest tool) ──
  if (latestViewType && isStreaming) {
    const sidebarType = VIEW_TO_SIDEBAR[latestViewType] ?? null;
    if (sidebarType && sidebarType !== lastSidebarTypeRef.current) {
      lastSidebarTypeRef.current = sidebarType;
      dispatch(setWorkspaceSidebarType(sidebarType));
    }
  }

  // When streaming ends, clear sidebar type tracking (agent is done)
  if (!isStreaming && lastSidebarTypeRef.current) {
    lastSidebarTypeRef.current = null;
  }
}

// ============================================================================
// Hook
// ============================================================================

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
  // Track if initial sync has been done
  const initialSyncDoneRef = useRef(false);
  // Skip the first useEffect when useLayoutEffect already handled it
  const skipFirstEffectRef = useRef(false);

  // Dedup refs for additional slices
  const processedTimelineRef = useRef(new Set<string>());
  const processedToolCallsRef = useRef(new Set<string>());
  const processedCodeViewerRef = useRef(new Set<string>());
  const processedWebDevRef = useRef(new Set<string>());
  const processedSlideRef = useRef(new Set<string>());
  const processedMapReduceRef = useRef<string>("");
  const processedAICanvasRef = useRef(new Set<string>());
  const processedWebDevAuthRef = useRef(new Set<string>());

  // Set timeline session ID when session changes
  useEffect(() => {
    dispatch(setTimelineSessionId(sessionId));
  }, [sessionId, dispatch]);

  // INITIAL SYNC: Process messages synchronously before paint (useLayoutEffect).
  // On page refresh, DB messages contain tool parts with full output (screenshots,
  // search results). This must run before the browser paints so useCanvasFromEntities
  // reads populated Redux state — otherwise the canvas flashes "Waiting for computer".
  useLayoutEffect(() => {
    if (initialSyncDoneRef.current) return;
    initialSyncDoneRef.current = true;
    if (messages.length > 0) {
      processMessages(
        messages, sessionId, isStreaming, dispatch,
        processedRef, processedMetaRef, lastSidebarTypeRef,
        processedTimelineRef, processedToolCallsRef, processedCodeViewerRef,
        processedWebDevRef, processedSlideRef, processedMapReduceRef,
        processedAICanvasRef, processedWebDevAuthRef,
      );
      skipFirstEffectRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps — runs once on mount before first paint

  // STREAMING: Process messages on every update (useEffect — async, non-blocking).
  // Deduplication via processedRef ensures entities from the initial sync aren't re-dispatched.
  // On mount, useLayoutEffect already processed — skip to avoid double dispatch for input-streaming.
  useEffect(() => {
    if (skipFirstEffectRef.current) {
      skipFirstEffectRef.current = false;
      return;
    }
    processMessages(
      messages, sessionId, isStreaming, dispatch,
      processedRef, processedMetaRef, lastSidebarTypeRef,
      processedTimelineRef, processedToolCallsRef, processedCodeViewerRef,
      processedWebDevRef, processedSlideRef, processedMapReduceRef,
      processedAICanvasRef, processedWebDevAuthRef,
    );
  }, [messages, sessionId, isStreaming, dispatch]);

  // Clear ALL tracked state when session changes
  const prevSessionRef = useRef(sessionId);
  useEffect(() => {
    if (prevSessionRef.current !== sessionId) {
      processedRef.current.clear();
      processedMetaRef.current = "";
      lastSidebarTypeRef.current = null;
      initialSyncDoneRef.current = false;
      processedTimelineRef.current.clear();
      processedToolCallsRef.current.clear();
      processedCodeViewerRef.current.clear();
      processedWebDevRef.current.clear();
      processedSlideRef.current.clear();
      processedMapReduceRef.current = "";
      processedAICanvasRef.current.clear();
      processedWebDevAuthRef.current.clear();
      // Clear session-scoped slice data (Manus parity: ALL domain slices reset on session switch)
      dispatch(clearSessionToolCalls(prevSessionRef.current));
      dispatch(resetTimeline());
      dispatch(resetWebDev());
      dispatch(resetSlideEditor());
      dispatch(resetMapReduce());
      dispatch(resetCodeViewer());
      dispatch(resetAICanvas());
      prevSessionRef.current = sessionId;
    }
  }, [sessionId, dispatch]);
}
