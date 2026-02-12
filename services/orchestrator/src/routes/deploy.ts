/**
 * Deploy Routes — Manages deployment of webdev projects.
 *
 * Manus pattern (confirmed Feb 2026):
 *   - NO Wasmer — Manus does NOT use Wasmer
 *   - Dev preview: local dev server + deploy_expose_port (E2B port proxy)
 *   - Production deploy: deploy_zip_and_upload → zip project → S3 → hosting infra
 *   - Version switching: deploy_switch_version → checkout specific version
 *
 * Routes:
 *   POST /api/deploy/expose-port          — Expose sandbox port publicly
 *   POST /api/deploy/zip-upload           — Zip and upload to S3
 *   POST /api/deploy/switch-version       — Switch deployed version
 *   POST /api/deploy/create-webdev-project — Create webdev project for deployment
 *   GET  /api/deploy/health               — Health check
 */

import type { FastifyInstance } from "fastify";
import { createLogger } from "@repo/service-utils";

const logger = createLogger({ service: "deploy" });

const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";

// Domain pattern for exposed sandbox ports
// Manus: {port}-{sandbox-id}.us2.manus.computer
// Rubic: {port}-{sandbox-id}.e2b.dev (E2B default) or custom domain
const SANDBOX_DOMAIN = process.env.SANDBOX_DOMAIN || "";

/**
 * Execute a shell command in a sandbox.
 */
async function sandboxExec(
  sandboxId: string,
  command: string,
  userId: string,
  timeout = 30000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const resp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/shell`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({ command, timeout }),
    signal: AbortSignal.timeout(timeout + 5000),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Sandbox exec failed: ${resp.status} ${detail}`);
  }

  const data = (await resp.json()) as {
    data?: { stdout?: string; stderr?: string; exitCode?: number };
  };
  return {
    stdout: data.data?.stdout || "",
    stderr: data.data?.stderr || "",
    exitCode: data.data?.exitCode ?? 1,
  };
}

