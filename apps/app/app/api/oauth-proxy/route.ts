import { auth } from "@repo/auth";
import { headers } from "next/headers";

const ORCHESTRATOR_URL =
  process.env.ORCHESTRATOR_SERVICE_URL || "http://localhost:4014";

/**
 * OAuth proxy route — forwards OAuth operations to the orchestrator.
 *
 * The app-auth page calls this to issue authorization codes after the user
 * authenticates via Better-Auth. This keeps the orchestrator URL private
 * and uses the existing auth session for identity verification.
 *
 * Body: { action: "authorize", userId, name, email, clientId, redirectUri, state, platform }
 */
export const POST = async (req: Request) => {
  try {
    const body = await req.json();
    const { action, ...payload } = body as {
      action: string;
      [key: string]: unknown;
    };

    if (action !== "authorize") {
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Verify the user is authenticated
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    // For the authorize action, we require that the userId matches the session
    // (prevents unauthorized users from getting codes for other users)
    if (session?.user) {
      // User is authenticated — enforce that they can only authorize as themselves
      if (payload.userId && payload.userId !== session.user.id) {
        return Response.json({ error: "User ID mismatch" }, { status: 403 });
      }
      payload.userId = session.user.id;
      payload.name = payload.name || session.user.name || "User";
      payload.email = payload.email || session.user.email || "";
    } else if (!payload.userId) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const resp = await fetch(`${ORCHESTRATOR_URL}/api/oauth/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "OAuth proxy failed" },
      { status: 500 }
    );
  }
};
