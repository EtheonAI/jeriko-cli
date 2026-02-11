# Part 3: Orchestrator, Agent Loop, and Session Management

> **This is the brain.** The orchestrator receives user messages, builds context, calls the LLM with tools, routes tool executions, streams results, and manages the entire conversation lifecycle. Everything flows through here.

---

## 1. The Agent Loop — The Core of Everything

Manus's agent loop is: **Plan → Act → Observe → Repeat → Respond.** The AI SDK's `streamText()` with `maxSteps` implements this entire loop in one function call.

### 1.1 The Complete Agent Loop Implementation

```typescript
// src/server/orchestrator/agent-loop.ts

import { streamText, generateText, StreamTextResult } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { buildSystemPrompt } from './context-builder';
import { createToolSet } from '../tools/definitions';
import { buildConversationHistory } from './history-builder';
import type { Session, User, ToolContext } from '../../shared/types';
import type { WebSocketServer } from '../websocket';
import type { SandboxManager } from '../sandbox/manager';
import type { DatabaseClient } from '../db/queries';
import type { StorageClient } from '../storage';
import type { SearchProvider } from '../search';

interface AgentLoopConfig {
  session: Session;
  user: User;
  userMessage: string;
  ws: WebSocketServer;
  sandboxManager: SandboxManager;
  db: DatabaseClient;
  storage: StorageClient;
  searchProvider: SearchProvider;
}

export async function runAgentLoop(config: AgentLoopConfig): Promise<void> {
  const { session, user, userMessage, ws, sandboxManager, db, storage, searchProvider } = config;

  // ============================================================
  // STEP 1: Persist the user message
  // ============================================================
  await db.insertMessage({
    sessionId: session.id,
    role: 'user',
    content: userMessage,
    contentType: 'text',
  });

  // Broadcast user message to all connected clients for this session
  ws.emit(session.id, {
    type: 'message',
    role: 'user',
    content: userMessage,
    timestamp: Date.now(),
  });

  // ============================================================
  // STEP 2: Acquire or reuse sandbox
  // ============================================================
  // ONE sandbox per user, shared across sessions
  // This is how Manus works — not one sandbox per task
  const sandbox = await sandboxManager.acquireForUser(user.id);

  // ============================================================
  // STEP 3: Build the tool context
  // ============================================================
  // The tool context is passed to every tool's execute function
  // It contains everything a tool needs to do its job
  const toolContext: ToolContext = {
    sessionId: session.id,
    userId: user.id,
    sandbox,
    sandboxProcesses: new Map(), // Active interactive processes
    ws,
    db,
    storage,
    searchProvider,
    sandboxPool: sandboxManager, // For map tool to spawn subtask sandboxes
    imageProvider: createImageProvider(), // DALL-E or Flux
    scheduler: createScheduler(), // BullMQ
  };

  // ============================================================
  // STEP 4: Build conversation history
  // ============================================================
  // This includes all previous messages AND tool calls/results
  // Manus uses "context compaction" for long conversations
  const history = await buildConversationHistory(session.id, db);

  // ============================================================
  // STEP 5: Build the system prompt
  // ============================================================
  const systemPrompt = buildSystemPrompt(session, user);

  // ============================================================
  // STEP 6: Create the tool set
  // ============================================================
  const tools = createToolSet(toolContext);

  // ============================================================
  // STEP 7: Run the agent loop via AI SDK streamText
  // ============================================================
  // This is THE agent loop. streamText with maxSteps will:
  // 1. Send system prompt + history + tools to Claude
  // 2. Claude returns a tool call (or text)
  // 3. AI SDK executes the tool's execute() function
  // 4. AI SDK feeds the result back to Claude
  // 5. Repeat until Claude stops calling tools OR maxSteps reached
  
  let taskComplete = false;
  let waitingForUser = false;
  let totalTokensUsed = 0;
  let stepCount = 0;

  try {
    const result = streamText({
      // PRIMARY MODEL: Claude Sonnet 4
      // This is the ONLY model running the agent loop
      // There is NO secondary model "inside E2B"
      model: anthropic('claude-sonnet-4-20250514'),

      system: systemPrompt,

      messages: [
        ...history,
        { role: 'user', content: userMessage }
      ],

      tools,

      // Maximum number of tool-call rounds
      // Each "step" is one LLM call that may produce tool calls
      // Manus typically allows 25-50 steps per task
      maxSteps: 30,

      // Temperature: 0 for deterministic tool calling
      temperature: 0,

      // ============================================================
      // STEP 8: Handle each step completion
      // ============================================================
      onStepFinish: async (step) => {
        stepCount++;

        // Track token usage
        totalTokensUsed += step.usage?.totalTokens || 0;

        // Persist tool calls to database
        if (step.toolCalls && step.toolCalls.length > 0) {
          for (const toolCall of step.toolCalls) {
            await db.insertToolCall({
              sessionId: session.id,
              toolName: toolCall.toolName,
              args: toolCall.args,
              status: 'completed',
            });

            // Broadcast tool call to frontend
            ws.emit(session.id, {
              type: 'tool_call',
              toolName: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              args: toolCall.args,
              status: 'started',
              timestamp: Date.now(),
            });
          }
        }

        // Persist tool results
        if (step.toolResults && step.toolResults.length > 0) {
          for (const toolResult of step.toolResults) {
            await db.updateToolCallResult(toolResult.toolCallId, {
              result: toolResult.result,
              status: 'completed',
            });

            // Broadcast tool result to frontend
            ws.emit(session.id, {
              type: 'tool_result',
              toolCallId: toolResult.toolCallId,
              toolName: toolResult.toolName,
              result: toolResult.result,
              status: 'completed',
              timestamp: Date.now(),
            });

            // Check if the message tool was called with special types
            if (toolResult.toolName === 'message') {
              const messageResult = toolResult.result as any;
              if (messageResult.status === 'task_complete') {
                taskComplete = true;
              }
              if (messageResult.status === 'waiting_for_user') {
                waitingForUser = true;
              }
            }
          }
        }

        // If agent sent a "result" message, the task is done
        // If agent sent an "ask" message, we need to wait for user
        // The AI SDK will stop the loop when the model stops calling tools
      },

      // ============================================================
      // STEP 9: Handle streaming text chunks
      // ============================================================
      // Note: In Manus's architecture, the agent almost never produces
      // raw text — it always uses the message tool instead.
      // But we handle it just in case.
      onChunk: async (chunk) => {
        if (chunk.type === 'text-delta') {
          ws.emit(session.id, {
            type: 'text_delta',
            content: chunk.textDelta,
          });
        }
      },
    });

    // ============================================================
    // STEP 10: Wait for the stream to complete
    // ============================================================
    // This blocks until all steps are done
    const finalResult = await result;

    // ============================================================
    // STEP 11: Post-loop cleanup
    // ============================================================
    
    // Track credit usage
    await db.updateSessionCredits(session.id, {
      tokensUsed: totalTokensUsed,
      toolCallsCount: stepCount,
    });

    // Broadcast task completion
    ws.emit(session.id, {
      type: 'task_finished',
      status: taskComplete ? 'completed' : waitingForUser ? 'waiting' : 'max_steps_reached',
      tokensUsed: totalTokensUsed,
      steps: stepCount,
    });

    // If waiting for user, update session state
    if (waitingForUser) {
      await db.updateSession(session.id, { status: 'waiting_for_user' });
    }

  } catch (error: any) {
    console.error('Agent loop error:', error);

    // Broadcast error to frontend
    ws.emit(session.id, {
      type: 'error',
      message: error.message || 'An unexpected error occurred',
      timestamp: Date.now(),
    });

    // Persist error
    await db.insertMessage({
      sessionId: session.id,
      role: 'system',
      content: `Agent error: ${error.message}`,
      contentType: 'error',
    });
  }
}
```