export async function deployRoutes(app: FastifyInstance) {
  /**
   * GET /api/deploy/health — Health check.
   */
  app.get("/api/deploy/health", async (_request, reply) => {
    return reply.send({
      status: "ok",
      sandboxDomain: SANDBOX_DOMAIN || "e2b.dev",
    });
  });

  /**
   * POST /api/deploy/expose-port — Expose a sandbox port as a public URL.
   *
   * Manus equivalent: deploy_expose_port tool
   *
   * Returns the public URL for the exposed port.
   * E2B automatically exposes ports via {port}-{sandbox-id}.e2b.dev
   */
  app.post("/api/deploy/expose-port", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      port: number;
    };

    const { sandboxId, userId, port } = body;

    if (!sandboxId || !userId || !port) {
      return reply.status(400).send({ error: "sandboxId, userId, and port required" });
    }

    try {
      // Get sandbox info to find E2B sandbox ID
      const sbxResp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}`, {
        headers: { "x-user-id": userId },
        signal: AbortSignal.timeout(5000),
      });

      if (!sbxResp.ok) {
        return reply.status(404).send({ error: "Sandbox not found" });
      }

      const sbxData = (await sbxResp.json()) as {
        data?: { e2bSandboxId?: string };
      };
      const e2bId = sbxData.data?.e2bSandboxId;

      if (!e2bId) {
        return reply.status(500).send({ error: "No E2B sandbox ID found" });
      }

      // Build public URL (port-first pattern: {port}-{e2bId}.domain)
      let publicUrl: string;
      if (SANDBOX_DOMAIN) {
        publicUrl = `https://${port}-${e2bId}.${SANDBOX_DOMAIN}`;
      } else {
        publicUrl = `https://${port}-${e2bId}.e2b.dev`;
      }

      logger.info({ sandboxId, port, publicUrl }, "Port exposed");

      return reply.send({
        success: true,
        url: publicUrl,
        port,
        sandboxId,
        e2bSandboxId: e2bId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/deploy/zip-upload — Zip project and upload to S3.
   *
   * Manus equivalent: POST /deploy/zip-and-upload
   *
   * This is the actual Manus deployment pattern:
   *   1. Build the project (optional)
   *   2. Zip the project or output dir
   *   3. Upload to S3 via rubic-upload-file (presigned URL)
   *   4. S3/hosting infrastructure serves the static site
   */
  app.post("/api/deploy/zip-upload", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      outputDir?: string;
      buildFirst?: boolean;
      buildCommand?: string;
    };

    const { sandboxId, userId } = body;
    const projectPath = body.projectPath || "/home/user/my-app";
    const outputDir = body.outputDir || "dist";
    const buildFirst = body.buildFirst ?? true;
    const buildCommand = body.buildCommand || "pnpm build";

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      // Optional: Build the project first
      if (buildFirst) {
        logger.info({ sandboxId, projectPath, buildCommand }, "Building project for deployment");
        const buildResult = await sandboxExec(
          sandboxId,
          `cd ${projectPath} && ${buildCommand}`,
          userId,
          120000 // 2 min build timeout
        );

        if (buildResult.exitCode !== 0) {
          return reply.status(400).send({
            error: "Build failed",
            stdout: buildResult.stdout.slice(-1000),
            stderr: buildResult.stderr.slice(-1000),
          });
        }
      }

      // Zip the output directory
      const zipName = `deploy-${Date.now()}.zip`;
      const zipPath = `/tmp/${zipName}`;
      await sandboxExec(
        sandboxId,
        `cd ${projectPath} && zip -r ${zipPath} ${outputDir}`,
        userId,
        30000
      );

      // Upload using rubic-upload-file utility
      const uploadResult = await sandboxExec(
        sandboxId,
        `rubic-upload-file ${zipPath}`,
        userId,
        30000
      );

      const accessUrl = uploadResult.stdout.trim();

      // Clean up
      await sandboxExec(sandboxId, `rm -f ${zipPath}`, userId, 5000);

      logger.info({ sandboxId, accessUrl }, "Project zipped and uploaded to S3");

      return reply.send({
        success: true,
        url: accessUrl,
        zipName,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/deploy/switch-version — Switch to a specific deployed version.
   *
   * Manus equivalent: POST /deploy/switch-version
   * Checks out a specific git commit and optionally rebuilds.
   */
  app.post("/api/deploy/switch-version", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      versionId: string;
      rebuild?: boolean;
    };

    const { sandboxId, userId, versionId } = body;
    const projectPath = body.projectPath || "/home/user/my-app";
    const rebuild = body.rebuild ?? false;

    if (!sandboxId || !userId || !versionId) {
      return reply.status(400).send({ error: "sandboxId, userId, and versionId required" });
    }

    try {
      // Checkout the specific version
      await sandboxExec(
        sandboxId,
        `cd ${projectPath} && git checkout ${versionId} -- .`,
        userId,
        10000
      );

      // Install deps (in case package.json changed)
      await sandboxExec(
        sandboxId,
        `cd ${projectPath} && pnpm install --frozen-lockfile 2>/dev/null || pnpm install`,
        userId,
        60000
      );

      // Optionally rebuild
      if (rebuild) {
        const buildResult = await sandboxExec(
          sandboxId,
          `cd ${projectPath} && pnpm build`,
          userId,
          120000
        );
        if (buildResult.exitCode !== 0) {
          return reply.status(400).send({
            error: "Build failed after version switch",
            output: buildResult.stdout.slice(-500) + "\n" + buildResult.stderr.slice(-500),
          });
        }
      }

      return reply.send({
        success: true,
        versionId,
        rebuilt: rebuild,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/deploy/create-webdev-project — Create a webdev project for deployment.
   *
   * Manus equivalent: POST /deploy/create-webdev-project
   * Sets up deployment configuration for a webdev project.
   */
  app.post("/api/deploy/create-webdev-project", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      app_name: string;
      projectPath?: string;
    };

    const { sandboxId, userId, app_name } = body;
    const projectPath = body.projectPath || `/home/user/${app_name}`;

    if (!sandboxId || !userId || !app_name) {
      return reply.status(400).send({ error: "sandboxId, userId, and app_name required" });
    }

    try {
      // Verify project exists
      const check = await sandboxExec(
        sandboxId,
        `[ -d "${projectPath}" ] && echo "exists" || echo "missing"`,
        userId,
        5000
      );

      if (check.stdout.trim() !== "exists") {
        return reply.status(404).send({ error: `Project not found at ${projectPath}` });
      }

      // Get current version
      const hashResult = await sandboxExec(
        sandboxId,
        `cd ${projectPath} && git rev-parse --short HEAD 2>/dev/null || echo "no-git"`,
        userId
      );

      // Get E2B sandbox ID for port proxy
      const sbxResp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}`, {
        headers: { "x-user-id": userId },
        signal: AbortSignal.timeout(5000),
      });

      let previewUrl = "";
      if (sbxResp.ok) {
        const sbxData = (await sbxResp.json()) as {
          data?: { e2bSandboxId?: string };
        };
        const e2bId = sbxData.data?.e2bSandboxId;
        if (e2bId) {
          const domain = SANDBOX_DOMAIN || "e2b.dev";
          previewUrl = `https://3000-${e2bId}.${domain}`;
        }
      }

      return reply.send({
        success: true,
        app_name,
        projectPath,
        currentVersion: hashResult.stdout.trim(),
        previewUrl,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });
}
