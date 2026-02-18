import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  files,
  fileVersions,
  fileShares,
  agentSessions,
  eq,
  desc,
  and,
  ilike,
  inArray,
  sql,
  isNotNull,
} from "@repo/database";
import { createId } from "@paralleldrive/cuid2";
import { syncFileToSearch, removeFileFromSearch } from "@repo/search";
import { deleteFile, deleteFiles, getPresignedUrl, getFileContentHead } from "@repo/storage";

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
      syncFileToSearch(file!).catch(() => {});

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
      syncFileToSearch(file!).catch(() => {});

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

      // Collect S3 keys to delete (main file + all versions)
      const versions = await db
        .select({ storageKey: fileVersions.storageKey })
        .from(fileVersions)
        .where(eq(fileVersions.fileId, input.id));

      const s3Keys = [
        ...(existing.storageKey ? [existing.storageKey] : []),
        ...versions.map((v) => v.storageKey),
      ];

      // Delete the file (versions will cascade)
      await db.delete(files).where(eq(files.id, input.id));

      // Remove from search index (non-blocking)
      removeFileFromSearch(input.id).catch(() => {});

      // Delete from S3 (non-blocking)
      if (s3Keys.length > 0) {
        deleteFiles(s3Keys).catch(() => {});
      }

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

      // Collect S3 keys before deleting DB records
      const filesToDelete = await db
        .select({ storageKey: files.storageKey })
        .from(files)
        .where(inArray(files.id, validIds));
      const versionKeys = await db
        .select({ storageKey: fileVersions.storageKey })
        .from(fileVersions)
        .where(inArray(fileVersions.fileId, validIds));

      const s3Keys = [
        ...filesToDelete.filter((f) => f.storageKey).map((f) => f.storageKey!),
        ...versionKeys.map((v) => v.storageKey),
      ];

      await db.delete(files).where(inArray(files.id, validIds));

      // Remove from search index (non-blocking)
      for (const id of validIds) {
        removeFileFromSearch(id).catch(() => {});
      }

      // Delete from S3 (non-blocking)
      if (s3Keys.length > 0) {
        deleteFiles(s3Keys).catch(() => {});
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

      if (!file.storageKey) {
        return { url: "" };
      }

      // If storageKey is already a URL (agent-created files), return it directly
      if (file.storageKey.startsWith("http")) {
        return { url: file.storageKey };
      }

      // storageKey is an S3 key — generate a presigned URL
      try {
        const url = await getPresignedUrl(file.storageKey, 3600);
        return { url };
      } catch {
        // Fallback: try file service
        const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || "http://localhost:4005";
        try {
          const res = await fetch(`${FILE_SERVICE_URL}/files/${input.id}/download`, {
            headers: { "x-user-id": ctx.user.id },
          });
          if (!res.ok) throw new Error("Failed to get download URL");
          const data = await res.json();
          return { url: data.url as string };
        } catch {
          return { url: file.storageKey };
        }
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

  // ============================================================================
  // Library: List files grouped by session (Manus-style)
  // ============================================================================
  listBySession: protectedProcedure
    .input(
      z
        .object({
          docType: z.number().optional(), // 0=all, 1=document, 2=pdf, 3=image, 4=video, 5=audio, 6=code, 7=other
          favoritesOnly: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      // Get all files for user that have a sessionId
      let conditions = [eq(files.userId, ctx.user.id), isNotNull(files.sessionId)];

      // Apply docType MIME filter
      if (input?.docType && input.docType > 0) {
        const mimePatterns: Record<number, string[]> = {
          1: ["text/%", "application/msword", "application/vnd.openxmlformats%", "application/rtf"],
          2: ["application/pdf"],
          3: ["image/%"],
          4: ["video/%"],
          5: ["audio/%"],
          6: ["application/javascript", "application/typescript", "application/json", "text/x-python", "text/css", "text/html"],
        };

        const patterns = mimePatterns[input.docType];
        if (patterns && patterns.length > 0) {
          const orClauses = patterns.map((p) => ilike(files.mimeType, p));
          conditions.push(sql`(${sql.join(orClauses, sql` OR `)})`);
        }
      }

      // Apply favorites filter using metadata->>'favorite' = 'true'
      if (input?.favoritesOnly) {
        conditions.push(sql`${files.metadata}->>'favorite' = 'true'`);
      }

      const allFiles = await db
        .select({
          id: files.id,
          sessionId: files.sessionId,
          userId: files.userId,
          name: files.name,
          path: files.path,
          mimeType: files.mimeType,
          size: files.size,
          storageKey: files.storageKey,
          storageProvider: files.storageProvider,
          isPublic: files.isPublic,
          metadata: files.metadata,
          createdAt: files.createdAt,
          updatedAt: files.updatedAt,
        })
        .from(files)
        .where(and(...conditions))
        .orderBy(desc(files.createdAt));

      // Get unique sessionIds
      const sessionIds = [...new Set(allFiles.filter((f) => f.sessionId).map((f) => f.sessionId!))];

      // Fetch session titles in bulk
      let sessionMap: Record<string, { title: string | null; createdAt: Date }> = {};
      if (sessionIds.length > 0) {
        const sessions = await db
          .select({
            id: agentSessions.id,
            title: agentSessions.title,
            createdAt: agentSessions.createdAt,
          })
          .from(agentSessions)
          .where(inArray(agentSessions.id, sessionIds));

        for (const s of sessions) {
          sessionMap[s.id] = { title: s.title, createdAt: s.createdAt };
        }
      }

      // Group files by session
      const groups: Array<{
        sessionId: string;
        sessionTitle: string;
        sessionCreatedAt: string;
        files: typeof allFiles;
      }> = [];

      const groupMap = new Map<string, typeof allFiles>();
      for (const f of allFiles) {
        if (!f.sessionId) continue;
        const existing = groupMap.get(f.sessionId);
        if (existing) {
          existing.push(f);
        } else {
          groupMap.set(f.sessionId, [f]);
        }
      }

      for (const [sessionId, sessionFiles] of groupMap) {
        const session = sessionMap[sessionId];
        groups.push({
          sessionId,
          sessionTitle: session?.title || "Untitled Task",
          sessionCreatedAt: session?.createdAt?.toISOString() || new Date().toISOString(),
          files: sessionFiles,
        });
      }

      // Sort groups by most recent file
      groups.sort((a, b) => {
        const aDate = a.files[0]?.createdAt?.getTime() ?? 0;
        const bDate = b.files[0]?.createdAt?.getTime() ?? 0;
        return bDate - aDate;
      });

      // ================================================================
      // Enrich files with resolvedUrl + contentPreview (Manus pattern)
      // Presigning is local crypto (~1ms each). Content fetches use S3
      // Range header (only first 3KB, no full download).
      // Concurrency capped at 10 to avoid S3 rate limits.
      // ================================================================
      const allEnrichableFiles = groups.flatMap((g) => g.files);

      const TEXT_MIME_PREFIXES = ["text/"];
      const TEXT_MIME_EXACT = ["application/json"];
      const TEXT_MIME_INCLUDES = ["javascript", "typescript", "python"];

      function isTextMime(mime: string | null): boolean {
        if (!mime) return false;
        if (TEXT_MIME_PREFIXES.some((p) => mime.startsWith(p))) return true;
        if (TEXT_MIME_EXACT.includes(mime)) return true;
        if (TEXT_MIME_INCLUDES.some((s) => mime.includes(s))) return true;
        return false;
      }

      // Process in batches of 10 to cap concurrency
      const BATCH_SIZE = 10;
      for (let i = 0; i < allEnrichableFiles.length; i += BATCH_SIZE) {
        const batch = allEnrichableFiles.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(async (file) => {
            const f = file as typeof file & { resolvedUrl?: string | null; contentPreview?: string | null };

            // Resolve URL
            if (!file.storageKey) {
              f.resolvedUrl = null;
            } else if (file.storageKey.startsWith("http")) {
              f.resolvedUrl = file.storageKey;
            } else {
              try {
                f.resolvedUrl = await getPresignedUrl(file.storageKey, 3600);
              } catch {
                f.resolvedUrl = null;
              }
            }

            // Fetch content preview for text files (first 3KB via S3 Range header)
            if (isTextMime(file.mimeType) && file.storageKey) {
              if (file.storageKey.startsWith("http")) {
                // HTTP URLs: fetch with abort after 3KB read
                try {
                  const res = await fetch(file.storageKey, { signal: AbortSignal.timeout(5000) });
                  if (res.ok && res.body) {
                    const reader = res.body.getReader();
                    const chunks: Uint8Array[] = [];
                    let totalBytes = 0;
                    while (totalBytes < 3072) {
                      const { done, value } = await reader.read();
                      if (done || !value) break;
                      chunks.push(value);
                      totalBytes += value.length;
                    }
                    reader.cancel();
                    const decoder = new TextDecoder("utf-8");
                    f.contentPreview = decoder.decode(Buffer.concat(chunks)).slice(0, 3072);
                  }
                } catch {
                  f.contentPreview = null;
                }
              } else {
                // S3 keys: direct SDK Range request (no presigned URL round-trip)
                f.contentPreview = await getFileContentHead(file.storageKey, 3072);
              }
            }
          })
        );
      }

      return groups;
    }),

  // ============================================================================
  // File content: Fetch raw content for preview
  // ============================================================================
  getContent: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [file] = await db.select().from(files).where(eq(files.id, input.id)).limit(1);

      if (!file || file.userId !== ctx.user.id) {
        throw new Error("File not found");
      }

      if (!file.storageKey) {
        return { content: null, url: null, mimeType: file.mimeType };
      }

      const isTextFile =
        file.mimeType?.startsWith("text/") ||
        file.mimeType === "application/json" ||
        file.mimeType?.includes("javascript") ||
        file.mimeType?.includes("typescript") ||
        file.mimeType?.includes("python");

      // If storageKey is a URL — fetch text content server-side (avoids CORS)
      if (file.storageKey.startsWith("http")) {
        if (isTextFile) {
          try {
            const res = await fetch(file.storageKey);
            if (res.ok) {
              const text = await res.text();
              // Cap at 2MB to avoid bloating tRPC responses
              const content = text.length > 2_000_000 ? text.slice(0, 2_000_000) : text;
              return { content, url: file.storageKey, mimeType: file.mimeType };
            }
          } catch {
            // Fetch failed — fall through to return URL only
          }
        }
        return { content: null, url: file.storageKey, mimeType: file.mimeType };
      }

      // storageKey is an S3 key — generate presigned URL + fetch text content
      try {
        const url = await getPresignedUrl(file.storageKey, 3600);

        if (isTextFile) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              const text = await res.text();
              const content = text.length > 2_000_000 ? text.slice(0, 2_000_000) : text;
              return { content, url, mimeType: file.mimeType };
            }
          } catch {
            // S3 fetch failed — return URL for client-side attempt
          }
        }

        return { content: null, url, mimeType: file.mimeType };
      } catch {
        return { content: null, url: null, mimeType: file.mimeType };
      }
    }),

  // ============================================================================
  // Share: Create a share link for a file
  // ============================================================================
  createShare: protectedProcedure
    .input(
      z.object({
        fileId: z.string(),
        accessLevel: z.enum(["viewer", "editor"]).optional(),
        expiresInDays: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [file] = await db.select().from(files).where(eq(files.id, input.fileId)).limit(1);

      if (!file || file.userId !== ctx.user.id) {
        throw new Error("File not found");
      }

      // Check for existing share
      const [existing] = await db
        .select()
        .from(fileShares)
        .where(and(eq(fileShares.fileId, input.fileId), eq(fileShares.sharedByUserId, ctx.user.id)))
        .limit(1);

      if (existing) {
        return existing;
      }

      const shareToken = createId() + createId(); // Long unique token
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      const id = createId();
      const [share] = await db
        .insert(fileShares)
        .values({
          id,
          fileId: input.fileId,
          sharedByUserId: ctx.user.id,
          shareToken,
          accessLevel: input.accessLevel || "viewer",
          expiresAt,
        })
        .returning();

      return share;
    }),

  // Get share info for a file
  getShare: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [share] = await db
        .select()
        .from(fileShares)
        .where(and(eq(fileShares.fileId, input.fileId), eq(fileShares.sharedByUserId, ctx.user.id)))
        .limit(1);

      return share || null;
    }),

  // Revoke a share
  revokeShare: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(fileShares)
        .where(
          and(eq(fileShares.fileId, input.fileId), eq(fileShares.sharedByUserId, ctx.user.id))
        );

      return { success: true };
    }),

  // Update share access level
  updateShare: protectedProcedure
    .input(
      z.object({
        fileId: z.string(),
        accessLevel: z.enum(["viewer", "editor"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [share] = await db
        .update(fileShares)
        .set({ accessLevel: input.accessLevel })
        .where(
          and(eq(fileShares.fileId, input.fileId), eq(fileShares.sharedByUserId, ctx.user.id))
        )
        .returning();

      return share;
    }),

  // ============================================================================
  // Toggle favorite (stores in metadata.favorite)
  // ============================================================================
  toggleFavorite: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [file] = await db.select().from(files).where(eq(files.id, input.id)).limit(1);

      if (!file || file.userId !== ctx.user.id) {
        throw new Error("File not found");
      }

      const currentMetadata = (file.metadata as Record<string, unknown>) || {};
      const isFavorite = currentMetadata.favorite === true;

      const updatedMetadata = { ...currentMetadata, favorite: !isFavorite };

      const [updated] = await db
        .update(files)
        .set({ metadata: updatedMetadata })
        .where(eq(files.id, input.id))
        .returning();

      return { favorite: !isFavorite, file: updated };
    }),
});
