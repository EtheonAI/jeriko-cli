# AI SDK V6 Implementation Guide for Rubic

## Overview

Rubic uses Vercel AI SDK V6 for the chat interface. This document captures the critical patterns, breaking changes, and implementation requirements.

**IMPORTANT**: Rubic's agent handles model selection internally. Users NEVER choose the model - the agent routes to the appropriate model based on task complexity.

---

## V6 Breaking Changes (Critical)

### 1. useChat Transport Pattern

```tsx
// OLD (V5) - DO NOT USE
const { messages, handleSubmit } = useChat({ api: "/api/chat" });

// NEW (V6) - REQUIRED
import { useChat, DefaultChatTransport } from "@ai-sdk/react";

const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});
```

### 2. Sending Messages

```tsx
// OLD (V5)
handleSubmit(e);
append({ role: "user", content: input });

// NEW (V6)
sendMessage({ text: input });
sendMessage({ text: input, files: [file1, file2] });
```

### 3. Message Structure

```tsx
// OLD (V5)
message.content; // string

// NEW (V6) - Parts-based
message.parts.map((part) => {
  switch (part.type) {
    case "text":
      return part.text;
    case "tool-invocation":
      return renderToolCall(part);
    case "source-url":
      return renderSource(part);
    case "file":
      return renderFile(part);
    case "reasoning":
      return renderReasoning(part);
  }
});
```

### 4. Server Response

```ts
// OLD (V5)
return new StreamingTextResponse(stream);

// NEW (V6)
const result = streamText({
  model: resolvedModel,
  messages: await convertToModelMessages(messages), // ASYNC now
});
return result.toUIMessageStreamResponse();
```

### 5. Type Renames

- `CoreMessage` → `ModelMessage`
- `Experimental_Agent` → `ToolLoopAgent`
- `system` option → `instructions` option

---

## Stream Protocol (SSE Format)

The AI SDK V6 uses Server-Sent Events with specific JSON message types:

```
data: {"type":"text-delta","id":"text-123","delta":"Hello"}
data: {"type":"text-delta","id":"text-123","delta":" world"}
data: {"type":"tool-input-start","toolCallId":"call-456","toolName":"search_web"}
data: {"type":"tool-input-delta","toolCallId":"call-456","delta":"{\"query\":"}
data: {"type":"tool-input-available","toolCallId":"call-456","input":{"query":"weather"}}
data: {"type":"tool-output-available","toolCallId":"call-456","output":{"result":"sunny"}}
data: {"type":"finish","finishReason":"stop"}
data: [DONE]
```

### Stream Codes (Data Stream Format)

When using data stream format (not SSE), prefix codes are used:

- `0:` - Text delta
- `9:` - Tool call start
- `a:` - Tool call delta
- `b:` - Tool result
- `c:` - Sources
- `d:` - Finish
- `e:` - Usage/metadata
- `f:` - Tool status events
- `3:` - Error

---

## Tool Part States

Tool invocations have four states that MUST be handled in the UI:

```tsx
function ToolInvocation({ part }: { part: ToolInvocationPart }) {
  switch (part.state) {
    case "input-streaming":
      // Tool input is being streamed
      return <ToolStreaming name={part.toolName} partialInput={part.input} />;

    case "input-available":
      // Tool input complete, waiting for execution
      return <ToolPending name={part.toolName} input={part.input} />;

    case "output-available":
      // Tool executed successfully
      return <ToolResult name={part.toolName} output={part.output} />;

    case "output-error":
      // Tool execution failed
      return <ToolError name={part.toolName} error={part.error} />;
  }
}
```

---

## ToolLoopAgent Pattern

For building agents with tool loops:

```ts
import { ToolLoopAgent, stepCountIs, hasToolCalls, streamText } from 'ai';

const agent = new ToolLoopAgent({
  model: resolvedModel,
  instructions: systemPrompt,
  tools: {
    search_web: {
      description: 'Search the web for information',
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        // Execute tool
        return { results: [...] };
      },
    },
    // ... more tools
  },
  stopWhen: stepCountIs(20), // Default in V6
});

// In API route:
return createAgentUIStreamResponse({ agent, uiMessages: messages });
```

---

## Client-Side Tools

For tools that run in the browser (not server):

