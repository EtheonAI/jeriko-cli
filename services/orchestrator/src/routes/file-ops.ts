import type { FastifyInstance } from "fastify";
import { createLogger } from "@repo/service-utils";

const logger = createLogger({ service: "file-ops" });
const SANDBOX_SERVICE_URL =
  process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";

async function sandboxExec(
  sandboxId: string,
  command: string,
  userId: string,
  timeout = 30000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const resp = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/shell`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ command, timeout }),
      signal: AbortSignal.timeout(timeout + 5000),
    },
  );
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

async function sandboxReadFile(
  sandboxId: string,
  filePath: string,
  userId: string,
): Promise<string> {
  const resp = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/files?path=${encodeURIComponent(filePath)}`,
    {
      headers: { "x-user-id": userId },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`File read failed: ${resp.status} ${detail}`);
  }
  const data = (await resp.json()) as { data?: { content?: string } };
  return data.data?.content || "";
}

async function sandboxWriteFile(
  sandboxId: string,
  filePath: string,
  content: string,
  userId: string,
): Promise<void> {
  const resp = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/files`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ path: filePath, content }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`File write failed: ${resp.status} ${detail}`);
  }
}

export async function fileOpsRoutes(fastify: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // POST /api/file/read — Read a single file from the sandbox
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: { sandboxId: string; userId: string; path: string };
  }>("/api/file/read", async (request, reply) => {
    const { sandboxId, userId, path } = request.body;
    if (!sandboxId || !userId || !path) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and path are required" });
    }
    try {
      const content = await sandboxReadFile(sandboxId, path, userId);
      return { success: true, data: { path, content } };
    } catch (err: any) {
      logger.error({ err, sandboxId, path }, "file/read failed");
      return reply.status(500).send({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/file/write — Write a single file in the sandbox
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: {
      sandboxId: string;
      userId: string;
      path: string;
      content: string;
    };
  }>("/api/file/write", async (request, reply) => {
    const { sandboxId, userId, path, content } = request.body;
    if (!sandboxId || !userId || !path || content === undefined) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, path, and content are required" });
    }
    try {
      await sandboxWriteFile(sandboxId, path, content, userId);
      return { success: true, data: { path } };
    } catch (err: any) {
      logger.error({ err, sandboxId, path }, "file/write failed");
      return reply.status(500).send({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/file/batch_read — Read multiple files in one call
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: { sandboxId: string; userId: string; paths: string[] };
  }>("/api/file/batch_read", async (request, reply) => {
    const { sandboxId, userId, paths } = request.body;
    if (!sandboxId || !userId || !Array.isArray(paths) || paths.length === 0) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and paths[] are required" });
    }
    try {
      const results = await Promise.allSettled(
        paths.map(async (p) => {
          const content = await sandboxReadFile(sandboxId, p, userId);
          return { path: p, content };
        }),
      );
      const files = results.map((r, i) =>
        r.status === "fulfilled"
          ? r.value
          : { path: paths[i]!, content: null, error: (r.reason as Error).message },
      );
      return { success: true, data: { files } };
    } catch (err: any) {
      logger.error({ err, sandboxId }, "file/batch_read failed");
      return reply.status(500).send({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/file/files_exist — Check if relative paths exist under basePath
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: {
      sandboxId: string;
      userId: string;
      paths: string[];
      basePath?: string;
    };
  }>("/api/file/files_exist", async (request, reply) => {
    const { sandboxId, userId, paths, basePath = "/home/user" } = request.body;
    if (!sandboxId || !userId || !Array.isArray(paths) || paths.length === 0) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and paths[] are required" });
    }
    try {
      // Build a single shell command that checks all paths at once
      const checks = paths
        .map((p) => {
          const full = `${basePath}/${p}`.replace(/\/+/g, "/");
          return `test -f ${JSON.stringify(full)} && echo "1" || echo "0"`;
        })
        .join("; ");
      const { stdout } = await sandboxExec(sandboxId, checks, userId);
      const lines = stdout.trim().split("\n");
      const results: Record<string, boolean> = {};
      paths.forEach((p, i) => {
        results[p] = lines[i]?.trim() === "1";
      });
      return { success: true, data: { results } };
    } catch (err: any) {
      logger.error({ err, sandboxId }, "file/files_exist failed");
      return reply.status(500).send({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/file/files_exist_abs — Check if absolute paths exist
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: { sandboxId: string; userId: string; paths: string[] };
  }>("/api/file/files_exist_abs", async (request, reply) => {
    const { sandboxId, userId, paths } = request.body;
    if (!sandboxId || !userId || !Array.isArray(paths) || paths.length === 0) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and paths[] are required" });
    }
    try {
      const checks = paths
        .map((p) => `test -f ${JSON.stringify(p)} && echo "1" || echo "0"`)
        .join("; ");
      const { stdout } = await sandboxExec(sandboxId, checks, userId);
      const lines = stdout.trim().split("\n");
      const results: Record<string, boolean> = {};
      paths.forEach((p, i) => {
        results[p] = lines[i]?.trim() === "1";
      });
      return { success: true, data: { results } };
    } catch (err: any) {
      logger.error({ err, sandboxId }, "file/files_exist_abs failed");
      return reply.status(500).send({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/file/upload_to_s3 — Upload a single sandbox file to S3
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: { sandboxId: string; userId: string; filePath: string };
  }>("/api/file/upload_to_s3", async (request, reply) => {
    const { sandboxId, userId, filePath } = request.body;
    if (!sandboxId || !userId || !filePath) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and filePath are required" });
    }
    try {
      const { stdout, stderr, exitCode } = await sandboxExec(
        sandboxId,
        `rubic-upload-file ${JSON.stringify(filePath)}`,
        userId,
        60000,
      );
      if (exitCode !== 0) {
        throw new Error(`Upload failed (exit ${exitCode}): ${stderr || stdout}`);
      }
      // rubic-upload-file prints the CDN URL on stdout
      const cdnUrl = stdout.trim().split("\n").pop()?.trim() || "";
      logger.info({ sandboxId, filePath, cdnUrl }, "upload_to_s3 success");
      return { success: true, data: { filePath, cdnUrl } };
    } catch (err: any) {
      logger.error({ err, sandboxId, filePath }, "upload_to_s3 failed");
      return reply.status(500).send({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/file/upload_files_to_s3 — Upload multiple sandbox files to S3
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: { sandboxId: string; userId: string; filePaths: string[] };
  }>("/api/file/upload_files_to_s3", async (request, reply) => {
    const { sandboxId, userId, filePaths } = request.body;
    if (
      !sandboxId ||
      !userId ||
      !Array.isArray(filePaths) ||
      filePaths.length === 0
    ) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and filePaths[] are required" });
    }
    try {
      const results = await Promise.allSettled(
        filePaths.map(async (fp) => {
          const { stdout, stderr, exitCode } = await sandboxExec(
            sandboxId,
            `rubic-upload-file ${JSON.stringify(fp)}`,
            userId,
            60000,
          );
          if (exitCode !== 0) {
            throw new Error(
              `Upload failed (exit ${exitCode}): ${stderr || stdout}`,
            );
          }
          const cdnUrl = stdout.trim().split("\n").pop()?.trim() || "";
          return { filePath: fp, cdnUrl };
        }),
      );
      const uploads = results.map((r, i) =>
        r.status === "fulfilled"
          ? { ...r.value, success: true }
          : {
              filePath: filePaths[i]!,
              cdnUrl: null,
              success: false,
              error: (r.reason as Error).message,
            },
      );
      logger.info(
        { sandboxId, total: filePaths.length, succeeded: uploads.filter((u) => u.success).length },
        "upload_files_to_s3 complete",
      );
      return { success: true, data: { uploads } };
    } catch (err: any) {
      logger.error({ err, sandboxId }, "upload_files_to_s3 failed");
      return reply.status(500).send({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/file/multipart_upload_to_s3 — Multipart upload for large files
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: { sandboxId: string; userId: string; filePath: string };
  }>("/api/file/multipart_upload_to_s3", async (request, reply) => {
    const { sandboxId, userId, filePath } = request.body;
    if (!sandboxId || !userId || !filePath) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and filePath are required" });
    }
    try {
      // rubic-upload-file handles large files internally (multipart via presigned URLs)
      const { stdout, stderr, exitCode } = await sandboxExec(
        sandboxId,
        `rubic-upload-file ${JSON.stringify(filePath)}`,
        userId,
        120000, // 2 min for large files
      );
      if (exitCode !== 0) {
        throw new Error(
          `Multipart upload failed (exit ${exitCode}): ${stderr || stdout}`,
        );
      }
      const cdnUrl = stdout.trim().split("\n").pop()?.trim() || "";
      logger.info({ sandboxId, filePath, cdnUrl }, "multipart_upload_to_s3 success");
      return { success: true, data: { filePath, cdnUrl } };
    } catch (err: any) {
      logger.error({ err, sandboxId, filePath }, "multipart_upload_to_s3 failed");
      return reply.status(500).send({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/file/store_parallel_tasks_result — Store parallel task results
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: {
      sandboxId: string;
      userId: string;
      taskId: string;
      results: unknown;
    };
  }>("/api/file/store_parallel_tasks_result", async (request, reply) => {
    const { sandboxId, userId, taskId, results } = request.body;
    if (!sandboxId || !userId || !taskId || results === undefined) {
      return reply
        .status(400)
        .send({
          error: "sandboxId, userId, taskId, and results are required",
        });
    }
    try {
      const outputDir = "/home/user/terminal_full_output";
      const filePath = `${outputDir}/${taskId}.json`;
      const content = JSON.stringify(results, null, 2);

      // Ensure directory exists, then write file
      await sandboxExec(sandboxId, `mkdir -p ${outputDir}`, userId);
      await sandboxWriteFile(sandboxId, filePath, content, userId);

      logger.info({ sandboxId, taskId, filePath }, "store_parallel_tasks_result success");
      return { success: true, data: { filePath } };
    } catch (err: any) {
      logger.error({ err, sandboxId, taskId }, "store_parallel_tasks_result failed");
      return reply.status(500).send({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/file/renew-presigned-urls — Renew presigned URLs for S3 keys
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: { keys: string[]; expiresIn?: number };
  }>("/api/file/renew-presigned-urls", async (request, reply) => {
    const { keys, expiresIn = 3600 } = request.body;
    if (!Array.isArray(keys) || keys.length === 0) {
      return reply.status(400).send({ error: "keys[] is required" });
    }
    try {
      // Lazy-load @repo/storage to avoid startup cost if never called
      const storageMod = await import("@repo/storage");
      const storage = (storageMod as any).default ?? storageMod;
      const { getPresignedUrl } = storage as {
        getPresignedUrl: (key: string, expiresIn?: number) => Promise<string>;
      };

      const results = await Promise.allSettled(
        keys.map(async (key) => {
          const url = await getPresignedUrl(key, expiresIn);
          return { key, url };
        }),
      );
      const urls = results.map((r, i) =>
        r.status === "fulfilled"
          ? { ...r.value, success: true }
          : {
              key: keys[i]!,
              url: null,
              success: false,
              error: (r.reason as Error).message,
            },
      );
      return { success: true, data: { urls } };
    } catch (err: any) {
      logger.error({ err }, "renew-presigned-urls failed");
      return reply.status(500).send({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/file/download-attachments — Download URLs to sandbox Downloads dir
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: {
      sandboxId: string;
      userId: string;
      attachments: Array<{ url: string; filename?: string }>;
    };
  }>("/api/file/download-attachments", async (request, reply) => {
    const { sandboxId, userId, attachments } = request.body;
    if (
      !sandboxId ||
      !userId ||
      !Array.isArray(attachments) ||
      attachments.length === 0
    ) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and attachments[] are required" });
    }
    try {
      const destDir = "/home/user/Downloads";
      await sandboxExec(sandboxId, `mkdir -p ${destDir}`, userId);

      const results = await Promise.allSettled(
        attachments.map(async (att) => {
          const filename =
            att.filename || att.url.split("/").pop()?.split("?")[0] || "file";
          const destPath = `${destDir}/${filename}`;
          const { stderr, exitCode } = await sandboxExec(
            sandboxId,
            `curl -fsSL -o ${JSON.stringify(destPath)} ${JSON.stringify(att.url)}`,
            userId,
            60000,
          );
          if (exitCode !== 0) {
            throw new Error(`Download failed: ${stderr}`);
          }
          return { url: att.url, filename, destPath };
        }),
      );
      const downloads = results.map((r, i) =>
        r.status === "fulfilled"
          ? { ...r.value, success: true }
          : {
              url: attachments[i]!.url,
              filename: attachments[i]!.filename || null,
              destPath: null,
              success: false,
              error: (r.reason as Error).message,
            },
      );
      logger.info(
        { sandboxId, total: attachments.length, succeeded: downloads.filter((d) => d.success).length },
        "download-attachments complete",
      );
      return { success: true, data: { downloads } };
    } catch (err: any) {
      logger.error({ err, sandboxId }, "download-attachments failed");
      return reply.status(500).send({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/file/download-user-edited — Download user-edited files to upload dir
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: {
      sandboxId: string;
      userId: string;
      files: Array<{ url: string; filename?: string }>;
    };
  }>("/api/file/download-user-edited", async (request, reply) => {
    const { sandboxId, userId, files } = request.body;
    if (
      !sandboxId ||
      !userId ||
      !Array.isArray(files) ||
      files.length === 0
    ) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and files[] are required" });
    }
    try {
      const destDir = "/home/user/upload";
      await sandboxExec(sandboxId, `mkdir -p ${destDir}`, userId);

      const results = await Promise.allSettled(
        files.map(async (f) => {
          const filename =
            f.filename || f.url.split("/").pop()?.split("?")[0] || "file";
          const destPath = `${destDir}/${filename}`;
          const { stderr, exitCode } = await sandboxExec(
            sandboxId,
            `curl -fsSL -o ${JSON.stringify(destPath)} ${JSON.stringify(f.url)}`,
            userId,
            60000,
          );
          if (exitCode !== 0) {
            throw new Error(`Download failed: ${stderr}`);
          }
          return { url: f.url, filename, destPath };
        }),
      );
      const downloads = results.map((r, i) =>
        r.status === "fulfilled"
          ? { ...r.value, success: true }
          : {
              url: files[i]!.url,
              filename: files[i]!.filename || null,
              destPath: null,
              success: false,
              error: (r.reason as Error).message,
            },
      );
      logger.info(
        { sandboxId, total: files.length, succeeded: downloads.filter((d) => d.success).length },
        "download-user-edited complete",
      );
      return { success: true, data: { downloads } };
    } catch (err: any) {
      logger.error({ err, sandboxId }, "download-user-edited failed");
      return reply.status(500).send({ error: err.message });
    }
  });
}
