import type { FastifyRequest, FastifyReply } from "fastify";
import type { ZodSchema, z } from "zod";
import { ValidationError } from "../errors/index.js";

/**
 * Schema definitions for a typed route. Each property is optional — only define
 * schemas for the parts of the request you want to validate.
 */
export interface RouteSchemas<
  TBody extends ZodSchema = ZodSchema,
  TParams extends ZodSchema = ZodSchema,
  TQuery extends ZodSchema = ZodSchema,
> {
  body?: TBody;
  params?: TParams;
  query?: TQuery;
}

/**
 * Creates a typed Fastify route handler with automatic Zod validation.
 *
 * Usage:
 * ```ts
 * const CreateFileBody = z.object({ name: z.string().min(1), path: z.string() });
 * const IdParams = z.object({ id: z.string().min(1) });
 *
 * app.post("/files", typedRoute({ body: CreateFileBody }, async (request, reply) => {
 *   // request.body is typed as { name: string; path: string }
 *   // request.userId is already verified by auth hook
 *   return reply.success(file);
 * }));
 *
 * app.get("/files/:id", typedRoute({ params: IdParams }, async (request, reply) => {
 *   // request.params is typed as { id: string }
 *   return reply.success(file);
 * }));
 * ```
 */
export function typedRoute<
  TBody extends ZodSchema = ZodSchema<unknown>,
  TParams extends ZodSchema = ZodSchema<unknown>,
  TQuery extends ZodSchema = ZodSchema<unknown>,
>(
  schemas: RouteSchemas<TBody, TParams, TQuery>,
  handler: (
    request: FastifyRequest<{
      Body: z.infer<TBody>;
      Params: z.infer<TParams>;
      Querystring: z.infer<TQuery>;
    }>,
    reply: FastifyReply,
  ) => Promise<unknown>,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Validate body
    if (schemas.body) {
      const result = schemas.body.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError("Request body validation failed", {
          issues: result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
            code: i.code,
          })),
        });
      }
      // Replace body with parsed (coerced/transformed) data
      (request as { body: unknown }).body = result.data;
    }

    // Validate params
    if (schemas.params) {
      const result = schemas.params.safeParse(request.params);
      if (!result.success) {
        throw new ValidationError("Request params validation failed", {
          issues: result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
            code: i.code,
          })),
        });
      }
      (request as { params: unknown }).params = result.data;
    }

    // Validate query
    if (schemas.query) {
      const result = schemas.query.safeParse(request.query);
      if (!result.success) {
        throw new ValidationError("Request query validation failed", {
          issues: result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
            code: i.code,
          })),
        });
      }
      (request as { query: unknown }).query = result.data;
    }

    return handler(request as FastifyRequest<{
      Body: z.infer<TBody>;
      Params: z.infer<TParams>;
      Querystring: z.infer<TQuery>;
    }>, reply);
  };
}
