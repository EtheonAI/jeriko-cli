/**
 * Deploy Routes — Manages deployment of webdev projects.
 *
 * Manus pattern (confirmed Feb 2026):
 *   - NO Wasmer — Manus does NOT use Wasmer
 *   - Dev preview: local dev server + deploy_expose_port (E2B port proxy)
 *   - Production deploy: deploy_zip_and_upload → zip project → S3 → hosting infra
 *   - Version switching: deploy_switch_version → checkout specific version
 *   - Static hosting: S3 + CDN with permanent URLs (*.rubic.space pattern)
 *
 * Routes:
 *   POST /api/deploy/expose-port          — Expose sandbox port publicly
 *   POST /api/deploy/zip-upload           — Zip and upload to S3 (legacy)
 *   POST /api/deploy/static              — Build + extract + upload individual files to S3
 *   POST /api/deploy/switch-version       — Switch deployed version
 *   POST /api/deploy/create-webdev-project — Create webdev project for deployment
 *   GET  /api/deploy/sites/:userId        — List user's deployed sites
 *   GET  /api/deploy/health               — Health check
 */

import type { FastifyInstance } from "fastify";
import { createLogger } from "@repo/service-utils";
import { getSessionIdBySandboxId, getTerminalServerUrlBySandboxId, getE2bSandboxIdBySandboxId, getProjectPathBySandboxId, buildSandboxPortUrl, buildPreviewUrl, getSandboxDomain, getDeployDomain } from "../lib/e2b-manager.js";
import { getRsaHeaders } from "../lib/rsa-auth.js";

const logger = createLogger({ service: "deploy" });

const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";

// DEPLOY_DOMAIN is centralized in e2b-manager.ts (via getDeployDomain())

// ─── Terminal server helpers (same pattern as webdev.ts) ────────────────

/** POST JSON to terminal server with RSA signing */
async function tsPost(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 30000
): Promise<Record<string, unknown>> {
  const jsonBody = JSON.stringify(body);
  const rsaHeaders = getRsaHeaders(jsonBody);
  const resp = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...rsaHeaders },
    body: jsonBody,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new Error(`Terminal server error (${resp.status}): ${text}`);
  }
  return (await resp.json()) as Record<string, unknown>;
}

/** Track which terminals have been created per base URL */
const createdTerminals = new Set<string>();

/** Ensure a terminal session exists for a given terminal ID */
async function ensureTerminal(baseUrl: string, terminalId: string): Promise<void> {
  const key = `${baseUrl}:${terminalId}`;
  if (createdTerminals.has(key)) return;
  try {
    await tsPost(baseUrl, "/terminal/create", { id: terminalId }, 10000);
  } catch { /* Terminal may already exist */ }
  createdTerminals.add(key);
}

/**
 * Execute a command and get CLEAN stdout via temp file.
 */
async function sandboxExecClean(
  sandboxId: string,
  command: string,
  _userId: string,
  timeout = 30000
): Promise<{ stdout: string; exitCode: number }> {
  const baseUrl = getTerminalServerUrlBySandboxId(sandboxId);
  if (!baseUrl) throw new Error(`No terminal server URL for sandbox ${sandboxId}`);

  const terminalId = "deploy";
  await ensureTerminal(baseUrl, terminalId);

  const tmpFile = `/tmp/rubic_deploy_${Date.now()}`;
  const marker = `__DEPLOY_DONE_${Date.now()}__`;

  // Run command, capture to temp file
  await tsPost(baseUrl, `/terminal/${terminalId}/write`, {
    text: `(${command}) > ${tmpFile} 2>&1; echo $? > ${tmpFile}.exit; echo "${marker}"\n`
  }, timeout);

  // Wait for marker
  const pollStart = Date.now();
  await new Promise((r) => setTimeout(r, 2000));
  while (Date.now() - pollStart < timeout) {
    try {
      const result = await tsPost(baseUrl, "/text_editor", { command: "view", path: tmpFile }, 5000);
      const exitResult = await tsPost(baseUrl, "/text_editor", { command: "view", path: `${tmpFile}.exit` }, 5000);
      const stdout = String(result.content || "").replace(/^\s*\d+\t/gm, "").trim();
      const exitCode = parseInt(String(exitResult.content || "").replace(/^\s*\d+\t/gm, "").trim()) || 0;
      return { stdout, exitCode };
    } catch { /* file not ready yet */ }
    await new Promise((r) => setTimeout(r, 2000));
  }

  return { stdout: "", exitCode: 1 };
}

/**
 * Execute a shell command in a sandbox (legacy — via sandbox service).
 */
