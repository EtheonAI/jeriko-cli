import { describe, it, expect } from "vitest";
import { z } from "zod";

const ApiKeySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  key: z.string().regex(/^rk_live_[A-Za-z0-9_-]{32}$/),
  keyPrefix: z.string(),
  name: z.string().min(1),
  isActive: z.boolean(),
  expiresAt: z.union([z.string(), z.date()]).nullable(),
  lastUsedAt: z.union([z.string(), z.date()]).nullable(),
  totalRequests: z.number().int().min(0),
});

// Generate a valid 32-char base64url string for the key suffix
function makeValidKey(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let suffix = "";
  for (let i = 0; i < 32; i++) {
    suffix += chars[i % chars.length];
  }
  return `rk_live_${suffix}`;
}

describe("API key contract", () => {
  const validApiKey = {
    id: "key_001",
    userId: "user_xyz789",
    key: makeValidKey(),
    keyPrefix: "rk_live_ABCD...",
    name: "Production Key",
    isActive: true,
    expiresAt: null,
    lastUsedAt: null,
    totalRequests: 0,
  };

  it("valid API key passes schema validation", () => {
    const result = ApiKeySchema.safeParse(validApiKey);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(validApiKey.id);
      expect(result.data.name).toBe("Production Key");
      expect(result.data.isActive).toBe(true);
      expect(result.data.totalRequests).toBe(0);
    }
  });

  it("key format rk_live_* required", () => {
    const result = ApiKeySchema.safeParse({
      ...validApiKey,
      key: "sk_test_invalid_prefix_xxxxxxxxxxxxxxx",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const keyIssue = result.error.issues.find((i) =>
        i.path.includes("key"),
      );
      expect(keyIssue).toBeDefined();
    }
  });

  it("invalid key prefix rejected", () => {
    // Key must match rk_live_ prefix followed by exactly 32 base64url chars
    const result = ApiKeySchema.safeParse({
      ...validApiKey,
      key: "rk_test_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const keyIssue = result.error.issues.find((i) =>
        i.path.includes("key"),
      );
      expect(keyIssue).toBeDefined();
    }
  });

  it("name required (non-empty)", () => {
    const result = ApiKeySchema.safeParse({
      ...validApiKey,
      name: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameIssue = result.error.issues.find((i) =>
        i.path.includes("name"),
      );
      expect(nameIssue).toBeDefined();
    }
  });

  it("totalRequests must be non-negative integer", () => {
    // Negative value
    const negativeResult = ApiKeySchema.safeParse({
      ...validApiKey,
      totalRequests: -5,
    });
    expect(negativeResult.success).toBe(false);

    // Float value
    const floatResult = ApiKeySchema.safeParse({
      ...validApiKey,
      totalRequests: 3.7,
    });
    expect(floatResult.success).toBe(false);

    // Valid positive integer
    const validResult = ApiKeySchema.safeParse({
      ...validApiKey,
      totalRequests: 42,
    });
    expect(validResult.success).toBe(true);
  });
});
