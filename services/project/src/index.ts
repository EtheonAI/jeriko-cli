import Fastify from "fastify";
import { createLogger, getEnv, createId, dispatchWebhookEvent } from "@repo/service-utils";
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
} from "@repo/database";

const logger = createLogger({ service: "project" });

async function main() {
  const port = parseInt(getEnv("PORT", "4010"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", service: "project" };
  });

  // List user's projects
  app.get("/users/:userId/projects", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { cursor, limit } = request.query as { cursor?: string; limit?: number };

    try {
      const pageLimit = Math.min(limit || 20, 100);
      const conditions = [eq(projects.userId, userId)];
      if (cursor) {
        conditions.push(
          sql`${projects.createdAt} < (SELECT created_at FROM projects WHERE id = ${cursor})`
        );
      }

      const results = await db
        .select()
        .from(projects)
        .where(and(...conditions))
        .orderBy(desc(projects.createdAt))
        .limit(pageLimit + 1);

      const hasMore = results.length > pageLimit;
      const items = hasMore ? results.slice(0, pageLimit) : results;
      const nextCursor = hasMore ? items[items.length - 1]!.id : null;

      return { projects: items, cursor: nextCursor };
    } catch (error) {
      logger.error(error, "Failed to fetch projects");
      return reply.status(500).send({ error: "Failed to fetch projects" });
    }
  });

  // Create project
  app.post("/projects", async (request, reply) => {
    const { name, description, userId, organizationId, visibility } = request.body as {
      name: string;
      description?: string;
      userId: string;
      organizationId?: string;
      visibility?: "private" | "team" | "public";
    };

    try {
      const [project] = await db
        .insert(projects)
        .values({
          id: createId(),
          name,
          description,
          userId,
          organizationId,
          visibility: visibility || "private",
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

      return {
        id: project!.id,
        name: project!.name,
        description: project!.description,
        visibility: project!.visibility,
        status: project!.status,
        createdAt: project!.createdAt.toISOString(),
      };
    } catch (error) {
      logger.error(error, "Failed to create project");
      return reply.status(500).send({ error: "Failed to create project" });
    }
  });

  // Get project
  app.get("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }
      return project;
    } catch (error) {
      logger.error(error, "Failed to fetch project");
      return reply.status(500).send({ error: "Failed to fetch project" });
    }
  });

  // Update project
  app.patch("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as Record<string, unknown>;
    try {
      const [updated] = await db
        .update(projects)
        .set(updates as any)
        .where(eq(projects.id, id))
        .returning();
      if (!updated) {
        return reply.status(404).send({ error: "Project not found" });
      }

      dispatchWebhookEvent({
        eventType: "project.updated",
        resourceType: "project",
        resourceId: id,
        payload: { id: updated.id, name: updated.name, ...updates },
      });

      return updated;
    } catch (error) {
      logger.error(error, "Failed to update project");
      return reply.status(500).send({ error: "Failed to update project" });
    }
  });

  // Delete project
  app.delete("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const [deleted] = await db.delete(projects).where(eq(projects.id, id)).returning();
      if (!deleted) {
        return reply.status(404).send({ error: "Project not found" });
      }

      dispatchWebhookEvent({
        eventType: "project.deleted",
        resourceType: "project",
        resourceId: id,
        payload: { id: deleted.id, name: deleted.name },
      });

      return { deleted: true };
    } catch (error) {
      logger.error(error, "Failed to delete project");
      return reply.status(500).send({ error: "Failed to delete project" });
    }
  });

  // Get project members
  app.get("/projects/:id/members", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const members = await db
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.projectId, id));
      return { members };
    } catch (error) {
      logger.error(error, "Failed to fetch project members");
      return reply.status(500).send({ error: "Failed to fetch project members" });
    }
  });

  // Add project member
  app.post("/projects/:id/members", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId, role } = request.body as { userId: string; role: string };
    try {
      await db.insert(projectMembers).values({
        id: createId(),
        projectId: id,
        userId,
        role: role as "owner" | "admin" | "editor" | "viewer",
      });
      return { projectId: id, userId, role, added: true };
    } catch (error) {
      logger.error(error, "Failed to add project member");
      return reply.status(500).send({ error: "Failed to add project member" });
    }
  });

  // Remove project member
  app.delete("/projects/:id/members/:userId", async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    try {
      await db
        .delete(projectMembers)
        .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)));
      return { removed: true };
    } catch (error) {
      logger.error(error, "Failed to remove project member");
      return reply.status(500).send({ error: "Failed to remove project member" });
    }
  });

  // Get project sessions
  app.get("/projects/:id/sessions", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const sessions = await db
        .select()
        .from(projectSessions)
        .where(eq(projectSessions.projectId, id))
        .orderBy(desc(projectSessions.createdAt));
      return { sessions };
    } catch (error) {
      logger.error(error, "Failed to fetch project sessions");
      return reply.status(500).send({ error: "Failed to fetch project sessions" });
    }
  });

  // Get project files
  app.get("/projects/:id/files", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const sessions = await db
        .select({ sessionId: projectSessions.sessionId })
        .from(projectSessions)
        .where(eq(projectSessions.projectId, id));

      if (sessions.length === 0) {
        return { files: [] };
      }

      const sessionIds = sessions.map((s) => s.sessionId);
      const projectFiles = await db
        .select()
        .from(files)
        .where(
          sql`${files.sessionId} IN (${sql.join(
            sessionIds.map((sid) => sql`${sid}`),
            sql`, `
          )})`
        );
      return { files: projectFiles };
    } catch (error) {
      logger.error(error, "Failed to fetch project files");
      return reply.status(500).send({ error: "Failed to fetch project files" });
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
    logger.info({ port, host }, "Project service started");
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
