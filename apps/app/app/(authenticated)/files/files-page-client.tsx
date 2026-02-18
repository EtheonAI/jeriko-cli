"use client";

import { useState } from "react";
import { StarIcon, SearchIcon, LayoutGridIcon, ListIcon } from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import { LibraryView } from "./components/library-view";
import { useAppDispatch, useLibrary } from "@/lib/store/hooks";
import { setViewType, setIsFavorite } from "@/lib/store/slices/library.slice";

// ============================================================================
// Manus Library page — exact layout from screenshot:
// [All] [★ My Favorites]           [Search files...] [grid] [list]
// Then session-grouped files below
// ============================================================================

export function FilesPageClient() {
  const dispatch = useAppDispatch();
  const { viewType, isFavorite } = useLibrary();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex flex-col pb-6 px-6 gap-3">
      {/* Manus top bar: tabs on left, search + icons on right */}
      <div className="flex items-center gap-4">
        {/* Left: tabs */}
        <TabLink
          label="All"
          active={!isFavorite}
          onClick={() => dispatch(setIsFavorite(false))}
        />
        <TabLink
          label="My Favorites"
          icon={<StarIcon className="size-3.5" />}
          active={isFavorite}
          onClick={() => dispatch(setIsFavorite(true))}
        />

        <div className="flex-1" />

        {/* Right: search field + view icons (Manus-exact) */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-52 rounded-lg border border-border bg-transparent pl-8 pr-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            type="button"
            onClick={() => dispatch(setViewType("grid"))}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition-colors",
              viewType === "grid" ? "text-foreground bg-muted" : "text-muted-foreground hover:bg-muted"
            )}
            title="Grid view"
          >
            <LayoutGridIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => dispatch(setViewType("list"))}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition-colors",
              viewType === "list" ? "text-foreground bg-muted" : "text-muted-foreground hover:bg-muted"
            )}
            title="List view"
          >
            <ListIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Library content — session-grouped files */}
      <LibraryView
        viewType={viewType}
        favoritesOnly={isFavorite}
        searchQuery={searchQuery}
      />
    </div>
  );
}

// ============================================================================
// Manus tab link — small text, active gets bold
// ============================================================================

function TabLink({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 text-sm transition-colors",
        active
          ? "text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground/80"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
