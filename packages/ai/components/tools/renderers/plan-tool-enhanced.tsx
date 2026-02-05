"use client";

/**
 * Enhanced Plan Tool - Rich planning visualization
 *
 * Features:
 * - Animated timeline view
 * - Collapsible phases with tasks
 * - Progress bar with percentage
 * - Time estimates
 * - Dependencies visualization
 * - Phase status animations
 */

import * as React from "react";
import { useState, useMemo } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  CheckIcon,
  ClipboardListIcon,
  CircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  AlertTriangleIcon,
  PlayIcon,
  PauseIcon,
  TargetIcon,
  SparklesIcon,
  ArrowRightIcon,
} from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

// ============================================================================
// Types
// ============================================================================

interface PlanTask {
  id?: string;
  name: string;
  status?: "completed" | "in-progress" | "pending" | "blocked";
  duration_estimate?: string;
  dependencies?: string[];
}

interface PlanPhase {
  id?: string;
  name: string;
  description?: string;
  status: "completed" | "in-progress" | "pending" | "blocked";
  tasks?: PlanTask[];
  duration_estimate?: string;
  start_time?: string;
  end_time?: string;
}

interface PlanInput {
  goal?: string;
  context?: string;
}

interface PlanOutput {
  plan?: {
    title?: string;
    goal?: string;
    phases?: PlanPhase[];
    summary?: string;
    estimated_duration?: string;
    confidence?: number;
  };
  thinking?: string;
  [key: string]: unknown;
}

// ============================================================================
// Utilities
// ============================================================================

function calculateProgress(phases?: PlanPhase[]): number {
  if (!phases || phases.length === 0) return 0;

  let totalTasks = 0;
  let completedTasks = 0;

  for (const phase of phases) {
    if (phase.tasks && phase.tasks.length > 0) {
      totalTasks += phase.tasks.length;
      completedTasks += phase.tasks.filter((t) => t.status === "completed").length;
    } else {
      // Count phase as one task if no sub-tasks
      totalTasks += 1;
      if (phase.status === "completed") completedTasks += 1;
    }
  }

  return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
}

// ============================================================================
// Phase Status Icon
// ============================================================================

function PhaseStatusIcon({
  status,
  animate = true,
}: {
  status: PlanPhase["status"];
  animate?: boolean;
}) {
  const baseClasses = "size-6 flex items-center justify-center rounded-full";

  switch (status) {
    case "completed":
      return (
        <div className={cn(baseClasses, "bg-green-500")}>
          <CheckIcon
            className={cn(
              "size-3.5 text-white",
              animate && "motion-safe:animate-[spring-bounce_500ms_cubic-bezier(0.34,1.56,0.64,1)]"
            )}
          />
        </div>
      );
    case "in-progress":
      return (
        <div className={cn(baseClasses, "border-2 border-primary bg-primary/10")}>
          <div
            className={cn(
              "size-2.5 rounded-full bg-primary",
              animate && "motion-safe:animate-pulse"
            )}
          />
        </div>
      );
    case "blocked":
      return (
        <div className={cn(baseClasses, "border-2 border-orange-500 bg-orange-500/10")}>
          <PauseIcon className="size-3 text-orange-500" />
        </div>
      );
    case "pending":
    default:
      return (
        <div className={cn(baseClasses, "border-2 border-muted-foreground/30")}>
          <CircleIcon className="size-2 text-muted-foreground" />
        </div>
      );
  }
}

// ============================================================================
// Task Item
// ============================================================================

function TaskItem({ task, index }: { task: PlanTask; index: number }) {
  const getStatusColor = () => {
    switch (task.status) {
      case "completed":
        return "text-green-500";
      case "in-progress":
        return "text-primary";
      case "blocked":
        return "text-orange-500";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1.5",
        "motion-safe:animate-[fade-in_200ms_ease-out_both]"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Status indicator */}
      <div
        className={cn(
          "size-4 flex items-center justify-center rounded-full",
          task.status === "completed" && "bg-green-500",
          task.status === "in-progress" && "border border-primary",
          task.status === "blocked" && "border border-orange-500",
          task.status === "pending" && "border border-muted-foreground/30"
        )}
      >
        {task.status === "completed" && <CheckIcon className="size-2.5 text-white" />}
        {task.status === "in-progress" && (
          <div className="size-1.5 rounded-full bg-primary animate-pulse" />
        )}
      </div>

      {/* Task name */}
      <span
        className={cn(
          "text-xs",
          task.status === "completed" && "line-through text-muted-foreground",
          task.status === "in-progress" && "font-medium",
          task.status === "blocked" && "text-orange-500"
        )}
      >
        {task.name}
      </span>

      {/* Duration */}
      {task.duration_estimate && (
        <span className="text-xs text-muted-foreground/70 ml-auto">{task.duration_estimate}</span>
      )}
    </div>
  );
}

// ============================================================================
// Phase Card
// ============================================================================

