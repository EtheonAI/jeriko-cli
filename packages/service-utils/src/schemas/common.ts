import { z } from "zod";

/** Route parameter with a single ID */
export const IdParams = z.object({
  id: z.string().min(1, "ID is required"),
});

/** Route parameter with userId */
export const UserIdParams = z.object({
  userId: z.string().min(1, "User ID is required"),
});

/** Cursor-based pagination query */
export const PaginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Offset-based pagination query */
export const OffsetPaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Path parameter that rejects directory traversal */
export const SafePathParam = z.string()
  .min(1)
  .refine((val) => !val.includes(".."), {
    message: "Path traversal not allowed",
  })
  .refine((val) => !val.includes("\0"), {
    message: "Null bytes not allowed in path",
  });
