import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { createLogger, getEnv } from "@repo/service-utils";

const logger = createLogger({ service: "file" });

async function main() {
  const port = parseInt(getEnv("PORT", "4005"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Register multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
      files: 10,
    },
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", service: "file" };
  });

  // Upload file
  app.post("/upload", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "No file provided" });
    }

    // TODO: Upload to S3 and save to database
    const fileId = crypto.randomUUID();

    return {
      id: fileId,
      filename: data.filename,
      mimetype: data.mimetype,
      size: 0, // Would be actual size after processing
    };
  });

  // Get file metadata
  app.get("/files/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Fetch from database
    return { id, status: "not_implemented" };
  });

  // Get presigned download URL
  app.get("/files/:id/download", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Generate presigned S3 URL
    return { id, url: "", expiresIn: 3600 };
  });

  // Delete file
  app.delete("/files/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Delete from S3 and database
    return { deleted: true };
  });

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
    }, "Incoming request");
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info({
      requestId: request.id,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, "Request completed");
  });

  try {
    await app.listen({ port, host });
    logger.info({ port, host }, "File service started");
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, "Received shutdown signal");
      await app.close();
      process.exit(0);
    });
  }
}

main();
