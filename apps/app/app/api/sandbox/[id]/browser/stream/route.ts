import { auth } from "@repo/auth";
import { headers } from "next/headers";

const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";

/**
 * GET /api/sandbox/[id]/browser/stream
 *
 * Returns the noVNC stream URL for embedding the live E2B Desktop browser
 * in an iframe. Proxies to the sandbox service which returns the public
 * noVNC URL from getHost(6080).
 */
export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
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

    const { id } = await params;

    const resp = await fetch(
      `${SANDBOX_SERVICE_URL}/sandboxes/${id}/browser/stream`,
      {
        headers: {
          "x-user-id": session.user.id,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!resp.ok) {
      const errorText = await resp.text();
      return new Response(errorText, {
        status: resp.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const raw = await resp.json();
    const data = raw.data ?? raw;

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to get stream URL",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
