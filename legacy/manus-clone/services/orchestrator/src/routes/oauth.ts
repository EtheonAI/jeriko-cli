/**
 * OAuth Server Routes — Authentication for webdev project users.
 *
 * Manus equivalent: webdev.v1.WebDevAuthPublicService (gRPC-style HTTP endpoints)
 *
 * Provides OAuth 2.0 authorization code flow for user-built webdev apps.
 * Each webdev project has a unique VITE_APP_ID (clientId). Users authenticate
 * via the Jeriko platform (Better-Auth), and the OAuth server issues tokens
 * that the webdev app's Express backend exchanges for user info.
 *
 * Flow:
 *   1. Frontend redirects to GET {OAUTH_PORTAL_URL}/app-auth?appId=...&redirectUri=...&state=...&type=signIn
 *   2. User authenticates (handled by the Next.js app-auth page)
 *   3. Portal redirects to GET {redirectUri}?code=<authcode>&state=<state>
 *   4. WebDev app backend calls POST ExchangeToken { code } → { accessToken }
 *   5. WebDev app backend calls POST GetUserInfo { accessToken } → { openId, name, email }
 *
 * Endpoints:
 *   POST /webdev.v1.WebDevAuthPublicService/ExchangeToken
 *   POST /webdev.v1.WebDevAuthPublicService/GetUserInfo
 *   POST /webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt
 *   POST /api/oauth/authorize    — Issue authorization code (called by portal page)
 *   GET  /api/oauth/health       — Health check
 */

import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { createLogger } from "@repo/service-utils";

const logger = createLogger({ service: "oauth" });

// ── In-memory stores (TTL-based, auto-cleanup) ──────────────────────────────
// Authorization codes: code → { userId, name, email, clientId, redirectUri, createdAt }
const authCodes = new Map<string, {
  userId: string;
  name: string;
  email: string;
  clientId: string;
  redirectUri: string;
  platform: string;
  createdAt: number;
}>();

// Access tokens: token → { userId, name, email, clientId, platform, createdAt }
const accessTokens = new Map<string, {
  userId: string;
  name: string;
  email: string;
  clientId: string;
  platform: string;
  createdAt: number;
}>();

// Cleanup expired entries every 5 minutes
const CODE_TTL = 5 * 60 * 1000;   // 5 minutes
const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of authCodes) {
    if (now - val.createdAt > CODE_TTL) authCodes.delete(key);
  }
  for (const [key, val] of accessTokens) {
    if (now - val.createdAt > TOKEN_TTL) accessTokens.delete(key);
  }
}, 5 * 60 * 1000);

