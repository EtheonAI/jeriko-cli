// src/validation/index.ts
import { z, ZodError } from "zod";
function validate(schema, data) {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
        code: err.code
      }));
      return { success: false, errors };
    }
    throw error;
  }
}
function validateRequest(request, schemas) {
  const errors = [];
  const data = {};
  if (schemas.body) {
    const result = validate(schemas.body, request.body);
    if (!result.success) {
      errors.push(
        ...(result.errors || []).map((e) => ({
          ...e,
          field: `body.${e.field}`
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
          field: `query.${e.field}`
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
          field: `params.${e.field}`
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
var commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional()
  }),
  // ID parameters
  idParam: z.object({
    id: z.string().min(1)
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
    to: z.coerce.date().optional()
  }),
  // Sort options
  sortOptions: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  }),
  // Search query
  searchQuery: z.object({
    q: z.string().min(1).max(500),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  })
};
export {
  ZodError,
  commonSchemas,
  validate,
  validateRequest,
  z
};
//# sourceMappingURL=index.js.map