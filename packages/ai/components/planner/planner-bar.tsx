"use client";

/**
 * PlannerBar — Collapsible bar showing the agent's task plan.
 *
 * Renders ONLY when the agent has called the `show_plan` tool.
 * Sits between the message list and the prompt input in the chat layout.
 *
 * Collapsed: compact strip with activity indicator, current step title, and progress.
 * Expanded: full plan with animated TodoIcons, connector lines, and progress bar.
 *
 * The planner is a tool — it gets persisted as part of message parts like any
 * other tool call. Historical chats show the planner because the show_plan tool
 * call is saved in the message parts.
 *
 * Relies on keyframes defined in tool-animations.css.
 */

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  Check,
  Loader2,
  X,
} from "lucide-react";
import type { PlannerState, PlanStep, PlanStepStatus } from "./use-planner-state";

// ============================================================================
// Types
// ============================================================================

export interface PlannerBarProps {
  /** Planner state from usePlannerState() */
  state: PlannerState;
  /** Whether the plan list is expanded */
  isExpanded: boolean;
  /** Toggle expand/collapse */
  onToggleExpanded: () => void;
  className?: string;
}

// ============================================================================
// TodoIcon — Status indicator with spring animations
// ============================================================================

function TodoIcon({ status }: { status: PlanStepStatus }) {
  if (status === "pending") {
    return (
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-card motion-safe:transition-all motion-safe:duration-200"
        aria-hidden="true"
      />
    );
  }

  if (status === "in_progress") {
    return (
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-[0_0_0_3px_hsl(var(--primary)/0.1)] motion-safe:transition-all motion-safe:duration-300"
        aria-hidden="true"
      >
        <Loader2 className="size-3.5 text-primary motion-safe:animate-[spin_0.7s_linear_infinite]" />
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-full border border-primary bg-primary shadow-sm motion-safe:animate-[spring-bounce_500ms_cubic-bezier(0.34,1.56,0.64,1)]"
        aria-hidden="true"
      >
        <Check
          className="size-3 text-primary-foreground [&_path]:motion-safe:animate-[check-draw_400ms_cubic-bezier(0.34,1.56,0.64,1)_100ms_backwards]"
          strokeWidth={3}
          style={{ ["--check-path-length" as string]: "24" }}
        />
      </span>
    );
  }

  // error
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-full border border-destructive bg-destructive shadow-sm motion-safe:animate-[spring-bounce_500ms_cubic-bezier(0.34,1.56,0.64,1)] dark:border-red-600 dark:bg-red-600"
      aria-hidden="true"
    >
      <X
        className="size-3 text-white [&_path]:motion-safe:animate-[check-draw_400ms_cubic-bezier(0.34,1.56,0.64,1)_100ms_backwards]"
        strokeWidth={3}
        style={{ ["--check-path-length" as string]: "16" }}
      />
    </span>
  );
}

// ============================================================================
// StepItem — Single plan step with connector line
// ============================================================================

function StepItem({
  step,
  isLast,
  isNew,
  staggerDelay,
}: {
  step: PlanStep;
  isLast: boolean;
  isNew: boolean;
  staggerDelay: number;
}) {
  return (
    <li
      className={cn(
        "relative flex flex-col py-1.5",
        isNew && "motion-safe:animate-[fade-up_300ms_ease-out]"
      )}
      style={
        isNew
          ? { animationDelay: `${staggerDelay}ms`, animationFillMode: "backwards" }
          : undefined
      }
    >
      <div className="flex items-start gap-2.5">
        {/* Connector line */}
        {!isLast && (
          <div
            className={cn(
              "absolute left-[9px] top-7 w-px",
              step.status === "completed" ? "bg-primary/30" : "bg-border/50"
            )}
            style={{ height: "calc(100% - 0.5rem)" }}
            aria-hidden="true"
          />
        )}

        {/* Status icon */}
        <div className="relative z-10 mt-0.5 shrink-0">
          <TodoIcon status={step.status} />
        </div>

        {/* Title */}
        <span
          className={cn(
            "break-words text-sm leading-5",
            step.status === "in_progress" && "shimmer shimmer-invert font-medium text-foreground motion-safe:shimmer",
            step.status === "completed" && "text-muted-foreground",
            step.status === "pending" && "text-muted-foreground/60",
            step.status === "error" && "font-medium text-destructive"
          )}
        >
          {step.title}
        </span>
      </div>
    </li>
  );
}

// ============================================================================
// ProgressBar — With celebration glow at 100%
// ============================================================================

