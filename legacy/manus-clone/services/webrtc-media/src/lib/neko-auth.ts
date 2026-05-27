/**
 * Neko pre-auth proxy.
 *
 * Fetches the Neko admin password from the sandbox runtime, caches it in the
 * media_sessions table, and returns an auth token + proxied WebSocket URL.
 */

import { createLogger } from "@repo/service-utils";
import { db, mediaSessions, eq } from "./db.js";

const logger = createLogger({ service: "neko-auth" });

interface NekoAuthResult {
  token: string;
  nekoUrl: string;
}

/**
 * Get Neko auth for a media session.
 *
 * 1. Look up nekoHost from DB
 * 2. If nekoPassword cached, return it
 * 3. Otherwise fetch from Neko runtime (GET /neko/pre-auth)
 * 4. Cache password in DB for future requests
 */
export async function getNekoAuth(
  sessionId: string,
  wsBaseUrl: string
): Promise<NekoAuthResult | null> {
  const [session] = await db
    .select()
    .from(mediaSessions)
    .where(eq(mediaSessions.sessionId, sessionId))
    .limit(1);

  if (!session) {
    logger.warn({ sessionId }, "No media session found");
    return null;
  }

  if (!session.nekoHost) {
    logger.warn({ sessionId }, "No nekoHost on media session");
    return null;
  }

  let password = session.nekoPassword;

  // Fetch from Neko runtime if not cached
  if (!password) {
    try {
      const resp = await fetch(`https://${session.nekoHost}/neko/pre-auth`, {
        signal: AbortSignal.timeout(5000),
      });

      if (resp.ok) {
        const data = (await resp.json()) as { password?: string; token?: string };
        password = data.password || data.token || null;

        // Cache in DB
        if (password) {
          await db
            .update(mediaSessions)
            .set({ nekoPassword: password, status: "active", updatedAt: new Date() })
            .where(eq(mediaSessions.id, session.id));
        }
      } else {
        logger.warn({ sessionId, status: resp.status }, "Neko pre-auth failed");
      }
    } catch (err) {
      logger.warn(
        { sessionId, error: err instanceof Error ? err.message : String(err) },
        "Neko pre-auth request failed"
      );
    }
  }

  if (!password) {
    return null;
  }

  return {
    token: password,
    nekoUrl: `${wsBaseUrl}/ws?session=${encodeURIComponent(sessionId)}`,
  };
}
