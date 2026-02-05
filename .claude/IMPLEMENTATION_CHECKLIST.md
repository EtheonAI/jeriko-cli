# Implementation Checklist

> P0 = Blocks everything | P1 = Core MVP | P2 = Polish

## P0 - Critical Path (Week 1-2)

### 1. Database Migration - Wire All Services

**Why:** Every service has `// TODO: database` stubs. Schemas exist in `packages/database/src/schema/` but no service queries them.

- [ ] Run `drizzle-kit push` to sync all schemas to PostgreSQL
- [ ] Seed subscription plans, credit packages, connector definitions
- [ ] Wire `services/billing/src/index.ts` - import from `@repo/database`, replace all 8 TODO endpoints
- [ ] Wire `services/connector/src/index.ts` - use connectorDefinitions + userConnectors tables
- [ ] Wire `services/file/src/index.ts` - use files + fileVersions tables
- [ ] Wire `services/knowledge/src/index.ts` - use knowledgeGroups + knowledgeItems + knowledgeChunks
- [ ] Wire `services/notification/src/index.ts` - use notifications + notificationPreferences
- [ ] Wire `services/project/src/index.ts` - use projects + projectMembers
- [ ] Wire `services/sandbox/src/index.ts` - use sandboxes + sandboxExecutions
- [ ] Wire `services/search/src/index.ts` - Typesense indexing
- [ ] Wire `services/webhook/src/index.ts` - use webhooks + webhookDeliveries
- [ ] Wire `services/task/src/routes/tasks.ts` - use agentSessions + agentTasks tables (currently in-memory)

### 2. Chat Pipeline End-to-End

**Why:** Chat sends messages to `/api/chat/route.ts` but doesn't persist, doesn't go through task service, doesn't track credits.

**Current flow:** User → `/api/chat` → `streamText()` → Response (no persistence)
**Target flow:** User → tRPC `messages.sendMessage` → DB save → Inngest `task/execute` → Agent Service → Stream via WebSocket → DB save → Credit deduction

- [ ] `messages.router.ts` line 57: Implement "Trigger AI response via agent orchestrator" TODO
- [ ] Agent service: Accept full conversation history (not just single prompt)
- [ ] Task service `inngest.ts`: Step 3 "process-result" - save to messages table, update task status
- [ ] Gateway WebSocket: Broadcast response chunks to session room
- [ ] Frontend: `useRealTimeChat` should listen for WebSocket `message:stream` events
- [ ] Credit deduction: After response, insert into `usageRecords` and decrement `creditBalances`

### 3. Stripe Integration

**Why:** billing.router.ts has 4 TODO comments for Stripe session creation. Everything else (DB queries, balance tracking) already works.

- [ ] Import `stripe` from `@repo/payments` in `billing.router.ts`
- [ ] Line 400: `createSubscriptionCheckout` - `stripe.checkout.sessions.create()` with plan's stripePriceId
- [ ] Line 411: `createCreditPurchaseCheckout` - `stripe.checkout.sessions.create()` for credit packages
- [ ] Line 519: `getBillingPortalUrl` - `stripe.billingPortal.sessions.create()`
- [ ] Line 302: `deletePaymentMethod` - `stripe.paymentMethods.detach()`
- [ ] Create Stripe webhook endpoint: `apps/api/app/webhooks/stripe/route.ts`
- [ ] Handle events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated/deleted`
- [ ] Sync Stripe events to `userSubscriptions`, `creditBalances`, `invoices` tables
- [ ] Frontend billing tab: wire subscription/credit purchase buttons to checkout mutations

### 4. Composio Integration

**Why:** Core differentiator - 500+ app integrations. Zero code exists.

- [ ] Install `composio-core` in `services/connector/`
- [ ] Create Composio client: `new Composio({ apiKey: process.env.COMPOSIO_API_KEY })`
- [ ] `/connectors` GET: `composio.apps.list()` to get available apps
- [ ] `/connectors/:id/connect` POST: `composio.connectedAccounts.initiate()` for OAuth
- [ ] `/connectors/:id/callback` GET: Handle OAuth callback, save to `userConnectors` table
- [ ] `/integrations/:id/tools` GET: `composio.actions.list({ appName })` for tools
- [ ] Register Composio tools as MCP tools for the agent service
- [ ] Frontend Applications page: Display real apps from Composio API
- [ ] Frontend: OAuth popup flow for connecting apps
- [ ] Save connection status to `userConnectors` + `connectorSyncLogs` tables

## P1 - Core Features (Week 3-4)

### 5. S3 Storage Refactor

- [ ] Replace `@vercel/blob` in `packages/storage/` with `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- [ ] Export: `uploadFile()`, `getPresignedUrl()`, `deleteFile()`, `listFiles()`
- [ ] Wire `services/file/`: upload via multipart → S3, generate presigned download URLs
- [ ] Wire to `files` + `fileVersions` Drizzle tables
- [ ] Library page: grid/list views, upload modal, folder nav, file actions, drag-and-drop

