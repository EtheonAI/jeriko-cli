import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, agents, agentTasks, agentSessions, eq, and, asc, desc } from "@repo/database";
import { createId } from "@paralleldrive/cuid2";
import { syncActionToSearch } from "@repo/search";

export const agentsRouter = createTRPCRouter({
  // List agents for a session
  list: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Run ownership check + agents query in parallel
      const [[session], sessionAgents] = await Promise.all([
        db
          .select()
          .from(agentSessions)
          .where(and(eq(agentSessions.id, input.sessionId), eq(agentSessions.userId, ctx.user.id)))
          .limit(1),
        db
          .select()
          .from(agents)
          .where(eq(agents.sessionId, input.sessionId))
          .orderBy(asc(agents.createdAt)),
      ]);

      if (!session) {
        throw new Error("Session not found");
      }

      return sessionAgents;
    }),

  // Get an agent by ID (single JOIN instead of 2 sequential queries)
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const result = await db
      .select({ agent: agents })
      .from(agents)
      .innerJoin(agentSessions, eq(agents.sessionId, agentSessions.id))
      .where(and(eq(agents.id, input.id), eq(agentSessions.userId, ctx.user.id)))
      .limit(1);

    return result[0]?.agent ?? null;
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
        metadata: z.record(z.string(), z.unknown()).optional(),
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

      // Verify agent exists + session ownership in one JOIN query
      const result = await db
        .select({ agent: agents })
        .from(agents)
        .innerJoin(agentSessions, eq(agents.sessionId, agentSessions.id))
        .where(and(eq(agents.id, id), eq(agentSessions.userId, ctx.user.id)))
        .limit(1);

      if (!result[0]) {
        throw new Error("Agent not found or access denied");
      }

      const [updatedAgent] = await db
        .update(agents)
        .set({
          ...updates,
          lastActivity: new Date(),
        })
        .where(eq(agents.id, id))
        .returning();

      return updatedAgent;
    }),

  // Get tasks for an agent
  tasks: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify agent exists + session ownership in one JOIN query
      const agentResult = await db
        .select({ agent: agents })
        .from(agents)
        .innerJoin(agentSessions, eq(agents.sessionId, agentSessions.id))
        .where(and(eq(agents.id, input.agentId), eq(agentSessions.userId, ctx.user.id)))
        .limit(1);

      if (!agentResult[0]) {
        throw new Error("Agent not found or access denied");
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
      // Verify agent + session ownership in one JOIN
      const agentResult = await db
        .select({ agent: agents })
        .from(agents)
        .innerJoin(agentSessions, eq(agents.sessionId, agentSessions.id))
        .where(and(eq(agents.id, input.agentId), eq(agentSessions.userId, ctx.user.id)))
        .limit(1);

      const agent = agentResult[0]?.agent;
      if (!agent) {
        throw new Error("Agent not found or access denied");
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
      }

      return task;
    }),

  // Update a task
  updateTask: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["pending", "in_progress", "completed", "failed", "cancelled"]).optional(),
        result: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Verify task → agent → session ownership in one JOIN (3 queries → 1)
      const result = await db
        .select({ task: agentTasks, agent: agents })
        .from(agentTasks)
        .innerJoin(agents, eq(agentTasks.agentId, agents.id))
        .innerJoin(agentSessions, eq(agents.sessionId, agentSessions.id))
        .where(and(eq(agentTasks.id, id), eq(agentSessions.userId, ctx.user.id)))
        .limit(1);

      if (!result[0]) {
        throw new Error("Task not found or access denied");
      }

      const { task, agent } = result[0];
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
      }

      return updatedTask;
    }),
});
