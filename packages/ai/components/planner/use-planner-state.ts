"use client";

/**
 * usePlannerState — Derives plan state from `show_plan` tool calls in messages.
 *
 * The planner is a TOOL. The agent calls `show_plan` to create or update a
 * structured plan. Each call includes `{ title, todos: [{ id, label, status }] }`.
 * This hook finds the LATEST `show_plan` tool call and builds a PlannerState
 * from its data.
 *
 * The planner ONLY appears when the agent has explicitly called `show_plan`.
 * Regular tool calls (browser, terminal, etc.) render inline in the message
 * list via the tool registry — they are NOT shown in the planner.
 *
 * Connected to Vercel AI SDK v6 — reads directly from useChat() messages.
 */

import { useMemo } from "react";
import type {
  UIMessage,
  StaticToolUIPart,
  DynamicToolUIPart,
} from "../../lib/types/ui-message";
import { isToolUIPart, getToolName } from "../../lib/types/ui-message";

// ============================================================================
// Types
// ============================================================================

export type PlanStepStatus = "pending" | "in_progress" | "completed" | "error";

export interface PlanStep {
  id: string;
  title: string;
  status: PlanStepStatus;
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
  /** Plan title from the agent */
  title?: string;
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

/** Tool name for the plan tool — canonical name from agent */
const PLAN_TOOL_NAMES = new Set(["show_plan"]);

// ============================================================================
// Helpers
// ============================================================================

function mapStatus(status: string | undefined): PlanStepStatus {
  if (!status) return "pending";
  const s = status.toLowerCase().replace(/-/g, "_");
  switch (s) {
    case "completed":
    case "done":
    case "complete":
      return "completed";
    case "in_progress":
    case "doing":
    case "running":
      return "in_progress";
    case "error":
    case "failed":
    case "cancelled":
      return "error";
    default:
      return "pending";
  }
}

// ============================================================================
// Hook
// ============================================================================

interface RawPlanTodo {
  id?: string;
  label?: string;
  title?: string;
  status?: string;
}

interface RawPlanData {
  title?: string;
  todos?: RawPlanTodo[];
  steps?: RawPlanTodo[];
  goal?: string;
  phases?: RawPlanTodo[];
}

export function usePlannerState(messages: UIMessage[]): PlannerState {
  return useMemo(() => {
    let latestPlan: RawPlanData | null = null;

    // Scan all assistant messages for the LATEST show_plan tool call
    for (const message of messages) {
      if (message.role !== "assistant" || !message.parts) continue;

      for (const part of message.parts) {
        if (!part || !isToolUIPart(part)) continue;

        const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
        const toolName = getToolName(toolPart);

        if (!PLAN_TOOL_NAMES.has(toolName)) continue;

        // Use output if available, otherwise input (for streaming state)
        const planSource =
          toolPart.state === "output-available" && toolPart.output
            ? toolPart.output
            : toolPart.input;

        if (planSource && typeof planSource === "object") {
          latestPlan = planSource as RawPlanData;
        }
      }
    }

    // No plan tool was called — return empty (planner stays hidden)
    if (!latestPlan) return EMPTY_STATE;

    // Extract todos from various possible field names
    const rawTodos =
      latestPlan.todos ?? latestPlan.steps ?? latestPlan.phases ?? [];
    if (rawTodos.length === 0) return EMPTY_STATE;

    // Build steps
    const steps: PlanStep[] = rawTodos.map((todo, i) => ({
      id: todo.id || `step-${i + 1}`,
      title: todo.label || todo.title || `Step ${i + 1}`,
      status: mapStatus(todo.status),
    }));

    const completedSteps = steps.filter((s) => s.status === "completed").length;
    const currentIndex = steps.findIndex((s) => s.status === "in_progress");
    const progress =
      steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

    return {
      steps,
      currentStepIndex: currentIndex !== -1 ? currentIndex : steps.length - 1,
      totalSteps: steps.length,
      completedSteps,
      progress,
      isActive: steps.some((s) => s.status === "in_progress"),
      hasSteps: true,
      title: latestPlan.title || latestPlan.goal,
    };
  }, [messages]);
}
