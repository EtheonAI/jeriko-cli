"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { ChevronDownIcon, CheckIcon } from "lucide-react";
import type { UIMessage } from "ai";
import {
  TextPartRenderer,
  ReasoningPartRenderer,
  FilePartRenderer,
  ToolPartRenderer,
  SourcesGroup,
} from "@repo/ai/components/parts";
import type {
  TextUIPart,
  ReasoningUIPart,
  FileUIPart,
  StaticToolUIPart,
  DynamicToolUIPart,
  SourceUrlUIPart,
  SourceDocumentUIPart,
  UIMessagePart,
} from "@repo/ai/lib/types";
import {
  isTextUIPart,
  isReasoningUIPart,
  isFileUIPart,
  isToolUIPart,
  isSourceUrlUIPart,
  isSourceDocumentUIPart,
  isStepStartUIPart,
  getToolName,
} from "@repo/ai/lib/types";

// ============================================================================
// Constants
// ============================================================================

/** Tools that should be auto-hidden when preceded by a sibling in the same category */
const REDUNDANT_TOOLS = new Set([
  "browser_view",   // Agent checking page state after another browser action
  "shell_view",     // Agent viewing terminal after shell_exec
]);

/** Tools that indicate a plan — render grouped under plan steps */
const PLAN_TOOL_NAMES = new Set(["show_plan"]);

// ============================================================================
// Types for plan step grouping
// ============================================================================

interface PlanStep {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "error";
}

interface GroupedSection {
  type: "plan-step";
  step: PlanStep;
  parts: UIMessagePart[];
  partIndices: number[];
}

interface FlatSection {
  type: "flat";
  parts: UIMessagePart[];
  partIndices: number[];
}

type MessageSection = GroupedSection | FlatSection;

// ============================================================================
// Grouping Logic
// ============================================================================

function extractPlanSteps(part: StaticToolUIPart | DynamicToolUIPart): PlanStep[] {
  const data = (part.state === "output-available" && part.output
    ? part.output
    : part.input) as Record<string, unknown> | undefined;

  if (!data) return [];
  const todos = (data.todos ?? data.steps ?? data.phases) as Array<{
    id?: string;
    label?: string;
    title?: string;
    status?: string;
  }> | undefined;

  if (!todos || !Array.isArray(todos) || todos.length === 0) return [];

  return todos.map((t, i) => ({
    id: t.id || `step-${i + 1}`,
    label: t.label || t.title || `Step ${i + 1}`,
    status: normalizeStepStatus(t.status),
  }));
}

function normalizeStepStatus(status: string | undefined): PlanStep["status"] {
  if (!status) return "pending";
  const s = status.toLowerCase().replace(/-/g, "_");
  if (s === "completed" || s === "done" || s === "complete") return "completed";
  if (s === "in_progress" || s === "doing" || s === "running") return "in_progress";
  if (s === "error" || s === "failed" || s === "cancelled") return "error";
  return "pending";
}

function shouldHideTool(
  toolName: string,
  index: number,
  parts: UIMessagePart[],
): boolean {
  if (!REDUNDANT_TOOLS.has(toolName)) return false;

  // Look backwards for the previous tool call
  const category = toolName.split("_")[0]; // "browser" or "shell"
  for (let i = index - 1; i >= 0; i--) {
    const prev = parts[i];
    if (!prev || typeof prev !== "object" || !("type" in prev)) continue;

    // Skip text parts — they don't break the chain
    if (isTextUIPart(prev)) continue;

    if (isToolUIPart(prev)) {
      const prevName = getToolName(prev as StaticToolUIPart | DynamicToolUIPart);
      if (prevName === toolName) return true; // Consecutive same tool → hide
      if (prevName.startsWith(category + "_") && prevName !== toolName) return true; // Same category predecessor → hide
      return false; // Different category → don't hide
    }

    break; // Non-text, non-tool part → stop searching
  }
  return false;
}

