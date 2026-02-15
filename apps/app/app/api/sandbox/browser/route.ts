import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { log } from "@repo/observability/log";

const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";

/**
 * POST /api/sandbox/browser
 *
 * Proxies browser actions to sandbox service browser endpoint.
 * Body: { sandboxId: string, action: string, ...params }
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
    const { sandboxId, action, ...params } = body as {
      sandboxId: string;
      action: "click" | "move" | "key" | "type" | "navigate";
      x?: number;
      y?: number;
      key?: string;
      text?: string;
      button?: string;
      url?: string;
    };

    if (!sandboxId || !action) {
      return new Response(JSON.stringify({ error: "sandboxId and action are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const endpoint = `${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/browser`;
    const requestBody = { action, params };

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": session.user.id,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      log.error(`Sandbox service browser control error: ${errorText}`);
      return new Response(errorText, {
        status: resp.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    log.error(`Browser proxy error: ${error instanceof Error ? error.message : "unknown"}`);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
