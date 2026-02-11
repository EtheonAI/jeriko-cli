# Part 6: Database Schema, Authentication, Deployment, and Complete Starter Code

> **This is the persistence and infrastructure layer.** Everything the agent does must be persisted — sessions, messages, tool calls, plans, files, users, credits. This document provides the complete database schema, auth flow, and deployment guide.

---

## 1. Complete Database Schema (Drizzle ORM + PostgreSQL)

This schema is derived directly from our investigation of Manus's persistence layer.

```typescript
// src/server/db/schema.ts

import { pgTable, text, timestamp, integer, jsonb, boolean, real, uuid, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// USERS
// ============================================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'), // null for OAuth users
  provider: text('provider').default('email'), // 'email', 'google', 'github'
  providerId: text('provider_id'),
  creditsRemaining: real('credits_remaining').default(10.0), // USD
  plan: text('plan').default('free'), // 'free', 'pro', 'enterprise'
  settings: jsonb('settings').default({}), // theme, language, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// SESSIONS
// ============================================================
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').default('New Task'),
  status: text('status').default('created'), // created, active, waiting_for_user, completed, failed, expired
  model: text('model').default('claude-sonnet-4-20250514'),
  tokensUsed: integer('tokens_used').default(0),
  toolCallsCount: integer('tool_calls_count').default(0),
  costUsd: real('cost_usd').default(0),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// MESSAGES
// ============================================================
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user', 'assistant', 'system', 'tool'
  content: text('content').notNull(),
  contentType: text('content_type').default('text'), // 'text', 'info', 'ask', 'result', 'error'
  metadata: jsonb('metadata').default({}), // attachments, model, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// TOOL CALLS
// ============================================================
export const toolCalls = pgTable('tool_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').references(() => messages.id),
  toolName: text('tool_name').notNull(), // 'shell', 'file', 'browser', etc.
  args: jsonb('args').notNull(), // Tool input parameters
  result: jsonb('result'), // Tool output (null while running)
  status: text('status').default('pending'), // 'pending', 'running', 'completed', 'error'
  durationMs: integer('duration_ms'), // Execution time
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// ============================================================
// PLANS
// ============================================================
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().unique().references(() => sessions.id, { onDelete: 'cascade' }),
  goal: text('goal').notNull(),
  phases: jsonb('phases').notNull(), // Array<{id: number, title: string}>
  currentPhaseId: integer('current_phase_id').default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// FILES
// ============================================================
export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  sessionId: uuid('session_id').references(() => sessions.id),
  originalName: text('original_name').notNull(),
  cdnUrl: text('cdn_url').notNull(),
  size: integer('size').notNull(), // bytes
  mimeType: text('mime_type').notNull(),
  source: text('source').default('upload'), // 'upload', 'generated', 'sandbox'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// SCHEDULED TASKS
// ============================================================
export const scheduledTasks = pgTable('scheduled_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  sessionId: uuid('session_id').references(() => sessions.id),
  name: text('name').notNull(),
  prompt: text('prompt').notNull(),
  type: text('type').notNull(), // 'cron', 'interval'
  cron: text('cron'),
  intervalSeconds: integer('interval_seconds'),
  repeat: boolean('repeat').default(false),
  playbook: text('playbook'),
  status: text('status').default('active'), // 'active', 'paused', 'completed', 'expired'
  lastRunAt: timestamp('last_run_at'),
  nextRunAt: timestamp('next_run_at'),
  expireAt: timestamp('expire_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// MAP/REDUCE JOBS
// ============================================================
export const mapReduceJobs = pgTable('map_reduce_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id),
  name: text('name').notNull(),
  title: text('title').notNull(),
  promptTemplate: text('prompt_template').notNull(),
  targetCount: integer('target_count').notNull(),
  completedCount: integer('completed_count').default(0),
  outputSchema: jsonb('output_schema').notNull(),
  results: jsonb('results'),
  status: text('status').default('pending'), // 'pending', 'running', 'completed', 'failed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// ============================================================
// USAGE RECORDS (for billing)
// ============================================================
export const usageRecords = pgTable('usage_records', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  sessionId: uuid('session_id').references(() => sessions.id),
  model: text('model').notNull(),
  promptTokens: integer('prompt_tokens').notNull(),
  completionTokens: integer('completion_tokens').notNull(),
  costUsd: real('cost_usd').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// CONNECTORS (user's external service connections)
// ============================================================
export const connectors = pgTable('connectors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(), // 'gmail', 'slack', 'github', etc.
  status: text('status').default('connected'), // 'connected', 'disconnected', 'error'
  accessToken: text('access_token'), // Encrypted
  refreshToken: text('refresh_token'), // Encrypted
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
});

// ============================================================
// KNOWLEDGE (persistent user facts)
// ============================================================
export const knowledge = pgTable('knowledge', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  useWhen: text('use_when').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// USER SECRETS (API keys for external services)
// ============================================================
export const userSecrets = pgTable('user_secrets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  serviceName: text('service_name').notNull(),
  variableName: text('variable_name').notNull(),
  encryptedValue: text('encrypted_value').notNull(), // AES-256 encrypted
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// RELATIONS
// ============================================================
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  files: many(files),
  connectors: many(connectors),
  knowledge: many(knowledge),
  secrets: many(userSecrets),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
  messages: many(messages),
  toolCalls: many(toolCalls),
  plan: one(plans),
  files: many(files),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, { fields: [messages.sessionId], references: [sessions.id] }),
}));

export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
  session: one(sessions, { fields: [toolCalls.sessionId], references: [sessions.id] }),
  message: one(messages, { fields: [toolCalls.messageId], references: [messages.id] }),
}));
```

