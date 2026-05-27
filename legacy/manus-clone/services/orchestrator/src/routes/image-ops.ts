import type { FastifyInstance } from "fastify";
import { createLogger } from "@repo/service-utils";

const logger = createLogger({ service: "image-ops" });
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

export async function imageOpsRoutes(fastify: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // POST /api/image/rmbg — Remove image background using rembg
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: {
      sandboxId: string;
      userId: string;
      imagePath: string;
      outputPath?: string;
      uploadToS3?: boolean;
    };
  }>("/api/image/rmbg", async (request, reply) => {
    const { sandboxId, userId, imagePath, outputPath, uploadToS3 } =
      request.body;
    if (!sandboxId || !userId || !imagePath) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and imagePath are required" });
    }

    // Derive output path: replace extension with _nobg.png or use provided
    const resolvedOutput =
      outputPath || imagePath.replace(/\.[^.]+$/, "_nobg.png");

    try {
      // First check if rembg is available
      const checkResult = await sandboxExec(
        sandboxId,
        "python3 -c \"import rembg; print('ok')\"",
        userId,
        15000,
      );

      if (checkResult.exitCode !== 0) {
        // Try to install rembg
        logger.info({ sandboxId }, "rembg not found, attempting install");
        const installResult = await sandboxExec(
          sandboxId,
          "pip install rembg[cli] onnxruntime 2>&1",
          userId,
          120000, // 2 min for install
        );
        if (installResult.exitCode !== 0) {
          return reply.status(422).send({
            success: false,
            error:
              "rembg is not installed and auto-install failed. " +
              "Install manually with: pip install rembg[cli] onnxruntime",
            detail: installResult.stderr || installResult.stdout,
          });
        }
      }

      // Run background removal via Python script for reliability
      const pyScript = [
        "from rembg import remove",
        "from pathlib import Path",
        `inp = Path(${JSON.stringify(imagePath)})`,
        `out = Path(${JSON.stringify(resolvedOutput)})`,
        "out.parent.mkdir(parents=True, exist_ok=True)",
        "out.write_bytes(remove(inp.read_bytes()))",
        "print(str(out))",
      ].join("; ");

      const { stdout, stderr, exitCode } = await sandboxExec(
        sandboxId,
        `python3 -c "${pyScript}"`,
        userId,
        120000, // rembg can be slow on first run (model download)
      );

      if (exitCode !== 0) {
        throw new Error(`rembg failed: ${stderr || stdout}`);
      }

      const result: {
        imagePath: string;
        outputPath: string;
        cdnUrl?: string;
      } = {
        imagePath,
        outputPath: resolvedOutput,
      };

      // Optionally upload result to S3
      if (uploadToS3) {
        const uploadResult = await sandboxExec(
          sandboxId,
          `jeriko-upload-file ${JSON.stringify(resolvedOutput)}`,
          userId,
          60000,
        );
        if (uploadResult.exitCode === 0) {
          result.cdnUrl =
            uploadResult.stdout.trim().split("\n").pop()?.trim() || "";
        } else {
          logger.warn(
            { sandboxId, stderr: uploadResult.stderr },
            "S3 upload after rmbg failed",
          );
        }
      }

      logger.info({ sandboxId, imagePath, outputPath: resolvedOutput }, "rmbg success");
      return { success: true, data: result };
    } catch (err: any) {
      logger.error({ err, sandboxId, imagePath }, "image/rmbg failed");
      return reply.status(500).send({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/image/search-upload — Upload image for reverse image search
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: { sandboxId: string; userId: string; imagePath: string };
  }>("/api/image/search-upload", async (request, reply) => {
    const { sandboxId, userId, imagePath } = request.body;
    if (!sandboxId || !userId || !imagePath) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and imagePath are required" });
    }

    try {
      // Verify the file exists first
      const { exitCode: existsCode } = await sandboxExec(
        sandboxId,
        `test -f ${JSON.stringify(imagePath)} && echo "exists"`,
        userId,
      );
      if (existsCode !== 0) {
        return reply
          .status(404)
          .send({ error: `Image not found: ${imagePath}` });
      }

      // Upload to S3 via jeriko-upload-file
      const { stdout, stderr, exitCode } = await sandboxExec(
        sandboxId,
        `jeriko-upload-file ${JSON.stringify(imagePath)}`,
        userId,
        60000,
      );
      if (exitCode !== 0) {
        throw new Error(`Upload failed: ${stderr || stdout}`);
      }

      const cdnUrl = stdout.trim().split("\n").pop()?.trim() || "";
      if (!cdnUrl) {
        throw new Error("Upload succeeded but no CDN URL returned");
      }

      logger.info({ sandboxId, imagePath, cdnUrl }, "search-upload success");
      return {
        success: true,
        data: {
          imagePath,
          cdnUrl,
          searchUrl: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(cdnUrl)}`,
        },
      };
    } catch (err: any) {
      logger.error({ err, sandboxId, imagePath }, "image/search-upload failed");
      return reply.status(500).send({ error: err.message });
    }
  });
}
