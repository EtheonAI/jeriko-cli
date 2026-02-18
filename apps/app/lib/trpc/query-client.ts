import {
  QueryClient,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query";

/**
 * Shared QueryClient factory — used by both TRPCProvider (client) and
 * server-side hydration helpers. Centralizes caching strategy.
 *
 * Tiered staleTime:
 * - Default: 30s — good balance for most queries
 * - Static definitions: Override per-query to 30min (connector defs, device catalog)
 * - Real-time data: Override per-query to 0 (active streaming, usage meters)
 *
 * refetchOnWindowFocus: false — users keep tabs open for long chat sessions.
 * refetchOnReconnect: "always" — after offline, sync immediately.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,          // 30s default
        gcTime: 10 * 60 * 1000,        // 10 min — keep inactive cache longer
        refetchOnWindowFocus: false,    // Chat app = long sessions
        refetchOnReconnect: "always",   // After offline → sync immediately
        retry: 1,                       // 1 retry (not 3) — fail fast
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      },
      mutations: {
        retry: 0,                       // Never retry mutations (could duplicate writes)
      },
      dehydrate: {
        // Dehydrate pending queries so in-flight server fetches
        // are picked up by the client without re-fetching
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}
