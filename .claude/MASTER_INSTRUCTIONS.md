# RUBIC - Master Implementation Instructions

> **Last Updated:** 2026-02-05 | **Status:** Ground-truth audit complete, implementation ready

## What Is Rubic

Rubic is a DAG (Directed Acyclic Graph) multi-agent AI platform with 500+ integrations for apps and devices. Think Manus.im but with universal device control, website building, and deeper integration ecosystem.

## Tech Stack (VERIFIED against actual codebase)

| Technology         | Purpose                          | Package/Location                      | Status            |
| ------------------ | -------------------------------- | ------------------------------------- | ----------------- |
| **Better-Auth**    | Authentication                   | `packages/auth/src/server.ts`         | COMPLETE          |
| **Drizzle ORM**    | Database                         | `packages/database/src/schema/`       | SCHEMAS COMPLETE  |
| **Vercel AI SDK**  | AI chat, streaming, tools        | `packages/ai/`                        | COMPLETE          |
| **Stripe**         | Payments, subscriptions, credits | `packages/payments/`                  | CLIENT ONLY       |
| **Composio**       | 500+ app integrations via MCP    | --                                    | NOT STARTED       |
| **Home Assistant** | Device control via MCP           | --                                    | NOT STARTED       |
| **Typesense**      | Search engine                    | `packages/search/`                    | CLIENT CONFIGURED |
| **Knock**          | Notifications                    | `packages/notifications/`             | CLIENT CONFIGURED |
| **Svix**           | Webhooks as service              | `packages/webhooks/`                  | CLIENT CONFIGURED |
| **Inngest**        | AI workflow orchestration        | `services/task/src/routes/inngest.ts` | CONFIGURED        |
| **E2B**            | Code sandbox execution           | --                                    | NOT STARTED       |
| **TiDB**           | Client website databases         | --                                    | NOT STARTED       |
| **Resend**         | Transactional emails             | `packages/email/`                     | CONFIGURED        |
| **AgentMail**      | Per-user AI email                | --                                    | NOT STARTED       |
| **AWS S3**         | File storage (target)            | `packages/storage/` uses Vercel Blob  | NEEDS REFACTOR    |
| **Liveblocks**     | Real-time collaboration          | `packages/collaboration/`             | CONFIGURED        |
| **Socket.io**      | WebSocket real-time              | `apps/app/lib/socket/`                | FULLY IMPLEMENTED |
| **tRPC**           | Type-safe API layer              | `apps/app/lib/trpc/`                  | 15 ROUTERS        |
| **Redux Toolkit**  | State management                 | `apps/app/lib/store/`                 | 45 SLICES         |

## Environment Variables

All API keys MUST be in `.env` files. NEVER hardcode. Key vars:

- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- `E2B_API_KEY`
- `COMPOSIO_API_KEY`, `COMPOSIO_PROJECT_ID`, `COMPOSIO_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `TIDB_CONNECTION_STRING`
- `TYPESENSE_API_KEY`, `TYPESENSE_HOST`
- `KNOCK_SECRET_API_KEY`, `NEXT_PUBLIC_KNOCK_API_KEY`
- `SVIX_TOKEN`
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- `DATABASE_URL` (PostgreSQL)
- `REDIS_URL`

## Codebase Architecture

```
rubic/
├── apps/
│   ├── app/            # Main Next.js frontend (PRIMARY)
│   ├── web/            # Marketing site
│   ├── api/            # Webhook receiver
│   ├── docs/           # Documentation site
│   ├── email/          # React Email templates
│   ├── storybook/      # Component showcase
│   └── studio/         # CMS studio
├── services/           # Backend microservices (13 services)
│   ├── gateway/        # Fastify API Gateway - PARTIAL
│   ├── agent/          # Python FastAPI AI Agent - PARTIAL
│   ├── task/           # Inngest orchestration - PARTIAL
│   ├── billing/        # Stripe billing - STUB
│   ├── connector/      # Composio integrations - STUB
│   ├── file/           # S3 file management - STUB
│   ├── device/         # Device control - EMPTY
│   ├── sandbox/        # E2B execution - STUB
│   ├── website/        # Website builder - STUB
│   ├── knowledge/      # RAG knowledge base - STUB
│   ├── notification/   # Knock notifications - STUB
│   ├── search/         # Typesense search - STUB
│   ├── webhook/        # Svix webhooks - STUB
│   └── project/        # Project management - STUB
├── packages/           # Shared libraries (27 packages)
│   ├── ai/             # AI SDK, agents, tools (MOST COMPLETE)
│   ├── database/       # Drizzle schemas - 15+ tables
│   ├── auth/           # Better-Auth - COMPLETE
│   ├── payments/       # Stripe client - CONFIGURED
│   ├── storage/        # Vercel Blob - NEEDS S3 REFACTOR
│   ├── search/         # Typesense - CONFIGURED
│   ├── notifications/  # Knock - CONFIGURED
│   ├── webhooks/       # Svix - CONFIGURED
│   ├── email/          # Resend - CONFIGURED
│   ├── collaboration/  # Liveblocks - CONFIGURED
│   ├── design-system/  # shadcn/ui 30+ components
│   ├── editor/         # EMPTY - needs implementation
│   ├── service-utils/  # Shared service utilities - COMPLETE
│   └── ...
└── docs/               # Documentation (600KB+)
```

## What WORKS Right Now

1. **AI Chat streaming** - `apps/app/app/api/chat/route.ts` → Vercel AI SDK → streamText
2. **WebSocket** - `apps/app/lib/socket/provider.tsx` (295 lines) full Redux integration
3. **Auth** - Better-Auth: email/password + Google + GitHub OAuth + Organizations
4. **tRPC** - 15 routers. billing.router.ts has 534 lines of real Drizzle queries
5. **DB schemas** - 15+ Drizzle tables: users, accounts, authSessions, verifications, agentSessions, messages, agents, agentTasks, files, fileVersions, devices, deviceSessions, deviceCommands, organizations, members, invitations, subscriptionPlans, userSubscriptions, creditPackages, creditBalances, creditTransactions, usageRecords, paymentMethods, invoices, connectorDefinitions, userConnectors, connectorSyncLogs, knowledgeGroups, knowledgeItems, knowledgeChunks, sessionAttachments, scheduledTasks, notifications, notificationPreferences, sandboxes, sandboxExecutions, webhooks, webhookDeliveries, projects, projectMembers, projectSessions, projectFiles, websites, websitePages
6. **Redux** - 45 slices, chat slice 475 lines
7. **Gateway** - Fastify with auth, proxy, WebSocket, health checks
8. **Agent** - Python with Anthropic + OpenAI streaming
9. **Inngest** - Task execution, scheduled tasks, approval workflows

## What Does NOT Work

1. **No service uses the database** - Schemas exist, services have `// TODO`
2. **Composio** - Zero code
3. **E2B** - Zero code
4. **Home Assistant** - Zero code
5. **AgentMail** - Zero code
6. **TiDB** - Zero code
7. **Storage** - Vercel Blob, needs S3
8. **Editor** - Package empty
9. **Frontend pages** - Files, Devices, Applications, Actions = placeholder shells
10. **Stripe checkout** - tRPC has TODOs for session creation
11. **Webhooks** - Svix package exists but not connected

