"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Button } from "@repo/design-system/components/ui/button";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  Heart,
  Eye,
  Clock,
  User2,
  TrendingUp,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  setDataSource,
  appendDataSource,
  setDataSourceLoading,
  setTotalItems,
  setHasMore,
  setSortBy,
  nextPage,
  toggleLike,
  setError,
  resetCommunity,
} from "@/lib/store/slices/community.slice";
import type { CommunityItem } from "@/lib/store/slices/community.slice";
import { getTrpcClient } from "@/lib/trpc/vanilla";
import { toast } from "sonner";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SessionCardSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
      <Skeleton className="h-5 w-3/4 mb-3" />
      <Skeleton className="h-4 w-1/2 mb-4" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-20" />
      </div>
    </div>
  );
}

interface SessionCardProps {
  session: {
    id: string;
    title: string;
    createdAt: string;
    likeCount: number;
    viewCount: number;
    isLiked: boolean;
    author: {
      name: string;
      image: string | null;
    };
  };
  onLike: (id: string) => void;
}

function SessionCard({ session, onLike }: SessionCardProps) {
  return (
    <div className="group rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 transition-colors hover:border-neutral-700 hover:bg-neutral-900">
      <Link href={`/share/${session.id}`} className="block">
        <h3 className="text-sm font-medium text-white truncate group-hover:text-white/90">
          {session.title}
        </h3>

        <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
          <User2 className="h-3 w-3" />
          <span>{session.author.name}</span>
        </div>
      </Link>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span>{session.viewCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatDate(session.createdAt)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLike(session.id);
          }}
          className={cn(
            "flex items-center gap-1 text-xs transition-colors",
            session.isLiked
              ? "text-red-400 hover:text-red-300"
              : "text-neutral-500 hover:text-neutral-300"
          )}
        >
          <Heart
            className={cn("h-3.5 w-3.5", session.isLiked && "fill-current")}
          />
          <span>{session.likeCount}</span>
        </button>
      </div>
    </div>
  );
}

export function CommunityPageClient() {
  const dispatch = useAppDispatch();
  const {
    dataSource,
    isDataSourceLoading,
    sortBy,
    page,
    pageSize,
    totalItems,
    hasMore,
    error,
  } = useAppSelector((state) => state.community);

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchSessions = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!append) {
        dispatch(setDataSourceLoading(true));
      }

      try {
        const client = getTrpcClient();
        const result = await client.community.listPublicSessions.query({
          page: pageNum,
          pageSize,
          sortBy: sortBy === "trending" ? "recent" : sortBy,
        });

        const items: CommunityItem[] = result.sessions.map((s) => ({
          id: s.id,
          title: s.title,
          author: {
            id: s.author.id,
            name: s.author.name,
            avatar: s.author.image ?? undefined,
          },
          category: "session",
          tags: [],
          likes: s.likeCount,
          views: s.viewCount,
          isLiked: false,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        }));

        if (append) {
          dispatch(appendDataSource(items));
        } else {
          dispatch(setDataSource(items));
        }
        dispatch(setTotalItems(result.totalItems));
        dispatch(setHasMore(result.hasMore));
      } catch {
        dispatch(setError("Failed to load shared sessions"));
      } finally {
        setIsLoadingMore(false);
      }
    },
    [dispatch, pageSize, sortBy]
  );

  // Initial fetch
  useEffect(() => {
    fetchSessions(1, false);
    return () => {
      dispatch(resetCommunity());
    };
  }, [fetchSessions, dispatch]);

  // Refetch when sort changes
  useEffect(() => {
    if (page === 1) return; // Already handled by initial fetch
    fetchSessions(1, false);
  }, [sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPageNum = page + 1;
    dispatch(nextPage());
    fetchSessions(nextPageNum, true);
  }, [isLoadingMore, hasMore, page, dispatch, fetchSessions]);

  const handleSortChange = useCallback(
    (newSort: "recent" | "popular") => {
      dispatch(setSortBy(newSort));
      // Reset and refetch
      dispatch(setDataSource([]));
      dispatch(setDataSourceLoading(true));
      fetchSessions(1, false);
    },
    [dispatch, fetchSessions]
  );

  const handleLike = useCallback(
    async (sessionId: string) => {
      // Optimistic update
      dispatch(toggleLike(sessionId));

      try {
        const client = getTrpcClient();
        await client.community.likeSession.mutate({ sessionId });
      } catch {
        // Revert optimistic update
        dispatch(toggleLike(sessionId));
        toast.error("Failed to update like");
      }
    },
    [dispatch]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator className="mr-2 h-4" orientation="vertical" />
          <h1 className="text-sm font-medium">Community</h1>
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-1">
          <Button
            variant={sortBy === "recent" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={() => handleSortChange("recent")}
          >
            <ArrowUpDown className="h-3 w-3" />
            Recent
          </Button>
          <Button
            variant={sortBy === "popular" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={() => handleSortChange("popular")}
          >
            <TrendingUp className="h-3 w-3" />
            Popular
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-5xl">
          {/* Stats */}
          {!isDataSourceLoading && totalItems > 0 && (
            <p className="mb-4 text-xs text-neutral-500">
              {totalItems} shared session{totalItems !== 1 ? "s" : ""}
            </p>
          )}

          {/* Error state */}
          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fetchSessions(1, false)}
              >
                Try again
              </Button>
            </div>
          )}

          {/* Loading skeletons */}
          {isDataSourceLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SessionCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isDataSourceLoading && !error && dataSource.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-neutral-900 p-4 mb-4">
                <Heart className="h-8 w-8 text-neutral-600" />
              </div>
              <h3 className="text-base font-medium text-white mb-1">
                No shared sessions yet
              </h3>
              <p className="text-sm text-neutral-500 max-w-sm">
                Be the first to share a conversation. Open any chat and click the Share button to
                make it public.
              </p>
            </div>
          )}

          {/* Session grid */}
          {!isDataSourceLoading && dataSource.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dataSource.map((item) => (
                  <SessionCard
                    key={item.id}
                    session={{
                      id: item.id,
                      title: item.title,
                      createdAt: item.createdAt,
                      likeCount: item.likes,
                      viewCount: item.views,
                      isLiked: item.isLiked,
                      author: {
                        name: item.author.name,
                        image: item.author.avatar ?? null,
                      },
                    }}
                    onLike={handleLike}
                  />
                ))}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="gap-2"
                  >
                    {isLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {isLoadingMore ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
