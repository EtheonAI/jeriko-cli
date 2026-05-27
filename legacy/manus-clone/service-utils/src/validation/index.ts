/**
 * Request Validation Utilities
 * Using Zod for type-safe validation with detailed error messages
 */

import { z, ZodError, ZodSchema } from "zod";
import type { FastifyRequest, FastifyReply } from "fastify";

// Validation error response
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationErrorDetail[];
}

/**
 * Validate data against a Zod schema
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: ValidationErrorDetail[] = error.issues.map((err) => ({
        field: err.path.map(String).join("."),
        message: err.message,
        code: err.code,
      }));
      return { success: false, errors };
    }
    throw error;
  }
}

/**
 * Validate request body, query, and params
 */
export interface RequestSchemas<TBody = unknown, TQuery = unknown, TParams = unknown> {
  body?: ZodSchema<TBody>;
  query?: ZodSchema<TQuery>;
  params?: ZodSchema<TParams>;
}

export function validateRequest<TBody, TQuery, TParams>(
  request: FastifyRequest,
  schemas: RequestSchemas<TBody, TQuery, TParams>
): ValidationResult<{ body?: TBody; query?: TQuery; params?: TParams }> {
  const errors: ValidationErrorDetail[] = [];
  const data: { body?: TBody; query?: TQuery; params?: TParams } = {};

  if (schemas.body) {
    const result = validate(schemas.body, request.body);
    if (!result.success) {
      errors.push(
        ...(result.errors || []).map((e) => ({
          ...e,
          field: `body.${e.field}`,
        }))
      );
    } else {
      data.body = result.data;
    }
  }

  if (schemas.query) {
    const result = validate(schemas.query, request.query);
    if (!result.success) {
      errors.push(
        ...(result.errors || []).map((e) => ({
          ...e,
          field: `query.${e.field}`,
        }))
      );
    } else {
      data.query = result.data;
    }
  }

  if (schemas.params) {
    const result = validate(schemas.params, request.params);
    if (!result.success) {
      errors.push(
        ...(result.errors || []).map((e) => ({
          ...e,
          field: `params.${e.field}`,
        }))
      );
    } else {
      data.params = result.data;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Generic non-empty ID string
  id: z.string().min(1),

  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
  }),

  // ID parameters
  idParam: z.object({
    id: z.string().min(1),
  }),

  // UUID
  uuid: z.string().uuid(),

  // CUID
  cuid: z.string().min(20).max(30),

  // Email
  email: z.string().email().toLowerCase().trim(),

  // URL
  url: z.string().url(),

  // Date range
  dateRange: z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }),

  // Sort options
  sortOptions: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),

  // Search query
  searchQuery: z.object({
    q: z.string().min(1).max(500),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

/**
 * Minimal Zod to JSON Schema converter for service metadata and tests.
 * This intentionally covers the common schema shapes used by service-utils.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = (schema as any)._def;
  const typeName = def?.typeName ?? def?.type;

  switch (typeName) {
    case "ZodString":
    case "string":
      return { type: "string" };

    case "ZodNumber":
    case "number":
      return { type: "number" };

    case "ZodBoolean":
    case "boolean":
      return { type: "boolean" };

    case "ZodArray":
    case "array": {
      const itemSchema = def?.type ?? def?.element;
      return {
        type: "array",
        items: itemSchema ? zodToJsonSchema(itemSchema) : {},
      };
    }

    case "ZodObject":
    case "object": {
      const shape =
        typeof def?.shape === "function"
          ? def.shape()
          : def?.shape ?? (schema as any).shape ?? {};
      const properties: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value as z.ZodTypeAny);
      }

      return {
        type: "object",
        properties,
        required: Object.keys(shape),
      };
    }

    case "ZodOptional":
    case "optional":
      return zodToJsonSchema(def.innerType);

    case "ZodNullable":
    case "nullable":
      return {
        anyOf: [zodToJsonSchema(def.innerType), { type: "null" }],
      };

    default:
      return {};
  }
}

// Re-export Zod for convenience
export { z, ZodError, type ZodSchema };
