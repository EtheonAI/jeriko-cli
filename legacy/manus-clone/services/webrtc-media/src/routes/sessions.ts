/**
 * Media sessions CRUD — DB-backed (replaces in-memory Map).
 *
 * POST /v1/media/sessions               — Create a media session
 * GET  /v1/media/sessions/by-session/:sessionId — Get by chat session ID
 * DELETE /v1/media/sessions/by-session/:sessionId — Delete by chat session ID
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, mediaSessions, eq } from "../lib/db.js";

const createBodySchema = z.object({
  sessionId: z.string().min(1),
  sandboxId: z.string().optional(),
  userId: z.string().min(1),
  e2bSandboxId: z.string().optional(),
  nekoHost: z.string().optional(),
  provider: z.enum(["neko", "novnc"]).optional().default("neko"),
});

const paramsSchema = z.object({ sessionId: z.string().min(1) });

export async function sessionRoutes(app: FastifyInstance) {
  app.post("/v1/media/sessions", async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const data = parsed.data;

    // Upsert — if a session already exists for this sessionId, update it
    const [existing] = await db
      .select()
      .from(mediaSessions)
      .where(eq(mediaSessions.sessionId, data.sessionId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(mediaSessions)
        .set({
          sandboxId: data.sandboxId ?? existing.sandboxId,
          e2bSandboxId: data.e2bSandboxId ?? existing.e2bSandboxId,
          nekoHost: data.nekoHost ?? existing.nekoHost,
          provider: data.provider,
          status: "active" as const,
          updatedAt: new Date(),
        })
        .where(eq(mediaSessions.id, existing.id))
        .returning();

      return reply.status(200).send({
        mediaSessionId: updated.id,
        sessionId: updated.sessionId,
        provider: updated.provider,
        nekoHost: updated.nekoHost,
        status: updated.status,
        createdAt: updated.createdAt,
      });
    }

    const [created] = await db
      .insert(mediaSessions)
      .values({
        sessionId: data.sessionId,
        sandboxId: data.sandboxId ?? null,
        userId: data.userId,
        e2bSandboxId: data.e2bSandboxId ?? null,
        nekoHost: data.nekoHost ?? null,
        provider: data.provider,
        status: "pending",
      })
      .returning();

    return reply.status(201).send({
      mediaSessionId: created.id,
      sessionId: created.sessionId,
      provider: created.provider,
      nekoHost: created.nekoHost,
      status: created.status,
      createdAt: created.createdAt,
    });
  });

  app.get("/v1/media/sessions/by-session/:sessionId", async (request, reply) => {
    const { sessionId } = paramsSchema.parse(request.params);

    const [session] = await db
      .select()
      .from(mediaSessions)
      .where(eq(mediaSessions.sessionId, sessionId))
      .limit(1);

    if (!session) {
      return reply.status(404).send({ error: "Media session not found" });
    }

    return {
      mediaSessionId: session.id,
      sessionId: session.sessionId,
      sandboxId: session.sandboxId,
      e2bSandboxId: session.e2bSandboxId,
      nekoHost: session.nekoHost,
      provider: session.provider,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  });

  app.delete("/v1/media/sessions/by-session/:sessionId", async (request, reply) => {
    const { sessionId } = paramsSchema.parse(request.params);

    const deleted = await db
      .delete(mediaSessions)
      .where(eq(mediaSessions.sessionId, sessionId))
      .returning();

    if (deleted.length === 0) {
      return reply.status(404).send({ success: false, error: "Media session not found" });
    }

    return { success: true };
  });
}
