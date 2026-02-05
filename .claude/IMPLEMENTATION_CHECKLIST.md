# Implementation Checklist

> VERIFIED against actual codebase — Feb 2026 audit
>
> P0 = Makes the app work | P1 = Core pages | P2 = Polish

## Verified Service Status (11/14 FULLY IMPLEMENTED)

| Service      | Port | DB Queries    | Status       | LOC  | Notes                                        |
| ------------ | ---- | ------------- | ------------ | ---- | -------------------------------------------- |
| Gateway      | 4001 | None (proxy)  | **COMPLETE** | 554  | Auth, proxy, WebSocket, SSE, Redis pub/sub   |
| Agent        | 8000 | None (Python) | **PARTIAL**  | 776  | LLM streaming works, NO tool loop, 3 stubs   |
| Task         | 4002 | Real Drizzle  | **COMPLETE** | 585  | Inngest functions, DB CRUD, WebSocket events |
| File         | 4005 | Real Drizzle  | **COMPLETE** | 492  | S3 upload, versioning, webhooks, pagination  |
| Billing      | 4008 | Real Drizzle  | **PARTIAL**  | 343  | All DB queries work, 4 Stripe TODOs          |
| Connector    | 4009 | Real Drizzle  | **COMPLETE** | 800  | Composio SDK, OAuth, catalog sync, tools     |
| Device       | 4001 | Real Drizzle  | **COMPLETE** | 792  | CRUD, commands, heartbeat, WebSocket, safety |
| Notification | 4006 | Real Drizzle  | **COMPLETE** | 364  | Knock email, Web Push, in-app, quiet hours   |
| Webhook      | 4007 | Real Drizzle  | **COMPLETE** | 289  | Event dispatch, HMAC signatures, retries     |
| Sandbox      | 4012 | Real Drizzle  | **COMPLETE** | 682  | E2B integration, code exec, shell, files     |
| Knowledge    | 4011 | Real Drizzle  | **COMPLETE** | 515  | RAG pipeline, embeddings, vector search      |
| Project      | 4010 | Real Drizzle  | **COMPLETE** | 313  | CRUD, members, sessions, files               |
| Search       | 4013 | Real Drizzle  | **COMPLETE** | 775  | Typesense + DB fallback, autocomplete        |
| Website      | 4004 | Real Drizzle  | **COMPLETE** | 1285 | Templates, file CRUD, deploy stubs           |

**Total backend LOC: ~8,565 lines of working code**

## Verified tRPC Router Status (16 routers, 160+ procedures, ALL have real queries)

| Router         | Procedures                     | Status                | Lines |
| -------------- | ------------------------------ | --------------------- | ----- |
| sessions       | 5 (CRUD + search sync)         | **REAL DB**           | 120   |
| messages       | 3 (list, send, add)            | **REAL DB**           | 104   |
| agents         | 7 (CRUD + tasks)               | **REAL DB**           | 281   |
| files          | 8 (CRUD + versions)            | **REAL DB**           | 244   |
| connectors     | 12 (CRUD + OAuth + tools)      | **REAL DB + service** | 374   |
| notifications  | 10 (CRUD + push + prefs)       | **REAL DB**           | 333   |
| scheduledTasks | 10 (CRUD + exec history)       | **REAL DB**           | 379   |
| projects       | 13 (CRUD + members + groups)   | **REAL DB**           | 548   |
| knowledge      | 14 (groups + items + RAG)      | **REAL DB + service** | 460   |
| billing        | 18 (plans + credits + Stripe)  | **REAL DB + Stripe**  | 608   |
| mail           | 11 (mailbox + AgentMail SDK)   | **REAL DB + SDK**     | 296   |
| user           | 14 (profile + prefs + export)  | **REAL DB**           | 392   |
| search         | 7 (global + reindex)           | **Typesense**         | 203   |
| devices        | 7 (proxies to service)         | **Service proxy**     | 178   |
| webhooks       | 11 (CRUD + delivery + retry)   | **REAL DB**           | 344   |
| websiteBuilder | 16 (projects + files + deploy) | **REAL DB + service** | 618   |

## Verified Chat Pipeline Status

**What WORKS end-to-end:**

1. User types in dashboard → creates session ID → stores in sessionStorage → navigates to `/chat/[id]`
2. Chat page reads initial message → sends via `useRealTimeChat` hook → hits `/api/chat`
3. API route (222 lines): authenticates → upserts session → persists user message → calls OpenAI/Anthropic → streams response
4. Assistant response persisted in DB → title auto-generated via GPT-4o-mini
5. RAG: queries knowledge service → injects context into system prompt (if knowledge groups provided)

**What does NOT work:**

- `/api/chat` is simple streaming — does NOT call the Python agent service
- Agent service accepts `tools` param but never passes them to the LLM
- No multi-step tool execution loop
- No Inngest task orchestration from chat
- No DAG workflows
- `messages.send` tRPC has TODO for triggering AI response (line 62)