### 1.2 Why `streamText` with `maxSteps` IS the Agent Loop

This is the critical insight. Here is what happens inside `streamText` with `maxSteps: 30`:

```
Round 1:
  → Send system prompt + history + user message to Claude
  ← Claude returns: tool_call(plan, {action: "update", goal: "...", phases: [...]})
  → AI SDK calls plan.execute()
  → Result: {success: true, message: "Plan created"}
  → AI SDK adds tool result to messages

Round 2:
  → Send updated messages (now includes plan result) to Claude
  ← Claude returns: tool_call(shell, {action: "exec", command: "ls -la"})
  → AI SDK calls shell.execute()
  → Result: {stdout: "total 48\ndrwxr-xr-x...", exitCode: 0}
  → AI SDK adds tool result to messages

Round 3:
  → Send updated messages to Claude
  ← Claude returns: tool_call(file, {action: "write", path: "/home/user/app.py", text: "..."})
  → AI SDK calls file.execute()
  → Result: {status: "success", bytesWritten: 1234}
  → AI SDK adds tool result to messages

... (continues for up to 30 rounds)

Round N:
  → Send updated messages to Claude
  ← Claude returns: tool_call(message, {type: "result", text: "Here are your results..."})
  → AI SDK calls message.execute()
  → Result: {status: "task_complete"}
  → Claude sees task is complete, stops calling tools
  → Stream ends
```

