import { ZodSchema, z } from 'zod';
export { ZodError, ZodSchema, z } from 'zod';
import { FastifyRequest } from 'fastify';

/**
 * Request Validation Utilities
 * Using Zod for type-safe validation with detailed error messages
 */

interface ValidationErrorDetail {
    field: string;
    message: string;
    code: string;
}
interface ValidationResult<T> {
    success: boolean;
    data?: T;
    errors?: ValidationErrorDetail[];
}
/**
 * Validate data against a Zod schema
 */
declare function validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T>;
/**
 * Validate request body, query, and params
 */
interface RequestSchemas<TBody = unknown, TQuery = unknown, TParams = unknown> {
    body?: ZodSchema<TBody>;
    query?: ZodSchema<TQuery>;
    params?: ZodSchema<TParams>;
}
declare function validateRequest<TBody, TQuery, TParams>(request: FastifyRequest, schemas: RequestSchemas<TBody, TQuery, TParams>): ValidationResult<{
    body?: TBody;
    query?: TQuery;
    params?: TParams;
}>;
/**
 * Common validation schemas
 */
declare const commonSchemas: {
    pagination: z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        cursor?: string | undefined;
    }, {
        page?: number | undefined;
        limit?: number | undefined;
        cursor?: string | undefined;
    }>;
    idParam: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    uuid: z.ZodString;
    cuid: z.ZodString;
    email: z.ZodString;
    url: z.ZodString;
    dateRange: z.ZodObject<{
        from: z.ZodOptional<z.ZodDate>;
        to: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        from?: Date | undefined;
        to?: Date | undefined;
    }, {
        from?: Date | undefined;
        to?: Date | undefined;
    }>;
    sortOptions: z.ZodObject<{
        sortBy: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        sortOrder: "asc" | "desc";
        sortBy?: string | undefined;
    }, {
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
    searchQuery: z.ZodObject<{
        q: z.ZodString;
        limit: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        q: string;
    }, {
        q: string;
        limit?: number | undefined;
    }>;
};

export { type RequestSchemas, type ValidationErrorDetail, type ValidationResult, commonSchemas, validate, validateRequest };
