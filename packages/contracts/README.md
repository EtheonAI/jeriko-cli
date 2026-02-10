# @repo/contracts

Type-safe contracts for orchestrator communication between the agent service and frontend.

## Overview

This package provides Zod schemas, TypeScript types, and format adapters for:

- **SSE Events**: Server-Sent Events from agent service → frontend
- **Tool Definitions**: Tool schemas and input validation
- **Messages**: Message, session, and API key schemas
- **Format Adapters**: SSE parsing/formatting and tool format conversion

## Installation

```bash
pnpm add @repo/contracts
```

## Usage

### Event Validation

```typescript
import { SSEEventSchema, parseSSEEvent } from "@repo/contracts";

// Parse SSE string
const event = parseSSEEvent('data: {"type":"content","content":"Hello","timestamp":123}\n\n');

// Validate event
const validated = SSEEventSchema.parse(event);

// Type-safe access
if (validated.type === "tool_call_started") {
  console.log(validated.toolCallId, validated.tool);
}
```

### Tool Schema Validation

```typescript
import { FileReadInputSchema, ShellExecInputSchema } from "@repo/contracts";

// Validate tool inputs
const fileInput = FileReadInputSchema.parse({ path: "/home/user/file.txt" });
const shellInput = ShellExecInputSchema.parse({
  session_id: "shell_001",
  command: "ls -la",
  timeout: 30,
});
```

### Format Conversion

```typescript
import {
  anthropicToOpenAI,
  openAIToAnthropic,
  formatSSEEvent,
} from '@repo/contracts/adapters';

// Convert tool formats
const anthropicTool = { name: 'file_read', description: '...', input_schema: {...} };
const openAITool = anthropicToOpenAI(anthropicTool);

// Format SSE events
const sseString = formatSSEEvent({
  type: 'content',
  content: 'Hello',
  timestamp: Date.now(),
});
```

## Available Schemas

### Events (23 total)

- Session: `session_created`, `session_reconnected`, `session_expired`, `session_terminated`
- Sandbox: `sandbox_info`, `neko_ready`
- Tools: `tool_call_started`, `tool_stream_chunk`, `tool_call_completed`, `tool_call_failed`
- Files: `file_created`, `file_updated`, `file_read`
- Browser: `browser_frame`, `browser_state`
- Content: `content`, `reasoning`, `reasoning_end`, `source_url`, `usage`, `error`, `warning`

### Tool Inputs (17 total)

- Planning: `show_plan`
- Communication: `message_notify_user`, `message_ask_user`
- File System: `file_read`, `file_write`, `file_edit`, `file_search`, `directory_list`, `directory_tree`
- Shell: `shell_create`, `shell_exec`, `shell_read`, `shell_kill`
- Browser: `browser_action`, `browser_extract`
- Search: `web_search`, `web_fetch`
- Code: `python_run`, `node_run`
- Image: `image_generate`

## Testing

All contracts are fully tested with 66 tests covering:

- Schema validation
- Enum constraints
- Optional fields
- Type discrimination
- Roundtrip conversions

Run tests:

```bash
pnpm test
```

## Architecture

```
packages/contracts/
├── src/
│   ├── schemas/
│   │   ├── events.ts      # SSE event schemas
│   │   ├── tools.ts       # Tool input schemas
│   │   ├── messages.ts    # Message, session, API key schemas
│   │   └── index.ts
│   ├── adapters/
│   │   ├── sse-adapter.ts    # SSE parsing/formatting
│   │   ├── tool-adapter.ts   # Tool format conversion
│   │   └── index.ts
│   ├── types/
│   │   └── index.ts       # Type re-exports
│   └── index.ts           # Main exports
└── __tests__/             # Contract tests
```

## Contract Alignment

All schemas are validated against:

- Agent service: `services/agent/src/events.py`
- Agent service: `services/agent/src/tools_definitions.py`
- Frontend contracts: `apps/app/__tests__/contracts/`

## License

MIT
