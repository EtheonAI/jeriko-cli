"use client";

/**
 * Enhanced Web Search - Expandable search results with rich previews
 *
 * Features:
 * - Animated search progress
 * - Expandable result cards with full content
 * - Source quality indicators
 * - Copy citation button
 * - Related searches
 * - Image results integration
 */

import * as React from "react";
import { useState, useCallback } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  SearchIcon,
  ExternalLinkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  CheckIcon,
  GlobeIcon,
  CalendarIcon,
  SparklesIcon,
  ImageIcon,
  BookOpenIcon,
  NewspaperIcon,
} from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

// ============================================================================
// Types
// ============================================================================

interface WebSearchInput {
  query: string;
  num_results?: number;
  include_domains?: string[];
  exclude_domains?: string[];
  search_type?: "web" | "news" | "images" | "academic";
}

interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  content?: string;
  score?: number;
  published_date?: string;
  source_type?: "news" | "academic" | "blog" | "official" | "forum";
  image_url?: string;
}

interface WebSearchOutput {
  results: SearchResult[];
  query?: string;
  total_results?: number;
  search_time_ms?: number;
  related_searches?: string[];
  answer_snippet?: string;
}

// ============================================================================
// Utilities
// ============================================================================

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return dateStr;
  }
}

function getSourceIcon(sourceType?: string) {
  switch (sourceType) {
    case "news":
      return NewspaperIcon;
    case "academic":
      return BookOpenIcon;
    default:
      return GlobeIcon;
  }
}

function useCopyToClipboard(timeout = 2000) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = useCallback(
    async (text: string, id: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), timeout);
      } catch {
        // Fallback
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), timeout);
      }
    },
    [timeout]
  );

  return { copiedId, copy };
}

// ============================================================================
// Search Result Card
// ============================================================================

