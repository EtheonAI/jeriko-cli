"use client";

/**
 * usePlannerState — Derives plan progress from AI SDK v6 UIMessage parts.
 *
 * The plan is a TOOL RESULT. The agent calls `show_plan` (or `showPlan`)
 * to display and update its plan. Each call creates a `tool-show_plan` part
 * in the messages array. This hook finds the latest one.
 *
 * Data sources (checked in priority order):
 *   1. `tool-show_plan` / `tool-showPlan` parts (agent calls showPlan tool)
 *   2. `data-plan` custom parts (alternative explicit plan)
 *   3. Auto-derived from step-start boundaries + tool call parts (fallback)
 *
 * NEW: Each PlanStep now contains a `tools: PlanStepTool[]` array that
 * tracks which tools were used in that step, enabling the planner bar
 * to render clickable tool buttons for canvas view switching.
 *
 * Connected to Vercel AI SDK v6 — reads directly from useChat() messages.
 */

import { useMemo } from "react";
import type {
  UIMessage,
  StaticToolUIPart,
  DynamicToolUIPart,
  ToolInvocationState,
} from "../../lib/types/ui-message";
import {
  isToolUIPart,
  isStepStartUIPart,
  isDataUIPart,
  getToolName,
} from "../../lib/types/ui-message";
import { TOOL_VIEW_MAP, type CanvasViewType } from "../canvas/use-canvas";

// ============================================================================
// Types
// ============================================================================

export interface PlanStepTool {
  toolCallId: string;
  toolName: string;
  canvasView: CanvasViewType;
  isActive: boolean;
  state: ToolInvocationState;
}

export type PlanStepStatus = "pending" | "in_progress" | "completed" | "error";

export interface PlanStep {
  id: string;
  title: string;
  status: PlanStepStatus;
  /** Tools used within this step — enables canvas view switching from the planner */
  tools: PlanStepTool[];
}