### 1.2 Migration

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

```bash
# Generate migration
npx drizzle-kit generate

# Run migration
npx drizzle-kit migrate
```

---

## 2. Authentication

### 2.1 JWT Auth (matching Manus's approach)

```typescript
// src/server/auth/jwt.ts

import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const ISSUER = 'your-agent-platform';
const EXPIRATION = '7d';

export async function createJWT(userId: string, email: string): Promise<string> {
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(EXPIRATION)
    .sign(JWT_SECRET);
}

export async function verifyJWT(token: string): Promise<{ userId: string; email: string }> {
  const { payload } = await jwtVerify(token, JWT_SECRET, { issuer: ISSUER });
  return { userId: payload.userId as string, email: payload.email as string };
}
```

### 2.2 Auth Middleware

```typescript
// src/server/auth/middleware.ts

import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from './jwt';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = authHeader.slice(7);
    const payload = await verifyJWT(token);
    (req as any).user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

### 2.3 Auth Routes

```typescript
// src/server/routes/auth.ts

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createJWT } from '../auth/jwt';
import type { DatabaseClient } from '../db/queries';

export function createAuthRoutes(db: DatabaseClient): Router {
  const router = Router();

  // Register
  router.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body;
    const existing = await db.getUserByEmail(email);
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.insertUser({ email, passwordHash, name });
    const token = await createJWT(user.id, user.email);

    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  });

  // Login
  router.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await db.getUserByEmail(email);
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = await createJWT(user.id, user.email);
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  });

  // Get current user
  router.get('/api/auth/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });

    try {
      const payload = await verifyJWT(authHeader.slice(7));
      const user = await db.getUser(payload.userId);
      res.json({ user });
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  return router;
}
```

---

## 3. Redis Cache Layer

```typescript
// src/server/cache/index.ts

import Redis from 'ioredis';

export class CacheClient {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  // Session state cache (avoid DB reads on every message)
  async getSessionState(sessionId: string): Promise<any | null> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async setSessionState(sessionId: string, state: any, ttlSeconds = 3600): Promise<void> {
    await this.redis.set(`session:${sessionId}`, JSON.stringify(state), 'EX', ttlSeconds);
  }

  // Rate limiting
  async checkRateLimit(userId: string, maxPerMinute = 10): Promise<boolean> {
    const key = `ratelimit:${userId}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 60);
    return count <= maxPerMinute;
  }

  // Sandbox tracking
  async setSandboxId(userId: string, sandboxId: string): Promise<void> {
    await this.redis.set(`sandbox:${userId}`, sandboxId, 'EX', 7200); // 2 hours
  }

  async getSandboxId(userId: string): Promise<string | null> {
    return this.redis.get(`sandbox:${userId}`);
  }
}
```

---

## 4. Deployment Architecture

### 4.1 Infrastructure Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  CLOUDFLARE / VERCEL EDGE                                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │  CDN    │  │  WAF    │  │  DNS    │                      │
│  └────┬────┘  └────┬────┘  └────┬────┘                      │
└───────┼─────────────┼───────────┼────────────────────────────┘
        │             │           │
        ▼             ▼           ▼
┌──────────────────────────────────────────────────────────────┐
│  APPLICATION SERVER (Railway / Fly.io / AWS ECS)             │
│  ┌──────────────────────────────────────────────┐            │
│  │  Node.js Process                              │            │
│  │  ├── Express (HTTP API)  :3000                │            │
│  │  ├── WebSocket Server    :3000/ws             │            │
│  │  └── BullMQ Worker       (scheduled tasks)    │            │
│  └──────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
        │           │           │           │
        ▼           ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│PostgreSQL│ │  Redis   │ │   S3     │ │   E2B    │
│(Neon/    │ │(Upstash) │ │(AWS/R2)  │ │(Sandbox  │
│ Supabase)│ │          │ │          │ │  API)    │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### 4.2 Deployment Options

| Platform | Pros | Cons | Cost |
|----------|------|------|------|
| **Railway** | Easy deploy, built-in Postgres + Redis | Limited WebSocket support | ~$20/mo |
| **Fly.io** | Global edge, WebSocket native, persistent volumes | More complex config | ~$15/mo |
| **AWS ECS + Fargate** | Production-grade, auto-scaling | Complex setup | ~$50/mo |
| **Vercel + Separate Backend** | Frontend on Vercel, backend on Railway | Split deployment | ~$30/mo |
| **Self-hosted (VPS)** | Full control, cheapest | You manage everything | ~$10/mo |

### 4.3 Recommended Stack for MVP

```
Frontend:  Vercel (free tier, auto-deploy from GitHub)
Backend:   Railway ($5/mo, includes Postgres + Redis)
Storage:   Cloudflare R2 (free 10GB, no egress fees)
Sandbox:   E2B (pay per use, ~$0.10/hour per sandbox)
LLM:       Anthropic API (pay per token)
Search:    Tavily ($0 for 1000 searches/month)
```

### 4.4 Docker Deployment

```dockerfile
# Dockerfile
FROM node:22-slim AS base

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# Build
COPY . .
RUN pnpm build

# Production
FROM node:22-slim AS production
WORKDIR /app
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

EXPOSE 3000
CMD ["node", "dist/server/index.js"]
```

```yaml
# docker-compose.yml (for local development)
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/agentdb
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: agentdb
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

volumes:
  pgdata:
```

---

## 5. Build Order Checklist

This is the exact order you should build, with estimated time for each:

| Phase | What to Build | Time | Dependencies |
|-------|--------------|------|-------------|
| 1 | Database schema + migrations | 2 hours | PostgreSQL |
| 2 | Auth (JWT + routes) | 2 hours | Database |
| 3 | System prompt builder | 3 hours | None |
| 4 | Tool definitions (Zod schemas) | 4 hours | None |
| 5 | E2B sandbox manager | 3 hours | E2B API key |
| 6 | Tool implementations (shell, file, match) | 4 hours | Sandbox manager |
| 7 | Tool implementations (browser, search, generate) | 4 hours | Sandbox + APIs |
| 8 | Agent loop (streamText + maxSteps) | 4 hours | Tools + system prompt |
| 9 | WebSocket server | 2 hours | None |
| 10 | Session manager + REST routes | 3 hours | Database + WebSocket |
| 11 | Frontend store (Zustand slices) | 3 hours | None |
| 12 | WebSocket hook | 2 hours | Store |
| 13 | Timeline + ChatInput components | 4 hours | Store + WebSocket |
| 14 | ToolCallCard + PlanSidebar | 3 hours | Store |
| 15 | File upload/download (S3) | 3 hours | S3 |
| 16 | Plan + Message tools | 2 hours | WebSocket + DB |
| 17 | Map tool (parallel processing) | 4 hours | Sandbox pool |
| 18 | Composio integration | 3 hours | Composio API key |
| 19 | Credit tracking | 2 hours | Database |
| 20 | Testing + deployment | 4 hours | Everything |
| **Total** | | **~60 hours** | |

---

## 6. What You Do NOT Need to Build (Manus Has But You Can Skip)

| Feature | Why Skip | Add Later? |
|---------|----------|-----------|
| Neko WebRTC streaming | Complex Go binary, noVNC is simpler | Yes, for browser sharing |
| 41 Redux slices | 12 critical slices cover 95% of functionality | Yes, incrementally |
| Slide generation | Niche feature | Yes, if needed |
| Custom domain management | Not core to agent functionality | Yes, for SaaS |
| Visual editor | Complex, not needed for MVP | Yes, for polish |
| Context compaction (advanced) | Simple truncation works for MVP | Yes, for long tasks |
| Skill system | Nice to have, not critical | Yes, for extensibility |
| Knowledge base | Can use system prompt directly | Yes, for personalization |

---

## 7. The Complete Flow — End to End

Here is every single step from user keystroke to final result:

```
1. User types message in ChatInput component
2. User presses Enter → sendMessage() called
3. If no session exists → POST /api/sessions → creates session in DB
4. POST /api/sessions/:id/messages → { content, attachments }
5. Server responds immediately: { status: "processing" }
6. Server calls runAgentLoop() asynchronously
7. Agent loop: acquireForUser() → gets or creates E2B sandbox
8. Agent loop: buildConversationHistory() → fetches from DB
9. Agent loop: buildSystemPrompt() → assembles XML sections
10. Agent loop: createToolSet() → creates AI SDK tool objects
11. Agent loop: streamText() called with Claude Sonnet 4
12. Claude receives system prompt + history + tools
13. Claude returns: tool_call(plan, {action: "update", ...})
14. AI SDK calls plan.execute() → DB write + WS emit "plan_update"
15. Frontend receives WS "plan_update" → setPlan() → PlanSidebar renders
16. Claude receives plan result → returns: tool_call(shell, {command: "..."})
17. AI SDK calls shell.execute() → E2B SDK → sandbox runs command
18. WS emit "tool_call" → Frontend shows ToolCallCard (loading)
19. Shell returns result → WS emit "tool_result" → ToolCallCard updates
20. Claude receives shell result → decides next action
21. ... (repeats for 5-25 rounds) ...
22. Claude returns: tool_call(message, {type: "result", text: "...", attachments: [...]})
23. message.execute() → uploads attachments to S3 → DB write → WS emit "message"
24. Frontend receives WS "message" → addTimelineEvent() → MessageBubble renders
25. message.execute() returns {status: "task_complete"}
26. Claude sees task is complete → stops calling tools
27. streamText() completes → onStepFinish runs final cleanup
28. Credit tracking: deductCredits() → DB write
29. WS emit "task_finished" → Frontend: setAgentRunning(false)
30. User sees the result with attachments in the timeline
```

**That is the entire flow. Every step. No gaps. No lies.**
