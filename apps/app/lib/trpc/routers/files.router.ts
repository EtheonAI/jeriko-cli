import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  files,
  fileVersions,
  agentSessions,
  eq,
  desc,
  and,
  ilike,
  inArray,
  sql,
} from "@repo/database";
import { createId } from "@paralleldrive/cuid2";
import { syncFileToSearch, removeFileFromSearch } from "@repo/search";

export const filesRouter = createTRPCRouter({
  // List files for the current user (optionally filtered by session)
  list: protectedProcedure
    .input(
      z
        .object({
          sessionId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (input?.sessionId) {
        // Run ownership check + files query in parallel
        const [[session], sessionFiles] = await Promise.all([
          db
            .select()
            .from(agentSessions)
            .where(and(eq(agentSessions.id, input.sessionId), eq(agentSessions.userId, ctx.user.id)))
            .limit(1),
          db
            .select()
            .from(files)
            .where(eq(files.sessionId, input.sessionId))
            .orderBy(desc(files.createdAt)),
        ]);

        if (!session) {
          throw new Error("Session not found");
        }

        return sessionFiles;
      }

      return db
        .select()
        .from(files)
        .where(eq(files.userId, ctx.user.id))
        .orderBy(desc(files.createdAt));
    }),

  // Get a single file
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [file] = await db.select().from(files).where(eq(files.id, input.id)).limit(1);

    if (!file || file.userId !== ctx.user.id) {
      return null;
    }

    return file;
  }),

  // Create a file record (actual upload handled separately)
  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        path: z.string(),
        mimeType: z.string().optional(),
        size: z.number().optional(),
        storageKey: z.string().optional(),
        storageProvider: z.enum(["local", "s3", "r2", "vercel_blob"]).optional(),
        sessionId: z.string().optional(),
        isPublic: z.boolean().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // If sessionId provided, verify ownership
      if (input.sessionId) {
        const [session] = await db
          .select()
          .from(agentSessions)
          .where(eq(agentSessions.id, input.sessionId))
          .limit(1);

        if (!session || session.userId !== ctx.user.id) {
          throw new Error("Session not found");
        }
      }

      const id = createId();
      const [file] = await db
        .insert(files)
        .values({
          id,
          userId: ctx.user.id,
          sessionId: input.sessionId || null,
          name: input.name,
          path: input.path,
          mimeType: input.mimeType || null,
          size: input.size || null,
          storageKey: input.storageKey || null,
          storageProvider: input.storageProvider || "local",
          isPublic: input.isPublic || false,
          metadata: input.metadata,
        })
        .returning();

      // Sync to search index (non-blocking)
      syncFileToSearch(file).catch(() => {});

      return file;
    }),

  // Update a file
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        path: z.string().optional(),
        isPublic: z.boolean().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [existing] = await db.select().from(files).where(eq(files.id, id)).limit(1);

      if (!existing || existing.userId !== ctx.user.id) {
        throw new Error("File not found");
      }

      const [file] = await db.update(files).set(updates).where(eq(files.id, id)).returning();

      // Sync to search index (non-blocking)
      syncFileToSearch(file).catch(() => {});

      return file;
    }),

  // Delete a file
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db.select().from(files).where(eq(files.id, input.id)).limit(1);

      if (!existing || existing.userId !== ctx.user.id) {
        throw new Error("File not found");
      }

      // Delete the file (versions will cascade)
      await db.delete(files).where(eq(files.id, input.id));

      // Remove from search index (non-blocking)
      removeFileFromSearch(input.id).catch(() => {});

      // TODO: Delete actual file from storage

      return { success: true };
    }),

  // Bulk delete files
  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { success: true, count: 0 };

      // Verify all files belong to user
      const userFiles = await db
        .select({ id: files.id })
        .from(files)
        .where(and(inArray(files.id, input.ids), eq(files.userId, ctx.user.id)));

      const validIds = userFiles.map((f) => f.id);
      if (validIds.length === 0) return { success: true, count: 0 };

      await db.delete(files).where(inArray(files.id, validIds));

      // Remove from search index (non-blocking)
      for (const id of validIds) {
        removeFileFromSearch(id).catch(() => {});
      }

      return { success: true, count: validIds.length };
    }),

  // Create a folder
  createFolder: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        path: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = createId();
      const [folder] = await db
        .insert(files)
        .values({
          id,
          userId: ctx.user.id,
          name: input.name,
          path: input.path,
          mimeType: "application/folder",
          size: 0,
          storageProvider: "local",
        })
        .returning();

      return folder;
    }),

  // Move a file to a new path
  move: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        newPath: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db.select().from(files).where(eq(files.id, input.id)).limit(1);

      if (!existing || existing.userId !== ctx.user.id) {
        throw new Error("File not found");
      }

      const [file] = await db
        .update(files)
        .set({ path: input.newPath })
        .where(eq(files.id, input.id))
        .returning();

      return file;
    }),

  // Get a download URL (presigned S3 URL via file service)
  getDownloadUrl: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [file] = await db.select().from(files).where(eq(files.id, input.id)).limit(1);

      if (!file || file.userId !== ctx.user.id) {
        throw new Error("File not found");
      }

      const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || "http://localhost:4005";
      try {
        const res = await fetch(`${FILE_SERVICE_URL}/files/${input.id}/download`, {
          headers: { "x-user-id": ctx.user.id },
        });
        if (!res.ok) throw new Error("Failed to get download URL");
        const data = await res.json();
        return { url: data.url as string };
      } catch {
        // Fallback: return storage key directly if file service is unavailable
        return { url: file.storageKey || "" };
      }
    }),

  // Search files by name
  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!input.query.trim()) return [];
      return db
        .select()
        .from(files)
        .where(and(eq(files.userId, ctx.user.id), ilike(files.name, `%${input.query}%`)))
        .orderBy(desc(files.createdAt))
        .limit(50);
    }),

  // Get storage usage grouped by MIME category
  getStorageUsage: protectedProcedure.query(async ({ ctx }) => {
    const result = await db
      .select({
        totalSize: sql<number>`COALESCE(SUM(${files.size}), 0)`,
        totalCount: sql<number>`COUNT(*)`,
      })
      .from(files)
      .where(eq(files.userId, ctx.user.id));

    return {
      totalSize: Number(result[0]?.totalSize ?? 0),
      totalCount: Number(result[0]?.totalCount ?? 0),
    };
  }),

  // Get versions of a file
  versions: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [file] = await db.select().from(files).where(eq(files.id, input.fileId)).limit(1);

      if (!file || file.userId !== ctx.user.id) {
        throw new Error("File not found");
      }

      return db
        .select()
        .from(fileVersions)
        .where(eq(fileVersions.fileId, input.fileId))
        .orderBy(desc(fileVersions.version));
    }),

  // Create a new version
  createVersion: protectedProcedure
    .input(
      z.object({
        fileId: z.string(),
        storageKey: z.string(),
        size: z.number().optional(),
        changeDescription: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [file] = await db.select().from(files).where(eq(files.id, input.fileId)).limit(1);

      if (!file || file.userId !== ctx.user.id) {
        throw new Error("File not found");
      }

      // Get the current max version
      const [maxVersion] = await db
        .select()
        .from(fileVersions)
        .where(eq(fileVersions.fileId, input.fileId))
        .orderBy(desc(fileVersions.version))
        .limit(1);

      const newVersion = (maxVersion?.version || 0) + 1;

      const id = createId();
      const [version] = await db
        .insert(fileVersions)
        .values({
          id,
          fileId: input.fileId,
          version: newVersion,
          storageKey: input.storageKey,
          size: input.size || null,
          changeDescription: input.changeDescription || null,
        })
        .returning();

      return version;
    }),
});
