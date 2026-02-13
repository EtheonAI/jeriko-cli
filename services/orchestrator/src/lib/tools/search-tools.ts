/**
 * Web search tool
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';

const SEARCH_FALLBACK_URL = 'https://html.duckduckgo.com/html/';

export function createSearchWebTool(ctx: ToolContext) {
  return tool({
    description: `Search web pages using search engine. Use for obtaining latest information or finding references.`,
    inputSchema: z.object({
      query: z.string().describe('Search query in Google search style, using 3-5 keywords.'),
      date_range: z
        .enum(['all', 'past_hour', 'past_day', 'past_week', 'past_month', 'past_year'])
        .optional()
        .describe('Time range filter for search results.'),
    }),
    execute: async (params) => {
      if (ctx.searchProvider) {
        try {
          const results = await ctx.searchProvider.search({
            query: params.query,
            dateRange: params.date_range,
          });
          return { status: 'success' as const, results };
        } catch {
          // Fall through to DuckDuckGo fallback
        }
      }

      // DuckDuckGo HTML fallback
      try {
        const resp = await fetch(SEARCH_FALLBACK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `q=${encodeURIComponent(params.query)}`,
          signal: AbortSignal.timeout(15000),
        });
        const html = await resp.text();

        const results: Array<{ title: string; url: string; snippet: string }> = [];
        const linkRegex = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

        const links: Array<{ url: string; title: string }> = [];
        let linkMatch: RegExpExecArray | null;
        while ((linkMatch = linkRegex.exec(html)) !== null) {
          let url = linkMatch[1] ?? '';
          if (url.includes('uddg=')) {
            const uddg = new URL(url, 'https://duckduckgo.com').searchParams.get('uddg');
            if (uddg) url = uddg;
          }
          const title = (linkMatch[2] ?? '').replace(/<[^>]*>/g, '').trim();
          links.push({ url, title });
        }

        const snippets: string[] = [];
        let snippetMatch: RegExpExecArray | null;
        while ((snippetMatch = snippetRegex.exec(html)) !== null) {
          snippets.push((snippetMatch[1] ?? '').replace(/<[^>]*>/g, '').trim());
        }

        const maxCount = Math.min(links.length, 5);
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

        return { status: 'success' as const, results };
      } catch {
        return { status: 'error' as const, error: 'Search failed' };
      }
    },
  });
}

export function createSearchTools(ctx: ToolContext) {
  return {
    info_search_web: createSearchWebTool(ctx),
  } as const;
}
