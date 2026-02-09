import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { log } from "@repo/observability/log";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

/**
 * POST /api/sandbox/browser
 *
 * Proxies browser actions to the agent service for user "Take Control" mode.
 * Body: { sandboxId: string, action: "click" | "move" | "key" | "type", x?: number, y?: number, key?: string, text?: string, button?: string }
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
      return new Response(
        JSON.stringify({ error: "sandboxId and action are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Map action to agent service endpoint
    const endpoint = `${AGENT_SERVICE_URL}/browser/${action}`;
    const requestBody = { sandbox_id: sandboxId, ...params };

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
      log.error("Agent service browser control error:", errorText);
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
    log.error("Browser proxy error:", error as Error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