function PhaseCard({
  phase,
  index,
  totalPhases,
  isExpanded,
  onToggle,
}: {
  phase: PlanPhase;
  index: number;
  totalPhases: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasTasks = phase.tasks && phase.tasks.length > 0;
  const completedTasks = phase.tasks?.filter((t) => t.status === "completed").length ?? 0;
  const totalTasks = phase.tasks?.length ?? 0;

  const isActive = phase.status === "in-progress";
  const isLast = index === totalPhases - 1;

  return (
    <div
      className={cn("relative pl-10", "motion-safe:animate-[fade-in_300ms_ease-out_both]")}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Connector line */}
      {!isLast && (
        <div
          className={cn(
            "absolute left-[11px] top-8 bottom-0 w-0.5",
            phase.status === "completed" ? "bg-green-500/50" : "bg-border"
          )}
        />
      )}

      {/* Status icon */}
      <div className="absolute left-0 top-1">
        <PhaseStatusIcon status={phase.status} />
      </div>

      {/* Phase content */}
      <div
        className={cn(
          "rounded-lg border p-3 transition-all duration-200",
          isActive && "border-primary/50 bg-primary/5",
          phase.status === "completed" && "border-green-500/30 bg-green-500/5",
          phase.status === "blocked" && "border-orange-500/30 bg-orange-500/5",
          !isActive && phase.status !== "completed" && phase.status !== "blocked" && "border-border"
        )}
      >
        {/* Header */}
        <div
          className={cn("flex items-center gap-2", hasTasks && "cursor-pointer")}
          onClick={hasTasks ? onToggle : undefined}
        >
          {hasTasks && (
            <button className="p-0.5 -ml-1">
              {isExpanded ? (
                <ChevronDownIcon className="size-4 text-muted-foreground" />
              ) : (
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              )}
            </button>
          )}

          <span
            className={cn(
              "text-sm font-medium flex-1",
              isActive && "shimmer",
              phase.status === "completed" && "text-green-600",
              phase.status === "blocked" && "text-orange-600"
            )}
          >
            Phase {index + 1}: {phase.name}
          </span>

          {/* Task count badge */}
          {hasTasks && (
            <span className="text-xs text-muted-foreground">
              {completedTasks}/{totalTasks}
            </span>
          )}

          {/* Duration */}
          {phase.duration_estimate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ClockIcon className="size-3" />
              {phase.duration_estimate}
            </span>
          )}
        </div>

        {/* Description */}
        {phase.description && (
          <p className="text-xs text-muted-foreground mt-1 ml-5">{phase.description}</p>
        )}

        {/* Tasks */}
        {hasTasks && isExpanded && (
          <div className="mt-3 ml-5 border-l-2 border-border pl-3 space-y-0.5">
            {phase.tasks!.map((task, taskIndex) => (
              <TaskItem key={task.id ?? taskIndex} task={task} index={taskIndex} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PlanToolEnhanced({
  toolName,
  toolCallId,
  state,
  input,
  output,
  errorText,
}: ToolRendererProps<PlanInput, PlanOutput>) {
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([0])); // Auto-expand first phase

  const typedInput = input as PlanInput | undefined;
  const typedOutput = output as PlanOutput | undefined;

  const plan = typedOutput?.plan;
  const thinking = typedOutput?.thinking;

  const progress = useMemo(() => calculateProgress(plan?.phases), [plan?.phases]);
  const isLoading = state === "input-streaming" || state === "input-available";
  const hasError = state === "output-error" || !!errorText;

  const togglePhase = (index: number) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-xl border border-dashed p-4">
        <div className="flex items-center gap-3">
          <div className="size-8 flex items-center justify-center rounded-lg bg-primary/10">
            <div className="size-4 border-2 border-primary/30 border-t-primary rounded-full spinner" />
          </div>
          <div>
            <div className="text-sm font-medium shimmer">Creating plan...</div>
            <div className="text-xs text-muted-foreground">
              {typedInput?.goal ? `Goal: ${typedInput.goal}` : "Analyzing requirements"}
            </div>
          </div>
        </div>

        {/* Skeleton phases */}
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 pl-2">
              <div className="size-5 rounded-full skeleton" />
              <div className="flex-1">
                <div className="h-3 w-32 skeleton rounded" />
                <div className="h-2 w-48 skeleton rounded mt-1.5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No plan state
  if (!plan && !hasError) {
    return null;
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-muted/30 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardListIcon className="size-4 text-primary" />
            <span className="text-sm font-medium">{plan?.title || "Project Plan"}</span>
          </div>

          {plan?.confidence !== undefined && (
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                plan.confidence >= 0.8
                  ? "bg-green-500/10 text-green-600"
                  : plan.confidence >= 0.5
                    ? "bg-yellow-500/10 text-yellow-600"
                    : "bg-red-500/10 text-red-600"
              )}
            >
              {Math.round(plan.confidence * 100)}% confidence
            </span>
          )}
        </div>

        {/* Goal */}
        {plan?.goal && (
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <TargetIcon className="size-3" />
            <span>{plan.goal}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {plan?.phases && plan.phases.length > 0 && (
        <div className="px-4 py-2 border-b bg-muted/10">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Progress</span>
            <span className="text-xs font-medium">{progress}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full bg-primary transition-all duration-500 ease-out",
                progress === 100 && "motion-safe:animate-[glow-pulse_600ms_ease-out]"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          {plan.estimated_duration && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
              <ClockIcon className="size-3" />
              <span>Estimated: {plan.estimated_duration}</span>
            </div>
          )}
        </div>
      )}

      {/* Phases */}
      <div className="p-4 space-y-3">
        {plan?.phases?.map((phase, index) => (
          <PhaseCard
            key={phase.id ?? index}
            phase={phase}
            index={index}
            totalPhases={plan.phases!.length}
            isExpanded={expandedPhases.has(index)}
            onToggle={() => togglePhase(index)}
          />
        ))}

        {/* Summary */}
        {plan?.summary && (
          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <SparklesIcon className="size-3" />
              <span>Summary</span>
            </div>
            <p className="text-sm text-muted-foreground">{plan.summary}</p>
          </div>
        )}
      </div>

      {/* Error state */}
      {hasError && (
        <div className="px-4 py-3 bg-red-500/5 border-t border-red-500/20">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangleIcon className="size-4" />
            <span className="text-sm">{errorText || "Failed to create plan"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlanToolEnhanced;
