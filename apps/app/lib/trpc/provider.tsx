"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import {
  httpBatchStreamLink,
  httpBatchLink,
  splitLink,
  loggerLink,
} from "@trpc/client";
import { useState, type ReactNode } from "react";
import superjson from "superjson";
import { trpc } from "./client";
import { makeQueryClient } from "./query-client";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

// Shared link config
const linkConfig = {
  url: `${typeof window !== "undefined" ? "" : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${process.env.PORT ?? 3000}`)}/api/trpc`,
  transformer: superjson,
  fetch(url: URL | RequestInfo, options?: RequestInit) {
    return fetch(url, {
      ...options,
      credentials: "include" as RequestCredentials,
    });
  },
  headers: () => {
    const headers = new Headers();
    headers.set("x-trpc-source", "client");
    return headers;
  },
};

// Singleton — don't recreate on hot-reload in dev
let browserQueryClient: ReturnType<typeof makeQueryClient> | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: reuse across renders (stable cache)
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

interface TRPCProviderProps {
  children: ReactNode;
}

export function TRPCProvider({ children }: TRPCProviderProps) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        splitLink({
          // Mutations use regular batch link (may need to set cookies/headers)
          condition: (op) => op.type === "mutation",
          true: httpBatchLink({
            url: `${getBaseUrl()}/api/trpc`,
            transformer: superjson,
            maxURLLength: 2083,
            fetch(url, options) {
              return fetch(url, { ...options, credentials: "include" });
            },
            headers: () => {
              const headers = new Headers();
              headers.set("x-trpc-source", "client");
              return headers;
            },
          }),
          // Queries use streaming batch link — fast queries resolve instantly,
          // slow ones (Stripe, external APIs) don't block the rest
          false: httpBatchStreamLink({
            url: `${getBaseUrl()}/api/trpc`,
            transformer: superjson,
            maxURLLength: 2083,
            fetch(url, options) {
              return fetch(url, { ...options, credentials: "include" });
            },
            headers: () => {
              const headers = new Headers();
              headers.set("x-trpc-source", "client");
              return headers;
            },
          }),
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
