import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  knowledgeGroups,
  knowledgeItems,
  eq,
  desc,
  count,
  and,
} from "@repo/database";
import { createId } from "@paralleldrive/cuid2";

export const knowledgeRouter = createTRPCRouter({
  // List all groups for the current user
  listGroups: protectedProcedure.query(async ({ ctx }) => {
    const groups = await db
      .select()
      .from(knowledgeGroups)
      .where(eq(knowledgeGroups.userId, ctx.user.id))
      .orderBy(knowledgeGroups.sortOrder);

    return groups;
  }),

  // Create a knowledge group
  createGroup: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        parentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [group] = await db
        .insert(knowledgeGroups)
        .values({
          id: createId(),
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          parentId: input.parentId,
        })
        .returning();

      return group!;
    }),

  // Update a group
  updateGroup: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(1000).optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const [updated] = await db
        .update(knowledgeGroups)
        .set(updates)
        .where(
          and(eq(knowledgeGroups.id, id), eq(knowledgeGroups.userId, ctx.user.id))
        )
        .returning();

      return updated ?? null;
    }),

  // Delete a group
  deleteGroup: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(knowledgeGroups)
        .where(
          and(
            eq(knowledgeGroups.id, input.id),
            eq(knowledgeGroups.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  // List items (optionally filtered by group)
  listItems: protectedProcedure
    .input(
      z
        .object({
          groupId: z.string().optional(),
          status: z.enum(["processing", "ready", "failed", "archived"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(knowledgeItems.userId, ctx.user.id)];

      if (input?.groupId) {
        conditions.push(eq(knowledgeItems.groupId, input.groupId));
      }
      if (input?.status) {
        conditions.push(eq(knowledgeItems.status, input.status));
      }

      const items = await db
        .select()
        .from(knowledgeItems)
        .where(and(...conditions))
        .orderBy(desc(knowledgeItems.createdAt))
        .limit(100);

      return items;
    }),

  // Get a single item
  getItem: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [item] = await db
        .select()
        .from(knowledgeItems)
        .where(
          and(eq(knowledgeItems.id, input.id), eq(knowledgeItems.userId, ctx.user.id))
        )
        .limit(1);

      return item ?? null;
    }),

  // Create item (text note)
  createItem: protectedProcedure
    .input(
      z.object({
        groupId: z.string().optional(),
        type: z.enum(["document", "webpage", "file", "note", "bookmark"]),
        name: z.string().min(1).max(500),
        description: z.string().max(2000).optional(),
        content: z.string().optional(),
        sourceUrl: z.string().url().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [item] = await db
        .insert(knowledgeItems)
        .values({
          id: createId(),
          userId: ctx.user.id,
          groupId: input.groupId,
          type: input.type,
          name: input.name,
          description: input.description,
          content: input.content,
          contentPreview: input.content?.slice(0, 500),
          sourceUrl: input.sourceUrl,
          tags: input.tags ?? [],
          status: "processing",
        })
        .returning();

      return item!;
    }),

  // Update item
  updateItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(500).optional(),
        description: z.string().max(2000).optional(),
        groupId: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const [updated] = await db
        .update(knowledgeItems)
        .set(updates)
        .where(
          and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, ctx.user.id))
        )
        .returning();

      return updated ?? null;
    }),

  // Delete item
  deleteItem: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(knowledgeItems)
        .where(
          and(
            eq(knowledgeItems.id, input.id),
            eq(knowledgeItems.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  // Get stats (total items, groups, by status)
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [itemCount] = await db
      .select({ count: count() })
      .from(knowledgeItems)
      .where(eq(knowledgeItems.userId, ctx.user.id));

    const [groupCount] = await db
      .select({ count: count() })
      .from(knowledgeGroups)
      .where(eq(knowledgeGroups.userId, ctx.user.id));

    return {
      totalItems: itemCount?.count ?? 0,
      totalGroups: groupCount?.count ?? 0,
    };
  }),
});
