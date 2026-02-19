/**
 * Web search tool — delegates to ctx.searchProvider (Brave/Serper/Tavily/Bing).
 * The search provider is configured in agent-loop.ts createDefaultSearchProvider().
 *
 * Manus parity: accepts `queries` (array of 1–3 strings) + `type` enum.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';

export function createSearchWebTool(ctx: ToolContext) {
  return tool({
    description: `Search the internet using 1–3 queries for comprehensive results. Each query should use 3-5 keywords in Google search style. Multiple queries improve coverage by searching different phrasings.`,
    inputSchema: z.object({
      queries: z
        .array(z.string())
        .min(1)
        .max(3)
        .describe('Array of search queries (1–3). Each query should be 3-5 keywords in Google search style.'),
      type: z
        .enum(['info', 'image', 'news', 'api', 'data', 'research', 'tool'])
        .default('info')
        .describe('Search type: info=web results (default), image=image search, news=news articles, api=API docs, data=datasets, research=academic papers, tool=developer tools'),
      date_range: z
        .enum(['all', 'past_hour', 'past_day', 'past_week', 'past_month', 'past_year'])
        .optional()
        .describe('Time range filter for search results.'),
    }),
    execute: async (params) => {
      if (!ctx.searchProvider) {
        return { status: 'error' as const, error: 'No search provider configured' };
      }
      try {
        const searchType = params.type || 'info';

        // Aggregate results from all queries (Manus pattern: up to 3 query variants)
        const allResults: { title: string; url: string; snippet: string }[] = [];
        for (const query of params.queries) {
          const results = await ctx.searchProvider.search({
            query,
            dateRange: params.date_range,
            type: searchType,
          });
          allResults.push(...results);
        }

        // Deduplicate by URL
        const seen = new Set<string>();
        const uniqueResults = allResults.filter((r) => {
          if (seen.has(r.url)) return false;
          seen.add(r.url);
          return true;
        });

        if (uniqueResults.length > 0) {
          return { status: 'success' as const, results: uniqueResults };
        }
        return { status: 'success' as const, results: [], message: 'No results found' };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Search failed';
        return { status: 'error' as const, error: msg };
      }
    },
  });
}

export function createSearchTools(ctx: ToolContext) {
  return {
    info_search_web: createSearchWebTool(ctx),
  } as const;
}
