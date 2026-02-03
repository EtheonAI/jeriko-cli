import { streamText, convertToModelMessages as aiConvertToModelMessages } from 'ai';
import { sanitizeMessages } from '@repo/ai';
import { log } from '@repo/observability/log';
import { models } from '@repo/ai/lib/models';
import type { UIMessage } from '@repo/ai/lib/types/ui-message';

export const maxDuration = 60;

export const POST = async (req: Request) => {
  try {
    const body = await req.json();
    log.info('🤖 Chat request received.');

    const { messages } = body as { messages: UIMessage[] };

    // Validate messages
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Sanitize messages
    const sanitized = sanitizeMessages(messages);

    // Convert to AI SDK model messages
    const modelMessages = await aiConvertToModelMessages(sanitized as Parameters<typeof aiConvertToModelMessages>[0]);

    log.info('🤖 Generating response...', { messageCount: modelMessages.length });

    const result = streamText({
      model: models.chat,
      system: 'You are Rubic, a helpful AI assistant. Be concise, helpful, and friendly.',
      messages: modelMessages,
    });

    log.info('🤖 Streaming response...');

    return result.toTextStreamResponse();
  } catch (error) {
    log.error('🤖 Chat error:', error as Error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};