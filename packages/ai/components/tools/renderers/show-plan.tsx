"use client";

/**
 * ShowPlan renderer — renders as a Chain of Thought UI.
 *
 * The agent calls `show_plan` with `{ title, todos: [{ id, label, status }] }`.
 * This renderer maps todos to ChainOfThought steps with proper status
 * indicators, timeline connectors, and collapsible UI.
 */

import * as React from "react";
import type { ToolRendererProps } from "../tool-registry";
import {
  ChainOfThought,
  type ChainOfThoughtStep,
  type StepStatus,
} from "../../parts/chain-of-thought";

interface ShowPlanInput {
  title?: string;
  todos?: Array<{
    id: string;
    label: string;
    status: string;
    description?: string;
  }>;
}

function normalizeStatus(status: string | undefined): StepStatus {
  if (!status) return "pending";
  const s = status.toLowerCase().replace(/-/g, "_");
  if (s === "completed" || s === "done" || s === "complete") return "complete";
  if (s === "in_progress" || s === "doing" || s === "running") return "active";
  if (s === "cancelled" || s === "error" || s === "failed") return "complete";
  return "pending";
}

export function ShowPlanRenderer({
  state,
  input,
  output,
}: ToolRendererProps<ShowPlanInput, ShowPlanInput>) {
  // Use output if available, otherwise input (for streaming)
  const data = (output ?? input) as ShowPlanInput | undefined;
  if (!data?.todos || data.todos.length === 0) return null;

  const steps: ChainOfThoughtStep[] = data.todos.map((t) => ({
    id: t.id,
    label: t.label,
    status: normalizeStatus(t.status),
    detail: t.description,
  }));

  const isActive =
    state === "input-streaming" ||
    state === "input-available" ||
    steps.some((s) => s.status === "active");

  return (
    <ChainOfThought
      steps={steps}
      title={data.title || "Plan"}
      defaultOpen={isActive}
    />
  );
}

export default ShowPlanRenderer;
