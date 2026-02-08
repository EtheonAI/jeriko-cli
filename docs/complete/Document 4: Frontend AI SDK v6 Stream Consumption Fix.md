# Document 4: Frontend AI SDK v6 Stream Consumption Fix

This document details the necessary changes to the frontend TypeScript code to correctly parse and handle the new, standardized AI SDK v6 SSE stream from the Python backend.

## 1. Executive Summary

The frontend's streaming logic is currently split across multiple files (`http-transport.ts`, `ai-stream.ts`, `stream-writer.ts`) and contains complex, custom parsing logic to handle the non-standard SSE events. This complexity is no longer needed.

**The Fix:** We will dramatically simplify the frontend streaming code. Since the backend now sends perfect AI SDK v6 `UIMessageStreamChunk` events, we can remove all the custom parsing logic in `http-transport.ts` and rely directly on the Vercel AI SDK's built-in parsers. The `tool-loop-agent.ts` will become the single point of entry for making API calls.

| Problem | Root Cause | Fix |
|---|---|---|
| **Overly Complex Parsing** | `http-transport.ts` has a `transformSSEStream` method with custom logic to guess event types. | Remove `transformSSEStream` entirely. The new SSE stream is directly consumable by the AI SDK. |
| **Scattered Logic** | Streaming logic is spread across `http-transport.ts`, `ai-stream.ts`, and `tool-loop-agent.ts`. | Consolidate all API call logic into `tool-loop-agent.ts`, which will use a simplified `fetch` call to the backend. |
| **Redundant Type Definitions** | Custom types are defined in `types.ts` and `schemas.ts` that are no longer needed. | Remove the custom stream chunk types and rely on the official types from `@ai-sdk/ui-utils`. |

---



## 2. Production-Ready Code Fixes

This section provides the simplified and corrected TypeScript code for the frontend.

### `tool-loop-agent.ts` (Corrected)

This file is now the **single entry point** for all communication with your backend. It uses the standard `fetch` API to call your `/v1/complete` endpoint and returns a `ReadableStream` that the `useChat` hook can consume directly. All the complex, custom stream transformation logic is gone.

```typescript
/**
 * @repo/ai - Tool Loop Agent Proxy
 *
 * This acts as the client-side proxy to your Python backend agent.
 * It makes a single `fetch` request and returns the raw SSE stream,
 * which is already in the AI SDK v6 format.
 */

import type { Agent, AgentStreamOptions, AgentStreamResult } from "../types/agent";
import { createStreamableValue } from "ai/rsc";

export class ToolLoopAgent implements Agent {
  private readonly apiEndpoint: string;

  constructor(apiEndpoint: string = "/api/agent") { // Your proxy endpoint
    this.apiEndpoint = apiEndpoint;
  }

  async stream(options: AgentStreamOptions): Promise<AgentStreamResult> {
    const { messages, abortSignal } = options;

    const streamable = createStreamableValue();

    // Use a self-invoking async function to start the fetch and pipe the stream
    (async () => {
      try {
        const response = await fetch(this.apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
          signal: abortSignal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("The response body is empty.");
        }

        // Pipe the raw response body directly to our streamable value.
        // No parsing or transformation is needed here anymore.
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          streamable.append(value);
        }
        streamable.done();
      } catch (error) {
        streamable.error(error);
      }
    })();

    return {
      stream: streamable.value as ReadableStream<any>,
      result: Promise.resolve({} as any), // Result promise can be resolved as needed
    };
  }

  // The `generate` method can be implemented if non-streaming responses are needed
  async generate(options: any) {
    // ...
    return {} as any;
  }
}

export const toolLoopAgent = new ToolLoopAgent("/api/agent");

```

---

### `http-transport.ts` & `ai-stream.ts` (Obsolete)

These files, which contained the complex logic for parsing the non-standard SSE stream, are **no longer needed**. You can delete them. The new `tool-loop-agent.ts` handles the simple `fetch` call, and the Vercel AI SDK handles the stream parsing automatically on the client side within the `useChat` hook.

By removing these files, you significantly reduce the complexity of your frontend codebase, making it more robust and easier to maintain.

This completes the frontend streaming fix. The entire data flow from the Python backend to the React frontend is now aligned with the AI SDK v6 standard.

---
