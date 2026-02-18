"use client";

import { useState, useRef, useEffect } from "react";
import { CheckIcon } from "lucide-react";

export type TaskFilterType =
  | "all"
  | "non-project"
  | "favorites"
  | "scheduled"
  | "shared";

const FILTER_OPTIONS: { value: TaskFilterType; label: string; separator?: boolean }[] = [
  { value: "all", label: "All tasks" },
  { value: "non-project", label: "Non-project tasks" },
  { value: "favorites", label: "Favorites", separator: true },
  { value: "scheduled", label: "Scheduled" },
  { value: "shared", label: "Shared" },
];

type TaskFilterProps = {
  value: TaskFilterType;
  onChange: (value: TaskFilterType) => void;
};

/**
 * Manus-style filter icon — three horizontal lines of decreasing width
 * with a plus sign on the top-right line.
 */
function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      className={className}
      color="currentColor"
    >
      <path d="M9 4.5H2.25" stroke="currentColor" strokeWidth="1.42" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 9H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.75 13.5H11.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 4.5H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 6L13.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TaskFilter({ value, onChange }: TaskFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-center size-8 rounded-lg cursor-pointer transition-colors ${
          open
            ? "bg-sidebar-accent/60"
            : "hover:bg-sidebar-accent/60"
        } ${value !== "all" ? "text-primary" : "text-sidebar-foreground/40"}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <FilterIcon />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-max backdrop-blur-2xl bg-popover flex flex-col py-1 rounded-xl shadow-lg border border-border/50"
          role="dialog"
        >
          {FILTER_OPTIONS.map((option) => (
            <div key={option.value}>
              {option.separator && (
                <div className="mx-3 my-1 h-px bg-border" />
              )}
              <div className="px-1">
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="flex items-center gap-1 p-2 w-full rounded-lg cursor-pointer hover:bg-accent transition-colors"
                >
                  <span className="flex-1 text-sm text-foreground leading-5 tracking-tight px-1">
                    {option.label}
                  </span>
                  <div className="flex items-center justify-center size-5">
                    {value === option.value && (
                      <CheckIcon className="size-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