## Frontend Page Status

| Page            | Client Component | Backend      | What's Missing                                 |
| --------------- | ---------------- | ------------ | ---------------------------------------------- |
| Dashboard       | No (server-only) | N/A          | Session creation uses sessionStorage, not tRPC |
| Chat            | Yes (351 lines)  | **Working**  | No tools, no agent panel, edit/delete TODOs    |
| Files/Library   | **No**           | **Complete** | Needs entire client component                  |
| Applications    | **No**           | **Complete** | Needs entire client component                  |
| Devices         | Yes (412 lines)  | **Complete** | Works! Needs smart home extension              |
| Actions         | Stub tabs        | Partial      | Task list, action templates, schedules         |
| Settings        | Yes (12+ tabs)   | **Complete** | Most tabs wired, billing needs Stripe          |
| Knowledge       | Exists           | **Complete** | May need deletion per instructions             |
| Website Builder | Exists           | **Complete** | Needs agent code gen integration               |
| Search          | Exists           | **Complete** | Functional with Typesense                      |

---

## P0 — Make the App Actually Work

### 1. Agent Tool Loop (HIGHEST PRIORITY)

**Why:** This is the difference between "ChatGPT clone" and "Manus.im competitor". Currently chat just streams text.

**The problem:** `/api/chat/route.ts` calls `streamText()` directly. It never calls the Python agent service. The Python agent service has tools defined but never passes them to the LLM.

**Fix options:**

**Option A: Enhance `/api/chat/route.ts` to use Vercel AI SDK tools**

```typescript
// In route.ts, add tools to streamText():
const result = streamText({
  model: resolveModel(model),
  system: systemPrompt,
  messages: sanitizedMessages,
  tools: {
    web_search: { description: "...", parameters: z.object({...}), execute: async (args) => { ... } },
    execute_code: { ... },
    browse_url: { ... },
  },
  maxSteps: 10, // Allow multi-step tool execution
});
```

**Option B: Route through Python agent service with tool loop**

- Call `POST /v1/complete` on agent service with tools
- Agent service passes tools to Anthropic/OpenAI
- Agent service executes tool calls via service endpoints
- Streams results back

