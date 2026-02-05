"use client";

import { cn } from "@repo/design-system/lib/utils";

const categories = [
  { value: "all", label: "All" },
  { value: "communication", label: "Communication" },
  { value: "storage", label: "Storage" },
  { value: "productivity", label: "Productivity" },
  { value: "development", label: "Development" },
  { value: "crm", label: "CRM" },
  { value: "analytics", label: "Analytics" },
  { value: "other", label: "Other" },
] as const;

export type CategoryValue = (typeof categories)[number]["value"];

interface CategoryFilterProps {
  selected: CategoryValue;
  onSelect: (category: CategoryValue) => void;
  counts?: Record<string, number>;
}

export function CategoryFilter({ selected, onSelect, counts }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((cat) => {
        const count =
          cat.value === "all"
            ? counts
              ? Object.values(counts).reduce((a, b) => a + b, 0)
              : undefined
            : counts?.[cat.value];
        const isActive = selected === cat.value;

        // Hide categories with 0 items (except "all")
        if (cat.value !== "all" && counts && count === 0) return null;

        return (
          <button
            key={cat.value}
            type="button"
            onClick={() => onSelect(cat.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {cat.label}
            {count !== undefined && (
              <span
                className={cn(
                  "ml-0.5 text-[10px]",
                  isActive ? "text-primary-foreground/70" : "text-muted-foreground/60"
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
