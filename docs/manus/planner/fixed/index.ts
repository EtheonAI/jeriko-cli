/**
 * Planner — Collapsible task progress bar for chat.
 *
 * Derives state from AI SDK UIMessage parts (tool calls, step-start boundaries).
 * Shows step-by-step progress with tool tabs linking to canvas views.
 *
 * NEW: Now includes clickable tool buttons per step that switch the canvas view.
 */

export {
  usePlannerState,
  type PlannerState,
  type PlanStep,
  type PlanStepStatus,
  type PlanStepTool,
} from "./use-planner-state";

export { PlannerBar, type PlannerBarProps } from "./planner-bar";