async function sandboxExec(
  sandboxId: string,
  command: string,
  userId: string,
  timeout = 30000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Try terminal server first (more reliable)
  const baseUrl = getTerminalServerUrlBySandboxId(sandboxId);
  if (baseUrl) {
    const result = await sandboxExecClean(sandboxId, command, userId, timeout);
    return { stdout: result.stdout, stderr: "", exitCode: result.exitCode };
  }

  // Fallback to sandbox service
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
      sandboxDomain: getSandboxDomain(),
      deployDomain: getDeployDomain(),
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

      // Build public URL using centralized helper
      const publicUrl = buildSandboxPortUrl(e2bId, port);

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
          previewUrl = buildPreviewUrl(e2bId, 3000) || "";
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

  /**
   * POST /api/deploy/static — Build, extract files, upload individually to S3.
   *
   * Manus pattern: Production deploy creates permanent public URLs.
   * Instead of uploading a zip, we upload individual files so S3/CDN
   * can serve them directly as a static website (index.html routing).
   *
   * Flow:
   *   1. Build project (optional)
   *   2. List all files in output dir
   *   3. Read each file from sandbox via terminal server /file/read
   *   4. Upload each to S3 with public-read
   *   5. Record deployment in DB
   *   6. Return permanent URL to index.html
   */
  app.post("/api/deploy/static", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectName?: string;
      projectPath?: string;
      outputDir?: string;
      buildFirst?: boolean;
      buildCommand?: string;
      sessionId?: string;
    };

    const { sandboxId, userId } = body;
    const projectPath = body.projectPath || getProjectPathBySandboxId(sandboxId) || "/home/ubuntu/my-app";
    const outputDir = body.outputDir || "dist";
    const buildFirst = body.buildFirst ?? true;
    const buildCommand = body.buildCommand || "pnpm build 2>&1 || npm run build 2>&1";
    const projectName = body.projectName || projectPath.split("/").pop() || "app";
    const sessionId = body.sessionId || getSessionIdBySandboxId(sandboxId) || "unknown";

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      // Step 1: Build
      let buildLog = "";
      if (buildFirst) {
        logger.info({ sandboxId, projectPath, buildCommand }, "Building project for static deploy");
        const buildResult = await sandboxExec(sandboxId, `cd ${projectPath} && ${buildCommand}`, userId, 180000);
        buildLog = buildResult.stdout.slice(-2000);
        if (buildResult.exitCode !== 0) {
          return reply.status(400).send({
            error: "Build failed",
            buildLog,
          });
        }
      }

      // Step 2: Get file list from output dir
      const fullOutputPath = outputDir.startsWith("/") ? outputDir : `${projectPath}/${outputDir}`;
      const fileListResult = await sandboxExec(
        sandboxId,
        `find ${fullOutputPath} -type f | head -500`,
        userId,
        15000
      );

      const files = fileListResult.stdout.trim().split("\n").filter(Boolean);
      if (files.length === 0) {
        return reply.status(400).send({ error: `No files found in ${fullOutputPath}`, buildLog });
      }

      // Step 3: Generate deployment prefix
      const timestamp = Date.now();
      const safeProject = projectName.replace(/[^a-z0-9-]/gi, "-").slice(0, 30).toLowerCase();
      const userPrefix = userId.replace(/[^a-z0-9]/gi, "").slice(0, 8);
      const deployId = `${userPrefix}-${safeProject}-${timestamp}`;
      const s3Prefix = `sites/${userId}/${deployId}`;

      // Step 4: Read files from sandbox and upload to S3
      const { uploadPublicFile, getPublicUrl } = await import("@repo/storage");
      const baseUrl = getTerminalServerUrlBySandboxId(sandboxId);
      if (!baseUrl) throw new Error("No terminal server URL for sandbox");

      let uploaded = 0;
      let failed = 0;
      const MIME_MAP: Record<string, string> = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".mjs": "application/javascript",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
        ".eot": "application/vnd.ms-fontobject",
        ".txt": "text/plain",
        ".xml": "application/xml",
        ".webmanifest": "application/manifest+json",
        ".map": "application/json",
      };

      // Upload files in parallel batches of 10
      const BATCH_SIZE = 10;
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (filePath) => {
          try {
            const rsaBody = JSON.stringify({ path: filePath });
            const rsaHeaders = getRsaHeaders(rsaBody);
            const resp = await fetch(`${baseUrl}/file/read`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...rsaHeaders },
              body: rsaBody,
              signal: AbortSignal.timeout(10000),
            });

            if (!resp.ok) { failed++; return; }
            const data = (await resp.json()) as { content?: string; encoding?: string };
            if (!data.content) { failed++; return; }

            const buffer = data.encoding === "base64"
              ? Buffer.from(data.content, "base64")
              : Buffer.from(data.content, "utf-8");

            // Compute relative path from output dir
            const relPath = filePath.startsWith(fullOutputPath)
              ? filePath.slice(fullOutputPath.length).replace(/^\//, "")
              : filePath.split("/").pop() || "file";

            const ext = "." + (relPath.split(".").pop() || "").toLowerCase();
            const contentType = MIME_MAP[ext] || "application/octet-stream";
            const s3Key = `${s3Prefix}/${relPath}`;

            await uploadPublicFile(s3Key, buffer, contentType);
            uploaded++;
          } catch (err) {
            logger.warn({ filePath, error: String(err) }, "Failed to upload file for static deploy");
            failed++;
          }
        }));
      }

      if (uploaded === 0) {
        return reply.status(500).send({ error: "Failed to upload any files", failed });
      }

      // Step 5: Generate permanent URL
      const indexKey = `${s3Prefix}/index.html`;
      const deployedUrl = getPublicUrl(indexKey);

      // Build a friendlier URL if DEPLOY_DOMAIN is set
      const deployDomain = getDeployDomain();
      const friendlyUrl = deployDomain
        ? `https://${safeProject}-${userPrefix}.${deployDomain}`
        : deployedUrl;

      // Step 6: Record deployment in DB
      let deploymentId: string | undefined;
      try {
        const dbModule = await import("@repo/database/service-index");
        const resolved = (dbModule as any).default ?? dbModule;
        const { db } = resolved;
        const { deployments } = resolved;

        if (db && deployments) {
          const [record] = await db.insert(deployments).values({
            projectId: sessionId,
            userId,
            sessionId,
            platform: "s3" as const,
            status: "deployed" as const,
            url: deployedUrl,
            s3Prefix,
            buildLog: buildLog.slice(-2000),
            environment: "production",
          }).returning({ id: deployments.id });
          deploymentId = record?.id;
        }
      } catch (dbErr) {
        logger.warn({ error: String(dbErr) }, "Failed to record deployment in DB (non-fatal)");
      }

      // Step 7: Get commit hash for reference
      let commitHash = "";
      try {
        const gitResult = await sandboxExec(sandboxId, `cd ${projectPath} && git rev-parse --short HEAD 2>/dev/null || echo ""`, userId, 5000);
        commitHash = gitResult.stdout.trim();
      } catch { /* git not available */ }

      logger.info({
        sandboxId, deployId, uploaded, failed, deployedUrl, deploymentId,
      }, "Static site deployed to S3");

      return reply.send({
        success: true,
        url: deployedUrl,
        friendlyUrl,
        s3Prefix,
        deploymentId,
        filesUploaded: uploaded,
        filesFailed: failed,
        commitHash,
        projectName: safeProject,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ sandboxId, error: msg }, "Static deploy failed");
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * GET /api/deploy/sites/:userId — List user's deployed sites.
   *
   * Returns deployment history with permanent URLs.
   */
  app.get("/api/deploy/sites/:userId", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    if (!userId) return reply.status(400).send({ error: "userId required" });

    try {
      const dbModule = await import("@repo/database/service-index");
      const resolved = (dbModule as any).default ?? dbModule;
      const { db, eq, desc } = resolved;
      const { deployments } = resolved;

      if (!db || !deployments) {
        return reply.send({ sites: [] });
      }

      const sites = await db
        .select({
          id: deployments.id,
          projectId: deployments.projectId,
          sessionId: deployments.sessionId,
          platform: deployments.platform,
          status: deployments.status,
          url: deployments.url,
          s3Prefix: deployments.s3Prefix,
          environment: deployments.environment,
          commitHash: deployments.commitHash,
          createdAt: deployments.createdAt,
        })
        .from(deployments)
        .where(eq(deployments.userId, userId))
        .orderBy(desc(deployments.createdAt))
        .limit(50);

      return reply.send({ sites });
    } catch (err) {
      logger.warn({ error: String(err) }, "Failed to list deployed sites");
      return reply.send({ sites: [] });
    }
  });

  /**
   * DELETE /api/deploy/sites/:deploymentId — Delete a deployed site.
   *
   * Removes S3 files and DB record.
   */
  app.delete("/api/deploy/sites/:deploymentId", async (request, reply) => {
    const { deploymentId } = request.params as { deploymentId: string };
    if (!deploymentId) return reply.status(400).send({ error: "deploymentId required" });

    try {
      const dbModule = await import("@repo/database/service-index");
      const resolved = (dbModule as any).default ?? dbModule;
      const { db, eq } = resolved;
      const { deployments } = resolved;

      if (!db || !deployments) {
        return reply.status(500).send({ error: "Database not available" });
      }

      // Get deployment record
      const [deployment] = await db.select().from(deployments).where(eq(deployments.id, deploymentId)).limit(1);
      if (!deployment) return reply.status(404).send({ error: "Deployment not found" });

      // Delete S3 files
      if (deployment.s3Prefix) {
        try {
          const { listFiles, deleteFiles } = await import("@repo/storage");
          const files = await listFiles(deployment.s3Prefix);
          if (files.length > 0) {
            await deleteFiles(files.map(f => f.key));
          }
        } catch (s3Err) {
          logger.warn({ error: String(s3Err) }, "Failed to delete S3 files (non-fatal)");
        }
      }

      // Delete DB record
      await db.delete(deployments).where(eq(deployments.id, deploymentId));

      return reply.send({ success: true });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
}
