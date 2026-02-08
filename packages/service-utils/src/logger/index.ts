import pino from "pino";

export interface LoggerOptions {
  service: string;
  level?: string;
  pretty?: boolean;
}

/** Sensitive field paths to redact from logs */
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-gateway-secret"]',
  "headers.authorization",
  "headers.cookie",
  'headers["x-gateway-secret"]',
  "password",
  "token",
  "secret",
  "creditCard",
  "credit_card",
  "stripe_key",
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "ssn",
  "*.password",
  "*.token",
  "*.secret",
  "*.apiKey",
  "*.creditCard",
];

/** Custom serializers for common log objects */
const serializers = {
  err: pino.stdSerializers.err,
  error: (err: unknown) => {
    if (err instanceof Error) {
      const errRecord = err as unknown as Record<string, unknown>;
      return {
        type: err.constructor.name,
        message: err.message,
        stack: err.stack,
        ...(errRecord.code ? { code: errRecord.code } : {}),
        ...(errRecord.statusCode ? { statusCode: errRecord.statusCode } : {}),
      };
    }
    return err;
  },
  req: (req: Record<string, unknown>) => ({
    method: req.method,
    url: req.url,
    remoteAddress: req.remoteAddress,
  }),
};

export function createLogger(options: LoggerOptions) {
  const { service, level = "info", pretty = process.env.NODE_ENV !== "production" } = options;

  return pino({
    level,
    name: service,
    serializers,
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]",
    },
    // Format-version for structured log parsers
    formatters: {
      level(label) {
        return { level: label };
      },
      bindings(bindings) {
        return {
          service: bindings.name || service,
          env: process.env.NODE_ENV || "development",
          pid: bindings.pid,
          hostname: bindings.hostname,
        };
      },
    },
    ...(pretty && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    }),
    base: {
      service,
      env: process.env.NODE_ENV || "development",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;

/**
 * Create a child logger with additional context (e.g., requestId, userId).
 * Child loggers inherit all settings from the parent but add bound fields.
 */
export function createChildLogger(
  parent: Logger,
  context: Record<string, unknown>,
): Logger {
  return parent.child(context) as Logger;
}
