"use client";

import * as React from "react";
import {
  GlobeIcon,
  CodeIcon,
  TerminalIcon,
  FileTextIcon,
  PresentationIcon,
  PaintbrushIcon,
  LayoutGridIcon,
  PencilIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import type { CanvasViewType } from "./use-canvas";

// ============================================================================
// View Tab Configuration
// ============================================================================

const VIEW_TAB_CONFIG: Record<
  CanvasViewType,
  { label: string; icon: LucideIcon; color: string } | null
> = {
  browser: { label: "Browser", icon: GlobeIcon, color: "text-blue-400" },
  editor: { label: "Editor", icon: PencilIcon, color: "text-amber-400" },
  code: { label: "Code", icon: CodeIcon, color: "text-green-400" },
  terminal: { label: "Terminal", icon: TerminalIcon, color: "text-green-400" },
  filePreview: { label: "Preview", icon: FileTextIcon, color: "text-orange-400" },
  slides: { label: "Slides", icon: PresentationIcon, color: "text-purple-400" },
  aiCanvas: { label: "Canvas", icon: PaintbrushIcon, color: "text-pink-400" },
  webDevIDE: { label: "IDE", icon: CodeIcon, color: "text-emerald-400" },
  mapReduce: { label: "Parallel", icon: LayoutGridIcon, color: "text-cyan-400" },
  empty: null,
};

// Ordered display priority
const VIEW_ORDER: CanvasViewType[] = [
  "browser",
  "editor",
  "code",
  "terminal",
  "filePreview",
  "slides",
  "aiCanvas",
  "webDevIDE",
  "mapReduce",
];

// ============================================================================
// Component
// ============================================================================

interface ViewTabsProps {
  availableViews: Set<CanvasViewType>;
  activeView: CanvasViewType;
  onSelectView: (view: CanvasViewType) => void;
}

export function ViewTabs({ availableViews, activeView, onSelectView }: ViewTabsProps) {
  // Only show tabs when there are 2+ views available
  const visibleViews = VIEW_ORDER.filter(
    (v) => availableViews.has(v) && VIEW_TAB_CONFIG[v] !== null
  );

  if (visibleViews.length < 2) return null;

  return (
    <div className="flex items-center gap-0.5 border-b border-border/10 bg-canvas-surface px-2">
      {visibleViews.map((view) => {
        const config = VIEW_TAB_CONFIG[view]!;
        const isActive = view === activeView;
        const Icon = config.icon;

        return (
          <button
            key={view}
            type="button"
            className={cn(
              "flex items-center gap-1.5 rounded-t-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "border-b-2 border-b-blue-500 text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground/80 hover:bg-muted/10"
            )}
            onClick={() => onSelectView(view)}
          >
            <Icon
              className={cn(
                "size-3",
                isActive ? config.color : "text-muted-foreground/40"
              )}
            />
            {config.label}
          </button>
        );
      })}
    </div>
  );
}
