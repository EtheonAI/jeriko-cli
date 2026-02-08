"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  ChevronDownIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon,
  SearchIcon,
  GlobeIcon,
  ExternalLinkIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type StepStatus = "complete" | "active" | "pending";

export interface ChainOfThoughtSearchResult {
  title: string;
  url: string;
  snippet?: string;
}

export interface ChainOfThoughtStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
  icon?: React.ReactNode;
  searchResults?: ChainOfThoughtSearchResult[];
  images?: string[];
}

export interface ChainOfThoughtProps {
  steps: ChainOfThoughtStep[];
  className?: string;
  defaultOpen?: boolean;
  title?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ChainOfThought({
  steps,
  className,
  defaultOpen = true,
  title = "Reasoning",
}: ChainOfThoughtProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const completedCount = steps.filter((s) => s.status === "complete").length;
  const activeStep = steps.find((s) => s.status === "active");
  const isWorking = !!activeStep;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/40",
        isWorking && "border-blue-500/20",
        className
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex size-6 items-center justify-center rounded-lg bg-blue-500/10">
          <SearchIcon className="size-3.5 text-blue-500" />
        </div>

        <span className="flex-1 text-sm font-medium text-foreground/80">
          {title}
        </span>

        {steps.length > 0 && (
          <span className="text-xs text-muted-foreground/60">
            {completedCount}/{steps.length}
          </span>
        )}

        <ChevronDownIcon
          className={cn(
            "size-4 text-muted-foreground/50 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Steps */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/30 px-3 py-2">
            <div className="space-y-0.5">
              {steps.map((step, index) => (
                <StepItem
                  key={step.id}
                  step={step}
                  isLast={index === steps.length - 1}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Step Item
// ============================================================================

function StepItem({
  step,
  isLast,
}: {
  step: ChainOfThoughtStep;
  isLast: boolean;
}) {
  const StatusIcon = getStatusIcon(step.status);

  return (
    <div className="flex gap-2.5">
      {/* Timeline */}
      <div className="flex flex-col items-center">
        <div className="flex size-5 items-center justify-center">
          {step.icon ?? (
            <StatusIcon
              className={cn(
                "size-4",
                step.status === "complete" && "text-green-500",
                step.status === "active" && "text-blue-500 animate-pulse",
                step.status === "pending" && "text-muted-foreground/30"
              )}
            />
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              "mt-0.5 w-px flex-1",
              step.status === "complete" ? "bg-green-500/20" : "bg-border/50"
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className={cn("min-w-0 flex-1 pb-2.5", isLast && "pb-0")}>
        <span
          className={cn(
            "text-sm",
            step.status === "complete" && "text-foreground/70",
            step.status === "active" && "font-medium text-foreground",
            step.status === "pending" && "text-muted-foreground/40"
          )}
        >
          {step.label}
        </span>

        {step.detail && step.status !== "pending" && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground/60">
            {step.detail}
          </p>
        )}

        {/* Search results */}
        {step.searchResults && step.searchResults.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {step.searchResults.map((result, i) => (
              <a
                key={i}
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=${getDomain(result.url)}&sz=16`}
                  alt=""
                  className="size-3"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <span className="max-w-[120px] truncate">{result.title}</span>
              </a>
            ))}
          </div>
        )}

        {/* Images */}
        {step.images && step.images.length > 0 && (
          <div className="mt-2 flex gap-2">
            {step.images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className="h-16 w-auto rounded-md border border-border/50 object-cover"
                loading="lazy"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusIcon(status: StepStatus) {
  switch (status) {
    case "complete":
      return CheckCircle2Icon;
    case "active":
      return CircleDotIcon;
    case "pending":
      return CircleIcon;
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}
