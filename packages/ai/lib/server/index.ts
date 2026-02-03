/**
 * @repo/ai - Server Utilities
 *
 * Server-side utilities for AI streaming and response handling.
 */

export {
  ServerStreamWriter,
  createStreamResponse,
  createDataStream,
  pipeAsyncGeneratorToWriter,
  createTextStream,
  type CreateStreamOptions,
  type StreamWriterOptions,
} from './stream-writer';

export {
  createAIStream,
  textStream,
  errorStream,
  type AIStreamOptions,
  type AIStreamResult,
  type ToolDefinition,
} from './ai-stream';

export {
  convertToModelMessages,
  sanitizeMessages,
} from './convert-messages';
