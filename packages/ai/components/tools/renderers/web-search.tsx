"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { ExternalLinkIcon, GlobeIcon, SearchIcon } from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

interface WebSearchInput {
  query: string;
  num_results?: number;
  include_domains?: string[];
  exclude_domains?: string[];
}

interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  content?: string;
  score?: number;
  published_date?: string;
}

interface WebSearchOutput {
  results: SearchResult[];
  query?: string;
  total_results?: number;
}

export interface WebSearchProps extends ToolRendererProps<WebSearchInput, WebSearchOutput> {}

/**
 * WebSearch - Renders web search results with favicons and snippets
 */
export function WebSearch({
  toolName,
  state,
  input,
  output,
}: WebSearchProps) {
  // Show search query during execution
  if (state !== "output-available" && input?.query) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <SearchIcon className="size-4" />
        <span>Searching for: <span className="font-medium text-foreground">{input.query}</span></span>
      </div>
    );
  }

  if (!output?.results || output.results.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No results found for "{input?.query ?? "search"}"
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Query summary */}
      {input?.query && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SearchIcon className="size-4" />
          <span>
            Found {output.results.length} results for "{input.query}"
          </span>
        </div>
      )}

      {/* Results list */}
      <div className="space-y-2">
        {output.results.slice(0, 5).map((result, index) => (
          <SearchResultCard key={`${result.url}-${index}`} result={result} />
        ))}
      </div>

      {/* More results indicator */}
      {output.results.length > 5 && (
        <p className="text-xs text-muted-foreground">
          +{output.results.length - 5} more results
        </p>
      )}
    </div>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const domain = getDomain(result.url);
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
    >
      {/* Favicon */}
      <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-md bg-muted">
        <img
          src={favicon}
          alt=""
          className="size-4"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
            e.currentTarget.parentElement?.classList.add("flex", "items-center", "justify-center");
            const icon = document.createElement("span");
            icon.innerHTML = `<svg class="size-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
          }}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-medium group-hover:text-primary">
            {result.title}
          </span>
          <ExternalLinkIcon className="size-3 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <span className="text-xs text-muted-foreground">{domain}</span>
        {result.snippet && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {result.snippet}
          </p>
        )}
      </div>

      {/* Score badge */}
      {result.score !== undefined && (
        <div className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {Math.round(result.score * 100)}%
        </div>
      )}
    </a>
  );
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}