```tsx
const { messages, sendMessage, addToolOutput } = useChat({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
  onToolCall: async ({ toolCall }) => {
    if (toolCall.toolName === "get_location") {
      const position = await getCurrentPosition();
      // Return result to continue the conversation
      return { lat: position.coords.latitude, lng: position.coords.longitude };
    }
  },
});

// Or manually add output:
addToolOutput({ toolCallId: "call-123", output: { result: "data" } });
```

---

## Auto-Continue After Tool Calls

To automatically send tool results back to the model:

```tsx
const { messages, sendMessage } = useChat({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
});
```

---

## Rubic-Specific Implementation

### System Prompt Structure (Manus-Aligned)

```xml
<intro>
You are Rubic, a powerful AI assistant...
</intro>

<system_capability>
- Execute code in sandboxed environment
- Browse the web with full browser control
- Search the web for current information
- Read, write, and manage files
- Control connected devices and smart home
- Access user's connected applications
</system_capability>

<agent_loop>
1. Analyze events and user messages
2. Select appropriate tools
3. Wait for tool execution
4. Iterate until task complete
5. Submit results to user
6. Enter standby mode
</agent_loop>

<tool_use_rules>
- Always respond with tool calls, not plain text
- Use message_notify_user for status updates
- Use message_ask_user when clarification needed
</tool_use_rules>

<connected_apps>
${connectorsList}
</connected_apps>

<available_skills>
${skillsList}
</available_skills>
```

### Tool Categories for Rubic

1. **Communication Tools**

   - `message_notify_user` - Send status/progress to user
   - `message_ask_user` - Ask user for input/clarification

2. **File Tools**

   - `file_read` - Read file contents
   - `file_write` - Write/create files
   - `file_str_replace` - Replace text in files
   - `file_find_in_content` - Search file contents
   - `file_find_by_name` - Find files by name pattern

3. **Shell Tools**

   - `shell_exec` - Execute shell commands
   - `shell_view` - View shell output
   - `shell_wait` - Wait for command completion
   - `shell_write_to_process` - Write to running process
   - `shell_kill_process` - Kill a process

4. **Browser Tools**

   - `browser_navigate` - Navigate to URL
   - `browser_view` - Take screenshot/view page
   - `browser_click` - Click element
   - `browser_input` - Type into element
   - `browser_scroll_up/down` - Scroll page
   - `browser_press_key` - Press keyboard key
   - `browser_select_option` - Select dropdown option
   - `browser_console_exec` - Execute JavaScript
   - `browser_console_view` - View console logs
   - `browser_restart` - Restart browser

5. **Search Tools**

   - `search_web` - Search the internet

6. **Code Tools**

   - `code_execute` - Run code in sandbox

7. **Deploy Tools**

   - `deploy_expose_port` - Expose port for preview
   - `deploy_apply` - Deploy to production

8. **Device Tools** (Rubic-specific)

   - `device_list` - List connected devices
   - `device_control` - Control a device
   - `device_status` - Get device status

9. **Connector Tools** (Rubic-specific)

   - `connector_list` - List available connectors
   - `connector_execute` - Execute connector action

10. **Image Tools**

    - `image_generate` - Generate images with AI

11. **Schedule Tools**
    - `schedule_task` - Schedule future task

---

## Error Handling

```tsx
const { error, status } = useChat({...});

// Status values: 'idle' | 'submitted' | 'streaming' | 'error' | 'ready'

if (status === 'error') {
  return <ErrorDisplay error={error} onRetry={() => regenerate()} />;
}
```

---

## Testing Checklist

Before deployment, verify:

- [ ] Messages stream character-by-character (not buffered)
- [ ] Tool calls render with correct states (streaming → pending → complete)
- [ ] Tool errors display properly
- [ ] Stop button works during streaming
- [ ] Regenerate works for last assistant message
- [ ] Messages persist to database
- [ ] Messages survive page refresh
- [ ] WebSocket connection shows status
- [ ] File attachments upload and display
- [ ] Sources render as citations
- [ ] Empty state shows correctly
- [ ] Auto-scroll works but respects user scroll position

---

## File Locations

- Chat API Route: `apps/app/app/api/chat/route.ts`
- Chat Client: `apps/app/app/(authenticated)/chat/[id]/chat-page-client.tsx`
- useRealTimeChat Hook: `packages/ai/hooks/use-real-time-chat.ts`
- Message Components: `packages/ai/components/chat/`
- Stream Types: `packages/ai/lib/types/stream-chunks.ts`
- HTTP Transport: `packages/ai/lib/transport/http-transport.ts`
- Agent Service: `services/agent/src/`
