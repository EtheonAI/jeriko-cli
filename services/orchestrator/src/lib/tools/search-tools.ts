/**
 * Web search tool
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';

const SEARCH_FALLBACK_URL = 'https://html.duckduckgo.com/html/';

export function createSearchWebTool(ctx: ToolContext) {
  return tool({
    description: `Search the web for current information using multiple queries.

Use this to:
- Find up-to-date information
- Research topics before responding
- Verify facts and data
- Find documentation, tutorials, or APIs

Returns a list of results with title, URL, and snippet for each query.
Always search BEFORE making claims about current events, prices, or rapidly-changing information.`,
    inputSchema: z.object({
      queries: z
        .array(z.string())
        .min(1)
        .max(5)
        .describe('Search queries to execute (1-5 queries)'),
      type: z
        .enum(['info', 'image', 'news', 'api', 'data', 'research'])
        .optional()
        .default('info')
        .describe('Type of search'),
      time_range: z
        .enum(['all', 'past_day', 'past_week', 'past_month', 'past_year'])
        .optional()
        .default('all')
        .describe('Time range filter'),
      max_results: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(5)
        .describe('Maximum results per query'),
    }),
    execute: async (params) => {
      if (ctx.searchProvider) {
        try {
          const results = await ctx.searchProvider.search({
            type: params.type ?? 'info',
            queries: params.queries,
            timeRange: params.time_range,
            maxResults: params.max_results ?? 5,
          });
          return { status: 'success' as const, results };
        } catch {
          // Fall through to DuckDuckGo fallback
        }
      }

      // DuckDuckGo HTML fallback
      const allResults: Array<{ query: string; results: Array<{ title: string; url: string; snippet: string }> }> = [];

      for (const query of params.queries) {
        try {
          const resp = await fetch(SEARCH_FALLBACK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `q=${encodeURIComponent(query)}`,
            signal: AbortSignal.timeout(15000),
          });
          const html = await resp.text();

          // Parse DuckDuckGo HTML results
          const results: Array<{ title: string; url: string; snippet: string }> = [];
          const linkRegex = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
          const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

          let linkMatch: RegExpExecArray | null;
          const links: Array<{ url: string; title: string }> = [];
          while ((linkMatch = linkRegex.exec(html)) !== null) {
            let url = linkMatch[1] ?? '';
            // Resolve DuckDuckGo redirect URLs
            if (url.includes('uddg=')) {
              const uddg = new URL(url, 'https://duckduckgo.com').searchParams.get('uddg');
              if (uddg) url = uddg;
            }
            const title = (linkMatch[2] ?? '').replace(/<[^>]*>/g, '').trim();
            links.push({ url, title });
          }

          let snippetMatch: RegExpExecArray | null;
          const snippets: string[] = [];
          while ((snippetMatch = snippetRegex.exec(html)) !== null) {
            snippets.push((snippetMatch[1] ?? '').replace(/<[^>]*>/g, '').trim());
          }

          const maxCount = Math.min(links.length, params.max_results ?? 5);
          for (let i = 0; i < maxCount; i++) {
            const link = links[i];
            if (link) {
              results.push({
                title: link.title,
                url: link.url,
                snippet: snippets[i] ?? '',
              });
            }
          }

          allResults.push({ query, results });
        } catch {
          allResults.push({ query, results: [] });
        }
      }

      return { status: 'success' as const, searches: allResults };
    },
  });
}

export function createSearchTools(ctx: ToolContext) {
  return {
    info_search_web: createSearchWebTool(ctx),
  } as const;
}
