/**
 * Centralized Error Handling
 * Custom error classes with proper HTTP status codes and error codes
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { Logger } from "pino";

// Base application error
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Specific error classes
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, "VALIDATION_ERROR", true, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "UNAUTHORIZED", true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Access denied") {
    super(message, 403, "FORBIDDEN", true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND", true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(message, 409, "CONFLICT", true);
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message: string = "Too many requests", retryAfter?: number) {
    super(message, 429, "RATE_LIMITED", true, { retryAfter });
    this.retryAfter = retryAfter;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = "Service temporarily unavailable") {
    super(message, 503, "SERVICE_UNAVAILABLE", true);
  }
}

export class BadGatewayError extends AppError {
  constructor(message: string = "Upstream service error") {
    super(message, 502, "BAD_GATEWAY", true);
  }
}

export class GatewayTimeoutError extends AppError {
  constructor(message: string = "Upstream service timeout") {
    super(message, 504, "GATEWAY_TIMEOUT", true);
  }
}

// Error response formatter
export interface ErrorResponse {
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

export function formatErrorResponse(
  error: AppError | Error,
  requestId: string
): ErrorResponse {
  const isAppError = error instanceof AppError;

  return {
    data: null,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
    error: {
      code: isAppError ? error.code : "INTERNAL_ERROR",
      message: isAppError && error.isOperational ? error.message : "Internal server error",
      details: isAppError ? error.details : undefined,
    },
  };
}

// Global error handler for Fastify
export function createErrorHandler(logger: Logger) {
  return function errorHandler(
    error: Error & { statusCode?: number; code?: string; validation?: unknown },
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    // Log the error
    const logContext = {
      err: error,
      requestId: request.id,
      method: request.method,
      url: request.url,
      userId: request.headers["x-user-id"],
    };

    // Determine if this is an operational error
    const isOperational = error instanceof AppError ? error.isOperational : false;

    if (isOperational) {
      logger.warn(logContext, "Operational error");
    } else {
      logger.error(logContext, "Unexpected error");
    }

    // Handle Fastify validation errors
    if (error.validation) {
      const appError = new ValidationError("Request validation failed", {
        validation: error.validation,
      });
      return reply
        .status(400)
        .send(formatErrorResponse(appError, request.id));
    }

    // Handle AppError instances
    if (error instanceof AppError) {
      if (error instanceof RateLimitError && error.retryAfter) {
        reply.header("Retry-After", error.retryAfter);
      }
      return reply
        .status(error.statusCode)
        .send(formatErrorResponse(error, request.id));
    }

    // Handle unknown errors
    const statusCode = error.statusCode || 500;
    return reply
      .status(statusCode)
      .send(formatErrorResponse(error, request.id));
  };
}

// Async handler wrapper to catch errors
export function asyncHandler<T>(
  fn: (request: FastifyRequest, reply: FastifyReply) => Promise<T>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await fn(request, reply);
    } catch (error) {
      throw error; // Let Fastify's error handler deal with it
    }
  };
}

// Not found handler
export function createNotFoundHandler(logger: Logger) {
  return function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
    logger.debug({ method: request.method, url: request.url }, "Route not found");
    const error = new NotFoundError("Route");
    return reply.status(404).send(formatErrorResponse(error, request.id));
  };
}
