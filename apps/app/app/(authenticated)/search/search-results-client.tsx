"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSearchQuery } from "@/lib/store/api/api.slice";
import { Input } from "@repo/design-system/components/ui/input";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Card, CardHeader, CardContent } from "@repo/design-system/components/ui/card";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  SearchIcon,
  FileIcon,
  MessageSquareIcon,
  ClockIcon,
  FolderIcon,
  ZapIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import type { SearchResultType, SearchResultItem } from "@/lib/store";

const typeIcons: Record<SearchResultType, React.ElementType> = {
  file: FileIcon,
  session: MessageSquareIcon,
  task: ClockIcon,
  project: FolderIcon,
  action: ZapIcon,
};

const typeLabels: Record<SearchResultType, string> = {
  file: "File",
  session: "Session",
  task: "Task",
  project: "Project",
  action: "Action",
};

const typeColors: Record<SearchResultType, string> = {
  file: "bg-blue-500/10 text-blue-500",
  session: "bg-green-500/10 text-green-500",
  task: "bg-orange-500/10 text-orange-500",
  project: "bg-purple-500/10 text-purple-500",
  action: "bg-yellow-500/10 text-yellow-500",
};

interface SearchResultsClientProps {
  initialQuery?: string;
  initialType?: string;
}

export function SearchResultsClient({
  initialQuery = "",
  initialType,
}: SearchResultsClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [activeType, setActiveType] = useState<SearchResultType | "all">(
    (initialType as SearchResultType) || "all"
  );
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Update URL when query changes
  useEffect(() => {
    if (debouncedQuery) {
      const params = new URLSearchParams();
      params.set("q", debouncedQuery);
      if (activeType !== "all") {
        params.set("type", activeType);
      }
      router.replace(`/search?${params.toString()}`, { scroll: false });
    }
  }, [debouncedQuery, activeType, router]);

  // Search query via RTK Query
  const { data: searchResults = null, isLoading, isFetching } = useSearchQuery(
    { query: debouncedQuery, limit: 50 },
    { skip: debouncedQuery.length < 2 }
  );

  // Filter results by type
  const searchData = searchResults as any;
  const filteredResults =
    activeType === "all"
      ? searchData?.results
      : searchData?.results?.filter((r: any) => r.type === activeType);

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / 86400000);

    if (days < 1) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;

    return new Date(timestamp).toLocaleDateString();
  };

  const handleResultClick = (result: SearchResultItem) => {
    if (result.url) {
      router.push(result.url);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files, sessions, tasks, projects..."
          className="pl-10 pr-10"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveType("all")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            activeType === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          All
          {searchData && (
            <span className="text-xs opacity-70">({searchData.totalFound})</span>
          )}
        </button>
        {(["file", "session", "task", "project", "action"] as const).map((type) => {
          const Icon = typeIcons[type];
          const count = searchData?.facets?.type?.[type] || 0;
          return (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                activeType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {typeLabels[type]}s
              {count > 0 && <span className="text-xs opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Results */}
      <div className="space-y-4">
        {/* Loading State */}
        {(isLoading || isFetching) && debouncedQuery.length >= 2 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty Query State */}
        {debouncedQuery.length < 2 && (
          <div className="flex flex-col items-center justify-center rounded-xl bg-muted/50 p-12 text-center">
            <SearchIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">Search your workspace</h3>
            <p className="text-muted-foreground mt-1">
              Enter at least 2 characters to start searching
            </p>
          </div>
        )}

        {/* No Results */}
        {!isLoading && !isFetching &&
          debouncedQuery.length >= 2 &&
          filteredResults?.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl bg-muted/50 p-12 text-center">
              <SearchIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">No results found</h3>
              <p className="text-muted-foreground mt-1">
                Try different keywords or adjust your filters
              </p>
            </div>
          )}

        {/* Results Grid */}
        {filteredResults && filteredResults.length > 0 && (
          <>
            <div className="text-sm text-muted-foreground">
              {filteredResults.length} result{filteredResults.length !== 1 ? "s" : ""}{" "}
              {searchData?.processingTimeMs !== undefined &&
                `in ${searchData.processingTimeMs}ms`}
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredResults.map((result: SearchResultItem) => {
                const Icon = typeIcons[result.type];
                return (
                  <Card
                    key={`${result.type}-${result.id}`}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => handleResultClick(result)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                            typeColors[result.type]
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h3 className="font-medium truncate">{result.title}</h3>
                          {result.subtitle && (
                            <p className="text-sm text-muted-foreground truncate">
                              {result.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {typeLabels[result.type]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(result.timestamp)}
                        </span>
                      </div>
                      {result.description && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                          {result.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