**There is no separate "planner" and "executor."** Claude plans in Round 1, executes in Rounds 2-N, and delivers in Round N. One model, one loop, one conversation.

---

## 2. Context Building — The Conversation History

### 2.1 History Builder with Context Compaction

When conversations get long, you must compact older messages to fit within Claude's context window (200K tokens). Manus does this by summarizing older segments.

```typescript
// src/server/orchestrator/history-builder.ts

import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { DatabaseClient } from '../db/queries';
import type { CoreMessage } from 'ai';

const MAX_CONTEXT_TOKENS = 150000; // Leave room for system prompt + response
const COMPACTION_THRESHOLD = 120000;

export async function buildConversationHistory(
  sessionId: string,
  db: DatabaseClient
): Promise<CoreMessage[]> {
  
  // Fetch all messages and tool calls for this session
  const rawMessages = await db.getSessionMessages(sessionId);
  const toolCalls = await db.getSessionToolCalls(sessionId);

  // Convert to AI SDK message format
  const messages: CoreMessage[] = [];

  for (const msg of rawMessages) {
    if (msg.role === 'user') {
      messages.push({
        role: 'user',
        content: msg.content,
      });
    } else if (msg.role === 'assistant') {
      // Assistant messages may include tool calls
      const assistantToolCalls = toolCalls.filter(
        tc => tc.messageId === msg.id
      );

      if (assistantToolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: assistantToolCalls.map(tc => ({
            type: 'tool-call' as const,
            toolCallId: tc.id,
            toolName: tc.toolName,
            args: tc.args,
          })),
        });

        // Add tool results
        for (const tc of assistantToolCalls) {
          if (tc.result) {
            messages.push({
              role: 'tool',
              content: [{
                type: 'tool-result' as const,
                toolCallId: tc.id,
                toolName: tc.toolName,
                result: tc.result,
              }],
            });
          }
        }
      } else {
        messages.push({
          role: 'assistant',
          content: msg.content,
        });
      }
    }
  }

  // ============================================================
  // CONTEXT COMPACTION
  // ============================================================
  // Estimate token count (rough: 1 token ≈ 4 chars)
  const estimatedTokens = JSON.stringify(messages).length / 4;

  if (estimatedTokens > COMPACTION_THRESHOLD) {
    return await compactHistory(messages);
  }

  return messages;
}

async function compactHistory(messages: CoreMessage[]): Promise<CoreMessage[]> {
  // Keep the last 20 messages intact (recent context)
  const recentMessages = messages.slice(-20);
  const olderMessages = messages.slice(0, -20);

  if (olderMessages.length === 0) return recentMessages;

  // Summarize older messages using a cheaper model
  const summary = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'Summarize the following conversation history concisely. Preserve all key facts, decisions, file paths, variable names, and action outcomes. Do not lose any technical details.',
    messages: [{
      role: 'user',
      content: `Summarize this conversation:\n\n${JSON.stringify(olderMessages).substring(0, 50000)}`
    }],
    maxTokens: 4000,
  });

  // Return compacted history
  return [
    {
      role: 'user',
      content: `<compacted_history>\n${summary.text}\n</compacted_history>`
    },
    {
      role: 'assistant',
      content: 'I understand the previous context. Continuing from where we left off.'
    },
    ...recentMessages,
  ];
}
```

---

## 3. Session Management

### 3.1 Session Lifecycle

A session in Manus goes through these states:

