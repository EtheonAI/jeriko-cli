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

      case "webdev-publish":
        url = `${ORCHESTRATOR_URL}/api/deploy/zip-upload`;
        fetchBody = JSON.stringify({
          sandboxId,
          userId: session.user.id,
          projectPath: payload.projectPath,
          outputDir: payload.outputDir || "dist",
          buildFirst: payload.buildFirst ?? true,
          buildCommand: payload.buildCommand || "pnpm build",
        });
        break;

      case "webdev-checkpoint":
        url = `${ORCHESTRATOR_URL}/api/webdev/checkpoint`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "webdev-restart":
        url = `${ORCHESTRATOR_URL}/api/webdev/restart`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "webdev-update-env":
        url = `${ORCHESTRATOR_URL}/api/webdev/update-env`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "webdev-domain-add":
        url = `${ORCHESTRATOR_URL}/api/webdev/domain/add`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "webdev-domain-remove":
        url = `${ORCHESTRATOR_URL}/api/webdev/domain/remove`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "webdev-domain-verify":
        url = `${ORCHESTRATOR_URL}/api/webdev/domain/verify`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "webdev-domain-list":
        url = `${ORCHESTRATOR_URL}/api/webdev/domain/list`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id });
        break;

      case "webdev-analytics":
        url = `${ORCHESTRATOR_URL}/api/webdev/analytics`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "deploy-static":
        url = `${ORCHESTRATOR_URL}/api/deploy/static`;
        fetchBody = JSON.stringify({
          sandboxId,
          userId: session.user.id,
          projectPath: payload.projectPath,
          projectName: payload.projectName,
          outputDir: payload.outputDir || "dist",
          buildFirst: payload.buildFirst ?? true,
          buildCommand: payload.buildCommand || "pnpm build 2>&1 || npm run build 2>&1",
          sessionId: payload.sessionId,
        });
        break;

      case "deploy-list-sites": {
        url = `${ORCHESTRATOR_URL}/api/deploy/sites/${encodeURIComponent(session.user.id)}`;
        method = "GET";
        break;
      }

      case "deploy-delete-site":
        url = `${ORCHESTRATOR_URL}/api/deploy/sites/${encodeURIComponent(payload.deploymentId as string)}`;
        method = "DELETE";
        break;

      case "webdev-debug-logs":
        url = `${ORCHESTRATOR_URL}/api/webdev/debug-logs`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "webdev-apply-edits":
        url = `${ORCHESTRATOR_URL}/api/webdev/apply-edits`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "webdev-setup-template":
        url = `${ORCHESTRATOR_URL}/api/webdev/setup-imported-template`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "webdev-rollback":
        url = `${ORCHESTRATOR_URL}/api/webdev/rollback`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "webdev-add-feature":
        url = `${ORCHESTRATOR_URL}/api/webdev/add-feature`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "webdev-restore":
        url = `${ORCHESTRATOR_URL}/api/webdev/restore`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "webdev-refresh-github-token":
        url = `${ORCHESTRATOR_URL}/api/webdev/refresh-github-token`;
        fetchBody = JSON.stringify({ sandboxId, userId: session.user.id, ...payload });
        break;

      case "usage-credits": {
        const billingUrl = process.env.BILLING_SERVICE_URL || "http://localhost:4008";
        url = `${billingUrl}/users/${encodeURIComponent(session.user.id)}/usage?limit=100`;
        if (payload.sessionId) {
          url += `&sessionId=${encodeURIComponent(payload.sessionId as string)}`;
        }
        method = "GET";
        break;
      }

      case "usage-balance": {
        const billingUrl2 = process.env.BILLING_SERVICE_URL || "http://localhost:4008";
        url = `${billingUrl2}/users/${encodeURIComponent(session.user.id)}/credits`;
        method = "GET";
        break;
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const resp = await fetch(url, {
      method,
      headers: (method === "GET" || method === "DELETE") ? { "x-user-id": session.user.id, "x-sandbox-id": sandboxId } : fetchHeaders,
      body: (method === "GET" || method === "DELETE") ? undefined : fetchBody,
      signal: AbortSignal.timeout(
        method === "POST" && (action === "deploy-static" || action === "webdev-publish") ? 300_000 : 30_000
      ),
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
