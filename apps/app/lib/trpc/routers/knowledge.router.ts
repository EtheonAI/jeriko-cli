import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  knowledgeGroups,
  knowledgeItems,
  knowledgeChunks,
  sessionAttachments,
  eq,
  and,
  desc,
  ilike,
  or,
  isNull,
  sql,
} from "@repo/database";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";

export const knowledgeRouter = createTRPCRouter({
  // List knowledge groups
  listGroups: protectedProcedure
    .input(
      z.object({
        parentId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(knowledgeGroups.userId, ctx.user.id)];

      if (input.parentId) {
        conditions.push(eq(knowledgeGroups.parentId, input.parentId));
      } else {
        conditions.push(isNull(knowledgeGroups.parentId));
      }

      const groups = await db
        .select()
        .from(knowledgeGroups)
        .where(and(...conditions))
        .orderBy(knowledgeGroups.sortOrder, knowledgeGroups.name);

      return groups;
    }),

  // Create knowledge group
  createGroup: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        parentId: z.string().optional(),
        organizationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = createId();

      const [group] = await db
        .insert(knowledgeGroups)
        .values({
          id,
          userId: ctx.user.id,
          organizationId: input.organizationId,
          parentId: input.parentId,
          name: input.name,
          description: input.description,
          icon: input.icon,
          color: input.color,
        })
        .returning();

      return group;
    }),

  // Update knowledge group
  updateGroup: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        isExpanded: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [existing] = await db
        .select()
        .from(knowledgeGroups)
        .where(
          and(
            eq(knowledgeGroups.id, id),
            eq(knowledgeGroups.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }

      const [group] = await db
        .update(knowledgeGroups)
        .set(updates)
        .where(eq(knowledgeGroups.id, id))
        .returning();

      return group;
    }),

  // Delete knowledge group
  deleteGroup: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(knowledgeGroups)
        .where(
          and(
            eq(knowledgeGroups.id, input.id),
            eq(knowledgeGroups.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }

      await db.delete(knowledgeGroups).where(eq(knowledgeGroups.id, input.id));

      return { success: true };
    }),

  // List knowledge items
  listItems: protectedProcedure
    .input(
      z.object({
        groupId: z.string().optional(),
        type: z.enum(["document", "webpage", "file", "note", "bookmark"]).optional(),
        status: z.enum(["processing", "ready", "failed", "archived"]).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(knowledgeItems.userId, ctx.user.id)];

      if (input.groupId) {
        conditions.push(eq(knowledgeItems.groupId, input.groupId));
      }

      if (input.type) {
        conditions.push(eq(knowledgeItems.type, input.type));
      }

      if (input.status) {
        conditions.push(eq(knowledgeItems.status, input.status));
      }

      if (input.search) {
        conditions.push(
          or(
            ilike(knowledgeItems.name, `%${input.search}%`),
            ilike(knowledgeItems.description || "", `%${input.search}%`),
            ilike(knowledgeItems.content || "", `%${input.search}%`)
          )!
        );
      }

      const items = await db
        .select()
        .from(knowledgeItems)
        .where(and(...conditions))
        .orderBy(desc(knowledgeItems.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return items;
    }),

  // Get a knowledge item
  getItem: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [item] = await db
        .select()
        .from(knowledgeItems)
        .where(
          and(
            eq(knowledgeItems.id, input.id),
            eq(knowledgeItems.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      // Update last accessed
      await db
        .update(knowledgeItems)
        .set({ lastAccessedAt: new Date() })
        .where(eq(knowledgeItems.id, input.id));

      return item;
    }),

  // Create knowledge item
  createItem: protectedProcedure
    .input(
      z.object({
        type: z.enum(["document", "webpage", "file", "note", "bookmark"]),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        content: z.string().optional(),
        sourceUrl: z.string().optional(),
        sourceType: z.string().optional(),
        mimeType: z.string().optional(),
        fileSize: z.number().optional(),
        storageKey: z.string().optional(),
        groupId: z.string().optional(),
        tags: z.array(z.string()).optional(),
        organizationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = createId();

      const [item] = await db
        .insert(knowledgeItems)
        .values({
          id,
          userId: ctx.user.id,
          organizationId: input.organizationId,
          groupId: input.groupId,
          type: input.type,
          name: input.name,
          description: input.description,
          content: input.content,
          contentPreview: input.content?.slice(0, 500),
          sourceUrl: input.sourceUrl,
          sourceType: input.sourceType,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          storageKey: input.storageKey,
          tags: input.tags,
          status: input.content ? "ready" : "processing",
        })
        .returning();

      return item;
    }),

  // Update knowledge item
  updateItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        content: z.string().optional(),
        groupId: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
        status: z.enum(["processing", "ready", "failed", "archived"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [existing] = await db
        .select()
        .from(knowledgeItems)
        .where(
          and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, ctx.user.id))
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      const updateData: Record<string, unknown> = { ...updates };
      if (updates.content) {
        updateData.contentPreview = updates.content.slice(0, 500);
      }

      const [item] = await db
        .update(knowledgeItems)
        .set(updateData)
        .where(eq(knowledgeItems.id, id))
        .returning();

      return item;
    }),

  // Delete knowledge item
  deleteItem: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(knowledgeItems)
        .where(
          and(
            eq(knowledgeItems.id, input.id),
            eq(knowledgeItems.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      await db.delete(knowledgeItems).where(eq(knowledgeItems.id, input.id));

      return { success: true };
    }),

  // Get item chunks (for RAG)
  getItemChunks: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const [item] = await db
        .select()
        .from(knowledgeItems)
        .where(
          and(
            eq(knowledgeItems.id, input.itemId),
            eq(knowledgeItems.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      const chunks = await db
        .select()
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.itemId, input.itemId))
        .orderBy(knowledgeChunks.chunkIndex);

      return chunks;
    }),

  // Session attachments
  listSessionAttachments: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const attachments = await db
        .select()
        .from(sessionAttachments)
        .where(
          and(
            eq(sessionAttachments.sessionId, input.sessionId),
            eq(sessionAttachments.userId, ctx.user.id)
          )
        )
        .orderBy(desc(sessionAttachments.createdAt));

      return attachments;
    }),

  // Add session attachment
  addSessionAttachment: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        name: z.string(),
        mimeType: z.string().optional(),
        fileSize: z.number().optional(),
        storageKey: z.string().optional(),
        knowledgeItemId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = createId();

      const [attachment] = await db
        .insert(sessionAttachments)
        .values({
          id,
          sessionId: input.sessionId,
          userId: ctx.user.id,
          name: input.name,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          storageKey: input.storageKey,
          knowledgeItemId: input.knowledgeItemId,
          status: input.storageKey ? "ready" : "uploading",
        })
        .returning();

      return attachment;
    }),

  // Remove session attachment
  removeSessionAttachment: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(sessionAttachments)
        .where(
          and(
            eq(sessionAttachments.id, input.id),
            eq(sessionAttachments.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Attachment not found",
        });
      }

      await db
        .delete(sessionAttachments)
        .where(eq(sessionAttachments.id, input.id));

      return { success: true };
    }),

  // Search across all knowledge
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        types: z
          .array(z.enum(["document", "webpage", "file", "note", "bookmark"]))
          .optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(knowledgeItems.userId, ctx.user.id),
        eq(knowledgeItems.status, "ready"),
        or(
          ilike(knowledgeItems.name, `%${input.query}%`),
          ilike(knowledgeItems.description || "", `%${input.query}%`),
          ilike(knowledgeItems.content || "", `%${input.query}%`)
        )!,
      ];

      if (input.types && input.types.length > 0) {
        conditions.push(
          sql`${knowledgeItems.type} IN (${sql.join(input.types.map((t) => sql`${t}`), sql`, `)})`
        );
      }

      const results = await db
        .select({
          id: knowledgeItems.id,
          type: knowledgeItems.type,
          name: knowledgeItems.name,
          description: knowledgeItems.description,
          contentPreview: knowledgeItems.contentPreview,
          sourceUrl: knowledgeItems.sourceUrl,
          createdAt: knowledgeItems.createdAt,
        })
        .from(knowledgeItems)
        .where(and(...conditions))
        .orderBy(desc(knowledgeItems.lastAccessedAt))
        .limit(input.limit);

      return results;
    }),
});