```
created → active → (waiting_for_user ↔ active) → completed
                                                 → failed
                                                 → expired
```

```typescript
// src/server/orchestrator/session-manager.ts

import { nanoid } from 'nanoid';
import type { DatabaseClient } from '../db/queries';
import type { SandboxManager } from '../sandbox/manager';
import type { WebSocketServer } from '../websocket';

export class SessionManager {
  constructor(
    private db: DatabaseClient,
    private sandboxManager: SandboxManager,
    private ws: WebSocketServer,
  ) {}

  // ============================================================
  // CREATE SESSION
  // ============================================================
  async createSession(userId: string, title?: string): Promise<Session> {
    const session = await this.db.insertSession({
      id: nanoid(),
      userId,
      title: title || 'New Task',
      status: 'created',
      createdAt: new Date(),
      metadata: {
        model: 'claude-sonnet-4-20250514',
        tokensUsed: 0,
        toolCallsCount: 0,
      },
    });

    // Pre-warm sandbox for this user (if not already running)
    // This is async — don't await, let it warm in background
    this.sandboxManager.warmForUser(userId).catch(console.error);

    return session;
  }

  // ============================================================
  // RESUME SESSION
  // ============================================================
  // When user sends a new message to an existing session
  async resumeSession(sessionId: string): Promise<Session> {
    const session = await this.db.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    if (session.status === 'completed' || session.status === 'failed') {
      // Reactivate completed sessions
      await this.db.updateSession(sessionId, { status: 'active' });
    }

    if (session.status === 'waiting_for_user') {
      await this.db.updateSession(sessionId, { status: 'active' });
    }

    return { ...session, status: 'active' };
  }

  // ============================================================
  // LIST USER SESSIONS
  // ============================================================
  async listSessions(userId: string): Promise<Session[]> {
    return this.db.getSessionsByUser(userId, {
      orderBy: 'updatedAt',
      order: 'desc',
      limit: 50,
    });
  }

  // ============================================================
  // DELETE SESSION
  // ============================================================
  async deleteSession(sessionId: string): Promise<void> {
    // Delete messages, tool calls, plans, files
    await this.db.deleteSessionCascade(sessionId);
  }

  // ============================================================
  // GET SESSION STATE FOR FRONTEND
  // ============================================================
  // This is what gets sent when the frontend loads a session
  async getSessionState(sessionId: string): Promise<SessionState> {
    const [session, messages, plan, recentToolCalls] = await Promise.all([
      this.db.getSession(sessionId),
      this.db.getSessionMessages(sessionId, { limit: 50 }),
      this.db.getSessionPlan(sessionId),
      this.db.getSessionToolCalls(sessionId, { limit: 100 }),
    ]);

    return {
      session,
      messages,
      plan,
      toolCalls: recentToolCalls,
    };
  }
}
```

### 3.2 The HTTP API for Sessions

```typescript
// src/server/routes/sessions.ts

import { Router } from 'express';
import { SessionManager } from '../orchestrator/session-manager';
import { runAgentLoop } from '../orchestrator/agent-loop';
import { authMiddleware } from '../auth/middleware';

export function createSessionRoutes(
  sessionManager: SessionManager,
  agentDeps: AgentDependencies,
): Router {
  const router = Router();

  // ============================================================
  // POST /api/sessions — Create new session
  // ============================================================
  router.post('/api/sessions', authMiddleware, async (req, res) => {
    const session = await sessionManager.createSession(req.user.id, req.body.title);
    res.json(session);
  });

  // ============================================================
  // GET /api/sessions — List user's sessions
  // ============================================================
  router.get('/api/sessions', authMiddleware, async (req, res) => {
    const sessions = await sessionManager.listSessions(req.user.id);
    res.json(sessions);
  });

  // ============================================================
  // GET /api/sessions/:id — Get session state
  // ============================================================
  router.get('/api/sessions/:id', authMiddleware, async (req, res) => {
    const state = await sessionManager.getSessionState(req.params.id);
    res.json(state);
  });

  // ============================================================
  // POST /api/sessions/:id/messages — Send message (triggers agent loop)
  // ============================================================
  router.post('/api/sessions/:id/messages', authMiddleware, async (req, res) => {
    const { content, attachments } = req.body;
    const session = await sessionManager.resumeSession(req.params.id);
    const user = req.user;

    // Respond immediately — the agent loop runs async
    res.json({ status: 'processing', sessionId: session.id });

    // Run the agent loop in background
    // This is critical: the HTTP request returns immediately
    // All updates stream via WebSocket
    runAgentLoop({
      session,
      user,
      userMessage: content,
      ws: agentDeps.ws,
      sandboxManager: agentDeps.sandboxManager,
      db: agentDeps.db,
      storage: agentDeps.storage,
      searchProvider: agentDeps.searchProvider,
    }).catch(error => {
      console.error('Agent loop failed:', error);
      agentDeps.ws.emit(session.id, {
        type: 'error',
        message: error.message,
      });
    });
  });

  // ============================================================
  // DELETE /api/sessions/:id — Delete session
  // ============================================================
  router.delete('/api/sessions/:id', authMiddleware, async (req, res) => {
    await sessionManager.deleteSession(req.params.id);
    res.json({ status: 'deleted' });
  });

  return router;
}
```

