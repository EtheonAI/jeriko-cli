import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  projects,
  projectMembers,
  projectSessions,
  projectGroups,
  projectGroupItems,
  eq,
  and,
  desc,
  or,
  ilike,
  sql,
} from "@repo/database";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";
import { syncProjectToSearch, removeProjectFromSearch } from "@repo/search";

export const projectsRouter = createTRPCRouter({
  // List projects
  list: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["active", "archived", "completed", "paused"])
          .optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        includeShared: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build conditions for owned projects
      const ownedConditions = [eq(projects.userId, ctx.user.id)];

      if (input.status) {
        ownedConditions.push(eq(projects.status, input.status));
      }

      if (input.search) {
        ownedConditions.push(
          or(
            ilike(projects.name, `%${input.search}%`),
            ilike(projects.description || "", `%${input.search}%`)
          )!
        );
      }

      const ownedProjects = await db
        .select()
        .from(projects)
        .where(and(...ownedConditions))
        .orderBy(desc(projects.isPinned), desc(projects.lastActivityAt))
        .limit(input.limit)
        .offset(input.offset);

      // If including shared projects, get those too
      if (input.includeShared) {
        const sharedProjectIds = await db
          .select({ projectId: projectMembers.projectId })
          .from(projectMembers)
          .where(eq(projectMembers.userId, ctx.user.id));

        if (sharedProjectIds.length > 0) {
          const ids = sharedProjectIds.map((p) => p.projectId);
          // Filter out owned projects from shared
          const filteredIds = ids.filter(
            (id) => !ownedProjects.some((p) => p.id === id)
          );

          if (filteredIds.length > 0) {
            const sharedProjects = await db
              .select()
              .from(projects)
              .where(
                and(
                  sql`${projects.id} IN (${sql.join(filteredIds.map((id) => sql`${id}`), sql`, `)})`,
                  input.status ? eq(projects.status, input.status) : sql`true`
                )
              )
              .limit(input.limit);

            return [...ownedProjects, ...sharedProjects];
          }
        }
      }

      return ownedProjects;
    }),

  // Get a single project
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.id))
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      // Check access
      if (project.userId !== ctx.user.id) {
        const [membership] = await db
          .select()
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, input.id),
              eq(projectMembers.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (!membership && project.visibility === "private") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }
      }

      return project;
    }),

  // Create a project
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        visibility: z.enum(["private", "team", "public"]).default("private"),
        settings: z.record(z.unknown()).optional(),
        tags: z.array(z.string()).optional(),
        organizationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = createId();

      const [project] = await db
        .insert(projects)
        .values({
          id,
          userId: ctx.user.id,
          organizationId: input.organizationId,
          name: input.name,
          description: input.description,
          icon: input.icon,
          color: input.color,
          visibility: input.visibility,
          settings: input.settings,
          tags: input.tags,
          status: "active",
          lastActivityAt: new Date(),
        })
        .returning();

      // Sync to search index (non-blocking)
      syncProjectToSearch(project).catch(() => {});

      return project;
    }),

  // Update a project
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        status: z.enum(["active", "archived", "completed", "paused"]).optional(),
        visibility: z.enum(["private", "team", "public"]).optional(),
        isPinned: z.boolean().optional(),
        settings: z.record(z.unknown()).optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Verify ownership or admin access
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      if (project.userId !== ctx.user.id) {
        const [membership] = await db
          .select()
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, id),
              eq(projectMembers.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (!membership || !["owner", "admin"].includes(membership.role)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to update this project",
          });
        }
      }

      const [updated] = await db
        .update(projects)
        .set({ ...updates, lastActivityAt: new Date() })
        .where(eq(projects.id, id))
        .returning();

      // Sync to search index (non-blocking)
      syncProjectToSearch(updated).catch(() => {});

      return updated;
    }),

  // Delete a project
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.id))
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      if (project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the owner can delete a project",
        });
      }

      await db.delete(projects).where(eq(projects.id, input.id));

      // Remove from search index (non-blocking)
      removeProjectFromSearch(input.id).catch(() => {});

      return { success: true };
    }),

  // Add member to project
  addMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string(),
        role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership or admin access
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      if (project.userId !== ctx.user.id) {
        const [membership] = await db
          .select()
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, input.projectId),
              eq(projectMembers.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (!membership || !["owner", "admin"].includes(membership.role)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to add members",
          });
        }
      }

      // Check if already a member
      const [existing] = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, input.projectId),
            eq(projectMembers.userId, input.userId)
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member",
        });
      }

      const id = createId();
      const [member] = await db
        .insert(projectMembers)
        .values({
          id,
          projectId: input.projectId,
          userId: input.userId,
          role: input.role,
        })
        .returning();

      return member;
    }),

  // Remove member from project
  removeMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership or admin access
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      if (project.userId !== ctx.user.id) {
        const [membership] = await db
          .select()
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, input.projectId),
              eq(projectMembers.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (!membership || !["owner", "admin"].includes(membership.role)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to remove members",
          });
        }
      }

      await db
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, input.projectId),
            eq(projectMembers.userId, input.userId)
          )
        );

      return { success: true };
    }),

  // List project members
  listMembers: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify access
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      const members = await db
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.projectId, input.projectId));

      return members;
    }),

  // Add session to project
  addSession: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        sessionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project access
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      const id = createId();
      const [projectSession] = await db
        .insert(projectSessions)
        .values({
          id,
          projectId: input.projectId,
          sessionId: input.sessionId,
        })
        .returning();

      // Update project activity
      await db
        .update(projects)
        .set({ lastActivityAt: new Date() })
        .where(eq(projects.id, input.projectId));

      return projectSession;
    }),

  // Remove session from project
  removeSession: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        sessionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(projectSessions)
        .where(
          and(
            eq(projectSessions.projectId, input.projectId),
            eq(projectSessions.sessionId, input.sessionId)
          )
        );

      return { success: true };
    }),

  // List project groups
  listGroups: protectedProcedure.query(async ({ ctx }) => {
    const groups = await db
      .select()
      .from(projectGroups)
      .where(eq(projectGroups.userId, ctx.user.id))
      .orderBy(projectGroups.sortOrder);

    return groups;
  }),

  // Create project group
  createGroup: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        color: z.string().optional(),
        icon: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = createId();

      const [group] = await db
        .insert(projectGroups)
        .values({
          id,
          userId: ctx.user.id,
          name: input.name,
          color: input.color,
          icon: input.icon,
        })
        .returning();

      return group;
    }),

  // Add project to group
  addToGroup: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        projectId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify group ownership
      const [group] = await db
        .select()
        .from(projectGroups)
        .where(
          and(
            eq(projectGroups.id, input.groupId),
            eq(projectGroups.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }

      const id = createId();
      const [item] = await db
        .insert(projectGroupItems)
        .values({
          id,
          groupId: input.groupId,
          projectId: input.projectId,
        })
        .returning();

      return item;
    }),
});
