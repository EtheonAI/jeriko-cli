/**
 * Web search tool — uses Bing HTML scraping.
 * DuckDuckGo blocks server-side requests with CAPTCHA (HTTP 202) as of Feb 2026.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';

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
      // Try configured search provider first
      if (ctx.searchProvider) {
        try {
          const results = await ctx.searchProvider.search({
            query: params.query,
            dateRange: params.date_range,
          });
          if (results.length > 0) {
            return { status: 'success' as const, results };
          }
          // Provider returned empty — fall through to Bing
        } catch {
          // Fall through to Bing fallback
        }
      }

      // Bing HTML fallback — reliable, no CAPTCHA
      try {
        const resp = await fetch(
          `https://www.bing.com/search?q=${encodeURIComponent(params.query)}&count=10`,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(12000),
          }
        );
        if (!resp.ok) {
          return { status: 'error' as const, error: `Search failed (${resp.status})` };
        }

        const html = await resp.text();
        const items = html.split(/<li[^>]*class="b_algo"[^>]*>/i).slice(1);
        const results: Array<{ title: string; url: string; snippet: string }> = [];

        for (const item of items) {
          const titleMatch = item.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
          if (!titleMatch) continue;
          const title = (titleMatch[1] ?? '').replace(/<[^>]*>/g, '').trim();

          const citeMatch = item.match(/<cite[^>]*>([\s\S]*?)<\/cite>/i);
          let url = '';
          if (citeMatch) {
            url = (citeMatch[1] ?? '').replace(/<[^>]*>/g, '').trim();
            url = url.replace(/\s*›\s*/g, '/');
            if (url && !url.startsWith('http')) url = 'https://' + url;
          }

          const snippetMatch =
            item.match(/<p[^>]*>([\s\S]*?)<\/p>/i) ??
            item.match(/<span[^>]*class="[^"]*b_(?:lineclamp|paractl|descript)[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
          const snippet = snippetMatch
            ? (snippetMatch[1] ?? '').replace(/<[^>]*>/g, '').trim()
            : '';

          if (url && title) {
            results.push({ title, url, snippet });
          }
          if (results.length >= 10) break;
        }

        console.log(`[search-fallback] Bing query="${params.query}" status=${resp.status} results=${results.length}`);
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
