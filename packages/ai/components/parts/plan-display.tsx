"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  ChevronDownIcon,
  ListChecksIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon,
  AlertCircleIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type PlanStepStatus = "complete" | "active" | "pending" | "error";

export interface PlanStep {
  id: string;
  title: string;
  status: PlanStepStatus;
  description?: string;
}

export interface PlanDisplayProps {
  title?: string;
  description?: string;
  steps: PlanStep[];
  isStreaming?: boolean;
  className?: string;
  defaultOpen?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function PlanDisplay({
  title = "Plan",
  description,
  steps,
  isStreaming = false,
  className,
  defaultOpen = true,
}: PlanDisplayProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const completedCount = steps.filter((s) => s.status === "complete").length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/40",
        isStreaming && "border-amber-500/20",
        className
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex size-6 items-center justify-center rounded-lg bg-amber-500/10">
          <ListChecksIcon className="size-3.5 text-amber-500" />
        </div>

        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground/80">{title}</span>
          {description && (
            <span className="ml-2 text-xs text-muted-foreground/50">{description}</span>
          )}
        </div>

        {totalSteps > 0 && (
          <span className="text-xs text-muted-foreground/60">
            {completedCount}/{totalSteps}
          </span>
        )}

        <ChevronDownIcon
          className={cn(
            "size-4 text-muted-foreground/50 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Progress bar */}
      {totalSteps > 0 && (
        <div className="h-[2px] w-full bg-muted/30">
          <div
            className={cn(
              "h-full transition-all duration-500 ease-out",
              isStreaming
                ? "bg-gradient-to-r from-amber-500/60 to-amber-400/60"
                : "bg-amber-500/40"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Steps */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-0 px-3 py-2">
            {steps.map((step) => (
              <PlanStepItem key={step.id} step={step} />
            ))}

            {/* Shimmer placeholder during streaming */}
            {isStreaming && (
              <div className="flex items-center gap-2.5 py-1.5">
                <CircleIcon className="size-4 text-muted-foreground/20" />
                <div className="h-3.5 w-32 animate-pulse rounded bg-muted/30" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Step Item
// ============================================================================

function PlanStepItem({ step }: { step: PlanStep }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className="flex size-5 flex-shrink-0 items-center justify-center">
        <StepIcon status={step.status} />
      </div>
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "text-sm",
            step.status === "complete" && "text-foreground/60 line-through decoration-muted-foreground/20",
            step.status === "active" && "font-medium text-foreground",
            step.status === "pending" && "text-muted-foreground/50",
            step.status === "error" && "text-red-400"
          )}
        >
          {step.title}
        </span>
        {step.description && step.status === "active" && (
          <p className="mt-0.5 text-xs text-muted-foreground/50">{step.description}</p>
        )}
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: PlanStepStatus }) {
  switch (status) {
    case "complete":
      return <CheckCircle2Icon className="size-4 text-green-500/70" />;
    case "active":
      return <CircleDotIcon className="size-4 animate-pulse text-amber-500" />;
    case "pending":
      return <CircleIcon className="size-4 text-muted-foreground/25" />;
    case "error":
      return <AlertCircleIcon className="size-4 text-red-400" />;
  }
}
