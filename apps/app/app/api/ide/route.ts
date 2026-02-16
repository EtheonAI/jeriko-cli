import { auth } from "@repo/auth";
import { headers } from "next/headers";

const ORCHESTRATOR_URL =
  process.env.ORCHESTRATOR_SERVICE_URL || "http://localhost:4014";

/**
 * IDE proxy route — forwards IDE operations to the orchestrator service.
 * Supports: database queries, file listing, code-server auth, webdev operations.
 *
 * Body: { sandboxId, action, ...payload }
 * Actions: "database", "files", "code-server-pre-auth", "code-server-auth",
 *          "webdev-status", "webdev-config", "deploy-expose"
 */
export const POST = async (req: Request) => {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sandboxId, action, ...payload } = body as {
      sandboxId: string;
      action: string;
      [key: string]: unknown;
    };

    if (!sandboxId || !action) {
      return Response.json(
        { error: "sandboxId and action are required" },
        { status: 400 }
      );
    }

    let url: string;
    let method = "POST";
    let fetchBody: string | undefined = undefined;
    const fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "x-user-id": session.user.id,
      "x-sandbox-id": sandboxId,
    };

    switch (action) {
      case "database":
        url = `${ORCHESTRATOR_URL}/api/webdev/database`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "files":
        url = `${ORCHESTRATOR_URL}/api/file/batch-read`;
        fetchBody = JSON.stringify({ sandboxId, ...payload });
        break;

      case "file-list": {
        const path = (payload.path as string) || "/home/ubuntu";
        url = `${ORCHESTRATOR_URL}/api/file/list`;
        fetchBody = JSON.stringify({ sandboxId, path });
        break;
      }

      case "code-server-pre-auth": {
        url = `${ORCHESTRATOR_URL}/api/code-server/pre-auth?sandboxId=${encodeURIComponent(sandboxId)}&userId=${encodeURIComponent(session.user.id)}`;
        method = "GET";
        break;
      }

      case "code-server-auth":
        url = `${ORCHESTRATOR_URL}/api/code-server/auth`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "webdev-status":
        url = `${ORCHESTRATOR_URL}/api/webdev/status`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id });
        break;

      case "webdev-config":
        url = `${ORCHESTRATOR_URL}/api/webdev/config`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "deploy-expose":
        url = `${ORCHESTRATOR_URL}/api/deploy/expose-port`;
        fetchBody = JSON.stringify({ sandboxId, ...payload });
        break;

      case "webdev-versions":
        url = `${ORCHESTRATOR_URL}/api/webdev/versions`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id });
        break;

      case "webdev-git-push":
        url = `${ORCHESTRATOR_URL}/api/webdev/git-push`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "webdev-git-sync":
        url = `${ORCHESTRATOR_URL}/api/webdev/git-sync-check`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id });
        break;

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const resp = await fetch(url, {
      method,
      headers: method === "GET" ? { "x-user-id": session.user.id, "x-sandbox-id": sandboxId } : fetchHeaders,
      body: method === "GET" ? undefined : fetchBody,
      signal: AbortSignal.timeout(30_000),
    });

    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "IDE proxy failed" },
      { status: 500 }
    );
  }
};