**Recommended:** Option A (simpler, uses Vercel AI SDK's built-in tool loop)

**Files to modify:**

- `apps/app/app/api/chat/route.ts` — Add tools to `streamText()` call
- Create tool definitions that call backend services (sandbox, device, connector, knowledge)

### 2. Sidebar: Real Sessions + Remove Dead Nav

**Why:** Sidebar shows 8 hardcoded dummy chats. Knowledge/Builder links go to pages that should be removed.

- [ ] Remove Knowledge + Builder from `nav-section.tsx` (lines 32-51)
- [ ] Delete `apps/app/app/(authenticated)/knowledge/` directory
- [ ] Delete `apps/app/app/(authenticated)/website-builder/` directory
- [ ] Replace hardcoded `recentChats` in `sidebar/index.tsx` with `api.sessions.list.useQuery()`
- [ ] Group sessions by date (Today, Yesterday, Last 7 days, Older)
- [ ] Add Rubic logo at top
- [ ] Wire ChatItem dropdown actions (Rename, Delete, Archive, Favorite)
- [ ] Wire New Task button → `sessions.create` → navigate to `/chat/[id]`

**See:** `.claude/frontend/sidebar/INSTRUCTIONS.md`

### 3. Dashboard → Chat Session Flow

**Why:** Dashboard creates session ID in sessionStorage but doesn't create it in DB. The `/api/chat` route upserts it, but this is fragile.

- [ ] Dashboard prompt: call `sessions.create` tRPC mutation FIRST
- [ ] Then navigate to `/chat/[sessionId]?q=encodedMessage`
- [ ] Chat page: read `?q=` param and send as first message
- [ ] Replace hardcoded credits with `billing.getCreditBalance.useQuery()`

**See:** `.claude/frontend/dashboard/INSTRUCTIONS.md`

### 4. Stripe Integration (4 TODOs)

**Why:** Billing tRPC router (608 lines) has real Drizzle queries. Only 4 Stripe API calls are missing.

- [ ] `createSubscriptionCheckout` — `stripe.checkout.sessions.create()`
- [ ] `createCreditPurchaseCheckout` — `stripe.checkout.sessions.create()`
- [ ] `getBillingPortalUrl` — `stripe.billingPortal.sessions.create()`
- [ ] `deletePaymentMethod` — `stripe.paymentMethods.detach()`
- [ ] Billing service: 4 matching Stripe TODOs (subscription create/cancel, credit purchase, webhook verify)
- [ ] Create Stripe webhook handler

---

## P1 — Core Frontend Pages

### 5. Files/Library Page

**Backend:** COMPLETE (file service 492 lines, storage with S3, tRPC 8 procedures)
**Frontend:** EMPTY placeholder

- [ ] Create `files-page-client.tsx` with grid/list views
- [ ] Tab filtering, folder navigation, upload zone
- [ ] File preview modal, file actions
- [ ] Add `createFolder`, `move`, `bulkDelete`, `share` tRPC procedures
- [ ] `fileShares` DB table for sharing

**See:** `.claude/frontend/library/INSTRUCTIONS.md`

### 6. Applications Page

**Backend:** COMPLETE (connector service 800 lines, Composio, tRPC 12 procedures)
**Frontend:** EMPTY placeholder

- [ ] Create `applications-page-client.tsx` with Connected/Available tabs
- [ ] Seed connectorDefinitions via `POST /connectors/sync-catalog`
- [ ] App card with connect/connected status
- [ ] OAuth popup flow (backend already handles it)
- [ ] App configuration panel

**See:** `.claude/frontend/applications/INSTRUCTIONS.md`

### 7. Unified Prompt Component

- [ ] Create unified prompt with auto-resize textarea + toolbar
- [ ] Files button, Connectors popover, Skills button, Model selector

**See:** `.claude/frontend/prompt/INSTRUCTIONS.md`

### 8. Devices: Smart Home Extension

**Backend + Frontend:** COMPLETE for Rubic devices

- [ ] Add Home Assistant hub integration
- [ ] Smart home device type cards (light, climate, sensor, media)
- [ ] Tab layout: My Devices / Smart Home / Hubs

**See:** `.claude/frontend/devices/INSTRUCTIONS.md`

---

## P2 — Advanced Features

### 9. Chat: Rubic Computer Panel

- [ ] Split-screen panel with Browser, Terminal, Preview, Files tabs
- [ ] Browser use integration (Playwright screenshots)
- [ ] E2B terminal (xterm.js) — sandbox service already works
- [ ] Task segmentation display

**See:** `.claude/frontend/chat/INSTRUCTIONS.md`

### 10. Agent Service Stubs

- [ ] `web_search` — Integrate Serper or Tavily API
- [ ] `create_document` — PDF/Word generation
- [ ] `generate_image` — DALL-E integration

### 11. Settings Pages

- [ ] Wire remaining settings tabs to their tRPC routers (most already work)

### 12. Search UX

- [ ] Search dialog already works (Cmd+K)
- [ ] Needs Typesense running for full functionality

### 13. Notifications

- [ ] Notification service fully implemented (Knock + Web Push)
- [ ] Need real-time notification feed component in frontend

---

## Acceptance Criteria

### Must Work (P0)

- [ ] Type prompt on dashboard → creates session in DB → redirects to chat → AI responds with tools
- [ ] Chat persists messages (ALREADY WORKS)
- [ ] AI can use tools: web search, code execution, file operations
- [ ] Sidebar shows real sessions grouped by date
- [ ] Knowledge and Builder pages/links removed
- [ ] Stripe checkout works for subscriptions and credit purchases

### Should Work (P1)

- [ ] Files page: upload, download, preview, folder navigation
- [ ] Applications page: browse marketplace, connect via OAuth
- [ ] Prompt has file upload, connectors popover, model selector
- [ ] Devices: smart home device cards with controls

### Nice to Have (P2)

- [ ] Rubic Computer panel with browser + terminal
- [ ] Notifications in real-time
- [ ] Webhooks management
- [ ] Agent service: document generation, image generation

---

## Instruction File Index

| File                                            | Covers                                                |
| ----------------------------------------------- | ----------------------------------------------------- |
| `.claude/frontend/dashboard/INSTRUCTIONS.md`    | Dashboard page, session creation, credits             |
| `.claude/frontend/sidebar/INSTRUCTIONS.md`      | Sidebar, nav, real chats, filters, logo               |
| `.claude/frontend/chat/INSTRUCTIONS.md`         | Chat pipeline, tools, Rubic Computer, E2B, browser    |
| `.claude/frontend/prompt/INSTRUCTIONS.md`       | Unified prompt component, toolbar, connectors, skills |
| `.claude/frontend/library/INSTRUCTIONS.md`      | Files page, upload, preview, folders, sharing         |
| `.claude/frontend/applications/INSTRUCTIONS.md` | App marketplace, Composio, OAuth, config              |
| `.claude/frontend/devices/INSTRUCTIONS.md`      | Device dashboard, smart home, HA, controls            |
| `.claude/frontend/FRONTEND_MASTER.md`           | Frontend architecture overview                        |
| `.claude/backend/BACKEND_MASTER.md`             | Backend architecture overview                         |
| `.claude/database/DATABASE_MASTER.md`           | Database schema reference                             |
| `.claude/business/VISION.md`                    | Business vision and product direction                 |
| `.claude/MASTER_INSTRUCTIONS.md`                | Top-level project instructions                        |
