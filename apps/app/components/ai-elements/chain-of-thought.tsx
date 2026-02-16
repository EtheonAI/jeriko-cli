"use client";

import * as React from "react";
import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { cn } from "@repo/design-system/lib/utils";
import Image from "next/image";
import {
  ChevronDownIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react";

// ============================================================================
// Context
// ============================================================================

interface ChainOfThoughtContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  stepCount: number;
  completedCount: number;
  activeCount: number;
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(null);

function useChainOfThoughtContext() {
  const ctx = useContext(ChainOfThoughtContext);
  if (!ctx) {
    throw new Error("ChainOfThought compound components must be used within <ChainOfThought>");
  }
  return ctx;
}

// ============================================================================
// Step counting helper — count ChainOfThoughtStep children recursively
// ============================================================================

type StepStatus = "complete" | "active" | "pending";

function countSteps(children: ReactNode): {
  total: number;
  completed: number;
  active: number;
} {
  let total = 0;
  let completed = 0;
  let active = 0;

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;

    // Check if child is a ChainOfThoughtStep by looking at props
    const props = child.props as Record<string, unknown>;
    if (typeof props.status === "string" && typeof props.label === "string") {
      total++;
      if (props.status === "complete") completed++;
      if (props.status === "active") active++;
    }

    // Recurse into ChainOfThoughtContent wrapper
    if (props.children) {
      const nested = countSteps(props.children as ReactNode);
      total += nested.total;
      completed += nested.completed;
      active += nested.active;
    }
  });

  return { total, completed, active };
}

// ============================================================================
// ChainOfThought (root container)
// ============================================================================

export interface ChainOfThoughtProps {
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export function ChainOfThought({ defaultOpen = true, className, children }: ChainOfThoughtProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const counts = useMemo(() => countSteps(children), [children]);

  const value = useMemo<ChainOfThoughtContextValue>(
    () => ({
      isOpen,
      setIsOpen,
      stepCount: counts.total,
      completedCount: counts.completed,
      activeCount: counts.active,
    }),
    [isOpen, counts.total, counts.completed, counts.active]
  );

  return (
    <ChainOfThoughtContext.Provider value={value}>
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border/40",
          counts.active > 0 && "border-blue-500/20",
          className
        )}
      >
        {children}
      </div>
    </ChainOfThoughtContext.Provider>
  );
}

// ============================================================================
// ChainOfThoughtHeader
// ============================================================================

export interface ChainOfThoughtHeaderProps {
  title?: string;
  icon?: LucideIcon;
  className?: string;
}

export function ChainOfThoughtHeader({
  title = "Reasoning",
  icon: Icon = SearchIcon,
  className,
}: ChainOfThoughtHeaderProps) {
  const { isOpen, setIsOpen, stepCount, completedCount } = useChainOfThoughtContext();

  return (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/30",
        className
      )}
    >
      <div className="flex size-6 items-center justify-center rounded-lg bg-blue-500/10">
        <Icon className="size-3.5 text-blue-500" />
      </div>

      <span className="flex-1 text-sm font-medium text-foreground/80">{title}</span>

      {stepCount > 0 && (
        <span className="text-xs text-muted-foreground/60">
          {completedCount}/{stepCount}
        </span>
      )}

      <ChevronDownIcon
        className={cn(
          "size-4 text-muted-foreground/50 transition-transform duration-200",
          isOpen && "rotate-180"
        )}
      />
    </button>
  );
}

// ============================================================================
// ChainOfThoughtContent
// ============================================================================

export interface ChainOfThoughtContentProps {
  className?: string;
  children: ReactNode;
}