---

## 4. The WebSocket Server

Every event from the agent loop streams to the frontend in real-time.

```typescript
// src/server/websocket.ts

import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { Server } from 'http';
import { verifyJWT } from './auth/jwt';

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  sessionId: string | null;
}

export class WebSocketServer {
  private wss: WSServer;
  private clients: Map<string, Set<ConnectedClient>> = new Map(); // sessionId → clients

  constructor(server: Server) {
    this.wss = new WSServer({ server, path: '/ws' });

    this.wss.on('connection', async (ws, req) => {
      // Authenticate via JWT in query string or cookie
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        ws.close(4001, 'Authentication required');
        return;
      }

      try {
        const payload = await verifyJWT(token);
        const client: ConnectedClient = {
          ws,
          userId: payload.userId,
          sessionId: null,
        };

        // Handle incoming messages from frontend
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          this.handleClientMessage(client, msg);
        });

        ws.on('close', () => {
          this.removeClient(client);
        });

        // Send connection confirmation
        ws.send(JSON.stringify({ type: 'connected', userId: payload.userId }));

      } catch (error) {
        ws.close(4001, 'Invalid token');
      }
    });
  }

  // ============================================================
  // SUBSCRIBE TO SESSION
  // ============================================================
  private handleClientMessage(client: ConnectedClient, msg: any) {
    if (msg.type === 'subscribe') {
      // Client wants to receive events for a specific session
      client.sessionId = msg.sessionId;

      if (!this.clients.has(msg.sessionId)) {
        this.clients.set(msg.sessionId, new Set());
      }
      this.clients.get(msg.sessionId)!.add(client);
    }

    if (msg.type === 'unsubscribe') {
      this.removeClient(client);
    }

    if (msg.type === 'ping') {
      client.ws.send(JSON.stringify({ type: 'pong' }));
    }
  }

  // ============================================================
  // EMIT EVENT TO ALL CLIENTS SUBSCRIBED TO A SESSION
  // ============================================================
  emit(sessionId: string, event: any) {
    const sessionClients = this.clients.get(sessionId);
    if (!sessionClients) return;

    const payload = JSON.stringify(event);

    for (const client of sessionClients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  private removeClient(client: ConnectedClient) {
    if (client.sessionId) {
      const sessionClients = this.clients.get(client.sessionId);
      if (sessionClients) {
        sessionClients.delete(client);
        if (sessionClients.size === 0) {
          this.clients.delete(client.sessionId);
        }
      }
    }
  }
}
```

---

## 5. The Complete WebSocket Event Protocol

These are ALL the events that flow from orchestrator to frontend:

