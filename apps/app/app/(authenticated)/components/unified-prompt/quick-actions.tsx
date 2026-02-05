"use client";

import {
  SearchIcon,
  CodeIcon,
  BarChart3Icon,
  CalendarClockIcon,
  HammerIcon,
  PaletteIcon,
} from "lucide-react";

interface QuickActionsProps {
  onSelect: (action: string) => void;
}

const ACTIONS = [
  { id: "search", label: "Search", icon: SearchIcon },
  { id: "code", label: "Code", icon: CodeIcon },
  { id: "analyze", label: "Analyze", icon: BarChart3Icon },
  { id: "schedule", label: "Schedule", icon: CalendarClockIcon },
  { id: "build", label: "Build", icon: HammerIcon },
  { id: "design", label: "Design", icon: PaletteIcon },
] as const;

const ACTION_PREFILLS: Record<string, string> = {
  search: "Search the web for ",
  code: "Write code to ",
  analyze: "Analyze ",
  schedule: "Schedule a task to ",
  build: "Build ",
  design: "Design ",
};

export { ACTION_PREFILLS };

export function QuickActions({ onSelect }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-2 px-1">
      {ACTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Icon className="size-3" />
          {label}
        </button>
      ))}
    </div>
  );
}
