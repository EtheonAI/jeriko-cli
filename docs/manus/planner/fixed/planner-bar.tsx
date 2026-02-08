"use client";

/**
 * PlannerBar — Collapsible bottom bar showing agent task progress.
 *
 * Sits between the message list and the prompt input in the chat layout.
 * Collapsed: compact strip with activity indicator, step title, progress, and tool-access buttons.
 * Expanded: full plan with animated TodoIcons, connector lines, progress bar, and per-step tool buttons.
 *
 * NEW: Each step now shows clickable tool buttons (IDE, Browser, Terminal, etc.)
 * that let the user switch the canvas view to see that tool's output.
 *
 * Uses the same visual language as PlanWindow (tool-ui port).
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
  CodeIcon,
  TerminalIcon,
  GlobeIcon,
  FileIcon,
  SearchIcon,
  RocketIcon,
  FileTextIcon,
  MonitorIcon,
  MessageSquareIcon,
} from "lucide-react";
import type {
  PlannerState,
  PlanStep,
  PlanStepStatus,
  PlanStepTool,
} from "./use-planner-state";
import type { CanvasViewType } from "../canvas/use-canvas";

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
  /** Called when user clicks a tool button to switch the canvas view */
  onToolSelect: (toolCallId: string, canvasView: CanvasViewType) => void;
  /** The currently selected/active tool call ID in the canvas (for highlighting) */
  activeToolCallId?: string | null;
  className?: string;
}

// ============================================================================
// Tool View Config — Icon + Label for each canvas view type
// ============================================================================

interface ToolViewConfig {
  icon: React.ElementType;
  label: string;
  colorClass: string;
  activeColorClass: string;
}

const TOOL_VIEW_CONFIG: Record<string, ToolViewConfig> = {
  terminal: {
    icon: TerminalIcon,
    label: "Terminal",
    colorClass: "text-green-500/70 bg-green-500/10 hover:bg-green-500/20 border-green-500/20",
    activeColorClass: "text-green-400 bg-green-500/25 border-green-500/40 ring-1 ring-green-500/30",
  },
  browser: {
    icon: GlobeIcon,
    label: "Browser",
    colorClass: "text-blue-500/70 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20",
    activeColorClass: "text-blue-400 bg-blue-500/25 border-blue-500/40 ring-1 ring-blue-500/30",
  },
  code: {
    icon: CodeIcon,
    label: "IDE",
    colorClass: "text-purple-500/70 bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20",
    activeColorClass: "text-purple-400 bg-purple-500/25 border-purple-500/40 ring-1 ring-purple-500/30",
  },
  file: {
    icon: FileTextIcon,
    label: "File",
    colorClass: "text-amber-500/70 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20",
    activeColorClass: "text-amber-400 bg-amber-500/25 border-amber-500/40 ring-1 ring-amber-500/30",
  },
  search: {
    icon: SearchIcon,
    label: "Search",
    colorClass: "text-cyan-500/70 bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/20",
    activeColorClass: "text-cyan-400 bg-cyan-500/25 border-cyan-500/40 ring-1 ring-cyan-500/30",
  },
  deploy: {
    icon: RocketIcon,
    label: "Deploy",
    colorClass: "text-rose-500/70 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20",
    activeColorClass: "text-rose-400 bg-rose-500/25 border-rose-500/40 ring-1 ring-rose-500/30",
  },
  message: {
    icon: MessageSquareIcon,
    label: "Message",
    colorClass: "text-muted-foreground/60 bg-muted/40 hover:bg-muted/60 border-border/30",
    activeColorClass: "text-foreground bg-muted/60 border-border/50 ring-1 ring-border/40",
  },
  empty: {
    icon: MonitorIcon,
    label: "Output",
    colorClass: "text-muted-foreground/60 bg-muted/40 hover:bg-muted/60 border-border/30",
    activeColorClass: "text-foreground bg-muted/60 border-border/50 ring-1 ring-border/40",
  },
};

function getToolConfig(canvasView: CanvasViewType): ToolViewConfig {
  return TOOL_VIEW_CONFIG[canvasView] ?? TOOL_VIEW_CONFIG.empty;
}

// ============================================================================
// TodoIcon — Matches PlanWindow / tool-ui with spring animations
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
// ToolButton — Clickable pill that switches the canvas view
// ============================================================================

function ToolButton({
  tool,
  isSelected,
  onToolSelect,
}: {
  tool: PlanStepTool;
  isSelected: boolean;
  onToolSelect: PlannerBarProps["onToolSelect"];
}) {
  const config = getToolConfig(tool.canvasView);
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // Don't trigger the parent step expand/collapse
        onToolSelect(tool.toolCallId, tool.canvasView);
      }}
      className={cn(
        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all duration-150",
        isSelected ? config.activeColorClass : config.colorClass
      )}
      title={`View ${config.label}: ${tool.toolName}`}
    >
      <Icon className="size-3 shrink-0" />
      <span className="truncate max-w-[80px]">{config.label}</span>
      {tool.isActive && (
        <span className="relative flex size-1.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-50" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
    </button>
  );
}

// ============================================================================
// CollapsedToolTabs — Quick-access tool buttons in the collapsed bar
// ============================================================================

