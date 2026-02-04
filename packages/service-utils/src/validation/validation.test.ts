import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  validateRequest,
  commonSchemas,
  zodToJsonSchema,
} from "./index.js";
import { createMockRequest } from "../testing/index.js";

describe("validateRequest", () => {
  it("should validate body successfully", () => {
    const request = createMockRequest({
      body: { name: "Test", email: "test@example.com" },
    });

    const result = validateRequest(request, {
      body: z.object({
        name: z.string().min(1),
        email: z.string().email(),
      }),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body?.name).toBe("Test");
      expect(result.data.body?.email).toBe("test@example.com");
    }
  });

  it("should return errors for invalid body", () => {
    const request = createMockRequest({
      body: { name: "", email: "invalid" },
    });

    const result = validateRequest(request, {
      body: z.object({
        name: z.string().min(1),
        email: z.string().email(),
      }),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("should validate query params", () => {
    const request = createMockRequest({
      query: { page: "1", limit: "20" },
    });

    const result = validateRequest(request, {
      query: z.object({
        page: z.string().transform(Number),
        limit: z.string().transform(Number),
      }),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query?.page).toBe(1);
      expect(result.data.query?.limit).toBe(20);
    }
  });
});

describe("commonSchemas", () => {
  describe("id", () => {
    it("should accept valid IDs", () => {
      expect(commonSchemas.id.safeParse("user_abc123").success).toBe(true);
      expect(commonSchemas.id.safeParse("123e4567-e89b-12d3-a456-426614174000").success).toBe(true);
    });

    it("should reject empty strings", () => {
      expect(commonSchemas.id.safeParse("").success).toBe(false);
    });
  });

  describe("email", () => {
    it("should accept valid emails", () => {
      expect(commonSchemas.email.safeParse("test@example.com").success).toBe(true);
    });

    it("should reject invalid emails", () => {
      expect(commonSchemas.email.safeParse("invalid").success).toBe(false);
    });
  });

  describe("pagination", () => {
    it("should have correct defaults", () => {
      const result = commonSchemas.pagination.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it("should clamp limit to max 100", () => {
      const result = commonSchemas.pagination.safeParse({ limit: 200 });
      expect(result.success).toBe(false);
    });
  });
});

describe("zodToJsonSchema", () => {
  it("should convert string schema", () => {
    const schema = z.string();
    const json = zodToJsonSchema(schema);
    expect(json.type).toBe("string");
  });

  it("should convert object schema", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const json = zodToJsonSchema(schema);
    expect(json.type).toBe("object");
    expect(json.properties).toBeDefined();
  });
});
