"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  ChevronDownIcon,
  CheckCircle2Icon,
  CircleIcon,
  ListOrderedIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface QueueItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface QueueSection {
  id: string;
  label: string;
  items: QueueItem[];
  defaultOpen?: boolean;
}

export interface QueueDisplayProps {
  sections: QueueSection[];
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function QueueDisplay({
  sections,
  className,
}: QueueDisplayProps) {
  if (sections.length === 0) return null;

  const totalItems = sections.reduce((acc, s) => acc + s.items.length, 0);
  const completedItems = sections.reduce(
    (acc, s) => acc + s.items.filter((i) => i.completed).length,
    0
  );

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/40", className)}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex size-6 items-center justify-center rounded-lg bg-indigo-500/10">
          <ListOrderedIcon className="size-3.5 text-indigo-500" />
        </div>
        <span className="flex-1 text-sm font-medium text-foreground/80">Queue</span>
        <span className="text-xs text-muted-foreground/60">
          {completedItems}/{totalItems}
        </span>
      </div>

      {/* Sections */}
      <div className="border-t border-border/30">
        {sections.map((section) => (
          <QueueSectionItem key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Queue Section
// ============================================================================

function QueueSectionItem({ section }: { section: QueueSection }) {
  const [isOpen, setIsOpen] = useState(section.defaultOpen ?? true);

  const completedCount = section.items.filter((i) => i.completed).length;

  return (
    <div className="border-b border-border/20 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/20"
      >
        <ChevronDownIcon
          className={cn(
            "size-3.5 text-muted-foreground/40 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
        <span className="flex-1 text-xs font-medium text-foreground/70">
          {section.label}
        </span>
        <span className="text-[10px] text-muted-foreground/40">
          {completedCount}/{section.items.length}
        </span>
      </button>

      <div
        className={cn(
          "grid transition-all duration-200",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-0 px-3 pb-2">
            {section.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 py-1"
              >
                {item.completed ? (
                  <CheckCircle2Icon className="size-3.5 flex-shrink-0 text-green-500/60" />
                ) : (
                  <CircleIcon className="size-3.5 flex-shrink-0 text-muted-foreground/25" />
                )}
                <span
                  className={cn(
                    "text-xs",
                    item.completed
                      ? "text-foreground/50 line-through decoration-muted-foreground/15"
                      : "text-foreground/70"
                  )}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