| Event Type | When Emitted | Payload | Frontend Action |
|-----------|-------------|---------|-----------------|
| `connected` | WebSocket opens | `{userId}` | Set connection state |
| `message` | User or assistant message | `{role, content, messageType, attachments, timestamp}` | Add to timeline |
| `tool_call` | Agent calls a tool | `{toolName, toolCallId, args, status, timestamp}` | Show tool card (loading) |
| `tool_result` | Tool execution completes | `{toolCallId, toolName, result, status, timestamp}` | Update tool card (result) |
| `plan_update` | Agent creates/updates plan | `{goal, phases, currentPhaseId}` | Update plan sidebar |
| `plan_advance` | Agent advances to next phase | `{currentPhaseId}` | Highlight next phase |
| `text_delta` | Streaming text from LLM | `{content}` | Append to current message |
| `task_finished` | Agent loop ends | `{status, tokensUsed, steps}` | Show completion state |
| `error` | Something failed | `{message, timestamp}` | Show error toast |
| `browser_screenshot` | Browser tool takes screenshot | `{url, pageUrl}` | Update browser view |
| `image_generated` | Generate tool creates image | `{url, prompt}` | Show in timeline |
| `map_started` | Map tool begins | `{jobId, total, title}` | Show progress bar |
| `map_progress` | Map subtask completes | `{jobId, completed, total}` | Update progress |
| `map_completed` | All map subtasks done | `{jobId, results}` | Show results |
| `file_uploaded` | File uploaded to S3 | `{path, url, size}` | Update file list |
| `pong` | Response to ping | `{}` | Reset heartbeat timer |

---

## 6. Credit/Token Tracking

Every LLM call costs money. Track it.

```typescript
// src/server/orchestrator/credit-tracker.ts

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Pricing per 1M tokens (as of 2025)
const PRICING = {
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
};

export function calculateCost(model: string, usage: TokenUsage): number {
  const pricing = PRICING[model as keyof typeof PRICING];
  if (!pricing) return 0;

  const inputCost = (usage.promptTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export async function checkCredits(userId: string, db: DatabaseClient): Promise<boolean> {
  const user = await db.getUser(userId);
  if (!user) return false;

  // Check if user has remaining credits
  return user.creditsRemaining > 0;
}

export async function deductCredits(
  userId: string, 
  sessionId: string,
  model: string, 
  usage: TokenUsage, 
  db: DatabaseClient
): Promise<void> {
  const cost = calculateCost(model, usage);

  await db.deductUserCredits(userId, cost);
  await db.insertUsageRecord({
    userId,
    sessionId,
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cost,
    timestamp: new Date(),
  });
}
```

---

## 7. The Server Entry Point

Putting it all together:

```typescript
// src/server/index.ts

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from './websocket';
import { SessionManager } from './orchestrator/session-manager';
import { SandboxManager } from './sandbox/manager';
import { createDatabaseClient } from './db/queries';
import { createStorageClient } from './storage';
import { createSearchProvider } from './search';
import { createSessionRoutes } from './routes/sessions';
import { createAuthRoutes } from './routes/auth';
import { createFileRoutes } from './routes/files';

async function main() {
  // Initialize dependencies
  const db = await createDatabaseClient(process.env.DATABASE_URL!);
  const storage = createStorageClient();
  const searchProvider = createSearchProvider();
  const sandboxManager = new SandboxManager(process.env.E2B_API_KEY!);

  // Create Express app
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Create HTTP server
  const server = createServer(app);

  // Create WebSocket server (attached to HTTP server)
  const ws = new WebSocketServer(server);

  // Create session manager
  const sessionManager = new SessionManager(db, sandboxManager, ws);

  // Agent dependencies (passed to agent loop)
  const agentDeps = { ws, sandboxManager, db, storage, searchProvider };

  // Mount routes
  app.use(createAuthRoutes(db));
  app.use(createSessionRoutes(sessionManager, agentDeps));
  app.use(createFileRoutes(storage, db));

  // Serve frontend (in production)
  app.use(express.static('dist/client'));

  // Start server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch(console.error);
```

---

## 8. Critical Architecture Decisions

| Decision | Manus's Choice | Why | Your Choice |
|----------|---------------|-----|-------------|
| Agent loop | Custom HTTP loop | Built before AI SDK existed | AI SDK `streamText` with `maxSteps` |
| One model | Claude Sonnet 4 for everything | Best tool calling, longest context | Same — Claude Sonnet 4 |
| Sandbox sharing | One per user | Cost efficiency, state persistence | Same — one per user |
| Tool execution | Synchronous per step | LLM needs result before next step | Same — sequential |
| Real-time updates | WebSocket | Low latency, bidirectional | Same — WebSocket |
| History management | Context compaction | Fits in context window | Same — summarize old messages |
| Message flow | HTTP trigger → async agent loop → WS events | Non-blocking, scalable | Same pattern |
