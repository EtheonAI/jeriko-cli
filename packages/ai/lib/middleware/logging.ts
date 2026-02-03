/**
 * @repo/ai - Logging Middleware
 *
 * Comprehensive logging middleware for AI agent operations.
 * Supports multiple log levels, structured logging, and custom outputs.
 */

import type {
  AgentMiddleware,
  AgentGenerateOptions,
  AgentGenerateResult,
  AgentStreamChunk,
} from '../agents/types';

// ============================================================================
// Logging Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  /** Timestamp */
  timestamp: Date;

  /** Log level */
  level: LogLevel;

  /** Event type */
  event: string;

  /** Log message */
  message: string;

  /** Additional data */
  data?: Record<string, unknown>;

  /** Duration (for timed events) */
  duration?: number;

  /** Request ID */
  requestId?: string;

  /** Session ID */
  sessionId?: string;
}

export interface LogTransport {
  /** Log entry handler */
  log(entry: LogEntry): void;
}

// ============================================================================
// Built-in Transports
// ============================================================================

export class ConsoleTransport implements LogTransport {
  private colors: Record<LogLevel, string> = {
    debug: '\x1b[90m', // Gray
    info: '\x1b[36m',  // Cyan
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
  };
  private reset = '\x1b[0m';

  log(entry: LogEntry): void {
    const color = this.colors[entry.level];
    const time = entry.timestamp.toISOString();
    const duration = entry.duration ? ` (${entry.duration}ms)` : '';

    console.log(
      `${color}[${entry.level.toUpperCase()}]${this.reset} ${time} [${entry.event}] ${entry.message}${duration}`
    );

    if (entry.data && Object.keys(entry.data).length > 0) {
      console.log(`  ${JSON.stringify(entry.data, null, 2).split('\n').join('\n  ')}`);
    }
  }
}

export class JSONTransport implements LogTransport {
  log(entry: LogEntry): void {
    console.log(JSON.stringify(entry));
  }
}

export class ArrayTransport implements LogTransport {
  public entries: LogEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  log(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  clear(): void {
    this.entries = [];
  }

  getEntries(filter?: { level?: LogLevel; event?: string }): LogEntry[] {
    if (!filter) return this.entries;

    return this.entries.filter((e) => {
      if (filter.level && e.level !== filter.level) return false;
      if (filter.event && e.event !== filter.event) return false;
      return true;
    });
  }
}

export class CallbackTransport implements LogTransport {
  constructor(private callback: (entry: LogEntry) => void) {}

  log(entry: LogEntry): void {
    this.callback(entry);
  }
}

// ============================================================================
// Logger Class
// ============================================================================

export class Logger {
  private transports: LogTransport[];
  private minLevel: LogLevel;
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };
  private requestId?: string;
  private sessionId?: string;

  constructor(
    transports: LogTransport[] = [new ConsoleTransport()],
    minLevel: LogLevel = 'info'
  ) {
    this.transports = transports;
    this.minLevel = minLevel;
  }

  setContext(context: { requestId?: string; sessionId?: string }): void {
    this.requestId = context.requestId;
    this.sessionId = context.sessionId;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  private log(level: LogLevel, event: string, message: string, data?: Record<string, unknown>, duration?: number): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      event,
      message,
      data,
      duration,
      requestId: this.requestId,
      sessionId: this.sessionId,
    };

    for (const transport of this.transports) {
      transport.log(entry);
    }
  }

  debug(event: string, message: string, data?: Record<string, unknown>): void {
    this.log('debug', event, message, data);
  }

  info(event: string, message: string, data?: Record<string, unknown>): void {
    this.log('info', event, message, data);
  }

  warn(event: string, message: string, data?: Record<string, unknown>): void {
    this.log('warn', event, message, data);
  }

  error(event: string, message: string, data?: Record<string, unknown>): void {
    this.log('error', event, message, data);
  }

  timed<T>(event: string, message: string, fn: () => T | Promise<T>, data?: Record<string, unknown>): Promise<T> {
    const start = Date.now();

    const logResult = (result: T, error?: Error): T => {
      const duration = Date.now() - start;

      if (error) {
        this.log('error', event, `${message} - Failed: ${error.message}`, { ...data, error: error.message }, duration);
        throw error;
      }

      this.log('info', event, `${message} - Completed`, data, duration);
      return result;
    };

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result.then((r) => logResult(r)).catch((e) => {
          logResult(undefined as T, e);
          return Promise.reject(e);
        });
      }

      return Promise.resolve(logResult(result));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logResult(undefined as T, err);
      return Promise.reject(err);
    }
  }
}

// ============================================================================
// Logging Middleware
// ============================================================================

export interface LoggingMiddlewareConfig {
  /** Logger instance */
  logger?: Logger;

  /** Log transports */
  transports?: LogTransport[];

