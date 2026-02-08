"use client";

import * as React from "react";
import { useMemo } from "react";
import type { UIMessage } from "ai";
import {
  TextPartRenderer,
  ReasoningPartRenderer,
  ToolPartRenderer,
  SourcesGroup,
} from "@repo/ai/components/parts";
import {
  ChainOfThought,
  type ChainOfThoughtStep,
  type StepStatus,
  type ChainOfThoughtSearchResult,
} from "@repo/ai/components/parts/chain-of-thought";
import type {
  TextUIPart,
  ReasoningUIPart,
  StaticToolUIPart,
  DynamicToolUIPart,
  SourceUrlUIPart,
  SourceDocumentUIPart,
  UIMessagePart,
} from "@repo/ai/lib/types";
import {
  isTextUIPart,
  isReasoningUIPart,
  isToolUIPart,
  isSourceUrlUIPart,
  isSourceDocumentUIPart,
  isStepStartUIPart,
  getToolName,
} from "@repo/ai/lib/types";

// ============================================================================
// Constants
// ============================================================================

const SEARCH_TOOL_NAMES = new Set(["web_search"]);

const PLAN_TOOL_NAMES = new Set(["show_plan"]);

// ============================================================================
// Helpers
// ============================================================================

function normalizePlanStatus(status: string | undefined): StepStatus {
  if (!status) return "pending";
  const s = status.toLowerCase().replace(/-/g, "_");
  if (s === "completed" || s === "done" || s === "complete") return "complete";
  if (s === "in_progress" || s === "doing" || s === "running") return "active";
  if (s === "cancelled" || s === "error" || s === "failed") return "complete";
  return "pending";
}

interface PlanData {
  title?: string;
  todos?: Array<{
    id: string;
    label: string;
    status: string;
    description?: string;
  }>;
}

interface SearchData {
  results?: Array<{ title: string; url: string; snippet?: string }>;
  query?: string;
}

