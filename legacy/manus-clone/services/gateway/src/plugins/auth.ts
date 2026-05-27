import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { extractAuth, type AuthContext } from "@repo/service-utils";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

const authPluginCallback: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("auth", null);

  fastify.addHook("onRequest", async (request) => {
    const authorization = request.headers.authorization;
    const apiKey = request.headers["x-api-key"] as string | undefined;

    request.auth = await extractAuth(authorization, apiKey);
  });
};

export const authPlugin = fp(authPluginCallback, {
  name: "auth",
});

// Helper to require authentication
export function requireAuth(request: { auth: AuthContext | null }) {
  if (!request.auth) {
    const error = new Error("Unauthorized") as Error & { statusCode: number; code: string };
    error.statusCode = 401;
    error.code = "UNAUTHORIZED";
    throw error;
  }
  return request.auth;
}
