"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@repo/design-system/components/ui/command";
import { Badge } from "@repo/design-system/components/ui/badge";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
  FileIcon,
  MessageSquareIcon,
  ClockIcon,
  FolderIcon,
  ZapIcon,
  SearchIcon,
  XIcon,
  HistoryIcon,
  ImageIcon,
  VideoIcon,
  MusicIcon,
  FileTextIcon,
  TableIcon,
  ArchiveIcon,
  CodeIcon,
  PlusIcon,
} from "lucide-react";
import { useSearch } from "@/lib/hooks/use-search";
import { cn } from "@repo/design-system/lib/utils";
import type { SearchResultType, SearchResultItem } from "@/lib/store";

// Icon mapping for result types
const typeIcons: Record<SearchResultType, React.ElementType> = {
  file: FileIcon,
  session: MessageSquareIcon,
  task: ClockIcon,
  project: FolderIcon,
  action: ZapIcon,
};

// Icon mapping for file mime types
function getFileIcon(iconName?: string): React.ElementType {
  switch (iconName) {
    case "image":
      return ImageIcon;
    case "video":
      return VideoIcon;
    case "music":
      return MusicIcon;
    case "file-text":
      return FileTextIcon;
    case "table":
      return TableIcon;
    case "archive":
      return ArchiveIcon;
    case "code":
      return CodeIcon;
    default:
      return FileIcon;
  }
}

// Type labels
const typeLabels: Record<SearchResultType, string> = {
  file: "Files",
  session: "Sessions",
  task: "Tasks",
  project: "Projects",
  action: "Actions",
};

// Filter button component
function FilterButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={cn("ml-1", active ? "opacity-80" : "opacity-60")}>{count}</span>
      )}
    </button>
  );
}

// Search result item component
function SearchResultItemComponent({
  result,
  isSelected,
  onSelect,
}: {
  result: SearchResultItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = result.type === "file" ? getFileIcon(result.icon) : typeIcons[result.type];

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <CommandItem
      value={`${result.type}-${result.id}`}
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5",
        isSelected && "bg-accent"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          result.type === "file" && "bg-blue-500/10 text-blue-500",
          result.type === "session" && "bg-green-500/10 text-green-500",
          result.type === "task" && "bg-orange-500/10 text-orange-500",
          result.type === "project" && "bg-purple-500/10 text-purple-500",
          result.type === "action" && "bg-yellow-500/10 text-yellow-500"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{result.title}</span>
          {result.highlights && result.highlights.length > 0 && (
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {result.highlights[0]?.snippet}
            </span>
          )}
        </div>
        {result.subtitle && (
          <span className="truncate text-xs text-muted-foreground">{result.subtitle}</span>
        )}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{formatTime(result.timestamp)}</span>
    </CommandItem>
  );
}

// Recent search item component
function RecentSearchItem({
  query,
  resultCount,
  onSelect,
  onRemove,
}: {
  query: string;
  resultCount: number;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <CommandItem
      value={`recent-${query}`}
      onSelect={onSelect}
      className="group flex items-center gap-3 rounded-lg px-3 py-2"
    >
      <HistoryIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{query}</span>
      <span className="text-xs text-muted-foreground">{resultCount} results</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="invisible shrink-0 rounded p-1 hover:bg-muted group-hover:visible"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </CommandItem>
  );
}

// Quick action component
function QuickAction({
  icon: Icon,
  label,
  shortcut,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <CommandItem onSelect={onClick} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4" />
      </div>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          {shortcut}
        </kbd>
      )}
    </CommandItem>
  );
}

