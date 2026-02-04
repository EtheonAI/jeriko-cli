import * as jose from "jose";
import { z } from "zod";

export interface JWTPayload {
  sub: string; // user id
  email: string;
  name?: string;
  iat: number;
  exp: number;
}

export const JWTPayloadSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  iat: z.number(),
  exp: z.number(),
});

let jwtSecret: Uint8Array | null = null;

function getJWTSecret(): Uint8Array {
  if (!jwtSecret) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is required");
    }
    jwtSecret = new TextEncoder().encode(secret);
  }
  return jwtSecret;
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
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

export async function createToken(
  userId: string,
  email: string,
  name?: string,
  expiresIn: string = "7d"
): Promise<string> {
  const token = await new jose.SignJWT({
    sub: userId,
    email,
    name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJWTSecret());

  return token;
}

// API Key validation
export interface ApiKeyPayload {
  userId: string;
  keyId: string;
  scopes: string[];
}

export async function validateApiKey(apiKey: string): Promise<ApiKeyPayload | null> {
  // In production, this would look up the API key in the database
  // For now, we'll use a simple format: rubic_<userId>_<keyId>
  const parts = apiKey.split("_");
  if (parts.length !== 3 || parts[0] !== "rubic") {
    return null;
  }

  // TODO: Implement proper API key lookup from database
  return {
    userId: parts[1] ?? "",
    keyId: parts[2] ?? "",
    scopes: ["*"],
  };
}

// Extract auth from request headers
export interface AuthContext {
  userId: string;
  email?: string;
  name?: string;
  type: "jwt" | "apikey";
}

export async function extractAuth(
  authorization?: string,
  apiKey?: string
): Promise<AuthContext | null> {
  // Try JWT first
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7);
    const payload = await verifyToken(token);
    if (payload) {
      return {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        type: "jwt",
      };
    }
  }

  // Try API key
  if (apiKey) {
    const payload = await validateApiKey(apiKey);
    if (payload) {
      return {
        userId: payload.userId,
        type: "apikey",
      };
    }
  }

  return null;
}