function ProgressBar({ progress, isCelebrating }: { progress: number; isCelebrating: boolean }) {
  return (
    <div className="relative h-1 overflow-hidden rounded-t-2xl bg-muted/40">
      <div
        className={cn(
          "h-full transition-all duration-500 ease-out",
          progress >= 100
            ? "bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 motion-safe:animate-[progress-pulse_600ms_ease-out]"
            : "bg-primary"
        )}
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
      {isCelebrating && (
        <div
          className="pointer-events-none absolute inset-0 motion-safe:animate-[glow-pulse_600ms_ease-out]"
          style={{ boxShadow: "0 0 16px rgba(16, 185, 129, 0.5)" }}
        />
      )}
    </div>
  );
}

// ============================================================================
// PlannerBar — Main Component
// ============================================================================

export function PlannerBar({
  state,
  isExpanded,
  onToggleExpanded,
  className,
}: PlannerBarProps) {
  const { steps, currentStepIndex, totalSteps, completedSteps, progress, isActive, title } =
    state;
  const activeStep = steps[currentStepIndex] ?? steps[steps.length - 1];
  const allComplete = completedSteps === totalSteps && totalSteps > 0;

  // Track new steps for entrance animation
  const seenStepIds = useRef(new Set<string>());
  const [newStepIds, setNewStepIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const newIds = new Set<string>();
    for (const step of steps) {
      if (!seenStepIds.current.has(step.id)) {
        newIds.add(step.id);
        seenStepIds.current.add(step.id);
      }
    }
    if (newIds.size > 0) {
      setNewStepIds(newIds);
      const timer = setTimeout(() => setNewStepIds(new Set()), 500);
      return () => clearTimeout(timer);
    }
  }, [steps]);

  // Celebration effect at 100%
  const [isCelebrating, setIsCelebrating] = useState(false);
  const prevProgressRef = useRef(0);

  useEffect(() => {
    if (progress === 100 && prevProgressRef.current < 100) {
      setIsCelebrating(true);
      const timer = setTimeout(() => setIsCelebrating(false), 1000);
      return () => clearTimeout(timer);
    }
    prevProgressRef.current = progress;
  }, [progress]);

  return (
    <div data-testid="planner-bar" className={cn("shrink-0", className)}>
      <div className="mx-auto max-w-3xl px-4 pb-2">
        {/* Self-contained rounded card matching prompt input style */}
        <div className="overflow-hidden rounded-2xl border border-border/30 bg-card/50">
          {/* Progress bar — thin strip at top of the card */}
          <ProgressBar progress={progress} isCelebrating={isCelebrating} />

          {/* Collapsed bar (always visible) */}
          <button
            type="button"
            onClick={onToggleExpanded}
            className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/30"
          >
            {/* Activity indicator */}
            {isActive ? (
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
            ) : allComplete ? (
              <span className="flex size-5 shrink-0 items-center justify-center">
                <Check className="size-3.5 text-emerald-500" strokeWidth={2.5} />
              </span>
            ) : (
              <span className="flex size-5 shrink-0 items-center justify-center">
                <span className="size-2 rounded-full bg-muted-foreground/40" />
              </span>
            )}

            {/* Current step title */}
            <span
              className={cn(
                "flex-1 truncate text-sm",
                isActive ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {activeStep?.title ?? (isActive ? "Working..." : "All steps complete")}
            </span>

            {/* Step counter */}
            <span className="shrink-0 text-xs text-muted-foreground/60">
              {completedSteps}/{totalSteps}
            </span>

            {/* Expand/collapse chevron */}
            {isExpanded ? (
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground/50" />
            ) : (
              <ChevronUpIcon className="size-4 shrink-0 text-muted-foreground/50" />
            )}
          </button>

          {/* Expanded plan list (animated height) */}
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div className="border-t border-border/20 px-4 py-3">
                {/* Plan title */}
                {title && (
                  <div className="mb-2 text-xs font-medium text-foreground/80">
                    {title}
                  </div>
                )}

                {/* Progress text */}
                <div className="mb-2 text-xs text-muted-foreground">
                  {completedSteps} of {totalSteps} complete
                </div>

                {/* Step list */}
                <ul className="max-h-52 overflow-y-auto">
                  {steps.map((step, index) => {
                    const isNew = newStepIds.has(step.id);
                    return (
                      <StepItem
                        key={step.id}
                        step={step}
                        isLast={index === steps.length - 1}
                        isNew={isNew}
                        staggerDelay={isNew ? index * 50 : 0}
                      />
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
