"use client";

/**
 * AgentActivityTracker - Real-time visualization of agent execution
 *
 * Shows:
 * - Collapsible plan progress strip above the prompt
 * - Planning phase with task breakdown
 * - Tool execution loops with state changes
 * - Progress indicators with animations
 * - Elapsed time and iterations
 *
 * Inspired by Manus and tool-ui patterns.
 */

import * as React from "react";
import { useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CheckIcon,
  XIcon,
  LoaderIcon,
  CircleIcon,
  PlayIcon,
  PauseIcon,
  BrainIcon,
  WrenchIcon,
  SearchIcon,
  CodeIcon,
  GlobeIcon,
  FileIcon,
  TerminalIcon,
  ImageIcon,
  RocketIcon,
  MessageSquareIcon,
  ClockIcon,
  ZapIcon,
  AlertCircleIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type ActivityStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface ActivityStep {
  id: string;
  type: "planning" | "tool" | "thinking" | "message";
  label: string;
  description?: string;
  status: ActivityStatus;
  toolName?: string;
  startTime?: number;
  endTime?: number;
  error?: string;
  substeps?: ActivityStep[];
  metadata?: Record<string, unknown>;
}

export interface AgentActivityTrackerProps {
  steps: ActivityStep[];
  currentStepId?: string;
  elapsedTime?: number;
  iterations?: number;
  isActive?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  className?: string;
  compact?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  web_search: SearchIcon,
  search_web: SearchIcon,
  browser_navigate: GlobeIcon,
  browser_view: GlobeIcon,
  browser_click: GlobeIcon,
  browser_input: GlobeIcon,
  shell_exec: TerminalIcon,
  code_execute: CodeIcon,
  file_read: FileIcon,
  file_write: FileIcon,
  file_str_replace: FileIcon,
  generate_image: ImageIcon,
  deploy_expose_port: RocketIcon,
  deploy_apply_deployment: RocketIcon,
  message_notify_user: MessageSquareIcon,
  message_ask_user: MessageSquareIcon,
  default: WrenchIcon,
};

// ============================================================================
// Sub-components
// ============================================================================

function StatusIcon({
  status,
  stepNumber,
  animate = true,
}: {
  status: ActivityStatus;
  stepNumber?: number;
  animate?: boolean;
}) {
  const baseClasses = "size-5 flex items-center justify-center rounded-full text-xs font-medium";

  switch (status) {
    case "pending":
      return (
        <div
          className={cn(baseClasses, "border-2 border-muted-foreground/30 text-muted-foreground")}
        >
          {stepNumber ?? <CircleIcon className="size-2" />}
        </div>
      );

    case "running":
      return (
        <div className={cn(baseClasses, "border-2 border-primary bg-primary/10")}>
          <LoaderIcon
            className={cn(
              "size-3 text-primary",
              animate && "motion-safe:animate-[spin_0.7s_linear_infinite]"
            )}
          />
        </div>
      );

    case "completed":
      return (
        <div className={cn(baseClasses, "bg-green-500/10 border-2 border-green-500")}>
          <CheckIcon
            className={cn(
              "size-3 text-green-500",
              animate && "motion-safe:animate-[spring-bounce_500ms_cubic-bezier(0.34,1.56,0.64,1)]"
            )}
          />
        </div>
      );

    case "failed":
      return (
        <div className={cn(baseClasses, "bg-red-500/10 border-2 border-red-500")}>
          <XIcon className="size-3 text-red-500" />
        </div>
      );

    case "cancelled":
      return (
        <div className={cn(baseClasses, "bg-orange-500/10 border-2 border-orange-500")}>
          <XIcon className="size-3 text-orange-500" />
        </div>
      );
  }
}

function TypeIcon({ type, toolName }: { type: ActivityStep["type"]; toolName?: string }) {
  const iconClasses = "size-3.5";

  switch (type) {
    case "planning":
      return <BrainIcon className={cn(iconClasses, "text-purple-500")} />;
    case "thinking":
      return <ZapIcon className={cn(iconClasses, "text-yellow-500")} />;
    case "message":
      return <MessageSquareIcon className={cn(iconClasses, "text-blue-500")} />;
    case "tool": {
      const Icon = TOOL_ICONS[toolName ?? "default"] ?? TOOL_ICONS.default ?? WrenchIcon;
      return <Icon className={cn(iconClasses, "text-primary")} />;
    }
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function ElapsedTimeDisplay({ startTime, endTime }: { startTime?: number; endTime?: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    if (endTime) {
      setElapsed(endTime - startTime);
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [startTime, endTime]);

  if (!startTime) return null;

  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      <ClockIcon className="size-3" />
      {formatDuration(elapsed)}
    </span>
  );
}

// ============================================================================
// Step Component
// ============================================================================

function ActivityStepItem({
  step,
  index,
  isLast,
  isCurrent,
  animationDelay,
}: {
  step: ActivityStep;
  index: number;
  isLast: boolean;
  isCurrent: boolean;
  animationDelay: number;
}) {
  const [isExpanded, setIsExpanded] = useState(step.substeps && step.substeps.length > 0);
  const hasSubsteps = step.substeps && step.substeps.length > 0;
  const isActive = step.status === "running";

  return (
    <div
      className={cn("relative", "motion-safe:animate-[fade-in_300ms_ease-out_both]")}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Connector line */}
      {!isLast && (
        <div
          className={cn(
            "absolute left-[9px] top-6 bottom-0 w-0.5",
            step.status === "completed" ? "bg-green-500/50" : "bg-border"
          )}
        />
      )}

      {/* Step content */}
      <div
        className={cn(
          "flex items-start gap-3 py-2",
          isCurrent && "bg-primary/5 -mx-2 px-2 rounded-lg"
        )}
      >
        <StatusIcon status={step.status} stepNumber={index + 1} />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2">
            <TypeIcon type={step.type} toolName={step.toolName} />

            <span
              className={cn(
                "text-sm font-medium truncate",
                isActive && "shimmer",
                step.status === "failed" && "text-red-500"
              )}
            >
              {step.label}
            </span>

            {hasSubsteps && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-0.5 hover:bg-accent rounded"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                )}
              </button>
            )}

            <div className="flex-1" />

            <ElapsedTimeDisplay startTime={step.startTime} endTime={step.endTime} />
          </div>

          {/* Description */}
          {step.description && (
            <p
              className={cn(
                "text-xs text-muted-foreground mt-0.5 line-clamp-2",
                "transition-all duration-200",
                isActive ? "opacity-100" : "opacity-70"
              )}
            >
              {step.description}
            </p>
          )}

          {/* Error */}
          {step.error && (
            <div className="flex items-start gap-1.5 mt-1.5 text-xs text-red-500">
              <AlertCircleIcon className="size-3.5 mt-0.5 flex-shrink-0" />
              <span>{step.error}</span>
            </div>
          )}

          {/* Substeps */}
          {hasSubsteps && isExpanded && (
            <div className="mt-2 ml-2 border-l-2 border-border pl-3 space-y-1">
              {step.substeps!.map((substep) => (
                <div key={substep.id} className="flex items-center gap-2 text-xs">
                  <StatusIcon status={substep.status} animate={false} />
                  <span
                    className={cn(
                      substep.status === "running" && "shimmer",
                      substep.status === "failed" && "text-red-500"
                    )}
                  >
                    {substep.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentActivityTracker({
  steps,
  currentStepId,
  elapsedTime,
  iterations,
  isActive = false,
  onPause,
  onResume,
  onCancel,
  className,
  compact = false,
}: AgentActivityTrackerProps) {
  const seenStepsRef = useRef(new Set<string>());
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Track seen steps for animation
  const stepsWithAnimation = useMemo(() => {
    const newSteps = steps.map((step, index) => {
      const isNew = !seenStepsRef.current.has(step.id);
      if (isNew) seenStepsRef.current.add(step.id);
      return { ...step, isNew, animationDelay: isNew ? index * 50 : 0 };
    });
    return newSteps;
  }, [steps]);

  // Calculate progress
  const progress = useMemo(() => {
    const completed = steps.filter((s) => s.status === "completed").length;
    return steps.length > 0 ? (completed / steps.length) * 100 : 0;
  }, [steps]);

  const completedCount = steps.filter((s) => s.status === "completed").length;

  // Auto-scroll to current step
  useEffect(() => {
    if (containerRef.current && currentStepId) {
      const currentElement = containerRef.current.querySelector(
        `[data-step-id="${currentStepId}"]`
      );
      currentElement?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentStepId]);

  // Current running step for compact display
  const currentStep =
    steps.find((s) => s.id === currentStepId) ?? steps.find((s) => s.status === "running");

  // Compact mode: collapsible plan strip
  if (compact) {
    return (
      <div className={cn("rounded-xl border bg-card overflow-hidden", className)}>
        {/* Compact strip (always visible) */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 w-full px-3 py-2 hover:bg-accent/50 transition-colors"
        >
          {/* Activity indicator */}
          {isActive && (
            <ZapIcon className="size-3.5 text-primary shrink-0 motion-safe:animate-pulse" />
          )}

          {/* Current step label */}
          {currentStep ? (
            <span
              className={cn(
                "text-xs text-muted-foreground truncate flex-1 text-left",
                isActive && "shimmer"
              )}
            >
              {currentStep.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground flex-1 text-left">Processing...</span>
          )}

          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {steps.slice(0, 6).map((s) => (
              <div
                key={s.id}
                className={cn(
                  "size-1.5 rounded-full transition-colors duration-300",
                  s.status === "completed" && "bg-green-500",
                  s.status === "running" && "bg-primary motion-safe:animate-pulse",
                  s.status === "failed" && "bg-red-500",
                  s.status === "pending" && "bg-muted-foreground/30",
                  s.status === "cancelled" && "bg-orange-500"
                )}
              />
            ))}
            {steps.length > 6 && (
              <span className="text-[10px] text-muted-foreground">+{steps.length - 6}</span>
            )}
          </div>

          {/* Step counter */}
          <span className="text-xs text-muted-foreground shrink-0">
            {completedCount}/{steps.length}
          </span>

          {elapsedTime != null && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5 shrink-0">
              <ClockIcon className="size-3" />
              {formatDuration(elapsedTime)}
            </span>
          )}

          {/* Cancel button */}
          {onCancel && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-red-500 shrink-0"
            >
              <XIcon className="size-3.5" />
            </button>
          )}

          {/* Expand chevron */}
          {isExpanded ? (
            <ChevronUpIcon className="size-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0" />
          )}
        </button>

        {/* Progress bar */}
        <div className="h-0.5 bg-muted">
          <div
            className={cn(
              "h-full bg-primary transition-all duration-300",
              progress === 100 && "motion-safe:animate-[progress-pulse_600ms_ease-out]"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Expanded step list */}
        {isExpanded && (
          <div
            ref={containerRef}
            className="px-4 py-2 max-h-[250px] overflow-y-auto border-t motion-safe:animate-[fade-in_200ms_ease-out]"
          >
            {stepsWithAnimation.map((step, index) => (
              <div key={step.id} data-step-id={step.id}>
                <ActivityStepItem
                  step={step}
                  index={index}
                  isLast={index === steps.length - 1}
                  isCurrent={step.id === currentStepId}
                  animationDelay={step.animationDelay}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className={cn("bg-card border rounded-xl", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "size-2 rounded-full",
              isActive ? "bg-green-500 motion-safe:animate-pulse" : "bg-muted-foreground"
            )}
          />
          <span className="text-sm font-medium">Agent Activity</span>
          {iterations && iterations > 1 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Loop {iterations}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {elapsedTime != null && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ClockIcon className="size-3" />
              {formatDuration(elapsedTime)}
            </span>
          )}

          {isActive && onPause && (
            <button
              onClick={onPause}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            >
              <PauseIcon className="size-4" />
            </button>
          )}

          {!isActive && onResume && (
            <button
              onClick={onResume}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            >
              <PlayIcon className="size-4" />
            </button>
          )}

          {onCancel && (
            <button
              onClick={onCancel}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-red-500"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className={cn(
            "h-full bg-primary transition-all duration-300",
            progress === 100 && "motion-safe:animate-[glow-pulse_600ms_ease-out]"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps list */}
      <div ref={containerRef} className="px-4 py-2 max-h-[400px] overflow-y-auto">
        {stepsWithAnimation.map((step, index) => (
          <div key={step.id} data-step-id={step.id}>
            <ActivityStepItem
              step={step}
              index={index}
              isLast={index === steps.length - 1}
              isCurrent={step.id === currentStepId}
              animationDelay={step.animationDelay}
            />
          </div>
        ))}

        {steps.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Waiting for agent activity...
          </div>
        )}
      </div>
    </div>
  );
}
