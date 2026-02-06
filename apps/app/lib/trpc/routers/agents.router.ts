import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, agents, agentTasks, agentSessions, eq, asc, desc } from "@repo/database";
import { createId } from "@paralleldrive/cuid2";
import { syncActionToSearch } from "@repo/search";

export const agentsRouter = createTRPCRouter({
  // List agents for a session
  list: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify session ownership
      const [session] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, input.sessionId))
        .limit(1);

      if (!session || session.userId !== ctx.user.id) {
        throw new Error("Session not found");
      }

      const sessionAgents = await db
        .select()
        .from(agents)
        .where(eq(agents.sessionId, input.sessionId))
        .orderBy(asc(agents.createdAt));

      return sessionAgents;
    }),

  // Get an agent by ID
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [agent] = await db.select().from(agents).where(eq(agents.id, input.id)).limit(1);

    if (!agent) {
      return null;
    }

    // Verify session ownership
    const [session] = await db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.id, agent.sessionId))
      .limit(1);

    if (!session || session.userId !== ctx.user.id) {
      return null;
    }

    return agent;
  }),

  // Create an agent (internal use)
  create: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        type: z.enum([
          "orchestrator",
          "researcher",
          "coder",
          "browser",
          "file_manager",
          "executor",
          "analyst",
        ]),
        name: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify session ownership
      const [session] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, input.sessionId))
        .limit(1);

      if (!session || session.userId !== ctx.user.id) {
        throw new Error("Session not found");
      }

      const id = createId();
      const [agent] = await db
        .insert(agents)
        .values({
          id,
          sessionId: input.sessionId,
          type: input.type,
          name: input.name || null,
          status: "idle",
          progress: 0,
          metadata: input.metadata,
        })
        .returning();

      // TODO: Publish agent:new event via gateway/backend service

      return agent;
    }),

  // Update agent status
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["idle", "thinking", "executing", "waiting", "completed", "failed"]),
        currentTask: z.string().optional(),
        progress: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);

      if (!agent) {
        throw new Error("Agent not found");
      }

      // Verify session ownership
      const [session] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, agent.sessionId))
        .limit(1);

      if (!session || session.userId !== ctx.user.id) {
        throw new Error("Access denied");
      }

      const [updatedAgent] = await db
        .update(agents)
        .set({
          ...updates,
          lastActivity: new Date(),
        })
        .where(eq(agents.id, id))
        .returning();

      // TODO: Publish agent:update event via gateway/backend service

      return updatedAgent;
    }),

  // Get tasks for an agent
  tasks: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [agent] = await db.select().from(agents).where(eq(agents.id, input.agentId)).limit(1);

      if (!agent) {
        throw new Error("Agent not found");
      }

      // Verify session ownership
      const [session] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, agent.sessionId))
        .limit(1);

      if (!session || session.userId !== ctx.user.id) {
        throw new Error("Access denied");
      }

      const tasks = await db
        .select()
        .from(agentTasks)
        .where(eq(agentTasks.agentId, input.agentId))
        .orderBy(desc(agentTasks.createdAt));

      return tasks;
    }),

  // Create a task for an agent
  createTask: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        title: z.string(),
        description: z.string().optional(),
        parentTaskId: z.string().optional(),
        priority: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [agent] = await db.select().from(agents).where(eq(agents.id, input.agentId)).limit(1);

      if (!agent) {
        throw new Error("Agent not found");
      }

      // Verify session ownership
      const [session] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, agent.sessionId))
        .limit(1);

      if (!session || session.userId !== ctx.user.id) {
        throw new Error("Access denied");
      }

      const id = createId();
      const [task] = await db
        .insert(agentTasks)
        .values({
          id,
          agentId: input.agentId,
          title: input.title,
          description: input.description || null,
          parentTaskId: input.parentTaskId || null,
          priority: input.priority || 0,
          status: "pending",
        })
        .returning();

      if (task) {
        void syncActionToSearch(task, agent, ctx.user.id);
        // TODO: Publish task:created event via gateway/backend service
      }

      return task;
    }),

  // Update a task
  updateTask: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["pending", "in_progress", "completed", "failed", "cancelled"]).optional(),
        result: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [task] = await db.select().from(agentTasks).where(eq(agentTasks.id, id)).limit(1);

      if (!task) {
        throw new Error("Task not found");
      }

      // Verify ownership through agent -> session chain
      const [agent] = await db.select().from(agents).where(eq(agents.id, task.agentId)).limit(1);

      if (!agent) {
        throw new Error("Agent not found");
      }

      const [session] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, agent.sessionId))
        .limit(1);

      if (!session || session.userId !== ctx.user.id) {
        throw new Error("Access denied");
      }

      const updateData: Record<string, unknown> = { ...updates };

      if (updates.status === "in_progress" && !task.startedAt) {
        updateData.startedAt = new Date();
      }

      if (updates.status && ["completed", "failed", "cancelled"].includes(updates.status)) {
        updateData.completedAt = new Date();
      }

      const [updatedTask] = await db
        .update(agentTasks)
        .set(updateData)
        .where(eq(agentTasks.id, id))
        .returning();

      if (updatedTask) {
        void syncActionToSearch(updatedTask, agent, ctx.user.id);
        // TODO: Publish task:updated/cancelled/completed events via gateway/backend service
      }

      return updatedTask;
    }),
});