function buildSections(parts: UIMessagePart[]): MessageSection[] {
  if (!parts || !Array.isArray(parts)) return [];

  const sections: MessageSection[] = [];
  let currentPlanSteps: PlanStep[] | null = null;
  let currentStepIndex = 0;
  let currentStepParts: UIMessagePart[] = [];
  let currentStepIndices: number[] = [];
  let flatParts: UIMessagePart[] = [];
  let flatIndices: number[] = [];

  // Flush flat parts to a flat section
  const flushFlat = () => {
    if (flatParts.length > 0) {
      sections.push({ type: "flat", parts: flatParts, partIndices: flatIndices });
      flatParts = [];
      flatIndices = [];
    }
  };

  // Flush current plan step to a grouped section
  const flushStep = () => {
    if (currentPlanSteps && currentStepIndex < currentPlanSteps.length && currentStepParts.length > 0) {
      sections.push({
        type: "plan-step",
        step: currentPlanSteps[currentStepIndex]!,
        parts: currentStepParts,
        partIndices: currentStepIndices,
      });
      currentStepParts = [];
      currentStepIndices = [];
    }
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (!part || typeof part !== "object" || !("type" in part)) continue;
    if (isStepStartUIPart(part)) continue;
    if (isSourceUrlUIPart(part) || isSourceDocumentUIPart(part)) continue;

    // Detect show_plan tool — switch to grouped mode
    if (isToolUIPart(part)) {
      const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
      const toolName = getToolName(toolPart);

      if (PLAN_TOOL_NAMES.has(toolName)) {
        const steps = extractPlanSteps(toolPart);
        if (steps.length > 0) {
          // Flush any pending flat parts
          flushFlat();
          // Flush any pending step parts from previous plan
          flushStep();

          currentPlanSteps = steps;
          currentStepIndex = 0;

          // Add empty section for first step — tool calls will populate it
          // Also push the plan overview as a special plan-header section
          // Find the first in_progress or pending step
          const activeIdx = steps.findIndex(s => s.status === "in_progress");
          currentStepIndex = activeIdx >= 0 ? activeIdx : 0;

          // Create sections for all completed steps before the active one
          for (let s = 0; s < currentStepIndex; s++) {
            sections.push({
              type: "plan-step",
              step: steps[s]!,
              parts: [],
              partIndices: [],
            });
          }

          continue;
        }
      }

      // Auto-hide redundant tools
      if (shouldHideTool(toolName, i, parts)) continue;
    }

    // If we're in plan mode, add parts to current step
    if (currentPlanSteps) {
      // Check if we should advance to next step:
      // When we encounter a text part after tool calls, it often signals
      // the agent finishing one step and transitioning to the next
      if (isTextUIPart(part) && currentStepParts.length > 0 &&
          currentStepParts.some(p => isToolUIPart(p))) {
        // Flush current step
        flushStep();

        // Advance to next step (if available)
        if (currentStepIndex < currentPlanSteps.length - 1) {
          currentStepIndex++;
        }

        // Add this text to the new step
        currentStepParts.push(part);
        currentStepIndices.push(i);
        continue;
      }

      currentStepParts.push(part);
      currentStepIndices.push(i);
    } else {
      // Flat mode
      flatParts.push(part);
      flatIndices.push(i);
    }
  }

  // Flush remaining
  if (currentPlanSteps) {
    flushStep();

    // Add remaining steps that weren't populated
    for (let s = currentStepIndex + 1; s < currentPlanSteps.length; s++) {
      sections.push({
        type: "plan-step",
        step: currentPlanSteps[s]!,
        parts: [],
        partIndices: [],
      });
    }
  }
  flushFlat();

  return sections;
}

// ============================================================================
// Plan Step Section Component (Manus-style)
// ============================================================================

