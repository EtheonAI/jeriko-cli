"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  CheckIcon,
  CircleIcon,
  LoaderIcon,
  XIcon,
} from "lucide-react";

export interface ProgressStep {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  substeps?: ProgressStep[];
}

export interface ProgressTrackerProps {
  steps: ProgressStep[];
  className?: string;
  variant?: "vertical" | "compact";
}

/**
 * ProgressTracker - Manus-style numbered step progression
 */
export function ProgressTracker({
  steps,
  className,
  variant = "vertical",
}: ProgressTrackerProps) {
  if (variant === "compact") {
    return (
      <CompactProgress steps={steps} className={className} />
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {steps.map((step, index) => (
        <ProgressStepItem
          key={step.id}
          step={step}
          index={index}
          isLast={index === steps.length - 1}
        />
      ))}
    </div>
  );
}

function ProgressStepItem({
  step,
  index,
  isLast,
}: {
  step: ProgressStep;
  index: number;
  isLast: boolean;
}) {
  return (
    <div className="relative flex gap-3">
      {/* Connector line */}
      {!isLast && (
        <div
          className={cn(
            "absolute left-3 top-6 h-full w-0.5 -translate-x-1/2",
            step.status === "completed" ? "bg-green-500" : "bg-border"
          )}
        />
      )}

      {/* Step indicator */}
      <div
        className={cn(
          "relative z-10 flex size-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium",
          step.status === "pending" && "border border-border bg-background text-muted-foreground",
          step.status === "in_progress" && "border-2 border-primary bg-primary/10 text-primary",
          step.status === "completed" && "bg-green-500 text-white",
          step.status === "failed" && "bg-destructive text-destructive-foreground"
        )}
      >
        {step.status === "pending" && (index + 1)}
        {step.status === "in_progress" && (
          <LoaderIcon className="size-3 animate-spin" />
        )}
        {step.status === "completed" && <CheckIcon className="size-3" />}
        {step.status === "failed" && <XIcon className="size-3" />}
      </div>

      {/* Step content */}
      <div className="min-w-0 flex-1 pb-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              step.status === "pending" && "text-muted-foreground",
              step.status === "in_progress" && "text-foreground",
              step.status === "completed" && "text-foreground",
              step.status === "failed" && "text-destructive"
            )}
          >
            {step.title}
          </span>
          {step.status === "in_progress" && (
            <span className="text-xs text-primary">In progress...</span>
          )}
        </div>
        {step.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {step.description}
          </p>
        )}

        {/* Substeps */}
        {step.substeps && step.substeps.length > 0 && (
          <div className="mt-2 space-y-1 pl-2">
            {step.substeps.map((substep, subIndex) => (
              <SubstepItem
                key={substep.id}
                step={substep}
                index={subIndex}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SubstepItem({
  step,
  index,
}: {
  step: ProgressStep;
  index: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex size-4 items-center justify-center",
          step.status === "pending" && "text-muted-foreground",
          step.status === "in_progress" && "text-primary",
          step.status === "completed" && "text-green-500",
          step.status === "failed" && "text-destructive"
        )}
      >
        {step.status === "pending" && <CircleIcon className="size-2" />}
        {step.status === "in_progress" && (
          <LoaderIcon className="size-3 animate-spin" />
        )}
        {step.status === "completed" && <CheckIcon className="size-3" />}
        {step.status === "failed" && <XIcon className="size-3" />}
      </div>
      <span
        className={cn(
          "text-xs",
          step.status === "pending" && "text-muted-foreground",
          step.status === "in_progress" && "text-foreground",
          step.status === "completed" && "text-foreground",
          step.status === "failed" && "text-destructive"
        )}
      >
        {step.title}
      </span>
    </div>
  );
}

function CompactProgress({
  steps,
  className,
}: {
  steps: ProgressStep[];
  className?: string;
}) {
  const completed = steps.filter((s) => s.status === "completed").length;
  const inProgress = steps.find((s) => s.status === "in_progress");

  return (
    <div className={cn("space-y-2", className)}>
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(completed / steps.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {completed}/{steps.length}
        </span>
      </div>

      {/* Current step */}
      {inProgress && (
        <div className="flex items-center gap-2 text-sm">
          <LoaderIcon className="size-4 animate-spin text-primary" />
          <span>{inProgress.title}</span>
        </div>
      )}
    </div>
  );
}
