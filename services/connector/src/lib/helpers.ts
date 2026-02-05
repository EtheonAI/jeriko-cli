import type { FastifyRequest } from "fastify";
import { createLogger } from "@repo/service-utils";

export const logger: ReturnType<typeof createLogger> = createLogger({ service: "connector" });

export function getUserId(request: FastifyRequest): string {
  const userId =
    (request.headers["x-user-id"] as string) || (request.query as Record<string, string>)?.userId;

  if (!userId) {
    throw Object.assign(new Error("Missing x-user-id header"), {
      statusCode: 401,
    });
  }

  return userId;
}