export function SearchModal() {
  const {
    isOpen,
    query,
    filteredResults,
    isLoading,
    recentSearches,
    activeFilter,
    selectedIndex,
    close,
    setQuery,
    setFilter,
    selectResult,
    selectRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  } = useSearch();

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Calculate facet counts
  const facetCounts = filteredResults?.facets?.type || {};

  // Group results by type
  const groupedResults = filteredResults?.results.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<SearchResultType, SearchResultItem[]>
  );

  const hasResults = filteredResults && filteredResults.results.length > 0;
  const hasQuery = query.length >= 2;

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => !open && close()}
      title="Search"
      description="Search across all your files, sessions, tasks, projects, and actions"
      className="max-w-2xl"
      showCloseButton={false}
    >
      {/* Search Input */}
      <div className="flex items-center border-b px-3">
        <SearchIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files, sessions, tasks..."
          className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        {query && (
          <button onClick={() => setQuery("")} className="rounded p-1 hover:bg-muted">
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter Pills */}
      {hasQuery && (
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <FilterButton active={activeFilter === "all"} onClick={() => setFilter("all")}>
            All
          </FilterButton>
          <FilterButton
            active={activeFilter === "file"}
            onClick={() => setFilter("file")}
            count={facetCounts.file}
          >
            Files
          </FilterButton>
          <FilterButton
            active={activeFilter === "session"}
            onClick={() => setFilter("session")}
            count={facetCounts.session}
          >
            Sessions
          </FilterButton>
          <FilterButton
            active={activeFilter === "task"}
            onClick={() => setFilter("task")}
            count={facetCounts.task}
          >
            Tasks
          </FilterButton>
          <FilterButton
            active={activeFilter === "project"}
            onClick={() => setFilter("project")}
            count={facetCounts.project}
          >
            Projects
          </FilterButton>
          <FilterButton
            active={activeFilter === "action"}
            onClick={() => setFilter("action")}
            count={facetCounts.action}
          >
            Actions
          </FilterButton>
        </div>
      )}

      <CommandList className="max-h-[400px]">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
          </div>
        )}

        {/* No Results */}
        {hasQuery && !isLoading && !hasResults && (
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-6">
              <SearchIcon className="h-10 w-10 text-muted-foreground/50" />
              <p>No results found for &quot;{query}&quot;</p>
              <p className="text-sm text-muted-foreground">
                Try different keywords or check the spelling
              </p>
            </div>
          </CommandEmpty>
        )}

        {/* Search Results */}
        {hasQuery && !isLoading && hasResults && (
          <>
            {/* Results grouped by type when showing all */}
            {activeFilter === "all" && groupedResults && (
              <>
                {(Object.keys(groupedResults) as SearchResultType[]).map((type, groupIndex) => (
                  <CommandGroup key={type} heading={typeLabels[type]}>
                    {groupedResults[type].map((result, index) => {
                      // Calculate global index for selection
                      let globalIndex = 0;
                      for (let i = 0; i < groupIndex; i++) {
                        const prevType = Object.keys(groupedResults)[i] as SearchResultType;
                        globalIndex += groupedResults[prevType].length;
                      }
                      globalIndex += index;

                      return (
                        <SearchResultItemComponent
                          key={result.id}
                          result={result}
                          isSelected={selectedIndex === globalIndex}
                          onSelect={() => selectResult(result)}
                        />
                      );
                    })}
                  </CommandGroup>
                ))}
              </>
            )}

            {/* Flat results when filtering by type */}
            {activeFilter !== "all" && filteredResults && (
              <CommandGroup heading={typeLabels[activeFilter]}>
                {filteredResults.results.map((result, index) => (
                  <SearchResultItemComponent
                    key={result.id}
                    result={result}
                    isSelected={selectedIndex === index}
                    onSelect={() => selectResult(result)}
                  />
                ))}
              </CommandGroup>
            )}

            {/* Result stats */}
            <div className="border-t px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {filteredResults?.totalFound} result{filteredResults?.totalFound !== 1 ? "s" : ""}{" "}
                found in {filteredResults?.processingTimeMs}ms
              </p>
            </div>
          </>
        )}

        {/* Empty State - Show recent searches and quick actions */}
        {!hasQuery && !isLoading && (
          <>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <CommandGroup
                heading={
                  <div className="flex items-center justify-between">
                    <span>Recent Searches</span>
                    <button
                      onClick={clearRecentSearches}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                }
              >
                {recentSearches.slice(0, 5).map((search) => (
                  <RecentSearchItem
                    key={search.query}
                    query={search.query}
                    resultCount={search.resultCount}
                    onSelect={() => selectRecentSearch(search.query)}
                    onRemove={() => removeRecentSearch(search.query)}
                  />
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />

            {/* Quick Actions */}
            <CommandGroup heading="Quick Actions">
              <QuickAction
                icon={PlusIcon}
                label="New task"
                shortcut="N"
                onClick={() => {
                  close();
                  // Navigate to new task
                }}
              />
              <QuickAction
                icon={MessageSquareIcon}
                label="New session"
                shortcut="C"
                onClick={() => {
                  close();
                  // Navigate to new session
                }}
              />
              <QuickAction
                icon={FolderIcon}
                label="New project"
                shortcut="P"
                onClick={() => {
                  close();
                  // Navigate to new project
                }}
              />
            </CommandGroup>
          </>
        )}
      </CommandList>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              ↑↓
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Tab</kbd>
            Filter
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
            Close
          </span>
        </div>
        <span>Powered by Typesense</span>
      </div>
    </CommandDialog>
  );
}
