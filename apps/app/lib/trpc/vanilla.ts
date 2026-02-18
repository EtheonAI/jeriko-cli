import { createTRPCProxyClient, httpBatchStreamLink, loggerLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "./routers";

// ─── Procedure-level query cache ────────────────────────────────
// Replaces React Query's built-in cache. Caches .query() results
// by procedure path + serialized input. Deduplicates in-flight
// requests. Mutations always pass through uncached.
//
// This is what makes the settings-dialog prefetch useful:
// dialog opens → 15 queries fire → results cached →
// each tab calls same query → cache hit = instant.
// ────────────────────────────────────────────────────────────────

const DEFAULT_STALE_MS = 30_000; // 30s — same query within 30s returns cache

interface CacheEntry {
  data: unknown;
  expiresAt: number;
  promise?: Promise<unknown>;
}

const queryCache = new Map<string, CacheEntry>();

/**
 * Invalidate cached queries. No args = clear all.
 * Pass a prefix to clear matching keys (e.g. "connectors" clears all connectors.* caches).
 */
export function invalidateQueries(prefix?: string) {
  if (!prefix) {
    queryCache.clear();
    return;
  }
  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) {
      queryCache.delete(key);
    }
  }
}

// ─── Cached proxy wrapper ───────────────────────────────────────
// Wraps the raw tRPC proxy client. Intercepts .query() calls to
// add caching + dedup. .mutate() calls pass through and also
// invalidate related caches.
// ────────────────────────────────────────────────────────────────

function createCachedProxy(target: any, path: string[]): any {
  return new Proxy(Object.create(null), {
    get(_obj, prop: string | symbol) {
      // Symbol properties (Symbol.toPrimitive, Symbol.toStringTag, etc.) — pass through
      if (typeof prop === "symbol") {
        return target[prop];
      }

      // .then — don't wrap, prevents Promise.resolve(proxy) confusion
      if (prop === "then") return undefined;

      if (prop === "query") {
        // Intercept .query() with cache
        return (input?: unknown) => {
          const key = path.join(".") + ":" + JSON.stringify(input ?? null);
          const entry = queryCache.get(key);

          // Cache hit — fresh data
          if (entry && entry.expiresAt > Date.now() && entry.data !== undefined) {
            return Promise.resolve(entry.data);
          }

          // Dedup — same query already in-flight
          if (entry?.promise) {
            return entry.promise;
          }

          // Cache miss — call the real .query()
          const promise = target.query(input)
            .then((data: unknown) => {
              queryCache.set(key, { data, expiresAt: Date.now() + DEFAULT_STALE_MS });
              return data;
            })
            .catch((err: unknown) => {
              queryCache.delete(key);
              throw err;
            });

          queryCache.set(key, { data: undefined, expiresAt: 0, promise });
          return promise;
        };
      }

      if (prop === "mutate") {
        // Mutations pass through, then invalidate the router's cache
        return (...args: unknown[]) => {
          const result = target.mutate(...args);
          // After mutation completes, invalidate queries for this router
          if (result && typeof result.then === "function") {
            result.then(() => {
              // Invalidate the router prefix (e.g. "connectors" for connectors.install)
              if (path.length >= 1) {
                invalidateQueries(path[0]);
              }
            }).catch(() => {});
          }
          return result;
        };
      }

      // Recurse deeper into the path (e.g. client.billing.getCreditBalance)
      return createCachedProxy(target[prop], [...path, prop]);
    },
  });
}

// ─── Client singleton ───────────────────────────────────────────

let rawClient: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null = null;
let cachedClient: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null = null;

function getRawClient() {
  if (!rawClient) {
    rawClient = createTRPCProxyClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (opts) => opts.direction === "down" && opts.result instanceof Error,
        }),
        httpBatchStreamLink({
          url: "/api/trpc",
          transformer: superjson,
          maxURLLength: 2083,
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: "include",
            });
          },
          headers: () => ({
            "x-trpc-source": "client",
          }),
        }),
      ],
    });
  }
  return rawClient;
}

/**
 * Returns a tRPC client with built-in query caching.
 * - .query() calls are cached for 30s + deduped if in-flight
 * - .mutate() calls pass through and auto-invalidate the router's cache
 */
export function getTrpcClient(): ReturnType<typeof createTRPCProxyClient<AppRouter>> {
  if (!cachedClient) {
    cachedClient = createCachedProxy(getRawClient(), []) as any;
  }
  return cachedClient;
}
