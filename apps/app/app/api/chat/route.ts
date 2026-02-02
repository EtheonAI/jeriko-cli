import { streamText, convertToModelMessages } from '@repo/ai';
import { log } from '@repo/observability/log';
import { models } from '@repo/ai/lib/models';

export const POST = async (req: Request) => {
  const body = await req.json();
  log.info('🤖 Chat request received.', { body });
  
  const { messages } = body;
  
  log.info('🤖 Generating response...');
  
  const result = streamText({
    model: models.chat,
    system: 'You are a helpful assistant.',
    messages: convertToModelMessages(messages), // Convert UIMessages to ModelMessages
  });
  
  log.info('🤖 Streaming response...');
  
  return result.toUIMessageStreamResponse(); // Changed from toDataStreamResponse
};