function SearchResultCardEnhanced({
  result,
  index,
  isExpanded,
  onToggle,
  copiedId,
  onCopy,
}: {
  result: SearchResult;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const domain = getDomain(result.url);
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  const SourceIcon = getSourceIcon(result.source_type);
  const hasContent = result.content && result.content.length > (result.snippet?.length ?? 0);

  const citation = `${result.title}. ${domain}. ${result.url}`;

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-200",
        isExpanded ? "border-primary/30 bg-primary/5" : "border-border bg-card hover:bg-muted/50",
        "motion-safe:animate-[fade-in-up_300ms_ease-out_both]"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Main content */}
      <div className="p-3">
        <div className="flex gap-3">
          {/* Favicon */}
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
            <img
              src={favicon}
              alt=""
              className="size-4"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <SourceIcon className="size-4 text-muted-foreground hidden first:block" />
          </div>

          {/* Text content */}
          <div className="min-w-0 flex-1">
            {/* Title row */}
            <div className="flex items-start gap-2">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex-1 min-w-0"
              >
                <span className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                  {result.title}
                </span>
              </a>

              {/* Score badge */}
              {result.score !== undefined && result.score > 0.7 && (
                <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                  {Math.round(result.score * 100)}%
                </span>
              )}
            </div>

            {/* Domain and date */}
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <span className="truncate">{domain}</span>
              {result.published_date && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="size-3" />
                    {formatDate(result.published_date)}
                  </span>
                </>
              )}
            </div>

            {/* Snippet */}
            {result.snippet && (
              <p
                className={cn(
                  "mt-2 text-xs text-muted-foreground",
                  isExpanded ? "" : "line-clamp-2"
                )}
              >
                {result.snippet}
              </p>
            )}
          </div>

          {/* Thumbnail */}
          {result.image_url && (
            <div className="flex-shrink-0 w-16 h-12 rounded overflow-hidden bg-muted">
              <img
                src={result.image_url}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.display = "none";
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && hasContent && (
        <div className="px-3 pb-3 border-t border-border/50 mt-2 pt-3">
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {result.content!.length > 1000
              ? `${result.content!.slice(0, 1000)}...`
              : result.content}
          </p>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-t border-border/50 bg-muted/30">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-accent"
        >
          <ExternalLinkIcon className="size-3" />
          <span>Open</span>
        </a>

        <button
          onClick={() => onCopy(citation, `cite-${index}`)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-accent"
        >
          {copiedId === `cite-${index}` ? (
            <CheckIcon className="size-3 text-green-500" />
          ) : (
            <CopyIcon className="size-3" />
          )}
          <span>Cite</span>
        </button>

        {hasContent && (
          <button
            onClick={onToggle}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-accent ml-auto"
          >
            {isExpanded ? (
              <>
                <ChevronUpIcon className="size-3" />
                <span>Less</span>
              </>
            ) : (
              <>
                <ChevronDownIcon className="size-3" />
                <span>More</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function WebSearchEnhanced({
  toolName,
  toolCallId,
  state,
  input,
  output,
  errorText,
}: ToolRendererProps<WebSearchInput, WebSearchOutput>) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { copiedId, copy } = useCopyToClipboard();

  const typedInput = input as WebSearchInput | undefined;
  const typedOutput = output as WebSearchOutput | undefined;

  const query = typedOutput?.query ?? typedInput?.query ?? "";
  const results = typedOutput?.results ?? [];
  const searchTime = typedOutput?.search_time_ms;
  const relatedSearches = typedOutput?.related_searches ?? [];
  const answerSnippet = typedOutput?.answer_snippet;

  const isLoading = state === "input-streaming" || state === "input-available";
  const hasResults = results.length > 0;
  const displayedResults = showAll ? results : results.slice(0, 5);

  return (
    <div className="space-y-3">
      {/* Search header */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center size-8 rounded-lg",
            isLoading ? "bg-primary/10" : hasResults ? "bg-green-500/10" : "bg-muted"
          )}
        >
          {isLoading ? (
            <div className="size-4 border-2 border-primary/30 border-t-primary rounded-full spinner" />
          ) : (
            <SearchIcon
              className={cn("size-4", hasResults ? "text-green-500" : "text-muted-foreground")}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-medium truncate", isLoading && "shimmer")}>
              {isLoading ? "Searching..." : query}
            </span>
          </div>
          {!isLoading && (
            <span className="text-xs text-muted-foreground">
              {hasResults
                ? `${results.length} results${searchTime ? ` in ${searchTime}ms` : ""}`
                : "No results found"}
            </span>
          )}
        </div>
      </div>

      {/* Answer snippet (if available) */}
      {answerSnippet && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <SparklesIcon className="size-4 text-primary" />
            <span className="text-xs font-medium text-primary">Quick Answer</span>
          </div>
          <p className="text-sm">{answerSnippet}</p>
        </div>
      )}

      {/* Results list */}
      {hasResults && (
        <div className="space-y-2">
          {displayedResults.map((result, index) => (
            <SearchResultCardEnhanced
              key={`${result.url}-${index}`}
              result={result}
              index={index}
              isExpanded={expandedIndex === index}
              onToggle={() => setExpandedIndex(expandedIndex === index ? null : index)}
              copiedId={copiedId}
              onCopy={copy}
            />
          ))}
        </div>
      )}

      {/* Show more/less */}
      {results.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground rounded-lg border border-dashed hover:border-solid transition-all"
        >
          {showAll ? (
            <>
              <ChevronUpIcon className="size-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDownIcon className="size-3.5" />
              Show {results.length - 5} more results
            </>
          )}
        </button>
      )}

      {/* Related searches */}
      {relatedSearches.length > 0 && (
        <div className="pt-2 border-t">
          <span className="text-xs text-muted-foreground">Related searches:</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {relatedSearches.slice(0, 5).map((search, i) => (
              <span
                key={i}
                className="px-2 py-1 text-xs rounded-full bg-muted hover:bg-accent cursor-pointer transition-colors"
              >
                {search}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* No results state */}
      {!isLoading && !hasResults && query && (
        <div className="py-8 text-center">
          <SearchIcon className="size-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No results found for "{query}"</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Try different keywords or check spelling
          </p>
        </div>
      )}
    </div>
  );
}

export default WebSearchEnhanced;