export interface PlannerState {
  /** All plan steps */
  steps: PlanStep[];
  /** Index of the currently active step (-1 if none) */
  currentStepIndex: number;
  /** Total number of steps */
  totalSteps: number;
  /** Number of completed steps */
  completedSteps: number;
  /** Completion percentage 0-100 */
  progress: number;
  /** Whether any step is currently in progress */
  isActive: boolean;
  /** Whether there are any steps to show */
  hasSteps: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const EMPTY_STATE: PlannerState = {
  steps: [],
  currentStepIndex: -1,
  totalSteps: 0,
  completedSteps: 0,
  progress: 0,
  isActive: false,
  hasSteps: false,
};

/** Tool names that represent the plan tool (snake_case and camelCase) */
const PLAN_TOOL_NAMES = new Set(["show_plan", "showPlan"]);

// ============================================================================
// Helpers
// ============================================================================

function isToolActive(state: ToolInvocationState): boolean {
  return (
    state === "input-streaming" ||
    state === "input-available" ||
    state === "approval-requested" ||
    state === "approval-responded"
  );
}

function deriveStepStatus(tools: PlanStepTool[]): PlanStepStatus {
  if (tools.length === 0) return "pending";
  if (tools.some((t) => t.state === "output-error")) return "error";
  if (tools.some((t) => t.isActive)) return "in_progress";
  if (
    tools.every(
      (t) => t.state === "output-available" || t.state === "output-denied"
    )
  )
    return "completed";
  return "in_progress";
}

function generateStepTitle(tools: PlanStepTool[]): string {
  if (tools.length === 0) return "Processing";

  const name = tools[0].toolName;

  if (name === "browser_navigate" || name === "browser_restart")
    return "Browsing the web";
  if (name.startsWith("browser_")) return "Interacting with browser";
  if (name === "shell_exec" || name === "code_execute")
    return "Running commands";
  if (name.startsWith("shell_")) return "Using terminal";
  if (
    name === "file_read" ||
    name === "file_find_in_content" ||
    name === "file_find_by_name"
  )
    return "Reading files";
  if (name === "file_write" || name === "file_str_replace")
    return "Writing code";
  if (name.includes("search")) return "Searching the web";
  if (name.startsWith("deploy_")) return "Deploying";
  if (name === "make_manus_page") return "Creating page";

  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapExplicitStatus(status: string): PlanStepStatus {
  switch (status) {
    case "done":
    case "completed":
    case "complete":
      return "completed";
    case "doing":
    case "in_progress":
    case "running":
      return "in_progress";
    case "error":
    case "failed":
      return "error";
    default:
      return "pending";
  }
}

function buildPlannerState(steps: PlanStep[]): PlannerState {
  if (steps.length === 0) return EMPTY_STATE;

  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const currentIndex = steps.findIndex((s) => s.status === "in_progress");
  const progress = (completedSteps / steps.length) * 100;

  return {
    steps,
    currentStepIndex: currentIndex !== -1 ? currentIndex : steps.length - 1,
    totalSteps: steps.length,
    completedSteps,
    progress,
    isActive: steps.some((s) => s.status === "in_progress"),
    hasSteps: true,
  };
}

// ============================================================================
// Plan builders
// ============================================================================

interface RawPlanTodo {
  id?: string;
  label?: string;
  title?: string;
  status?: string;
  toolsUsed?: Array<{ toolCallId?: string; toolName?: string }>;
}

interface RawPlanData {
  title?: string;
  todos?: RawPlanTodo[];
}

/**
 * Build from an explicit plan (from show_plan tool output or data-plan part).
 * Links collected tool calls to plan steps via:
 *   1. Explicit `toolsUsed` array in the plan todo
 *   2. `planStepId` field in the tool's input args
 *   3. Temporal ordering (tools between plan updates are assigned to the active step)
 */
function buildFromExplicitPlan(
  planData: RawPlanData,
  collectedTools: PlanStepTool[],
  toolToStepMap: Map<string, string>
): PlannerState {
  const todos = planData.todos ?? [];
  if (todos.length === 0) return EMPTY_STATE;

  // Index collected tools by toolCallId for quick lookup
  const toolIndex = new Map<string, PlanStepTool>();
  for (const t of collectedTools) {
    toolIndex.set(t.toolCallId, t);
  }

  // Track which tools have been assigned to a step
  const assignedToolIds = new Set<string>();

  const steps: PlanStep[] = todos.map((todo, i) => {
    const stepId = todo.id || `step-${i + 1}`;
    const title = todo.label || todo.title || `Step ${i + 1}`;
    const status = mapExplicitStatus(todo.status ?? "pending");

    const stepTools: PlanStepTool[] = [];

    // Method 1: Link tools explicitly declared in the plan's toolsUsed array
    if (Array.isArray(todo.toolsUsed)) {
      for (const ref of todo.toolsUsed) {
        const existing = ref.toolCallId
          ? toolIndex.get(ref.toolCallId)
          : undefined;
        if (existing) {
          stepTools.push(existing);
          assignedToolIds.add(existing.toolCallId);
        } else if (ref.toolName) {
          stepTools.push({
            toolCallId: ref.toolCallId || `ref-${i}-${stepTools.length}`,
            toolName: ref.toolName,
            canvasView:
              TOOL_VIEW_MAP[ref.toolName] ?? ("empty" as CanvasViewType),
            isActive: false,
            state: "output-available" as ToolInvocationState,
          });
        }
      }
    }

    // Method 2: Link tools that have planStepId matching this step
    for (const [toolCallId, mappedStepId] of toolToStepMap.entries()) {
      if (mappedStepId === stepId && !assignedToolIds.has(toolCallId)) {
        const tool = toolIndex.get(toolCallId);
        if (tool) {
          stepTools.push(tool);
          assignedToolIds.add(toolCallId);
        }
      }
    }

    return { id: stepId, title, status, tools: stepTools };
  });

  // Method 3: Assign unassigned tools to the currently in-progress step
  // (or the last step if none is in progress)
  const unassigned = collectedTools.filter(
    (t) => !assignedToolIds.has(t.toolCallId)
  );
  if (unassigned.length > 0) {
    const activeStepIdx = steps.findIndex((s) => s.status === "in_progress");
    const targetIdx = activeStepIdx !== -1 ? activeStepIdx : steps.length - 1;
    if (targetIdx >= 0) {
      steps[targetIdx].tools.push(...unassigned);
    }
  }

  return buildPlannerState(steps);
}

/**
 * Fallback: build plan from step-start boundaries and tool call parts.
 * Groups consecutive tool calls between step-start markers into steps.
 */
function buildFromToolCalls(messages: UIMessage[]): PlannerState {
  const steps: PlanStep[] = [];
  let currentTools: PlanStepTool[] = [];
  let stepCounter = 0;
  let hasAnyTools = false;

  for (const message of messages) {
    if (message.role !== "assistant") continue;

    for (const part of message.parts) {
      if (isStepStartUIPart(part)) {
        if (currentTools.length > 0) {
          stepCounter++;
          steps.push({
            id: `step-${stepCounter}`,
            title: generateStepTitle(currentTools),
            status: deriveStepStatus(currentTools),
            tools: currentTools,
          });
          currentTools = [];
        }
        continue;
      }

      if (isToolUIPart(part)) {
        const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
        const toolName = getToolName(toolPart);

        // Skip plan tools in fallback mode
        if (PLAN_TOOL_NAMES.has(toolName)) continue;

        hasAnyTools = true;
        const canvasView =
          TOOL_VIEW_MAP[toolName] ?? ("empty" as CanvasViewType);

        currentTools.push({
          toolCallId: toolPart.toolCallId,
          toolName,
          canvasView,
          isActive: isToolActive(toolPart.state),
          state: toolPart.state,
        });
      }
    }
  }

  // Flush remaining
  if (currentTools.length > 0) {
    stepCounter++;
    steps.push({
      id: `step-${stepCounter}`,
      title: generateStepTitle(currentTools),
      status: deriveStepStatus(currentTools),
      tools: currentTools,
    });
  }

  if (!hasAnyTools) return EMPTY_STATE;
  return buildPlannerState(steps);
}

// ============================================================================
// Hook
// ============================================================================

export function usePlannerState(messages: UIMessage[]): PlannerState {
  return useMemo(() => {
    let latestPlan: RawPlanData | null = null;
    const collectedTools: PlanStepTool[] = [];
    const toolToStepMap = new Map<string, string>(); // toolCallId -> planStepId

    // --- Scan all messages for plan tool outputs and regular tool calls ---
    for (const message of messages) {
      if (message.role !== "assistant") continue;

      for (const part of message.parts) {
        // Check for data-plan custom parts
        if (part.type === "data-plan" && isDataUIPart(part)) {
          const data = (part as { data: unknown }).data;
          if (data && typeof data === "object") {
            latestPlan = Array.isArray(data)
              ? { todos: data as RawPlanTodo[] }
              : (data as RawPlanData);
          }
          continue;
        }

        if (!isToolUIPart(part)) continue;

        const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
        const toolName = getToolName(toolPart);

        // --- Priority 1: show_plan / showPlan tool ---
        if (PLAN_TOOL_NAMES.has(toolName)) {
          // Use output if available, otherwise input (for streaming state)
          const planSource =
            toolPart.state === "output-available" && toolPart.output
              ? toolPart.output
              : toolPart.input;

          if (planSource && typeof planSource === "object") {
            const raw = planSource as Record<string, unknown>;
            latestPlan = {
              title: raw.title as string | undefined,
              todos: (raw.todos ?? raw.steps) as RawPlanTodo[] | undefined,
            };
          }
          continue;
        }

        // --- Collect regular tool calls ---
        const canvasView =
          TOOL_VIEW_MAP[toolName] ?? ("empty" as CanvasViewType);
        const toolEntry: PlanStepTool = {
          toolCallId: toolPart.toolCallId,
          toolName,
          canvasView,
          isActive: isToolActive(toolPart.state),
          state: toolPart.state,
        };
        collectedTools.push(toolEntry);

        // Extract planStepId from tool input args if present
        const input = toolPart.input as Record<string, unknown> | undefined;
        if (input && typeof input === "object" && "planStepId" in input) {
          const stepId = input.planStepId;
          if (typeof stepId === "string") {
            toolToStepMap.set(toolPart.toolCallId, stepId);
          }
        }
      }
    }

    // --- Build from explicit plan if found ---
    if (
      latestPlan &&
      Array.isArray(latestPlan.todos) &&
      latestPlan.todos.length > 0
    ) {
      return buildFromExplicitPlan(latestPlan, collectedTools, toolToStepMap);
    }

    // --- Fallback: auto-derive from step boundaries + tool calls ---
    if (collectedTools.length > 0) {
      return buildFromToolCalls(messages);
    }

    return EMPTY_STATE;
  }, [messages]);
}
