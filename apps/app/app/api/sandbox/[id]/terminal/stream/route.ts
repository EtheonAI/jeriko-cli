import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { log } from "@repo/observability/log";

const SANDBOX_SERVICE_URL =
  process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";

/**
 * GET /api/sandbox/[id]/terminal/stream
 *
 * Returns the PTY WebSocket URL for live terminal streaming from the sandbox service.
 * The frontend (useE2BTerminal) connects to this WebSocket for xterm.js attachment.
 */
export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { id: sandboxId } = await params;

    const resp = await fetch(
      `${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/terminal/stream`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return new Response(
        JSON.stringify({
          error: `Sandbox service error: ${resp.status}`,
          detail: text,
        }),
        { status: resp.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const raw = await resp.json();
    const data = raw.data ?? raw;

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    log.error("Terminal stream proxy error:", error as Error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
