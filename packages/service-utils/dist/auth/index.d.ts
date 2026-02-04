import { z } from 'zod';

interface JWTPayload {
    sub: string;
    email: string;
    name?: string;
    iat: number;
    exp: number;
}
declare const JWTPayloadSchema: z.ZodObject<{
    sub: z.ZodString;
    email: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    iat: z.ZodNumber;
    exp: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sub: string;
    email: string;
    iat: number;
    exp: number;
    name?: string | undefined;
}, {
    sub: string;
    email: string;
    iat: number;
    exp: number;
    name?: string | undefined;
}>;
declare function verifyToken(token: string): Promise<JWTPayload | null>;
declare function createToken(userId: string, email: string, name?: string, expiresIn?: string): Promise<string>;
interface ApiKeyPayload {
    userId: string;
    keyId: string;
    scopes: string[];
}
declare function validateApiKey(apiKey: string): Promise<ApiKeyPayload | null>;
interface AuthContext {
    userId: string;
    email?: string;
    name?: string;
    type: "jwt" | "apikey";
}
declare function extractAuth(authorization?: string, apiKey?: string): Promise<AuthContext | null>;

export { type ApiKeyPayload, type AuthContext, type JWTPayload, JWTPayloadSchema, createToken, extractAuth, validateApiKey, verifyToken };
