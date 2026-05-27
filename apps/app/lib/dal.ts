import "server-only";

import { cache } from "react";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/env";

/**
 * Cached session getter — deduplicates across layout + page in a single request.
 * Returns the session or null. Does NOT redirect.
 */
export const getSession = cache(async () => {
  if (env.E2E_AUTH_BYPASS === "true") {
    return {
      user: {
        id: "e2e-user",
        email: "e2e@jeriko.dev",
        name: "E2E User",
        image: null,
      },
    } as const;
  }

  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  return session;
});

/**
 * Verifies session and redirects to /login if not authenticated.
 * Call this from pages/server actions — NOT from layouts
 * (layouts don't re-render on navigation, per Next.js docs).
 */
export const verifySession = cache(async () => {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
});
