import multipart from "@fastify/multipart";
import { createService, typedRoute, createId, dispatchWebhookEvent } from "@repo/service-utils";
import { NotFoundError, ValidationError, AuthenticationError, AuthorizationError } from "@repo/service-utils/errors";
import { sanitizePath } from "@repo/service-utils/security";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";

// ─── Zod schemas ────────────────────────────────────────────────────────────

const IdParams = z.object({
  id: z.string().min(1, "File ID is required"),
});

const UserIdParams = z.object({
  userId: z.string().min(1, "User ID is required"),
});

const DownloadQuery = z.object({
  version: z.string().optional(),
});

const ListFilesQuery = z.object({
  sessionId: z.string().optional(),
  mimeType: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Dynamic imports to avoid ESM namespace destructuring issues with tsx
  const rawDatabase = await import("@repo/database/service-index");
  const database = (rawDatabase as any).default ?? rawDatabase;
  const { db, files, fileVersions } = database;
  const rawStorage = await import("@repo/storage");
  const storageModule = (rawStorage as any).default ?? rawStorage;
  const {
    uploadFile,
    getPresignedUrl,
    deleteFiles,
    getStorageKey,
    getVersionStorageKey,
    calculateChecksum,
    verifyChecksum,
  } = storageModule;

  const { app, logger, start } = await createService({
    name: "file",
    port: parseInt(process.env.PORT || "4005", 10),
  });

  // Register multipart plugin for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
      files: 10,
    },
  });

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Extract & validate the x-user-id header. Throws if missing. */
  function requireUserId(request: { headers: Record<string, string | string[] | undefined> }): string {
    const userId = request.headers["x-user-id"] as string | undefined;
    if (!userId) {
      throw new AuthenticationError("Missing x-user-id header");
    }
    return userId;
  }

  /** Read the x-path header, sanitize it, and return a safe path. */
  function getSafePath(request: { headers: Record<string, string | string[] | undefined> }): string {
    const raw = (request.headers["x-path"] as string) || "/";
    return sanitizePath(raw);
  }

  // ── POST /upload — Single file upload ──────────────────────────────────

  app.post("/upload", typedRoute({}, async (request, reply) => {
    const userId = requireUserId(request);
    const data = await request.file();
    if (!data) {
      throw new ValidationError("No file provided");
    }

    const sessionId = request.headers["x-session-id"] as string | undefined;
    const expectedChecksum = request.headers["x-checksum"] as string | undefined;
    const toolCallId = request.headers["x-tool-call-id"] as string | undefined;

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Calculate checksum
    const checksum = calculateChecksum(buffer);

    // Verify checksum if provided
    if (expectedChecksum && !verifyChecksum(buffer, expectedChecksum)) {
      throw new ValidationError(`Checksum mismatch: expected ${expectedChecksum}, got ${checksum}`);
    }

    const fileId = createId();
    const storageKey = getStorageKey(userId, fileId, data.filename);

    await uploadFile(storageKey, buffer, data.mimetype);

    // Insert file record and initial version in a single transaction
    const file = await db.transaction(async (tx) => {
      const [f] = await tx
        .insert(files)
        .values({
          id: fileId,
          userId,
          sessionId: sessionId || null,
          name: data.filename,
          path: getSafePath(request),
          mimeType: data.mimetype,
          size: buffer.length,
          storageKey,
          storageProvider: "s3",
          checksum,
          checksumAlgorithm: "sha256",
          metadata: toolCallId ? { toolCallId } : null,
        })
        .returning();

      // Create initial version
      await tx.insert(fileVersions).values({
        id: createId(),
        fileId,
        version: 1,
        storageKey,
        size: buffer.length,
        checksum,
        checksumAlgorithm: "sha256",
        changeDescription: "Initial upload",
      });

      return f;
    });

    dispatchWebhookEvent({
      eventType: "file.uploaded",
      resourceType: "file",
      resourceId: file!.id,
      payload: { id: file!.id, name: file!.name, mimeType: file!.mimeType, size: file!.size },
      userId,
    });

    return reply.success({
      id: file!.id,
      name: file!.name,
      mimeType: file!.mimeType,
      size: file!.size,
      storageProvider: file!.storageProvider,
      createdAt: file!.createdAt,
    });
  }));

  // ── POST /upload/bulk — Multi-file upload ──────────────────────────────

  app.post("/upload/bulk", typedRoute({}, async (request, reply) => {
    const userId = requireUserId(request);
    const sessionId = request.headers["x-session-id"] as string | undefined;
    const toolCallId = request.headers["x-tool-call-id"] as string | undefined;

    const results: Array<{
      id: string;
      name: string;
      mimeType: string | null;
      size: number | null;
    }> = [];
    const errors: Array<{ filename: string; error: string }> = [];

    const parts = request.files();
    for await (const data of parts) {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of data.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Calculate checksum for each file
        const checksum = calculateChecksum(buffer);

        const fileId = createId();
        const storageKey = getStorageKey(userId, fileId, data.filename);

        await uploadFile(storageKey, buffer, data.mimetype);

        // Insert file record and initial version in a single transaction
        const file = await db.transaction(async (tx) => {
          const [f] = await tx
            .insert(files)
            .values({
              id: fileId,
              userId,
              sessionId: sessionId || null,
              name: data.filename,
              path: getSafePath(request),
              mimeType: data.mimetype,
              size: buffer.length,
              storageKey,
              storageProvider: "s3",
              checksum,
              checksumAlgorithm: "sha256",
              metadata: toolCallId ? { toolCallId } : null,
            })
            .returning();

          await tx.insert(fileVersions).values({
            id: createId(),
            fileId,
            version: 1,
            storageKey,
            size: buffer.length,
            checksum,
            checksumAlgorithm: "sha256",
            changeDescription: "Initial upload",
          });

          return f;
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

    return reply.success({ files: results, errors });
  }));

  // ── GET /files/:id — File metadata + versions ─────────────────────────

  app.get("/files/:id", typedRoute({ params: IdParams }, async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params;

    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.userId, userId)))
      .limit(1);

    if (!file) {
      throw new NotFoundError("File");
    }

    const versions = await db
      .select()
      .from(fileVersions)
      .where(eq(fileVersions.fileId, id))
      .orderBy(desc(fileVersions.version));

    return reply.success({ ...file, versions });
  }));

  // ── GET /files/:id/download — Presigned download URL ───────────────────

  app.get("/files/:id/download", typedRoute({ params: IdParams, query: DownloadQuery }, async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params;
    const { version } = request.query;

    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.userId, userId)))
      .limit(1);

    if (!file) {
      throw new NotFoundError("File");
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
        throw new NotFoundError("Version");
      }
      key = ver.storageKey;
    }

    if (!key) {
      throw new NotFoundError("File storage key");
    }

    const expiresIn = 3600;
    const url = await getPresignedUrl(key, expiresIn, file.isPublic || false);

    return reply.success({ id: file.id, url, expiresIn, cdnUrl: file.isPublic ? url : null });
  }));

  // ── PUT /files/:id — Upload new version ────────────────────────────────

  app.put("/files/:id", typedRoute({ params: IdParams }, async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params;

    const data = await request.file();
    if (!data) {
      throw new ValidationError("No file provided");
    }

    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.userId, userId)))
      .limit(1);

    if (!file) {
      throw new NotFoundError("File");
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

    // Calculate checksum for new version
    const checksum = calculateChecksum(buffer);

    const storageKey = getVersionStorageKey(userId, id, nextVersion, data.filename);

    await uploadFile(storageKey, buffer, data.mimetype);

    // Insert new version and update file record in a single transaction
    const updated = await db.transaction(async (tx) => {
      await tx.insert(fileVersions).values({
        id: createId(),
        fileId: id,
        version: nextVersion,
        storageKey,
        size: buffer.length,
        checksum,
        checksumAlgorithm: "sha256",
        changeDescription: (request.headers["x-change-description"] as string) || null,
      });

      // Update the main file record to point to the latest version
      const [u] = await tx
        .update(files)
        .set({
          storageKey,
          size: buffer.length,
          mimeType: data.mimetype,
          name: data.filename,
          checksum,
          checksumAlgorithm: "sha256",
        })
        .where(eq(files.id, id))
        .returning();

      return u;
    });

    return reply.success({
      id: updated!.id,
      name: updated!.name,
      version: nextVersion,
      size: updated!.size,
      storageKey: updated!.storageKey,
    });
  }));

  // ── DELETE /files/:id — S3 + DB cleanup ────────────────────────────────

  app.delete("/files/:id", typedRoute({ params: IdParams }, async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params;

    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.userId, userId)))
      .limit(1);

    if (!file) {
      throw new NotFoundError("File");
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

    // Delete from DB first (cascade handles fileVersions), then clean up S3
    await db.delete(files).where(eq(files.id, id));

    // Delete from S3 after DB commit — if this fails, orphaned S3 objects can be cleaned up later
    if (keysToDelete.length > 0) {
      await deleteFiles(keysToDelete);
    }

    return reply.success({ deleted: true });
  }));

  // ── GET /users/:userId/files — List user files ─────────────────────────

  app.get("/users/:userId/files", typedRoute({ params: UserIdParams, query: ListFilesQuery }, async (request, reply) => {
    const authUserId = requireUserId(request);
    const { userId } = request.params;

    if (authUserId !== userId) {
      throw new AuthorizationError("Forbidden");
    }

    const { sessionId, mimeType, cursor, limit } = request.query;

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

    return reply.success({ files: fileList, nextCursor });
  }));

  // ── Start the service ──────────────────────────────────────────────────

  await start();
}

main();