function CollapsedToolTabs({
  state,
  activeToolCallId,
  onToolSelect,
}: {
  state: PlannerState;
  activeToolCallId?: string | null;
  onToolSelect: PlannerBarProps["onToolSelect"];
}) {
  // Collect the most recent unique canvas views across all steps
  const recentTools = React.useMemo(() => {
    const seen = new Map<CanvasViewType, PlanStepTool>();
    // Walk steps in reverse to get the most recent tools first
    for (let i = state.steps.length - 1; i >= 0; i--) {
      const step = state.steps[i];
      for (let j = step.tools.length - 1; j >= 0; j--) {
        const tool = step.tools[j];
        if (!seen.has(tool.canvasView)) {
          seen.set(tool.canvasView, tool);
        }
      }
    }
    // Return at most 4 unique view types, in order of most recent first
    return Array.from(seen.values()).slice(0, 4);
  }, [state.steps]);

  if (recentTools.length === 0) return null;

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {recentTools.map((tool) => {
        const config = getToolConfig(tool.canvasView);
        const Icon = config.icon;
        const isSelected = activeToolCallId === tool.toolCallId;

        return (
          <button
            key={tool.canvasView}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToolSelect(tool.toolCallId, tool.canvasView);
            }}
            className={cn(
              "flex items-center justify-center rounded-md border p-1 transition-all duration-150",
              isSelected ? config.activeColorClass : config.colorClass
            )}
            title={`Switch to ${config.label}`}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// StepItem — With connector line AND tool buttons
// ============================================================================

function StepItem({
  step,
  isLast,
  isNew,
  staggerDelay,
  activeToolCallId,
  onToolSelect,
}: {
  step: PlanStep;
  isLast: boolean;
  isNew: boolean;
  staggerDelay: number;
  activeToolCallId?: string | null;
  onToolSelect: PlannerBarProps["onToolSelect"];
}) {
  // Deduplicate tools by canvasView within a step (show one button per view type)
  const uniqueTools = React.useMemo(() => {
    const seen = new Map<CanvasViewType, PlanStepTool>();
    for (const tool of step.tools) {
      // Keep the most recent (last) tool for each view type
      seen.set(tool.canvasView, tool);
    }
    return Array.from(seen.values());
  }, [step.tools]);

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
      {/* Main row: icon + title */}
      <div className="flex items-start gap-2.5">
        {/* Connector line */}
        {!isLast && (
          <div
            className={cn(
              "absolute left-[9px] top-7 w-px",
              step.status === "completed"
                ? "bg-primary/30"
                : "bg-border/50"
            )}
            style={{ height: "calc(100% - 0.5rem)" }}
            aria-hidden="true"
          />
        )}

        {/* Status icon */}
        <div className="relative z-10 mt-0.5 shrink-0">
          <TodoIcon status={step.status} />
        </div>

        {/* Title + tool buttons */}
        <div className="flex-1 min-w-0">
          <span
            className={cn(
              "text-sm leading-5 break-words",
              step.status === "in_progress" && "font-medium text-foreground motion-safe:shimmer shimmer-invert",
              step.status === "completed" && "text-muted-foreground",
              step.status === "pending" && "text-muted-foreground/60",
              step.status === "error" && "font-medium text-destructive"
            )}
          >
            {step.title}
          </span>

          {/* Tool buttons row */}
          {uniqueTools.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {uniqueTools.map((tool) => (
                <ToolButton
                  key={tool.toolCallId}
                  tool={tool}
                  isSelected={activeToolCallId === tool.toolCallId}
                  onToolSelect={onToolSelect}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

// ============================================================================
// ProgressBar — With celebration glow at 100%
// ============================================================================

function ProgressBar({ progress, isCelebrating }: { progress: number; isCelebrating: boolean }) {
  return (
    <div className="relative h-1 overflow-hidden bg-muted/40">
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
  onToolSelect,
  activeToolCallId,
  className,
}: PlannerBarProps) {
  const { steps, currentStepIndex, totalSteps, completedSteps, progress, isActive } =
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
    <div className={cn("flex-shrink-0", className)}>
      {/* Progress bar — thin strip at top */}
      <ProgressBar progress={progress} isCelebrating={isCelebrating} />

      {/* Collapsed bar (always visible) */}
      <div className="mx-auto max-w-3xl px-4">
        <div className="flex w-full items-center gap-3 py-2">
          {/* Left side: clickable expand/collapse area */}
          <button
            type="button"
            onClick={onToggleExpanded}
            className="flex flex-1 items-center gap-3 text-left transition-colors hover:opacity-80 min-w-0"
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

          {/* Right side: quick-access tool tabs (always visible in collapsed state) */}
          {!isExpanded && (
            <CollapsedToolTabs
              state={state}
              activeToolCallId={activeToolCallId}
              onToolSelect={onToolSelect}
            />
          )}
        </div>
      </div>

      {/* Expanded plan list (animated height) */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="mx-auto max-w-3xl px-4 pb-2">
            <div className="rounded-lg bg-muted/30 px-4 py-3">
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
                      activeToolCallId={activeToolCallId}
                      onToolSelect={onToolSelect}
                    />
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
