"use client";

import * as React from "react";
import { useMemo, useState, useCallback } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  ChevronDownIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleDotIcon,
  CircleIcon,
  XCircleIcon,
} from "lucide-react";
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

const REDUNDANT_TOOLS = new Set(["browser_view", "shell_view"]);
const PLAN_TOOL_NAMES = new Set(["show_plan"]);

// ============================================================================
// Types for plan step grouping
// ============================================================================

interface PlanStep {
  id: string;
  label: string;
  description?: string;
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
  const data = (part.state === "output-available" && part.output ? part.output : part.input) as
    | Record<string, unknown>
    | undefined;

  if (!data) return [];
  const todos = (data.plan ?? data.todos ?? data.steps ?? data.phases) as
    | Array<{ id?: string; label?: string; title?: string; description?: string; status?: string }>
    | undefined;

  if (!todos || !Array.isArray(todos) || todos.length === 0) return [];

  return todos.map((t, i) => ({
    id: t.id || `step-${i + 1}`,
    label: t.label || t.title || `Step ${i + 1}`,
    description: t.description,
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

function shouldHideTool(toolName: string, index: number, parts: UIMessagePart[]): boolean {
  if (!REDUNDANT_TOOLS.has(toolName)) return false;
  const category = toolName.split("_")[0];
  for (let i = index - 1; i >= 0; i--) {
    const prev = parts[i];
    if (!prev || typeof prev !== "object" || !("type" in prev)) continue;
    if (isTextUIPart(prev)) continue;
    if (isToolUIPart(prev)) {
      const prevName = getToolName(prev as StaticToolUIPart | DynamicToolUIPart);
      if (prevName === toolName) return true;
      if (prevName.startsWith(category + "_") && prevName !== toolName) return true;
      return false;
    }
    break;
  }
  return false;
}

function buildSections(parts: UIMessagePart[]): MessageSection[] {
  if (!parts || !Array.isArray(parts)) return [];

  // --- Pass 1: Find all show_plan invocations and determine which step is active at each point ---
  interface PlanInvocation {
    partIndex: number;
    steps: PlanStep[];
    activeStepId: string | null; // null = all completed
  }

  const planInvocations: PlanInvocation[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (!part || typeof part !== "object" || !("type" in part)) continue;
    if (!isToolUIPart(part)) continue;
    const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
    const toolName = getToolName(toolPart);
    if (!PLAN_TOOL_NAMES.has(toolName)) continue;

    const steps = extractPlanSteps(toolPart);
    if (steps.length === 0) continue;

    const activeIdx = steps.findIndex((s) => s.status === "in_progress");
    planInvocations.push({
      partIndex: i,
      steps,
      activeStepId: activeIdx >= 0 ? steps[activeIdx]!.id : null,
    });
  }

  if (planInvocations.length === 0) return [];

  // Use the LAST invocation's steps as the final plan state (latest statuses)
  const finalSteps = planInvocations[planInvocations.length - 1]!.steps;

  // --- Pass 2: Assign non-plan parts to their active step ---
  const stepBuckets = new Map<string, { parts: UIMessagePart[]; partIndices: number[] }>();
  for (const step of finalSteps) {
    stepBuckets.set(step.id, { parts: [], partIndices: [] });
  }

  const sections: MessageSection[] = [];
  let flatParts: UIMessagePart[] = [];
  let flatIndices: number[] = [];
  let invIdx = 0;
  let currentActiveStepId: string | null = null;
  let inPlanRegion = false;

  const flushFlat = () => {
    if (flatParts.length > 0) {
      sections.push({ type: "flat", parts: flatParts, partIndices: flatIndices });
      flatParts = [];
      flatIndices = [];
    }
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (!part || typeof part !== "object" || !("type" in part)) continue;
    if (isStepStartUIPart(part)) continue;
    if (isSourceUrlUIPart(part) || isSourceDocumentUIPart(part)) continue;

    // Check if this is a plan invocation
    if (
      isToolUIPart(part) &&
      invIdx < planInvocations.length &&
      planInvocations[invIdx]!.partIndex === i
    ) {
      if (!inPlanRegion) {
        flushFlat();
        inPlanRegion = true;
      }
      currentActiveStepId = planInvocations[invIdx]!.activeStepId;
      invIdx++;
      continue; // Don't render show_plan itself
    }

    // Skip show_plan parts that weren't matched (shouldn't happen, but safety)
    if (isToolUIPart(part)) {
      const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
      const toolName = getToolName(toolPart);
      if (PLAN_TOOL_NAMES.has(toolName)) continue;
      if (shouldHideTool(toolName, i, parts)) continue;
    }

    if (inPlanRegion && currentActiveStepId) {
      const bucket = stepBuckets.get(currentActiveStepId);
      if (bucket) {
        bucket.parts.push(part);
        bucket.partIndices.push(i);
      } else {
        // Step ID not in final plan — treat as flat
        flatParts.push(part);
        flatIndices.push(i);
      }
    } else if (inPlanRegion && !currentActiveStepId) {
      // All steps completed — remaining content is flat (the "answer")
      flatParts.push(part);
      flatIndices.push(i);
    } else {
      // Before first plan invocation
      flatParts.push(part);
      flatIndices.push(i);
    }
  }

  // Build final sections: leading flat → plan steps → trailing flat
  flushFlat();

  for (const step of finalSteps) {
    const bucket = stepBuckets.get(step.id)!;
    sections.push({
      type: "plan-step",
      step,
      parts: bucket.parts,
      partIndices: bucket.partIndices,
    });
  }

  flushFlat();

  return sections;
}

// ============================================================================
// Collapsible Section — shared between PlanStep and AutoGrouped
// ============================================================================

function CollapsibleSection({
  icon,
  title,
  description,
  badge,
  isLast,
  defaultOpen,
  lineColor,
  titleClassName,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  isLast: boolean;
  defaultOpen: boolean;
  lineColor: string;
  titleClassName?: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasChildren = React.Children.count(children) > 0;

  const toggle = useCallback(() => {
    if (hasChildren) setIsOpen((v) => !v);
  }, [hasChildren]);

  return (
    <div className="flex gap-3 group/section">
      {/* Timeline column — Manus: w-[24px], icon at center, dashed line at start-[8px] */}
      <div className="flex flex-col items-center w-6 shrink-0 relative">
        <div className="flex size-4 shrink-0 items-center justify-center z-10">
          {icon}
        </div>
        {!isLast && (
          <div
            className={cn(
              "absolute border-l border-dashed top-4",
              lineColor,
            )}
            style={{ left: "8px", height: "calc(100% + 14px)" }}
          />
        )}
      </div>

      {/* Content column */}
      <div className={cn("min-w-0 flex-1", !isLast && "pb-2")}>
        {/* Header row — Manus: text-sm, font-medium, gap-2, clickable */}
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "flex items-center gap-2 w-full text-left rounded-md -ml-1 px-1 py-0.5",
            hasChildren && "cursor-pointer hover:bg-muted/30",
            !hasChildren && "cursor-default",
            "transition-colors duration-150",
          )}
        >
          <span
            className={cn(
              "flex-1 text-sm font-medium truncate",
              titleClassName ?? "text-[var(--rubic-text-primary,theme(colors.foreground/70))]",
            )}
          >
            {title}
          </span>

          {badge}

          {/* Manus: chevron-down rotates 180° when expanded */}
          {hasChildren && (
            <ChevronDownIcon
              className={cn(
                "size-4 shrink-0 text-muted-foreground/50 transition-transform duration-300",
                isOpen && "rotate-180",
              )}
            />
          )}
        </button>

        {/* Description */}
        {description && (
          <p className="text-xs leading-relaxed mt-0.5 ml-1 text-muted-foreground/60">
            {description}
          </p>
        )}

        {/* Collapsible body — Manus: gap-3 (12px), pt-2, transition max-height */}
        {hasChildren && (
          <div
            className={cn(
              "transition-[max-height,opacity] duration-150 ease-in-out overflow-hidden",
              isOpen ? "max-h-[100000px] opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <div className="flex flex-col gap-3 pt-2">
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Plan Step Section — wraps CollapsibleSection with plan-specific styling
// ============================================================================

function PlanStepSection({
  step,
  children,
  isLast,
  defaultOpen,
  toolCount,
}: {
  step: PlanStep;
  children: React.ReactNode;
  isLast: boolean;
  defaultOpen: boolean;
  toolCount: number;
}) {
  const lineColor =
    step.status === "completed"
      ? "border-green-500/30"
      : step.status === "in_progress"
        ? "border-blue-500/30"
        : "border-[var(--rubic-border-dark,theme(colors.border))]";

  const titleColor =
    step.status === "completed"
      ? "text-foreground/70"
      : step.status === "in_progress"
        ? "text-foreground"
        : step.status === "error"
          ? "text-destructive"
          : "text-muted-foreground/40";

  return (
    <CollapsibleSection
      icon={<StepStatusIcon status={step.status} />}
      title={step.label}
      description={step.description}
      badge={
        toolCount > 0 ? (
          <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">
            {toolCount}
          </span>
        ) : undefined
      }
      isLast={isLast}
      defaultOpen={defaultOpen}
      lineColor={lineColor}
      titleClassName={titleColor}
    >
      {children}
    </CollapsibleSection>
  );
}

// ============================================================================
// Step Status Icon
// ============================================================================

function StepStatusIcon({ status }: { status: PlanStep["status"] }) {
  if (status === "completed") {
    // Manus: filled circle with checkmark, 16x16, bg-[var(--text-disable)]
    return (
      <div className="size-4 flex-shrink-0 flex items-center justify-center rounded-full bg-[var(--rubic-text-disable,theme(colors.muted.foreground/40))]">
        <CheckIcon className="size-2.5 text-white" />
      </div>
    );
  }
  if (status === "in_progress") {
    return <CircleDotIcon className="size-4 text-blue-500 animate-pulse" />;
  }
  if (status === "error") {
    return <XCircleIcon className="size-4 text-destructive" />;
  }
  // Pending — Manus: empty circle with border, 16x16
  return (
    <div className="size-4 flex-shrink-0 flex items-center justify-center border border-[var(--rubic-border-dark,theme(colors.border))] rounded-full" />
  );
}

// ============================================================================
// Auto-grouped tool rendering — Manus-style visual without show_plan
// ============================================================================

function getToolGroupLabel(toolNames: string[]): string {
  const categories = new Set(toolNames.map((n) => {
    if (n.includes("search") || n === "info_search_web") return "search";
    if (n.startsWith("browser_")) return "browser";
    if (n.startsWith("shell_") || n === "code_execute") return "terminal";
    if (n.startsWith("file_")) return "code";
    if (n.startsWith("deploy_")) return "deploy";
    if (n === "generate_image") return "image";
    return "other";
  }));

  if (categories.has("search") && categories.size === 1) return "Researching";
  if (categories.has("browser") && categories.size === 1) return "Browsing";
  if (categories.has("terminal") && categories.size === 1) return "Running commands";
  if (categories.has("code") && categories.size === 1) return "Editing files";
  if (categories.has("deploy")) return "Deploying";
  if (categories.has("image")) return "Creating";
  if (categories.has("search")) return "Researching & browsing";
  return "Working";
}

function AutoGroupedToolRendering({
  parts,
  messageId,
  onViewInCanvas,
  timestamp,
  onPreviewFile,
}: {
  parts: UIMessagePart[];
  messageId: string;
  onViewInCanvas?: (toolCallId: string) => void;
  timestamp?: string;
  onPreviewFile?: (file: FileUIPart) => void;
}) {
  const { leading, grouped, trailing, toolNames } = useMemo(() => {
    const leadingParts: { part: UIMessagePart; idx: number }[] = [];
    const groupedParts: { part: UIMessagePart; idx: number }[] = [];
    const trailingParts: { part: UIMessagePart; idx: number }[] = [];
    const names: string[] = [];

    let firstToolIdx = -1;
    let lastToolIdx = -1;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]!;
      if (!p || typeof p !== "object" || !("type" in p)) continue;
      if (!isToolUIPart(p)) continue;
      const tn = getToolName(p as StaticToolUIPart | DynamicToolUIPart);
      if (PLAN_TOOL_NAMES.has(tn)) continue;
      if (shouldHideTool(tn, i, parts)) continue;
      if (firstToolIdx === -1) firstToolIdx = i;
      lastToolIdx = i;
      names.push(tn);
    }

    if (firstToolIdx === -1) {
      for (let i = 0; i < parts.length; i++) {
        leadingParts.push({ part: parts[i]!, idx: i });
      }
      return { leading: leadingParts, grouped: groupedParts, trailing: trailingParts, toolNames: names };
    }

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]!;
      if (!p || typeof p !== "object" || !("type" in p)) continue;
      if (isStepStartUIPart(p)) continue;
      if (isSourceUrlUIPart(p) || isSourceDocumentUIPart(p)) continue;

      if (i < firstToolIdx) {
        leadingParts.push({ part: p, idx: i });
      } else if (i <= lastToolIdx) {
        if (isToolUIPart(p)) {
          const tn = getToolName(p as StaticToolUIPart | DynamicToolUIPart);
          if (shouldHideTool(tn, i, parts)) continue;
        }
        groupedParts.push({ part: p, idx: i });
      } else {
        trailingParts.push({ part: p, idx: i });
      }
    }

    return { leading: leadingParts, grouped: groupedParts, trailing: trailingParts, toolNames: names };
  }, [parts]);

  const toolCount = toolNames.length;
  const groupLabel = getToolGroupLabel(toolNames);
  const allToolsDone = useMemo(() => {
    return grouped.every(({ part: p }) => {
      if (!isToolUIPart(p)) return true;
      const tp = p as StaticToolUIPart | DynamicToolUIPart;
      return tp.state === "output-available" || tp.state === "output-error" || tp.state === "output-denied";
    });
  }, [grouped]);

  return (
    <>
      {/* Leading text — before tools */}
      {leading.map(({ part, idx }) =>
        renderPart(part, idx, messageId, onViewInCanvas, timestamp, onPreviewFile)
      )}

      {/* Tool group — collapsible section */}
      {grouped.length > 0 && (
        <CollapsibleSection
          icon={
            allToolsDone
              ? <StepStatusIcon status="completed" />
              : <CircleDotIcon className="size-4 text-blue-500 animate-pulse" />
          }
          title={groupLabel}
          badge={
            toolCount > 0 ? (
              <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">
                {toolCount}
              </span>
            ) : undefined
          }
          isLast={trailing.length === 0}
          defaultOpen={true}
          lineColor={allToolsDone ? "border-green-500/30" : "border-blue-500/30"}
        >
          {grouped.map(({ part, idx }) =>
            renderPart(part, idx, messageId, onViewInCanvas, timestamp, onPreviewFile)
          )}
        </CollapsibleSection>
      )}

      {/* Trailing text — the "answer" */}
      {trailing.map(({ part, idx }) =>
        renderPart(part, idx, messageId, onViewInCanvas, timestamp, onPreviewFile)
      )}
    </>
  );
}

// ============================================================================
// Part Renderer
// ============================================================================

function renderPart(
  part: UIMessagePart,
  index: number,
  _messageId: string,
  onViewInCanvas?: (toolCallId: string) => void,
  timestamp?: string,
  onPreviewFile?: (file: FileUIPart) => void,
) {
  if (!part || typeof part !== "object" || !("type" in part)) return null;
  if (isStepStartUIPart(part)) return null;
  if (isSourceUrlUIPart(part) || isSourceDocumentUIPart(part)) return null;

  // Text
  if (isTextUIPart(part)) {
    if (!part.text) return null;
    return <TextPartRenderer key={`text-${index}`} part={part as TextUIPart} />;
  }

  // Reasoning — renders as collapsible pill
  if (isReasoningUIPart(part)) {
    return <ReasoningPartRenderer key={`reasoning-${index}`} part={part as ReasoningUIPart} />;
  }

  // File parts
  if (isFileUIPart(part)) {
    return <FilePartRenderer key={`file-${index}`} part={part as FileUIPart} onPreview={onPreviewFile} />;
  }

  // Tool parts — render as clickable pills
  if (isToolUIPart(part)) {
    const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
    const toolName = getToolName(toolPart);

    // Skip show_plan — handled by plan step grouping
    if (PLAN_TOOL_NAMES.has(toolName)) return null;

    return (
      <ToolPartRenderer
        key={`tool-${toolPart.toolCallId}`}
        part={toolPart}
        onViewInCanvas={onViewInCanvas}
        timestamp={timestamp}
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
  onPreviewFile?: (file: FileUIPart) => void;
}

export function MessageRenderer(props: MessageRendererProps) {
  const { message, onViewSources, onViewInCanvas, onPreviewFile } = props;
  const parts = message.parts as unknown as UIMessagePart[];

  // Format timestamp for tool pill hover
  const timestamp = useMemo(() => {
    const createdAt = (message as unknown as Record<string, unknown>).createdAt as string | undefined;
    if (!createdAt) return undefined;
    return formatHoverTimestamp(createdAt);
  }, [message]);

  // Collect source parts
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

  // Single-pass: detect plan, tools, and build sections in one memo
  const { hasPlan, hasTools, sections } = useMemo(() => {
    if (!parts || !Array.isArray(parts)) {
      return { hasPlan: false, hasTools: false, sections: [] as MessageSection[] };
    }

    let foundPlan = false;
    let foundTools = false;
    for (const p of parts) {
      if (!p || typeof p !== "object" || !("type" in p)) continue;
      if (!isToolUIPart(p)) continue;
      foundTools = true;
      if (PLAN_TOOL_NAMES.has(getToolName(p as StaticToolUIPart | DynamicToolUIPart))) {
        foundPlan = true;
        break; // No need to continue — hasPlan implies hasTools
      }
    }

    return {
      hasPlan: foundPlan,
      hasTools: foundTools,
      sections: foundPlan ? buildSections(parts) : [],
    };
  }, [parts]);

  // Flat rendering — no plan
  if (!hasPlan) {
    const allParts = parts ?? [];

    // If tools are present, use auto-grouping for Manus-style visual
    if (hasTools) {
      return (
        <>
          <AutoGroupedToolRendering
            parts={allParts}
            messageId={message.id}
            onViewInCanvas={onViewInCanvas}
            timestamp={timestamp}
            onPreviewFile={onPreviewFile}
          />
          {sources.length > 0 && <SourcesGroup sources={sources} onViewSources={onViewSources} />}
        </>
      );
    }

    // No tools — simple flat rendering
    const flatElements: React.ReactNode[] = [];
    let i = 0;

    while (i < allParts.length) {
      const part = allParts[i]!;
      if (!part || typeof part !== "object" || !("type" in part)) { i++; continue; }
      if (isStepStartUIPart(part)) { i++; continue; }
      if (isSourceUrlUIPart(part) || isSourceDocumentUIPart(part)) { i++; continue; }

      // Group consecutive file parts into a grid
      if (isFileUIPart(part)) {
        const fileGroup: { part: FileUIPart; index: number }[] = [];
        while (i < allParts.length && isFileUIPart(allParts[i] as UIMessagePart)) {
          fileGroup.push({ part: allParts[i] as FileUIPart, index: i });
          i++;
        }

        if (fileGroup.length === 1) {
          flatElements.push(
            renderPart(fileGroup[0]!.part, fileGroup[0]!.index, message.id, onViewInCanvas, timestamp, onPreviewFile)
          );
        } else {
          flatElements.push(
            <div key={`file-group-${fileGroup[0]!.index}`} className="grid grid-cols-2 gap-2">
              {fileGroup.map(({ part: fp, index: fi }) => (
                <FilePartRenderer key={`file-${fi}`} part={fp} onPreview={onPreviewFile} />
              ))}
            </div>
          );
        }
        continue;
      }

      flatElements.push(renderPart(part, i, message.id, onViewInCanvas, timestamp, onPreviewFile));
      i++;
    }

    return (
      <>
        {flatElements}
        {sources.length > 0 && <SourcesGroup sources={sources} onViewSources={onViewSources} />}
      </>
    );
  }

  // Grouped rendering — plan steps with timeline
  const planStepSections = sections.filter(
    (s): s is GroupedSection => s.type === "plan-step"
  );
  const completedSteps = planStepSections.filter(
    (s) => s.step.status === "completed"
  ).length;
  const totalSteps = planStepSections.length;
  const lastPlanStepIdx = sections.reduce(
    (acc, s, i) => (s.type === "plan-step" ? i : acc),
    -1
  );

  return (
    <>
      {totalSteps > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--rubic-text-tertiary)] mb-1 ml-8">
          <span className="tabular-nums">
            {completedSteps}/{totalSteps}
          </span>
        </div>
      )}

      {sections.map((section, sIdx) => {
        if (section.type === "flat") {
          return (
            <React.Fragment key={`flat-${sIdx}`}>
              {section.parts.map((part, pIdx) =>
                renderPart(part, section.partIndices[pIdx]!, message.id, onViewInCanvas, timestamp, onPreviewFile)
              )}
            </React.Fragment>
          );
        }

        const { step, parts: stepParts, partIndices } = section;
        const isLastPlanStep = sIdx === lastPlanStepIdx;
        const isActive = step.status === "in_progress";
        const toolCount = stepParts.filter((p) => isToolUIPart(p)).length;

        return (
          <PlanStepSection
            key={`plan-step-${sIdx}`}
            step={step}
            isLast={isLastPlanStep}
            defaultOpen={isActive || stepParts.length > 0}
            toolCount={toolCount}
          >
            {stepParts.map((part, pIdx) =>
              renderPart(part, partIndices[pIdx]!, message.id, onViewInCanvas, timestamp, onPreviewFile)
            )}
          </PlanStepSection>
        );
      })}

      {sources.length > 0 && <SourcesGroup sources={sources} onViewSources={onViewSources} />}
    </>
  );
}

// ============================================================================
// Timestamp helper
// ============================================================================

function formatHoverTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
