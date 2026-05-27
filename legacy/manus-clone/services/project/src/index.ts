import { createService, typedRoute, createId, z } from "@repo/service-utils";
import { NotFoundError, AuthorizationError } from "@repo/service-utils/errors";
import { dispatchWebhookEvent } from "@repo/service-utils";
import {
  db,
  projects,
  projectMembers,
  projectSessions,
  files,
  eq,
  and,
  desc,
  sql,
  initDb,
} from "./lib/db.js";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const IdParams = z.object({ id: z.string().min(1) });

const MemberParams = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
});

const UserIdParams = z.object({ userId: z.string().min(1) });

const ListProjectsQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const CreateProjectBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  userId: z.string().min(1).optional(),
  organizationId: z.string().optional(),
  visibility: z.enum(["private", "team", "public"]).default("private"),
});

const UpdateProjectBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  visibility: z.enum(["private", "team", "public"]).optional(),
  status: z.string().optional(),
});

const AddMemberBody = z.object({
  userId: z.string().min(1),
  role: z.enum(["owner", "admin", "editor", "viewer"]),
});

// ---------------------------------------------------------------------------
// Authorization helper
// ---------------------------------------------------------------------------

/**
 * Verify the requesting user owns or is a member of the project.
 * Returns the project record if found and authorized.
 */