  /** Minimum log level */
  minLevel?: LogLevel;

  /** Log request details */
  logRequests?: boolean;

  /** Log response details */
  logResponses?: boolean;

  /** Log stream chunks */
  logStreamChunks?: boolean;

  /** Log tool calls */
  logToolCalls?: boolean;

  /** Redact sensitive data */
  redactSensitive?: boolean;

  /** Sensitive field patterns */
  sensitivePatterns?: RegExp[];

  /** Request ID generator */
  generateRequestId?: () => string;
}

export function createLoggingMiddleware(
  config: LoggingMiddlewareConfig = {}
): AgentMiddleware {
  const logger = config.logger ?? new Logger(
    config.transports ?? [new ConsoleTransport()],
    config.minLevel ?? 'info'
  );

  const {
    logRequests = true,
    logResponses = true,
    logStreamChunks = false,
    logToolCalls = true,
    redactSensitive = true,
    sensitivePatterns = [/password/i, /secret/i, /token/i, /api[_-]?key/i, /auth/i],
    generateRequestId = () => `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  } = config;

  let requestStartTime: number;

  const redact = (data: unknown): unknown => {
    if (!redactSensitive || !data) return data;

    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(redact);
    }

    if (typeof data === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const isSensitive = sensitivePatterns.some((p) => p.test(key));
        result[key] = isSensitive ? '[REDACTED]' : redact(value);
      }
      return result;
    }

    return data;
  };

  return {
    name: 'logging',

    async beforeGenerate(options: AgentGenerateOptions): Promise<AgentGenerateOptions> {
      const requestId = generateRequestId();
      requestStartTime = Date.now();

      logger.setContext({ requestId });

      if (logRequests) {
        const messageCount = options.messages.length;
        const lastMessage = options.messages[options.messages.length - 1];
        const preview = lastMessage?.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { text: string }).text)
          .join(' ')
          .slice(0, 100);

        logger.info('agent:request', `New request with ${messageCount} messages`, {
          messageCount,
          preview: preview ? `${preview}...` : undefined,
        });
      }

      return options;
    },

    async afterGenerate(result: AgentGenerateResult): Promise<AgentGenerateResult> {
      const duration = Date.now() - requestStartTime;

      if (logResponses) {
        const textParts = result.message.parts.filter((p) => p.type === 'text');
        const responseText = textParts
          .map((p) => (p as { text: string }).text)
          .join(' ')
          .slice(0, 100);

        logger.info('agent:response', `Response generated`, {
          finishReason: result.finishReason,
          steps: result.steps.length,
          usage: result.usage,
          preview: responseText ? `${responseText}...` : undefined,
          duration,
        });
      }

      if (logToolCalls) {
        for (const step of result.steps) {
          if (step.toolCalls?.length) {
            for (const call of step.toolCalls) {
              logger.debug('agent:tool-call', `Tool called: ${call.toolName}`, {
                toolName: call.toolName,
                toolCallId: call.toolCallId,
                input: redact(call.input),
              });
            }
          }

          if (step.toolResults?.length) {
            for (const res of step.toolResults) {
              logger.debug('agent:tool-result', `Tool result: ${res.toolName}`, {
                toolName: res.toolName,
                toolCallId: res.toolCallId,
                isError: res.isError,
                duration: res.duration,
              });
            }
          }
        }
      }

      return result;
    },

    transformChunk(chunk: AgentStreamChunk): AgentStreamChunk | null {
      if (logStreamChunks) {
        switch (chunk.type) {
          case 'step-start':
            logger.debug('stream:step-start', `Step ${chunk.stepNumber} started`);
            break;
          case 'step-end':
            logger.debug('stream:step-end', `Step ${chunk.stepNumber} ended`);
            break;
          case 'tool-call-start':
            logger.debug('stream:tool-start', `Tool ${chunk.toolName} starting`, {
              toolCallId: chunk.toolCallId,
            });
            break;
          case 'tool-call-result':
            logger.debug('stream:tool-result', `Tool result received`, {
              toolCallId: chunk.toolCallId,
              isError: chunk.isError,
            });
            break;
          case 'error':
            logger.error('stream:error', chunk.error);
            break;
          case 'finish':
            logger.debug('stream:finish', `Stream finished: ${chunk.finishReason}`, {
              usage: chunk.usage,
            });
            break;
        }
      }

      return chunk;
    },
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createLogger(
  transports?: LogTransport[],
  minLevel?: LogLevel
): Logger {
  return new Logger(transports, minLevel);
}

export function createConsoleLogger(minLevel: LogLevel = 'info'): Logger {
  return new Logger([new ConsoleTransport()], minLevel);
}

export function createJSONLogger(minLevel: LogLevel = 'info'): Logger {
  return new Logger([new JSONTransport()], minLevel);
}
