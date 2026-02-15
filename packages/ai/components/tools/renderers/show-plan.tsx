"use client";

/**
 * ShowPlan renderer — renders inline plan as Manus-style collapsible step list.
 *
 * The agent calls `show_plan` with `{ title, todos: [{ id, label, status }] }`.
 * This renderer maps todos to a compact step list with status indicators.
 *
 * NOTE: When the message-renderer detects show_plan, it groups subsequent tool
 * calls under plan steps. This renderer is used as a fallback when show_plan
 * appears outside of the grouped context (e.g., in PlannerBar or debug mode).
 */

import * as React from "react";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

interface ShowPlanInput {
  title?: string;
  todos?: Array<{
    id: string;
    label: string;
    status: string;
    description?: string;
  }>;
}

type StepStatus = "pending" | "in_progress" | "completed" | "error";

function normalizeStatus(status: string | undefined): StepStatus {
  if (!status) return "pending";
  const s = status.toLowerCase().replace(/-/g, "_");
  if (s === "completed" || s === "done" || s === "complete") return "completed";
  if (s === "in_progress" || s === "doing" || s === "running") return "in_progress";
  if (s === "cancelled" || s === "error" || s === "failed") return "error";
  return "pending";
}

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === "completed") {
    return (
      <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full bg-muted-foreground/20 dark:bg-white/10">
        <CheckIcon className="size-2.5 text-muted-foreground" strokeWidth={3} />
      </div>
    );
  }

  if (status === "in_progress") {
    return (
      <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full border border-blue-500/50 bg-blue-500/10">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-blue-400" />
        </span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full border border-destructive/50 bg-destructive/10">
        <span className="size-1.5 rounded-full bg-destructive" />
      </div>
    );
  }

  // Pending
  return (
    <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full border border-border/60 bg-card" />
  );
}

export function ShowPlanRenderer({
  state,
  input,
  output,
}: ToolRendererProps<ShowPlanInput, ShowPlanInput>) {
  const data = (output ?? input) as ShowPlanInput | undefined;
  if (!data?.todos || data.todos.length === 0) return null;

  const steps = data.todos.map((t) => ({
    id: t.id,
    label: t.label,
    status: normalizeStatus(t.status),
  }));

  const isActive =
    state === "input-streaming" ||
    state === "input-available" ||
    steps.some((s) => s.status === "in_progress");

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const [isOpen, setIsOpen] = useState(isActive || completedCount < steps.length);

  return (
    <div className="flex flex-col gap-0.5 my-1">
      {/* Plan header */}
      {data.title && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-sm py-1 cursor-pointer hover:opacity-80"
        >
          <span className="font-medium text-foreground/80">{data.title}</span>
          <span className="text-xs text-muted-foreground/50">{completedCount}/{steps.length}</span>
          <ChevronDownIcon
            className={cn(
              "size-4 text-muted-foreground/50 transition-transform duration-300",
              isOpen && "rotate-180",
            )}
          />
        </button>
      )}

      {/* Step list */}
      <div
        className={cn(
          "transition-[max-height,opacity] duration-150 ease-in-out overflow-hidden",
          isOpen ? "max-h-[100000px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="flex flex-col gap-0.5">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-2 py-0.5">
              {/* Status icon */}
              <div className="mt-0.5">
                <StepStatusIcon status={step.status} />
              </div>

              {/* Step label */}
              <span className={cn(
                "text-sm",
                step.status === "completed" && "text-muted-foreground",
                step.status === "in_progress" && "font-medium text-foreground",
                step.status === "pending" && "text-muted-foreground/60",
                step.status === "error" && "text-destructive",
              )}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ShowPlanRenderer;
