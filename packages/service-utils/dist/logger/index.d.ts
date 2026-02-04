import pino from 'pino';

interface LoggerOptions {
    service: string;
    level?: string;
    pretty?: boolean;
}
declare function createLogger(options: LoggerOptions): pino.Logger<never, boolean>;
type Logger = ReturnType<typeof createLogger>;

export { type Logger, type LoggerOptions, createLogger };