export async function oauthRoutes(app: FastifyInstance) {
  /**
   * GET /api/oauth/health — Health check.
   */
  app.get("/api/oauth/health", async (_request, reply) => {
    return reply.send({
      status: "ok",
      activeCodes: authCodes.size,
      activeTokens: accessTokens.size,
    });
  });

  /**
   * POST /api/oauth/authorize — Issue an authorization code.
   *
   * Called by the app-auth login page after the user authenticates.
   * The page posts the authenticated user's info + clientId + redirectUri,
   * and receives a code to redirect the user back to the webdev app.
   */
  app.post("/api/oauth/authorize", async (request, reply) => {
    const body = request.body as {
      userId: string;
      name: string;
      email: string;
      clientId: string;      // VITE_APP_ID of the webdev project
      redirectUri: string;
      state?: string;
      platform?: string;     // "email", "google", "github", etc.
    };

    if (!body.userId || !body.clientId || !body.redirectUri) {
      return reply.status(400).send({ error: "userId, clientId, and redirectUri required" });
    }

    // Generate authorization code
    const code = crypto.randomBytes(32).toString("base64url");

    authCodes.set(code, {
      userId: body.userId,
      name: body.name || "User",
      email: body.email || "",
      clientId: body.clientId,
      redirectUri: body.redirectUri,
      platform: body.platform || "email",
      createdAt: Date.now(),
    });

    logger.info({ clientId: body.clientId, userId: body.userId }, "OAuth code issued");

    // Return the redirect URL with code + state
    const redirectUrl = new URL(body.redirectUri);
    redirectUrl.searchParams.set("code", code);
    if (body.state) {
      redirectUrl.searchParams.set("state", body.state);
    }

    return reply.send({
      redirectUrl: redirectUrl.toString(),
      code,
    });
  });

  /**
   * POST /webdev.v1.WebDevAuthPublicService/ExchangeToken
   *
   * Manus gRPC-style: exchange authorization code for access token.
   * Called by webdev app's Express backend in /api/oauth/callback.
   */
  app.post("/webdev.v1.WebDevAuthPublicService/ExchangeToken", async (request, reply) => {
    const body = request.body as {
      grantType: string;
      code?: string;
      refreshToken?: string;
      clientId: string;
      clientSecret?: string;
      redirectUri: string;
    };

    if (body.grantType !== "authorization_code") {
      return reply.status(400).send({ error: `Unsupported grant type: ${body.grantType}` });
    }

    if (!body.code) {
      return reply.status(400).send({ error: "code required for authorization_code grant" });
    }

    // Look up and consume the authorization code
    const codeData = authCodes.get(body.code);
    if (!codeData) {
      return reply.status(400).send({ error: "Invalid or expired authorization code" });
    }

    // Validate code hasn't expired
    if (Date.now() - codeData.createdAt > CODE_TTL) {
      authCodes.delete(body.code);
      return reply.status(400).send({ error: "Authorization code expired" });
    }

    // Validate clientId matches
    if (codeData.clientId !== body.clientId) {
      return reply.status(400).send({ error: "clientId mismatch" });
    }

    // Consume the code (one-time use)
    authCodes.delete(body.code);

    // Issue access token
    const accessToken = crypto.randomBytes(48).toString("base64url");
    const idToken = crypto.randomBytes(32).toString("base64url");

    accessTokens.set(accessToken, {
      userId: codeData.userId,
      name: codeData.name,
      email: codeData.email,
      clientId: codeData.clientId,
      platform: codeData.platform,
      createdAt: Date.now(),
    });

    logger.info({ clientId: body.clientId }, "OAuth token exchanged");

    return reply.send({
      accessToken,
      tokenType: "Bearer",
      expiresIn: Math.floor(TOKEN_TTL / 1000),
      refreshToken: crypto.randomBytes(32).toString("base64url"),
      scope: "openid profile email",
      idToken,
    });
  });

  /**
   * POST /webdev.v1.WebDevAuthPublicService/GetUserInfo
   *
   * Manus gRPC-style: get user info by access token.
   * Called by webdev app's Express backend after exchanging code for token.
   */
  app.post("/webdev.v1.WebDevAuthPublicService/GetUserInfo", async (request, reply) => {
    const body = request.body as { accessToken: string };

    if (!body.accessToken) {
      return reply.status(400).send({ error: "accessToken required" });
    }

    const tokenData = accessTokens.get(body.accessToken);
    if (!tokenData) {
      return reply.status(401).send({ error: "Invalid or expired access token" });
    }

    // Check expiry
    if (Date.now() - tokenData.createdAt > TOKEN_TTL) {
      accessTokens.delete(body.accessToken);
      return reply.status(401).send({ error: "Access token expired" });
    }

    return reply.send({
      openId: tokenData.userId,
      projectId: tokenData.clientId,
      name: tokenData.name,
      email: tokenData.email,
      platform: tokenData.platform,
      loginMethod: tokenData.platform,
    });
  });

  /**
   * POST /webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt
   *
   * Manus gRPC-style: validate a webdev app's local JWT and return user info.
   * Called when the webdev app needs to re-hydrate user info from a JWT cookie.
   *
   * Since the JWT is signed by the webdev app's own JWT_SECRET (which we issued
   * during project init), we can't verify it here. Instead, we trust the
   * projectId + openId claim and look up the user.
   */
  app.post("/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt", async (request, reply) => {
    const body = request.body as {
      jwtToken: string;
      projectId: string;
    };

    if (!body.jwtToken || !body.projectId) {
      return reply.status(400).send({ error: "jwtToken and projectId required" });
    }

    // Decode the JWT payload (base64url) without verification
    // The webdev app already verified the JWT with its own JWT_SECRET.
    // We just need to extract the openId to look up user info.
    try {
      const parts = body.jwtToken.split(".");
      if (parts.length !== 3) {
        return reply.status(400).send({ error: "Invalid JWT format" });
      }

      const payload = JSON.parse(
        Buffer.from(parts[1]!, "base64url").toString("utf-8")
      ) as { openId?: string; userId?: string; sub?: string; name?: string; email?: string };

      const openId = payload.openId || payload.userId || payload.sub;
      if (!openId) {
        return reply.status(400).send({ error: "JWT missing openId/userId/sub claim" });
      }

      // Look up user from database
      let name = payload.name || "User";
      let email = payload.email || "";
      let platform = "email";

      try {
        const mod = await import("@repo/database");
        const dbMod: any = (mod as any).default ?? mod;
        const { eq } = await import("drizzle-orm");
        const user = await dbMod.db
          .select({ name: dbMod.users.name, email: dbMod.users.email })
          .from(dbMod.users)
          .where(eq(dbMod.users.id, openId))
          .limit(1);

        if (user[0]) {
          name = user[0].name || name;
          email = user[0].email || email;
        }

        // Check account provider
        const account = await dbMod.db
          .select({ providerId: dbMod.accounts.providerId })
          .from(dbMod.accounts)
          .where(eq(dbMod.accounts.userId, openId))
          .limit(1);

        if (account[0]?.providerId) {
          platform = account[0].providerId;
        }
      } catch {
        // DB lookup failed — use JWT claims
      }

      return reply.send({
        openId,
        projectId: body.projectId,
        name,
        email,
        platform,
        loginMethod: platform,
      });
    } catch {
      return reply.status(400).send({ error: "Failed to decode JWT" });
    }
  });
}
