import pino from "pino";

export interface LoggerOptions {
  service: string;
  level?: string;
  pretty?: boolean;
}

export function createLogger(options: LoggerOptions) {
  const { service, level = "info", pretty = process.env.NODE_ENV !== "production" } = options;

  return pino({
    level,
    name: service,
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
