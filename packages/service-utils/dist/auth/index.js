// src/auth/index.ts
import * as jose from "jose";
import { z } from "zod";
var JWTPayloadSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  iat: z.number(),
  exp: z.number()
});
var jwtSecret = null;
function getJWTSecret() {
  if (!jwtSecret) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is required");
    }
    jwtSecret = new TextEncoder().encode(secret);
  }
  return jwtSecret;
}
async function verifyToken(token) {
  try {
    const { payload } = await jose.jwtVerify(token, getJWTSecret());
    const parsed = JWTPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
async function createToken(userId, email, name, expiresIn = "7d") {
  const token = await new jose.SignJWT({
    sub: userId,
    email,
    name
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expiresIn).sign(getJWTSecret());
  return token;
}
async function validateApiKey(apiKey) {
  const parts = apiKey.split("_");
  if (parts.length !== 3 || parts[0] !== "rubic") {
    return null;
  }
  return {
    userId: parts[1] ?? "",
    keyId: parts[2] ?? "",
    scopes: ["*"]
  };
}
async function extractAuth(authorization, apiKey) {
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7);
    const payload = await verifyToken(token);
    if (payload) {
      return {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        type: "jwt"
      };
    }
  }
  if (apiKey) {
    const payload = await validateApiKey(apiKey);
    if (payload) {
      return {
        userId: payload.userId,
        type: "apikey"
      };
    }
  }
  return null;
}
export {
  JWTPayloadSchema,
  createToken,
  extractAuth,
  validateApiKey,
  verifyToken
};
//# sourceMappingURL=index.js.map