// ============================================================================
// Component
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

  // ----------------------------------------------------------------
  // Build chain-of-thought data by merging show_plan + search tools
  // ----------------------------------------------------------------
  const { chainOfThought, mergedToolIds, sources } = useMemo(() => {
    const planParts: Array<{ index: number; data: PlanData; toolCallId: string }> = [];
    const searchParts: Array<{
      index: number;
      data: SearchData;
      toolCallId: string;
    }> = [];
    const collectedSources: (SourceUrlUIPart | SourceDocumentUIPart)[] = [];
    const seenUrls = new Set<string>();

    if (!parts || !Array.isArray(parts)) {
      return { chainOfThought: null, mergedToolIds: new Set<string>(), sources: [] };
    }

    // --- Pass 1: collect plan + search tool parts, and all sources ---
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part || typeof part !== "object" || !("type" in part)) continue;

      // Native source parts
      if (isSourceUrlUIPart(part)) {
        if (!seenUrls.has(part.url)) {
          seenUrls.add(part.url);
          collectedSources.push(part);
        }
        continue;
      }
      if (isSourceDocumentUIPart(part)) {
        collectedSources.push(part);
        continue;
      }

      if (!isToolUIPart(part)) continue;

      const toolName = getToolName(part);
      const output =
        part.state === "output-available" && part.output
          ? typeof part.output === "string"
            ? safeJsonParse(part.output)
            : (part.output as Record<string, unknown>)
          : undefined;
      const input = part.input as Record<string, unknown> | undefined;

      // Plan tools
      if (PLAN_TOOL_NAMES.has(toolName)) {
        const data = (output ?? input) as PlanData | undefined;
        if (data?.todos && data.todos.length > 0) {
          planParts.push({
            index: i,
            data,
            toolCallId: (part as StaticToolUIPart | DynamicToolUIPart).toolCallId,
          });
        }
      }

      // Search tools
      if (SEARCH_TOOL_NAMES.has(toolName)) {
        const searchOutput = output as SearchData | undefined;
        const searchInput = input as SearchData | undefined;
        searchParts.push({
          index: i,
          data: searchOutput ?? searchInput ?? {},
          toolCallId: (part as StaticToolUIPart | DynamicToolUIPart).toolCallId,
        });

        // Also collect sources from search results
        const results = searchOutput?.results ?? [];
        for (const r of results) {
          if (r.url && r.title && !seenUrls.has(r.url)) {
            seenUrls.add(r.url);
            collectedSources.push({
              type: "source-url",
              sourceId: String(collectedSources.length + 1),
              url: r.url,
              title: r.title,
            });
          }
        }
      }

      // Also extract sources from browser tool outputs
      if (
        toolName.startsWith("browser_") &&
        output &&
        typeof output.url === "string" &&
        typeof output.title === "string" &&
        !seenUrls.has(output.url as string)
      ) {
        seenUrls.add(output.url as string);
        collectedSources.push({
          type: "source-url",
          sourceId: String(collectedSources.length + 1),
          url: output.url as string,
          title: output.title as string,
        });
      }
    }

    // --- Pass 2: Build enriched chain of thought from latest plan ---
    if (planParts.length === 0) {
      return {
        chainOfThought: null,
        mergedToolIds: new Set<string>(),
        sources: collectedSources,
      };
    }

    const latestPlan = planParts[planParts.length - 1];
    if (!latestPlan) return { chainOfThought: null, mergedToolIds: new Set<string>(), sources: collectedSources };
    const mergedIds = new Set<string>();

    // Mark all plan tool IDs as merged (skip individual rendering)
    for (const pp of planParts) {
      mergedIds.add(pp.toolCallId);
    }

    // Build enriched steps with associated search results
    const steps: ChainOfThoughtStep[] = (latestPlan.data.todos ?? []).map(
      (todo) => {
        const step: ChainOfThoughtStep = {
          id: todo.id,
          label: todo.label,
          status: normalizePlanStatus(todo.status),
          detail: todo.description,
        };

        // Find search results that are relevant to this step
        // (simple heuristic: search queries that mention words in the step label)
        const labelWords = new Set(
          todo.label.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
        );
        const relevantResults: ChainOfThoughtSearchResult[] = [];

        for (const sp of searchParts) {
          if (!sp.data.results?.length) continue;
          const query = (sp.data.query ?? "").toLowerCase();
          const isRelevant =
            [...labelWords].some((w) => query.includes(w)) ||
            todo.label.toLowerCase().includes("search");

          if (isRelevant) {
            mergedIds.add(sp.toolCallId); // Merge this search into the chain
            for (const r of sp.data.results.slice(0, 6)) {
              relevantResults.push({
                title: r.title,
                url: r.url,
                snippet: r.snippet,
              });
            }
          }
        }

        if (relevantResults.length > 0) {
          step.searchResults = relevantResults;
        }

        return step;
      }
    );

    // If there are unmerged search results (not associated with any step),
    // attach them to the first completed or active step
    const unmatchedSearches = searchParts.filter(
      (sp) => !mergedIds.has(sp.toolCallId) && sp.data.results?.length
    );
    if (unmatchedSearches.length > 0) {
      const targetStep =
        steps.find((s) => s.status === "active") ??
        steps.find((s) => s.status === "complete") ??
        steps[0];
      if (targetStep) {
        const existingResults = targetStep.searchResults ?? [];
        for (const sp of unmatchedSearches) {
          mergedIds.add(sp.toolCallId);
          for (const r of (sp.data.results ?? []).slice(0, 6)) {
            existingResults.push({
              title: r.title,
              url: r.url,
              snippet: r.snippet,
            });
          }
        }
        targetStep.searchResults = existingResults;
      }
    }

    return {
      chainOfThought: {
        title: latestPlan.data.title || "Plan",
        steps,
        isActive: steps.some((s) => s.status === "active"),
      },
      mergedToolIds: mergedIds,
      sources: collectedSources,
    };
  }, [parts]);

  // ----------------------------------------------------------------
  // Track whether we've rendered the chain of thought already
  // ----------------------------------------------------------------
  let chainRendered = false;

  return (
    <>
      {(parts ?? []).map((part, i) => {
        // Skip undefined/null/malformed parts
        if (!part || typeof part !== "object" || !("type" in part)) return null;

        // Skip step-start markers
        if (isStepStartUIPart(part)) {
          return null;
        }

        // Skip native source parts — rendered as SourcesGroup below
        if (isSourceUrlUIPart(part) || isSourceDocumentUIPart(part)) {
          return null;
        }

        // Text → TextPartRenderer
        if (isTextUIPart(part)) {
          if (!part.text) return null;
          return (
            <TextPartRenderer
              key={`${message.id}-text-${i}`}
              part={part as TextUIPart}
            />
          );
        }

        // Reasoning → ReasoningPartRenderer
        if (isReasoningUIPart(part)) {
          return (
            <ReasoningPartRenderer
              key={`${message.id}-reasoning-${i}`}
              part={part as ReasoningUIPart}
            />
          );
        }

        // Tool parts
        if (isToolUIPart(part)) {
          const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
          const toolName = getToolName(toolPart);

          // If this tool is merged into the chain of thought, render
          // the chain component once (at the position of the first plan tool)
          if (mergedToolIds.has(toolPart.toolCallId)) {
            if (!chainRendered && chainOfThought && PLAN_TOOL_NAMES.has(toolName)) {
              chainRendered = true;
              return (
                <div key={`${message.id}-chain`} className="my-2">
                  <ChainOfThought
                    steps={chainOfThought.steps}
                    title={chainOfThought.title}
                    defaultOpen={chainOfThought.isActive}
                  />
                </div>
              );
            }
            // Skip merged tools (already rendered in chain)
            return null;
          }

          // Regular tool rendering
          return (
            <ToolPartRenderer
              key={`${message.id}-tool-${toolPart.toolCallId}`}
              part={toolPart}
              onViewInCanvas={onViewInCanvas}
            />
          );
        }

        // File parts
        if (part.type === "file") {
          return null;
        }

        // Data parts — skip
        return null;
      })}

      {/* Sources group at bottom of message */}
      {sources.length > 0 && <SourcesGroup sources={sources} onViewSources={onViewSources} />}
    </>
  );
}

// ============================================================================
// Utils
// ============================================================================

function safeJsonParse(str: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(str);
  } catch {
    return undefined;
  }
}
