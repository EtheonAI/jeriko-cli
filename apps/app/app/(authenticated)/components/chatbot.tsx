'use client';
import { Message } from '@repo/ai/components/message';
import { Thread } from '@repo/ai/components/thread';
import { useChat } from '@repo/ai/lib/react';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import { handleError } from '@repo/design-system/lib/utils';
import { DefaultChatTransport } from '@repo/ai';
import { SendIcon } from 'lucide-react';
import { useState } from 'react';

export const Chatbot = () => {
  const [input, setInput] = useState('');
  
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    onError: handleError,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    sendMessage({ text: input });
    setInput('');
  };

  const isLoading = status === 'streaming' || status === 'submitted';

  return (
    <div className="flex h-[calc(100vh-64px-16px)] flex-col divide-y overflow-hidden">
      <Thread>
        {messages.map((message) => (
          <Message key={message.id} data={message} />
        ))}
      </Thread>
      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 items-center gap-2 px-8 py-4"
        aria-disabled={isLoading}
      >
        <Input
          placeholder="Ask a question!"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading}>
          <SendIcon className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};