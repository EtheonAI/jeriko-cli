// src/logger/index.ts
import pino from "pino";
function createLogger(options) {
  const { service, level = "info", pretty = process.env.NODE_ENV !== "production" } = options;
  return pino({
    level,
    name: service,
    ...pretty && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname"
        }
      }
    },
    base: {
      service,
      env: process.env.NODE_ENV || "development"
    },
    timestamp: pino.stdTimeFunctions.isoTime
  });
}
export {
  createLogger
};
//# sourceMappingURL=index.js.map