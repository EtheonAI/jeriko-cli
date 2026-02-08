import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { log } from "@repo/observability/log";

const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";

/**
 * POST /api/sandbox/browser
 *
 * Proxies browser actions to the sandbox service for user "Take Control" mode.
 * Body: { sandboxId: string, action: string, params?: Record<string, unknown> }
 */
export const POST = async (req: Request) => {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { sandboxId, action, params } = body as {
      sandboxId: string;
      action: string;
      params?: Record<string, unknown>;
    };

    if (!sandboxId || !action) {
      return new Response(
        JSON.stringify({ error: "sandboxId and action are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const resp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/browser`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, params }),
      signal: AbortSignal.timeout(50000),
    });

    const raw = await resp.json();
    const data = raw.data ?? raw; // Unwrap service envelope
    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    log.error("Browser proxy error:", error as Error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
