import type { FastifyInstance } from "fastify";
import { secureCompare } from "../security/index.js";
import { AuthenticationError } from "../errors/index.js";

const SKIP_AUTH_PREFIXES = ["/health", "/metrics", "/ready", "/live"];

/**
 * Registers an onRequest hook that verifies the x-gateway-secret header.
 * This ensures requests are coming through the gateway and not directly
 * from the internet. Skips health/metrics endpoints.
 */
export function registerAuthHook(
  app: FastifyInstance,
  gatewaySecret: string,
  additionalPublicRoutes: string[] = [],
): void {
  const skipPrefixes = [...SKIP_AUTH_PREFIXES, ...additionalPublicRoutes];

  app.addHook("onRequest", async (request) => {
    // Skip auth for health/metrics endpoints
    if (skipPrefixes.some((prefix) => request.url.startsWith(prefix))) {
      return;
    }

    const providedSecret = request.headers["x-gateway-secret"] as string | undefined;

    if (!providedSecret || !secureCompare(providedSecret, gatewaySecret)) {
      throw new AuthenticationError("Invalid or missing gateway secret");
    }

    // Extract and decorate userId from gateway-verified header
    const userId = request.headers["x-user-id"] as string | undefined;
    if (userId) {
      request.userId = userId;
    }
  });
}
