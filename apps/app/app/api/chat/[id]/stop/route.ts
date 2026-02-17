// ============================================================
// POST /api/chat/[id]/stop — Explicitly stop agent execution
// ============================================================
//
// Called when the user clicks the Stop button. Forwards the stop
// request to the orchestrator, which aborts the agent loop's
// AbortController. This replaces the old auto-stop-on-disconnect
// behavior — stop must now be an explicit user action.
// ============================================================

import { auth } from "@repo/auth";
import { headers } from "next/headers";

const ORCHESTRATOR_SERVICE_URL = process.env.ORCHESTRATOR_SERVICE_URL || "http://localhost:4014";

export const POST = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) {
    return new Response(null, { status: 401 });
  }

  const { id: sessionId } = await params;

  // Forward stop request to orchestrator
  const resp = await fetch(
    `${ORCHESTRATOR_SERVICE_URL}/v1/completions/${sessionId}/stop`,
    { method: "POST", signal: AbortSignal.timeout(5000) },
  ).catch(() => null);

  return Response.json({
    success: resp?.ok ?? false,
    sessionId,
  });
};
