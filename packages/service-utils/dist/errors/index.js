// src/errors/index.ts
var AppError = class _AppError extends Error {
  statusCode;
  code;
  isOperational;
  details;
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR", isOperational = true, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, _AppError.prototype);
  }
};
var ValidationError = class extends AppError {
  constructor(message, details) {
    super(message, 400, "VALIDATION_ERROR", true, details);
  }
};
var AuthenticationError = class extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED", true);
  }
};
var AuthorizationError = class extends AppError {
  constructor(message = "Access denied") {
    super(message, 403, "FORBIDDEN", true);
  }
};
var NotFoundError = class extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND", true);
  }
};
var ConflictError = class extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409, "CONFLICT", true);
  }
};
var RateLimitError = class extends AppError {
  retryAfter;
  constructor(message = "Too many requests", retryAfter) {
    super(message, 429, "RATE_LIMITED", true, { retryAfter });
    this.retryAfter = retryAfter;
  }
};
var ServiceUnavailableError = class extends AppError {
  constructor(message = "Service temporarily unavailable") {
    super(message, 503, "SERVICE_UNAVAILABLE", true);
  }
};
var BadGatewayError = class extends AppError {
  constructor(message = "Upstream service error") {
    super(message, 502, "BAD_GATEWAY", true);
  }
};
var GatewayTimeoutError = class extends AppError {
  constructor(message = "Upstream service timeout") {
    super(message, 504, "GATEWAY_TIMEOUT", true);
  }
};
function formatErrorResponse(error, requestId) {
  const isAppError = error instanceof AppError;
  return {
    data: null,
    meta: {
      requestId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    },
    error: {
      code: isAppError ? error.code : "INTERNAL_ERROR",
      message: isAppError && error.isOperational ? error.message : "Internal server error",
      details: isAppError ? error.details : void 0
    }
  };
}
function createErrorHandler(logger) {
  return function errorHandler(error, request, reply) {
    const logContext = {
      err: error,
      requestId: request.id,
      method: request.method,
      url: request.url,
      userId: request.headers["x-user-id"]
    };
    const isOperational = error instanceof AppError ? error.isOperational : false;
    if (isOperational) {
      logger.warn(logContext, "Operational error");
    } else {
      logger.error(logContext, "Unexpected error");
    }
    if (error.validation) {
      const appError = new ValidationError("Request validation failed", {
        validation: error.validation
      });
      return reply.status(400).send(formatErrorResponse(appError, request.id));
    }
    if (error instanceof AppError) {
      if (error instanceof RateLimitError && error.retryAfter) {
        reply.header("Retry-After", error.retryAfter);
      }
      return reply.status(error.statusCode).send(formatErrorResponse(error, request.id));
    }
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send(formatErrorResponse(error, request.id));
  };
}
function asyncHandler(fn) {
  return async (request, reply) => {
    try {
      return await fn(request, reply);
    } catch (error) {
      throw error;
    }
  };
}
function createNotFoundHandler(logger) {
  return function notFoundHandler(request, reply) {
    logger.debug({ method: request.method, url: request.url }, "Route not found");
    const error = new NotFoundError("Route");
    return reply.status(404).send(formatErrorResponse(error, request.id));
  };
}
export {
  AppError,
  AuthenticationError,
  AuthorizationError,
  BadGatewayError,
  ConflictError,
  GatewayTimeoutError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
  asyncHandler,
  createErrorHandler,
  createNotFoundHandler,
  formatErrorResponse
};
//# sourceMappingURL=index.js.map