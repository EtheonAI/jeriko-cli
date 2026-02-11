import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().min(1) });
const startBodySchema = z.object({
  sandboxId: z.string().optional(),
  userId: z.string().optional(),
  provider: z.enum(["neko", "novnc"]).optional().default("neko"),
});

async function proxyJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export const mediaRoutes: FastifyPluginAsync = async (fastify) => {
  const mediaServiceUrl = process.env.MEDIA_SERVICE_URL ?? "http://localhost:4016";

  fastify.post("/v1/sessions/:id/media/start", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const parsed = startBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const payload = { sessionId: id, ...parsed.data };
    const result = await proxyJson(`${mediaServiceUrl}/v1/media/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!result.ok) return reply.status(result.status).send(result.body);
    return reply.status(201).send(result.body);
  });

  fastify.get("/v1/sessions/:id/media", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const result = await proxyJson(`${mediaServiceUrl}/v1/media/sessions/by-session/${encodeURIComponent(id)}`);
    if (!result.ok) return reply.status(result.status).send(result.body);
    return result.body;
  });

  fastify.post("/v1/sessions/:id/media/stop", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const result = await proxyJson(`${mediaServiceUrl}/v1/media/sessions/by-session/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!result.ok) return reply.status(result.status).send(result.body);
    return result.body;
  });
};