## Segmented Instructions

| File                                         | Purpose                                                    |
| -------------------------------------------- | ---------------------------------------------------------- |
| `IMPLEMENTATION_CHECKLIST.md`                | Prioritized task list with all TODOs                       |
| `frontend/FRONTEND_MASTER.md`                | Frontend architecture and patterns                         |
| `frontend/chat/INSTRUCTIONS.md`              | Chat page end-to-end                                       |
| `frontend/library/INSTRUCTIONS.md`           | File manager with S3                                       |
| `frontend/devices/INSTRUCTIONS.md`           | Device dashboard                                           |
| `frontend/applications/INSTRUCTIONS.md`      | App marketplace (Composio)                                 |
| `frontend/actions/INSTRUCTIONS.md`           | Tasks/Actions/Schedules                                    |
| `frontend/settings/INSTRUCTIONS.md`          | Settings modal (all tabs)                                  |
| `frontend/packages/INSTRUCTIONS.md`          | Package refactoring                                        |
| `backend/BACKEND_MASTER.md`                  | Backend architecture and patterns                          |
| `backend/gateway/INSTRUCTIONS.md`            | API Gateway                                                |
| `backend/agent/INSTRUCTIONS.md`              | Agent service                                              |
| `backend/task/INSTRUCTIONS.md`               | Task + Inngest                                             |
| `backend/billing/INSTRUCTIONS.md`            | Stripe billing                                             |
| `backend/connector/INSTRUCTIONS.md`          | Composio integration                                       |
| `backend/file/INSTRUCTIONS.md`               | S3 file service                                            |
| `backend/device/INSTRUCTIONS.md`             | Device control                                             |
| `backend/sandbox/INSTRUCTIONS.md`            | E2B sandbox                                                |
| `backend/remaining-services/INSTRUCTIONS.md` | Knowledge, notification, search, webhook, project, website |
| `database/DATABASE_MASTER.md`                | Complete schema reference                                  |
| `business/VISION.md`                         | Business strategy and pricing                              |

## Code Patterns (from actual codebase)

### tRPC Router Pattern

```typescript
// apps/app/lib/trpc/routers/xyz.router.ts
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, tableName, eq } from "@repo/database";

export const xyzRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(tableName).where(eq(tableName.userId, ctx.user.id));
  }),
});
```

### Service Route Pattern

```typescript
// services/xyz/src/index.ts
import { db, tableName, eq } from "@repo/database";

fastify.get("/items", async (request, reply) => {
  const items = await db.select().from(tableName).where(eq(tableName.userId, request.userId));
  return { data: items };
});
```

### WebSocket Pattern

```typescript
// Server: gateway/src/routes/websocket.ts
publish(channel, { event: "message:new", data: { sessionId, message } });

// Client: apps/app/lib/socket/provider.tsx
socket.on("message:new", ({ sessionId, message }) => {
  dispatch(addMessage({ sessionId, ...message }));
});
```
