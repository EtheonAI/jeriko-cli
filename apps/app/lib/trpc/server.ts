import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { createCallerFactory, createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers";

/**
 * Cache the query client per request — ensures all prefetches within one
 * RSC render share the same cache and get dehydrated together.
 */
export const getQueryClient = cache(makeQueryClient);

/**
 * This wraps the `createTRPCContext` helper and provides the required context
 * for the tRPC API when handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");
  return createTRPCContext({ headers: heads });
});

const createCaller = createCallerFactory(appRouter);

/**
 * Hydration helpers — prefetch data on the server, hydrate on the client.
 *
 * Usage in server components:
 *   import { serverTrpc, HydrateClient } from "@/lib/trpc/server";
 *
 *   // In a page.tsx:
 *   void serverTrpc.sessions.list.prefetch();
 *   return <HydrateClient><ClientComponent /></HydrateClient>;
 *
 * The client component's `trpc.sessions.list.useQuery()` will INSTANTLY
 * have the data — zero network waterfall.
 */
export const { trpc: serverTrpc, HydrateClient } = createHydrationHelpers<typeof appRouter>(
  createCaller(createContext),
  getQueryClient,
);

/**
 * Legacy server caller — use serverTrpc.X.prefetch() for new code.
 * Kept for backward compatibility with existing server component calls.
 */
export const api = async () => {
  const ctx = await createContext();
  return createCaller(ctx);
};
