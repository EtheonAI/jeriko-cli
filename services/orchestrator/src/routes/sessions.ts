import { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { runAgentLoop, type AgentLoopEvent } from "../lib/agent-loop.js";

type Role = "user" | "assistant" | "system";

interface SessionMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
}

interface SessionRecord {
  sessionId: string;
  userId: string;
  title: string | null;
  mode: "single" | "multi";
  createdAt: string;
  updatedAt: string;
  messages: SessionMessage[];
  events: AgentLoopEvent[];
}

const sessions = new Map<string, SessionRecord>();

const createSessionBodySchema = z.object({
  userId: z.string().optional(),
  title: z.string().optional(),
  mode: z.enum(["single", "multi"]).optional().default("single"),
  context: z.record(z.string(), z.unknown()).optional(),
});

const sendMessageBodySchema = z.object({
  message: z.string().min(1),
  files: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
});

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/v1/sessions", async (request, reply) => {
    const parsed = createSessionBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    const now = new Date().toISOString();
    const sessionId = `sess_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const userId = parsed.data.userId ?? "anonymous";

    const record: SessionRecord = {
      sessionId,
      userId,
      title: parsed.data.title ?? null,
      mode: parsed.data.mode,
      createdAt: now,
      updatedAt: now,
      messages: [],
      events: [
        {
          type: "session.created",
          timestamp: now,
          sessionId,
          sandboxId: null,
        },
      ],
    };

    sessions.set(sessionId, record);

    return reply.status(201).send({
      sessionId: record.sessionId,
      userId: record.userId,
      createdAt: record.createdAt,
      mode: record.mode,
    });
  });

  fastify.get("/v1/sessions", async (request) => {
    const query = z
      .object({
        userId: z.string().optional(),
        limit: z.coerce.number().int().positive().optional().default(20),
        offset: z.coerce.number().int().nonnegative().optional().default(0),
      })
      .parse(request.query);

    const filtered = [...sessions.values()].filter((s) => !query.userId || s.userId === query.userId);
    const paged = filtered.slice(query.offset, query.offset + query.limit);

    return {
      sessions: paged.map((s) => ({
        sessionId: s.sessionId,
        userId: s.userId,
        title: s.title,
        mode: s.mode,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
      })),
      total: filtered.length,
      limit: query.limit,
      offset: query.offset,
    };
  });

  fastify.get("/v1/sessions/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const session = sessions.get(params.id);
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }
    return {
      sessionId: session.sessionId,
      userId: session.userId,
      title: session.title,
      mode: session.mode,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messages.length,
    };
  });

  fastify.delete("/v1/sessions/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const ok = sessions.delete(params.id);
    if (!ok) {
      return reply.status(404).send({ success: false, error: "Session not found" });
    }
    return { success: true };
  });

  fastify.post("/v1/sessions/:id/messages", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const parsed = sendMessageBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    const session = sessions.get(params.id);
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }

    const now = new Date().toISOString();
    const userMessage: SessionMessage = {
      id: `msg_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      role: "user",
      content: parsed.data.message,
      createdAt: now,
    };
    session.messages.push(userMessage);

    const planPhases = [
      { id: 1, title: "Understand request" },
      { id: 2, title: "Execute tools" },
      { id: 3, title: "Return result" },
    ];

    session.events.push(
      { type: "message.start", timestamp: now, messageId: userMessage.id, role: "user" },
      { type: "plan.update", timestamp: now, planId: `plan_${session.sessionId}`, phases: planPhases, currentPhase: 1 },
      { type: "tool_call.start", timestamp: now, toolCallId: `tc_${Date.now()}`, toolName: "plan", args: { action: "update" } },
      { type: "tool_call.result", timestamp: now, toolCallId: `tc_${Date.now()}`, result: { ok: true } },
    );

    const loop = await runAgentLoop({
      messages: session.messages.map((m) => ({ role: m.role, content: m.content, timestamp: m.createdAt })),
      skills: parsed.data.tools ?? [],
      relatedKnowledge: [],
    });

    const assistantMessage: SessionMessage = {
      id: `msg_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      role: "assistant",
      content: loop.assistantMessage,
      createdAt: new Date().toISOString(),
    };

    session.messages.push(assistantMessage);
    session.updatedAt = new Date().toISOString();
    session.events.push(
      { type: "message.chunk", timestamp: session.updatedAt, messageId: assistantMessage.id, delta: loop.assistantMessage },
      { type: "message.complete", timestamp: session.updatedAt, messageId: assistantMessage.id, content: assistantMessage.content },
      { type: "credits.update", timestamp: session.updatedAt, remaining: 1000, used: 1 },
      ...loop.events,
    );

    return reply.send(loop.events);
  });

  fastify.get("/v1/sessions/:id/messages", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const session = sessions.get(params.id);
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }
    return {
      messages: session.messages,
      hasMore: false,
    };
  });

  fastify.get("/v1/sessions/:id/events", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const query = z
      .object({
        limit: z.coerce.number().int().positive().optional().default(100),
      })
      .parse(request.query);
    const session = sessions.get(params.id);
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }
    return {
      sessionId: session.sessionId,
      events: session.events.slice(-query.limit),
    };
  });
};