### 6. E2B Sandbox Integration

- [ ] Install `e2b` package in `services/sandbox/`
- [ ] Create sandbox: `Sandbox.create({ apiKey: process.env.E2B_API_KEY })`
- [ ] Execute code: `sandbox.runCode(code, { language })`
- [ ] File operations: `sandbox.files.write()`, `sandbox.files.read()`
- [ ] Wire as agent tool: When agent needs code execution, call sandbox service
- [ ] Frontend: Terminal + preview pane for sandbox output
- [ ] Save to `sandboxes` + `sandboxExecutions` tables

### 7. Settings Pages (ALL tabs)

- [ ] Account: Profile update via `users.router.ts`, password change, email management
- [ ] Billing: Plans, subscription, credits, invoices, payment methods (wire to `billing.router.ts`)
- [ ] Connectors: Connected/available apps, connect/disconnect (wire to `connectors.router.ts`)
- [ ] Devices: Device list, register, control (wire to `devices.router.ts`)
- [ ] Personalization: Theme, language, AI response preferences
- [ ] Scheduled Tasks: CRUD for scheduled Inngest jobs, cron editor
- [ ] Data Controls: Export data, delete account, privacy settings
- [ ] Skills: AI skills marketplace (future)
- [ ] Mail: AgentMail configuration (future)
- [ ] Usage: Credit usage charts and history

### 8. Device Control

- [ ] Implement `services/device/` (Node.js Fastify or Go)
- [ ] Home Assistant MCP integration for smart home devices
- [ ] Device registration, heartbeat, command execution
- [ ] Wire `devices`, `deviceSessions`, `deviceCommands` tables
- [ ] Devices page: device cards with type-specific controls
- [ ] Automations builder UI

## P2 - Polish (Week 5-6)

### 9. Website Builder + Editor Package

- [ ] Implement `packages/editor/` with Monaco Editor
- [ ] 3-pane layout: file tree + code editor + preview
- [ ] AI code generation → file system → live preview
- [ ] E2B or WebContainer for runtime
- [ ] TiDB Serverless for client DB provisioning
- [ ] Template system (React, Next.js, Vue, Express)

### 10. Knowledge Base (RAG)

- [ ] Wire knowledge service to `knowledgeGroups/Items/Chunks` tables
- [ ] Document upload → text extraction → chunking → embedding (OpenAI text-embedding-3-small)
- [ ] Vector search for context-aware AI responses
- [ ] Knowledge base UI in Library section

### 11. Webhooks Pipeline

- [ ] Wire webhook service to DB + Svix (`@repo/webhooks`)
- [ ] Emit events from other services (task.completed, file.uploaded, etc.)
- [ ] Webhook management UI in settings
- [ ] Delivery logs and retry handling

### 12. Notifications

- [ ] Wire notification service to Knock (`@repo/notifications`)
- [ ] Real-time notification feed component
- [ ] Email + push + in-app channels
- [ ] Notification preferences per user

### 13. Search Indexing

- [ ] Wire search service to Typesense (`@repo/search`)
- [ ] Index: sessions, messages, files, projects on create/update
- [ ] Search UI already partially implemented (search.router.ts 153 lines)
- [ ] Autocomplete/suggestions

### 14. AgentMail

- [ ] Research AgentMail API, provision mailbox per user
- [ ] Mail settings tab, wire as agent tool

## Acceptance Criteria

- [ ] Chat sends/receives/persists messages end-to-end
- [ ] Sign up → verify email → sign in works
- [ ] Subscribe via Stripe → credits appear
- [ ] Connect app via Composio → available as AI tool
- [ ] Upload/download files via S3
- [ ] All settings tabs save correctly
- [ ] WebSocket reconnects automatically
- [ ] Credits deducted per AI action
- [ ] Search returns relevant results
- [ ] Notifications appear in real-time
