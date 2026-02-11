import { auth } from "@repo/auth";
import { headers } from "next/headers";

const ORCHESTRATOR_SERVICE_URL = process.env.ORCHESTRATOR_SERVICE_URL || "http://localhost:4014";

export const POST = async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
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
    const resp = await fetch(`${ORCHESTRATOR_SERVICE_URL}/v1/sessions/${id}/media/stop`, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });

    return new Response(await resp.text(), {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