function PlanStepSection({
  step,
  children,
  isLast,
  defaultOpen,
}: {
  step: PlanStep;
  children: React.ReactNode;
  isLast: boolean;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasChildren = React.Children.count(children) > 0;

  return (
    <div className="flex flex-col">
      {/* Step header */}
      <button
        type="button"
        onClick={() => hasChildren && setIsOpen(!isOpen)}
        className={cn(
          "text-sm w-full flex gap-2 justify-between items-center truncate py-1",
          hasChildren && "cursor-pointer hover:opacity-80",
          !hasChildren && "cursor-default",
        )}
      >
        <div className="flex flex-row gap-2 items-center truncate">
          {/* Status icon */}
          <StepStatusIcon status={step.status} />

          {/* Step title */}
          <span className={cn(
            "truncate font-medium text-sm",
            step.status === "completed" && "text-muted-foreground",
            step.status === "in_progress" && "text-foreground",
            step.status === "pending" && "text-muted-foreground/60",
            step.status === "error" && "text-destructive",
          )}>
            {step.label}
          </span>
        </div>

        {/* Chevron */}
        {hasChildren && (
          <ChevronDownIcon
            className={cn(
              "size-4 flex-shrink-0 text-muted-foreground/50 transition-transform duration-300",
              isOpen && "rotate-180",
            )}
          />
        )}
      </button>

      {/* Nested content with vertical dashed line */}
      {hasChildren && (
        <div
          className={cn(
            "transition-[max-height,opacity] duration-150 ease-in-out overflow-hidden",
            isOpen ? "max-h-[100000px] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="flex">
            {/* Vertical dashed line column */}
            {!isLast && (
              <div className="w-6 relative flex-shrink-0">
                <div className="border-l border-dashed border-border/40 absolute left-2 top-0 bottom-0" />
              </div>
            )}
            {isLast && <div className="w-6 flex-shrink-0" />}

            {/* Nested content */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-0 pb-2">
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Step Status Icon (Manus-style)
// ============================================================================

function StepStatusIcon({ status }: { status: PlanStep["status"] }) {
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

// ============================================================================
// Part Renderer (renders individual parts — shared between flat and grouped)
// ============================================================================

function renderPart(
  part: UIMessagePart,
  index: number,
  messageId: string,
  onViewInCanvas?: (toolCallId: string) => void,
) {
  if (!part || typeof part !== "object" || !("type" in part)) return null;
  if (isStepStartUIPart(part)) return null;
  if (isSourceUrlUIPart(part) || isSourceDocumentUIPart(part)) return null;

  // Text
  if (isTextUIPart(part)) {
    if (!part.text) return null;
    return (
      <TextPartRenderer
        key={`text-${index}`}
        part={part as TextUIPart}
      />
    );
  }

  // Reasoning
  if (isReasoningUIPart(part)) {
    return (
      <ReasoningPartRenderer
        key={`reasoning-${index}`}
        part={part as ReasoningUIPart}
      />
    );
  }

  // File parts
  if (isFileUIPart(part)) {
    return (
      <FilePartRenderer
        key={`file-${index}`}
        part={part as FileUIPart}
      />
    );
  }

  // Tool parts — render as Manus-style pills (never show_plan, it's handled by grouping)
  if (isToolUIPart(part)) {
    const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
    const toolName = getToolName(toolPart);

    // Skip show_plan — handled by plan step grouping above
    if (PLAN_TOOL_NAMES.has(toolName)) return null;

    return (
      <ToolPartRenderer
        key={`tool-${toolPart.toolCallId}`}
        part={toolPart}
        onViewInCanvas={onViewInCanvas}
      />
    );
  }

  return null;
}

// ============================================================================
// Main Component
// ============================================================================

interface MessageRendererProps {
  message: UIMessage;
  isLastMessage: boolean;
  isStreaming: boolean;
  onViewSources?: (sources: (SourceUrlUIPart | SourceDocumentUIPart)[]) => void;
  onViewInCanvas?: (toolCallId: string) => void;
}

export function MessageRenderer({
  message,
  isLastMessage,
  isStreaming,
  onViewSources,
  onViewInCanvas,
}: MessageRendererProps) {
  const parts = message.parts as unknown as UIMessagePart[];

  // Collect native source parts for grouped display at the bottom
  const sources = useMemo(() => {
    if (!parts || !Array.isArray(parts)) return [];
    const collected: (SourceUrlUIPart | SourceDocumentUIPart)[] = [];
    const seenUrls = new Set<string>();

    for (const part of parts) {
      if (!part || typeof part !== "object" || !("type" in part)) continue;

      if (isSourceUrlUIPart(part)) {
        if (!seenUrls.has(part.url)) {
          seenUrls.add(part.url);
          collected.push(part);
        }
      } else if (isSourceDocumentUIPart(part)) {
        collected.push(part);
      }
    }
    return collected;
  }, [parts]);

  // Check if message has plan steps
  const hasPlan = useMemo(() => {
    if (!parts || !Array.isArray(parts)) return false;
    return parts.some(p => {
      if (!p || typeof p !== "object" || !("type" in p)) return false;
      if (!isToolUIPart(p)) return false;
      const name = getToolName(p as StaticToolUIPart | DynamicToolUIPart);
      return PLAN_TOOL_NAMES.has(name);
    });
  }, [parts]);

  // Build sections — group tool calls under plan steps when plan exists
  const sections = useMemo(() => {
    if (!parts || !Array.isArray(parts)) return [];
    if (!hasPlan) return []; // Will use flat rendering path
    return buildSections(parts);
  }, [parts, hasPlan]);

  // Flat rendering — no plan, just render parts sequentially with auto-hide
  if (!hasPlan) {
    return (
      <>
        {(parts ?? []).map((part, i) => {
          if (!part || typeof part !== "object" || !("type" in part)) return null;
          if (isStepStartUIPart(part)) return null;
          if (isSourceUrlUIPart(part) || isSourceDocumentUIPart(part)) return null;

          // Auto-hide redundant tools even in flat mode
          if (isToolUIPart(part)) {
            const toolName = getToolName(part as StaticToolUIPart | DynamicToolUIPart);
            if (shouldHideTool(toolName, i, parts)) return null;
          }

          return renderPart(part, i, message.id, onViewInCanvas);
        })}

        {sources.length > 0 && <SourcesGroup sources={sources} onViewSources={onViewSources} />}
      </>
    );
  }

  // Grouped rendering — plan steps with nested tool pills
  return (
    <>
      {sections.map((section, sIdx) => {
        if (section.type === "flat") {
          return (
            <React.Fragment key={`flat-${sIdx}`}>
              {section.parts.map((part, pIdx) =>
                renderPart(part, section.partIndices[pIdx]!, message.id, onViewInCanvas)
              )}
            </React.Fragment>
          );
        }

        // Plan step section
        const { step, parts: stepParts, partIndices } = section;
        const isLast = sIdx === sections.length - 1;
        const isActive = step.status === "in_progress" || step.status === "pending";

        return (
          <PlanStepSection
            key={step.id}
            step={step}
            isLast={isLast}
            defaultOpen={isActive || stepParts.length > 0}
          >
            {stepParts.map((part, pIdx) =>
              renderPart(part, partIndices[pIdx]!, message.id, onViewInCanvas)
            )}
          </PlanStepSection>
        );
      })}

      {sources.length > 0 && <SourcesGroup sources={sources} onViewSources={onViewSources} />}
    </>
  );
}