export function ChainOfThoughtContent({ className, children }: ChainOfThoughtContentProps) {
  const { isOpen } = useChainOfThoughtContext();

  return (
    <div
      className={cn(
        "grid transition-all duration-300 ease-in-out",
        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
    >
      <div className="overflow-hidden">
        <div className={cn("border-t border-border/30 px-3 py-2", className)}>
          <div className="space-y-0.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ChainOfThoughtStep
// ============================================================================

export interface ChainOfThoughtStepProps {
  icon?: LucideIcon;
  label: string;
  status: StepStatus;
  className?: string;
  children?: ReactNode;
}

function StepStatusIcon({ status }: { status: StepStatus }) {
  const iconClass = cn(
    "size-4",
    status === "complete" && "text-green-500",
    status === "active" && "text-blue-500 animate-pulse",
    status === "pending" && "text-muted-foreground/30"
  );

  switch (status) {
    case "complete":
      return <CheckCircle2Icon className={iconClass} />;
    case "active":
      return <CircleDotIcon className={iconClass} />;
    case "pending":
      return <CircleIcon className={iconClass} />;
  }
}

export function ChainOfThoughtStep({
  icon: CustomIcon,
  label,
  status,
  className,
  children,
}: ChainOfThoughtStepProps) {
  const iconClass = cn(
    "size-4",
    status === "complete" && "text-green-500",
    status === "active" && "text-blue-500 animate-pulse",
    status === "pending" && "text-muted-foreground/30"
  );

  return (
    <div className={cn("flex gap-2.5", className)}>
      {/* Timeline column */}
      <div className="flex flex-col items-center">
        <div className="flex size-5 items-center justify-center">
          {CustomIcon ? <CustomIcon className={iconClass} /> : <StepStatusIcon status={status} />}
        </div>
        <div
          className={cn(
            "mt-0.5 w-px flex-1",
            status === "complete" ? "bg-green-500/20" : "bg-border/50"
          )}
        />
      </div>

      {/* Content column */}
      <div className="min-w-0 flex-1 pb-2.5">
        <span
          className={cn(
            "text-sm",
            status === "complete" && "text-foreground/70",
            status === "active" && "font-medium text-foreground",
            status === "pending" && "text-muted-foreground/40"
          )}
        >
          {label}
        </span>

        {children && <div className="mt-1.5">{children}</div>}
      </div>
    </div>
  );
}

// ============================================================================
// ChainOfThoughtSearchResults
// ============================================================================

export interface ChainOfThoughtSearchResultsProps {
  className?: string;
  children: ReactNode;
}

export function ChainOfThoughtSearchResults({
  className,
  children,
}: ChainOfThoughtSearchResultsProps) {
  return <div className={cn("flex flex-wrap gap-1.5", className)}>{children}</div>;
}

// ============================================================================
// ChainOfThoughtSearchResult
// ============================================================================

export interface ChainOfThoughtSearchResultProps {
  url?: string;
  className?: string;
  children: ReactNode;
}

export function ChainOfThoughtSearchResult({
  url,
  className,
  children,
}: ChainOfThoughtSearchResultProps) {
  // Extract hostname from children text for favicon
  const hostname = typeof children === "string" ? children.replace("www.", "") : "";
  const faviconDomain = url ? getDomain(url) : hostname;

  const content = (
    <>
      {faviconDomain && (
        <Image
          src={`https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=16`}
          alt=""
          width={12}
          height={12}
          className="size-3"
          unoptimized
        />
      )}
      <span className="max-w-[120px] truncate">{children}</span>
    </>
  );

  const chipClass = cn(
    "inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
    className
  );

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={chipClass}>
        {content}
      </a>
    );
  }

  return <span className={chipClass}>{content}</span>;
}

// ============================================================================
// ChainOfThoughtImage
// ============================================================================

export interface ChainOfThoughtImageProps {
  caption: string;
  className?: string;
  children: ReactNode;
}

export function ChainOfThoughtImage({ caption, className, children }: ChainOfThoughtImageProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="inline-block rounded-md border border-border/50 overflow-hidden">
        {children}
      </div>
      {caption && <p className="text-xs text-muted-foreground/60 leading-relaxed">{caption}</p>}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export type { StepStatus };
