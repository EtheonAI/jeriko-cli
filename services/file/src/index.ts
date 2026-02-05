import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { createLogger, getEnv, createId } from "@repo/service-utils";
import { db, files, fileVersions, eq, and, desc, asc, sql } from "@repo/database/service-index";
import {
  uploadFile,
  getPresignedUrl,
  deleteFile,
  deleteFiles,
  getStorageKey,
  getVersionStorageKey,
} from "@repo/storage";

const logger = createLogger({ service: "file" });

async function main() {
  const port = parseInt(getEnv("PORT", "4005"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

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

  // POST /upload - Single file upload
  app.post("/upload", async (request, reply) => {
    const userId = request.headers["x-user-id"] as string | undefined;
    if (!userId) {
      return reply.status(401).send({ error: "Missing x-user-id header" });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "No file provided" });
    }

    try {
      const sessionId = request.headers["x-session-id"] as string | undefined;

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const fileId = createId();
      const storageKey = getStorageKey(userId, fileId, data.filename);

      await uploadFile(storageKey, buffer, data.mimetype);

      const [file] = await db
        .insert(files)
        .values({
          id: fileId,
          userId,
          sessionId: sessionId || null,
          name: data.filename,
          path: `/${data.filename}`,
          mimeType: data.mimetype,
          size: buffer.length,
          storageKey,
          storageProvider: "s3",
        })
        .returning();

      // Create initial version
      await db.insert(fileVersions).values({
        id: createId(),
        fileId,
        version: 1,
        storageKey,
        size: buffer.length,
        changeDescription: "Initial upload",
      });

      return {
        id: file!.id,
        name: file!.name,
        mimeType: file!.mimeType,
        size: file!.size,
        storageProvider: file!.storageProvider,
        createdAt: file!.createdAt,
      };
    } catch (error) {
      logger.error(error, "Failed to upload file");
      return reply.status(500).send({ error: "Failed to upload file" });
    }
  });

  // POST /upload/bulk - Multi-file upload
  app.post("/upload/bulk", async (request, reply) => {
    const userId = request.headers["x-user-id"] as string | undefined;
    if (!userId) {
      return reply.status(401).send({ error: "Missing x-user-id header" });
    }

    const sessionId = request.headers["x-session-id"] as string | undefined;
    const results: Array<{
      id: string;
      name: string;
      mimeType: string | null;
      size: number | null;
    }> = [];
    const errors: Array<{ filename: string; error: string }> = [];

    try {
      const parts = request.files();
      for await (const data of parts) {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of data.file) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);

          const fileId = createId();
          const storageKey = getStorageKey(userId, fileId, data.filename);

          await uploadFile(storageKey, buffer, data.mimetype);

          const [file] = await db
            .insert(files)
            .values({
              id: fileId,
              userId,
              sessionId: sessionId || null,
              name: data.filename,
              path: `/${data.filename}`,
              mimeType: data.mimetype,
              size: buffer.length,
              storageKey,
              storageProvider: "s3",
            })
            .returning();

          await db.insert(fileVersions).values({
            id: createId(),
            fileId,
            version: 1,
            storageKey,
            size: buffer.length,
            changeDescription: "Initial upload",
          });

          results.push({
            id: file!.id,
            name: file!.name,
            mimeType: file!.mimeType,
            size: file!.size,
          });
        } catch (err) {
          logger.error(err, `Failed to upload file: ${data.filename}`);
          errors.push({ filename: data.filename, error: "Upload failed" });
        }
      }

      return { files: results, errors };
    } catch (error) {
      logger.error(error, "Failed to process bulk upload");
      return reply.status(500).send({ error: "Failed to process bulk upload" });
    }
  });

  // GET /files/:id - File metadata + versions
  app.get("/files/:id", async (request, reply) => {
    const userId = request.headers["x-user-id"] as string | undefined;
    if (!userId) {
      return reply.status(401).send({ error: "Missing x-user-id header" });
    }

    const { id } = request.params as { id: string };

    try {
      const [file] = await db
        .select()
        .from(files)
        .where(and(eq(files.id, id), eq(files.userId, userId)))
        .limit(1);

      if (!file) {
        return reply.status(404).send({ error: "File not found" });
      }

      const versions = await db
        .select()
        .from(fileVersions)
        .where(eq(fileVersions.fileId, id))
        .orderBy(desc(fileVersions.version));

      return { ...file, versions };
    } catch (error) {
      logger.error(error, "Failed to fetch file");
      return reply.status(500).send({ error: "Failed to fetch file" });
    }
  });

  // GET /files/:id/download - Presigned download URL
  app.get("/files/:id/download", async (request, reply) => {
    const userId = request.headers["x-user-id"] as string | undefined;
    if (!userId) {
      return reply.status(401).send({ error: "Missing x-user-id header" });
    }

    const { id } = request.params as { id: string };
    const { version } = request.query as { version?: string };

    try {
      const [file] = await db
        .select()
        .from(files)
        .where(and(eq(files.id, id), eq(files.userId, userId)))
        .limit(1);

      if (!file) {
        return reply.status(404).send({ error: "File not found" });
      }

      let key = file.storageKey;

      // If a specific version is requested, resolve its storageKey
      if (version) {
        const [ver] = await db
          .select()
          .from(fileVersions)
          .where(and(eq(fileVersions.fileId, id), eq(fileVersions.version, parseInt(version, 10))))
          .limit(1);

        if (!ver) {
          return reply.status(404).send({ error: "Version not found" });
        }
        key = ver.storageKey;
      }

      if (!key) {
        return reply.status(404).send({ error: "File has no storage key" });
      }

      const expiresIn = 3600;
      const url = await getPresignedUrl(key, expiresIn);

      return { id: file.id, url, expiresIn };
    } catch (error) {
      logger.error(error, "Failed to generate download URL");
      return reply.status(500).send({ error: "Failed to generate download URL" });
    }
  });

  // PUT /files/:id - Upload new version
  app.put("/files/:id", async (request, reply) => {
    const userId = request.headers["x-user-id"] as string | undefined;
    if (!userId) {
      return reply.status(401).send({ error: "Missing x-user-id header" });
    }

    const { id } = request.params as { id: string };

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "No file provided" });
    }

    try {
      const [file] = await db
        .select()
        .from(files)
        .where(and(eq(files.id, id), eq(files.userId, userId)))
        .limit(1);

      if (!file) {
        return reply.status(404).send({ error: "File not found" });
      }

      // Get the latest version number
      const [latest] = await db
        .select({ maxVersion: sql<number>`coalesce(max(${fileVersions.version}), 0)` })
        .from(fileVersions)
        .where(eq(fileVersions.fileId, id));

      const nextVersion = (latest?.maxVersion ?? 0) + 1;

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const storageKey = getVersionStorageKey(userId, id, nextVersion, data.filename);

      await uploadFile(storageKey, buffer, data.mimetype);

      await db.insert(fileVersions).values({
        id: createId(),
        fileId: id,
        version: nextVersion,
        storageKey,
        size: buffer.length,
        changeDescription: (request.headers["x-change-description"] as string) || null,
      });

      // Update the main file record to point to the latest version
      const [updated] = await db
        .update(files)
        .set({
          storageKey,
          size: buffer.length,
          mimeType: data.mimetype,
          name: data.filename,
        })
        .where(eq(files.id, id))
        .returning();

      return {
        id: updated!.id,
        name: updated!.name,
        version: nextVersion,
        size: updated!.size,
        storageKey: updated!.storageKey,
      };
    } catch (error) {
      logger.error(error, "Failed to upload new version");
      return reply.status(500).send({ error: "Failed to upload new version" });
    }
  });

  // DELETE /files/:id - S3 + DB cleanup
  app.delete("/files/:id", async (request, reply) => {
    const userId = request.headers["x-user-id"] as string | undefined;
    if (!userId) {
      return reply.status(401).send({ error: "Missing x-user-id header" });
    }

    const { id } = request.params as { id: string };

    try {
      const [file] = await db
        .select()
        .from(files)
        .where(and(eq(files.id, id), eq(files.userId, userId)))
        .limit(1);

      if (!file) {
        return reply.status(404).send({ error: "File not found" });
      }

      // Collect all storage keys (main file + all versions)
      const versions = await db
        .select({ storageKey: fileVersions.storageKey })
        .from(fileVersions)
        .where(eq(fileVersions.fileId, id));

      const keysToDelete = versions.map((v) => v.storageKey).filter(Boolean);

      // Include the main file's storageKey if it differs
      if (file.storageKey && !keysToDelete.includes(file.storageKey)) {
        keysToDelete.push(file.storageKey);
      }

      // Delete from S3
      if (keysToDelete.length > 0) {
        await deleteFiles(keysToDelete);
      }

      // Delete from DB (cascade handles fileVersions)
      await db.delete(files).where(eq(files.id, id));

      return { deleted: true };
    } catch (error) {
      logger.error(error, "Failed to delete file");
      return reply.status(500).send({ error: "Failed to delete file" });
    }
  });

  // GET /users/:userId/files - List user files
  app.get("/users/:userId/files", async (request, reply) => {
    const authUserId = request.headers["x-user-id"] as string | undefined;
    if (!authUserId) {
      return reply.status(401).send({ error: "Missing x-user-id header" });
    }

    const { userId } = request.params as { userId: string };
    if (authUserId !== userId) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const {
      sessionId,
      mimeType,
      cursor,
      limit: limitStr,
    } = request.query as {
      sessionId?: string;
      mimeType?: string;
      cursor?: string;
      limit?: string;
    };

    const limit = Math.min(parseInt(limitStr || "50", 10), 100);

    try {
      const conditions = [eq(files.userId, userId)];

      if (sessionId) {
        conditions.push(eq(files.sessionId, sessionId));
      }
      if (mimeType) {
        conditions.push(eq(files.mimeType, mimeType));
      }
      if (cursor) {
        conditions.push(sql`${files.createdAt} < ${cursor}`);
      }

      const result = await db
        .select()
        .from(files)
        .where(and(...conditions))
        .orderBy(desc(files.createdAt))
        .limit(limit + 1);

      const hasMore = result.length > limit;
      const fileList = hasMore ? result.slice(0, limit) : result;
      const nextCursor = hasMore ? fileList[fileList.length - 1]!.createdAt.toISOString() : null;

      return { files: fileList, nextCursor };
    } catch (error) {
      logger.error(error, "Failed to list user files");
      return reply.status(500).send({ error: "Failed to list files" });
    }
  });

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      "Incoming request"
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info(
      {
        requestId: request.id,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "Request completed"
    );
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