async function verifyProjectAccess(
  projectId: string,
  userId: string
): Promise<void> {
  const [project] = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new NotFoundError("Project");
  }

  if (project.userId === userId) return;

  // Check membership
  const [member] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);

  if (!member) {
    throw new AuthorizationError("Not authorized to access this project");
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main() {
  await initDb();

  const { app, logger, start } = await createService({ name: "project", port: parseInt(process.env.PORT || "4010", 10) });

  // ---------------------------------------------------------------------------
  // List user's projects
  // ---------------------------------------------------------------------------
  app.get(
    "/users/:userId/projects",
    typedRoute({ params: UserIdParams, query: ListProjectsQuery }, async (request, reply) => {
      const { userId } = request.params;
      if (request.userId !== userId) {
        throw new AuthorizationError("Not authorized to list another user's projects");
      }
      const { cursor, limit } = request.query;

      const conditions = [eq(projects.userId, userId)];
      if (cursor) {
        conditions.push(
          sql`${projects.createdAt} < (SELECT created_at FROM projects WHERE id = ${cursor})`,
        );
      }

      const results = await db
        .select()
        .from(projects)
        .where(and(...conditions))
        .orderBy(desc(projects.createdAt))
        .limit(limit + 1);

      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;
      const nextCursor = hasMore ? items[items.length - 1]!.id : null;

      return reply.success({ projects: items, cursor: nextCursor });
    }),
  );

  // ---------------------------------------------------------------------------
  // Create project
  // ---------------------------------------------------------------------------
  app.post(
    "/projects",
    typedRoute({ body: CreateProjectBody }, async (request, reply) => {
      const { name, description, organizationId, visibility } = request.body;
      const userId = request.userId;

      const [project] = await db
        .insert(projects)
        .values({
          id: createId(),
          name,
          description,
          userId,
          organizationId,
          visibility,
          status: "active",
        })
        .returning();

      logger.info({ projectId: project!.id, userId }, "Project created");

      dispatchWebhookEvent({
        eventType: "project.created",
        resourceType: "project",
        resourceId: project!.id,
        payload: { id: project!.id, name: project!.name, visibility: project!.visibility },
        userId,
        organizationId,
      });

      return reply.success({
        id: project!.id,
        name: project!.name,
        description: project!.description,
        visibility: project!.visibility,
        status: project!.status,
        createdAt: project!.createdAt.toISOString(),
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // Get project
  // ---------------------------------------------------------------------------
  app.get(
    "/projects/:id",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;
      await verifyProjectAccess(id, request.userId);

      const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);

      return reply.success(project!);
    }),
  );

  // ---------------------------------------------------------------------------
  // Update project
  // ---------------------------------------------------------------------------
  app.patch(
    "/projects/:id",
    typedRoute({ params: IdParams, body: UpdateProjectBody }, async (request, reply) => {
      const { id } = request.params;
      await verifyProjectAccess(id, request.userId);

      const [updated] = await db
        .update(projects)
        .set(request.body as any)
        .where(eq(projects.id, id))
        .returning();

      if (!updated) throw new NotFoundError("Project");

      dispatchWebhookEvent({
        eventType: "project.updated",
        resourceType: "project",
        resourceId: id,
        payload: { id: updated.id, name: updated.name, ...request.body },
      });

      return reply.success(updated);
    }),
  );

  // ---------------------------------------------------------------------------
  // Delete project
  // ---------------------------------------------------------------------------
  app.delete(
    "/projects/:id",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;

      // Only owner can delete
      const [project] = await db.select({ userId: projects.userId }).from(projects).where(eq(projects.id, id)).limit(1);
      if (!project) throw new NotFoundError("Project");
      if (project.userId !== request.userId) throw new AuthorizationError("Only the project owner can delete");

      const [deleted] = await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, request.userId))).returning();

      if (!deleted) throw new NotFoundError("Project");

      dispatchWebhookEvent({
        eventType: "project.deleted",
        resourceType: "project",
        resourceId: id,
        payload: { id: deleted.id, name: deleted.name },
      });

      return reply.success({ deleted: true });
    }),
  );

  // ---------------------------------------------------------------------------
  // Get project members
  // ---------------------------------------------------------------------------
  app.get(
    "/projects/:id/members",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;
      await verifyProjectAccess(id, request.userId);

      const members = await db
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.projectId, id));

      return reply.success({ members });
    }),
  );

  // ---------------------------------------------------------------------------
  // Add project member
  // ---------------------------------------------------------------------------
  app.post(
    "/projects/:id/members",
    typedRoute({ params: IdParams, body: AddMemberBody }, async (request, reply) => {
      const { id } = request.params;

      // Only owner/admin can add members
      const [project] = await db.select({ userId: projects.userId }).from(projects).where(eq(projects.id, id)).limit(1);
      if (!project) throw new NotFoundError("Project");
      if (project.userId !== request.userId) {
        const [member] = await db.select({ role: projectMembers.role }).from(projectMembers).where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, request.userId))).limit(1);
        if (!member || !["owner", "admin"].includes(member.role)) {
          throw new AuthorizationError("Only owners and admins can add members");
        }
      }

      const { userId, role } = request.body;

      await db.insert(projectMembers).values({
        id: createId(),
        projectId: id,
        userId,
        role,
      });

      return reply.success({ projectId: id, userId, role, added: true });
    }),
  );

  // ---------------------------------------------------------------------------
  // Remove project member
  // ---------------------------------------------------------------------------
  app.delete(
    "/projects/:id/members/:userId",
    typedRoute({ params: MemberParams }, async (request, reply) => {
      const { id, userId } = request.params;

      // Only owner/admin can remove members
      const [project] = await db.select({ userId: projects.userId }).from(projects).where(eq(projects.id, id)).limit(1);
      if (!project) throw new NotFoundError("Project");
      if (project.userId !== request.userId) {
        const [member] = await db.select({ role: projectMembers.role }).from(projectMembers).where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, request.userId))).limit(1);
        if (!member || !["owner", "admin"].includes(member.role)) {
          throw new AuthorizationError("Only owners and admins can remove members");
        }
      }

      await db
        .delete(projectMembers)
        .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)));

      return reply.success({ removed: true });
    }),
  );

  // ---------------------------------------------------------------------------
  // Get project sessions
  // ---------------------------------------------------------------------------
  app.get(
    "/projects/:id/sessions",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;
      await verifyProjectAccess(id, request.userId);

      const sessions = await db
        .select()
        .from(projectSessions)
        .where(eq(projectSessions.projectId, id))
        .orderBy(desc(projectSessions.createdAt));

      return reply.success({ sessions });
    }),
  );

  // ---------------------------------------------------------------------------
  // Get project files
  // ---------------------------------------------------------------------------
  app.get(
    "/projects/:id/files",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;
      await verifyProjectAccess(id, request.userId);

      const sessions = await db
        .select({ sessionId: projectSessions.sessionId })
        .from(projectSessions)
        .where(eq(projectSessions.projectId, id));

      if (sessions.length === 0) {
        return reply.success({ files: [] });
      }

      const sessionIds = sessions.map((s) => s.sessionId);
      const projectFiles = await db
        .select()
        .from(files)
        .where(
          sql`${files.sessionId} IN (${sql.join(
            sessionIds.map((sid) => sql`${sid}`),
            sql`, `,
          )})`,
        );

      return reply.success({ files: projectFiles });
    }),
  );

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  await start();
}

main();
