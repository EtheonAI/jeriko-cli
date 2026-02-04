import * as http from 'http';
import * as fastify from 'fastify';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Logger } from 'pino';

declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly isOperational: boolean;
    readonly details?: Record<string, unknown>;
    constructor(message: string, statusCode?: number, code?: string, isOperational?: boolean, details?: Record<string, unknown>);
}
declare class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>);
}
declare class AuthenticationError extends AppError {
    constructor(message?: string);
}
declare class AuthorizationError extends AppError {
    constructor(message?: string);
}
declare class NotFoundError extends AppError {
    constructor(resource?: string);
}
declare class ConflictError extends AppError {
    constructor(message?: string);
}
declare class RateLimitError extends AppError {
    readonly retryAfter?: number;
    constructor(message?: string, retryAfter?: number);
}
declare class ServiceUnavailableError extends AppError {
    constructor(message?: string);
}
declare class BadGatewayError extends AppError {
    constructor(message?: string);
}
declare class GatewayTimeoutError extends AppError {
    constructor(message?: string);
}
interface ErrorResponse {
    data: null;
    meta: {
        requestId: string;
        timestamp: string;
    };
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}
declare function formatErrorResponse(error: AppError | Error, requestId: string): ErrorResponse;
declare function createErrorHandler(logger: Logger): (error: Error & {
    statusCode?: number;
    code?: string;
    validation?: unknown;
}, request: FastifyRequest, reply: FastifyReply) => FastifyReply<fastify.RouteGenericInterface, fastify.RawServerDefault, http.IncomingMessage, http.ServerResponse<http.IncomingMessage>, unknown, fastify.FastifySchema, fastify.FastifyTypeProviderDefault, unknown>;
declare function asyncHandler<T>(fn: (request: FastifyRequest, reply: FastifyReply) => Promise<T>): (request: FastifyRequest, reply: FastifyReply) => Promise<T>;
declare function createNotFoundHandler(logger: Logger): (request: FastifyRequest, reply: FastifyReply) => FastifyReply<fastify.RouteGenericInterface, fastify.RawServerDefault, http.IncomingMessage, http.ServerResponse<http.IncomingMessage>, unknown, fastify.FastifySchema, fastify.FastifyTypeProviderDefault, unknown>;

export { AppError, AuthenticationError, AuthorizationError, BadGatewayError, ConflictError, type ErrorResponse, GatewayTimeoutError, NotFoundError, RateLimitError, ServiceUnavailableError, ValidationError, asyncHandler, createErrorHandler, createNotFoundHandler, formatErrorResponse };
