import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 4016);
const HOST = process.env.HOST ?? "0.0.0.0";

const createBodySchema = z.object({
  sessionId: z.string().min(1),
  sandboxId: z.string().optional(),
  userId: z.string().optional(),
  provider: z.enum(["neko", "novnc"]).optional().default("neko"),
});

const sessionMap = new Map<string, {
  mediaSessionId: string;
  sessionId: string;
  sandboxId: string | null;
  userId: string | null;
  provider: "neko" | "novnc";
  streamUrl: string;
  controlUrl: string;
  createdAt: string;
  updatedAt: string;
}>();

function streamUrlFor(provider: "neko" | "novnc", sandboxId: string | null): string {
  const host = process.env.NEKO_PUBLIC_HOST ?? "localhost";
  const scheme = process.env.NEKO_PUBLIC_SCHEME ?? "https";
  const port = Number(process.env.NEKO_PUBLIC_PORT ?? 8080);

  if (provider === "neko") {
    const sid = sandboxId ?? "unknown";
    return `${scheme}://${host}:${port}/?session=${encodeURIComponent(sid)}`;
  }

  // Fallback noVNC stream pattern
  const novncHost = process.env.NOVNC_PUBLIC_HOST ?? host;
  const novncPort = Number(process.env.NOVNC_PUBLIC_PORT ?? 6080);
  return `${scheme}://${novncHost}:${novncPort}/vnc.html`;
}

function buildApp() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok", service: "webrtc-media" }));

  app.post("/v1/media/sessions", async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const data = parsed.data;
    const now = new Date().toISOString();
    const mediaSessionId = `med_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    const streamUrl = streamUrlFor(data.provider, data.sandboxId ?? null);
    const controlUrl = `${streamUrl}&control=1`;

    const record = {
      mediaSessionId,
      sessionId: data.sessionId,
      sandboxId: data.sandboxId ?? null,
      userId: data.userId ?? null,
      provider: data.provider,
      streamUrl,
      controlUrl,
      createdAt: now,
      updatedAt: now,
    } as const;

    sessionMap.set(data.sessionId, { ...record });

    return reply.status(201).send({
      mediaSessionId,
      sessionId: data.sessionId,
      provider: data.provider,
      streamUrl,
      controlUrl,
      createdAt: now,
    });
  });

  app.get("/v1/media/sessions/by-session/:sessionId", async (request, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(request.params);
    const record = sessionMap.get(sessionId);
    if (!record) return reply.status(404).send({ error: "Media session not found" });
    return record;
  });

  app.delete("/v1/media/sessions/by-session/:sessionId", async (request, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(request.params);
    const deleted = sessionMap.delete(sessionId);
    if (!deleted) return reply.status(404).send({ success: false, error: "Media session not found" });
    return { success: true };
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = buildApp();
  app.listen({ port: PORT, host: HOST }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}

export { buildApp };
