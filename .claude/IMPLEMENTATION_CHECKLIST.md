# Implementation Checklist

> VERIFIED against actual codebase — Feb 6 2026
> Aligned with Redux-State-Slice-Explanations.md (all 44 Manus slices)
>
> P0 = Launch blockers | P1 = Core UX | P2 = Power features | P3 = Polish

---

## Verified Backend Status

### Services (14 total — 11 complete, 3 partial)

| Service | Port | Status | LOC | Notes |
|---------|------|--------|-----|-------|
| Gateway | 4001 | **COMPLETE** | 554 | Auth, proxy, WebSocket, SSE, Redis pub/sub |
| Agent | 8000 | **COMPLETE** | 4877 | 32 tools, full loop, Manus-aligned prompt |
| Task | 4002 | **COMPLETE** | 585 | Inngest + Drizzle CRUD + WebSocket events |
| File | 4005 | **COMPLETE** | 492 | S3 upload, versioning, webhooks, pagination |
| Billing | 4008 | **PARTIAL** | 343 | All DB queries, 4 Stripe TODOs only |
| Connector | 4009 | **COMPLETE** | 800 | Composio SDK, OAuth, catalog sync, tools |
| Device | 4001 | **COMPLETE** | 792 | CRUD, commands, heartbeat, WebSocket, HA E2E |
| Notification | 4006 | **COMPLETE** | 364 | Knock email, Web Push, in-app, quiet hours |
| Webhook | 4007 | **COMPLETE** | 289 | Event dispatch, HMAC, retries |
| Sandbox | 4012 | **COMPLETE** | 682 | E2B integration, code/shell exec, files |
| Knowledge | 4011 | **COMPLETE** | 515 | RAG pipeline, embeddings, vector search |
| Project | 4010 | **COMPLETE** | 313 | CRUD, members, sessions, files |
| Search | 4013 | **COMPLETE** | 775 | Typesense + DB ILIKE fallback |
| Website | 4004 | **PARTIAL** | 1285 | Templates, file CRUD, AI gen stub |

### tRPC Routers (16 routers, 160+ procedures, ALL real queries)

| Router | Procedures | Lines |
|--------|-----------|-------|
| sessions | 5 (CRUD + search sync) | 120 |
| messages | 3 (list, send, add) | 104 |
| agents | 7 (CRUD + tasks) | 281 |
| files | 8 (CRUD + versions) | 244 |
| connectors | 12 (CRUD + OAuth + tools) | 374 |
| notifications | 10 (CRUD + push + prefs) | 333 |
| scheduledTasks | 10 (CRUD + exec history) | 379 |
| projects | 13 (CRUD + members + groups) | 548 |
| knowledge | 14 (groups + items + RAG) | 460 |
| billing | 18 (plans + credits + Stripe) | 608 |
| mail | 11 (mailbox + AgentMail SDK) | 296 |
| user | 14 (profile + prefs + export) | 392 |
| search | 7 (global + reindex) | 203 |
| devices | 7 (proxies to service) | 178 |
| webhooks | 11 (CRUD + delivery + retry) | 344 |
| websiteBuilder | 16 (projects + files + deploy) | 618 |

### Chat Pipeline (FULL FLOW — Feb 2026)

- [x] `/api/chat/route.ts` (490 lines) — SSE transform, agent proxy, DB persistence
- [x] `useChat` from `@ai-sdk/react` — replaced useRealTimeChat
- [x] Agent service proxy — transforms SSE to UIMessageStream format
- [x] Fallback to direct AI SDK `streamText()` if agent unavailable
- [x] DB persistence — user & assistant messages saved, session auto-titled
- [x] Tool registry — 10+ renderers (WebSearch, CodeBlock, Terminal, etc.)

### Redux State (46 slices — 100% Manus coverage)

- [x] 43 Manus-aligned slices (all defaults, types, keys verified)
- [x] 3 Rubic-specific slices (agents, devices, search)
- [x] 0 TypeScript errors in slice files (138 pre-existing elsewhere)

---

## Frontend Page Status

| Page | Status | Backend | What's Missing |
|------|--------|---------|----------------|
| Dashboard | **WORKS** | N/A | Wire tRPC session creation (uses sessionStorage), example prompts |
| Chat | **WORKS** | **Complete** | Agent workspace panel, tool approval UX |
| Applications | **DONE** | **Complete** | — |
| Devices | **DONE** | **Complete** | — |
| Files/Library | **EMPTY** | **Complete** | Entire client component needed |
| Settings | **12+ tabs** | **Complete** | Most wired, billing needs Stripe |
| Search | **WORKS** | **Complete** | Needs Typesense running |

---

## P0 — Launch Blockers

### 1. Sidebar Real Sessions
**Slices:** sessions, navbar, configs

- [ ] Replace hardcoded dummy chats → `sessions.list` tRPC
- [ ] Group by date (Today, Yesterday, Last 7 days, Older)
- [ ] Wire navbar tabKey, isNavBarMinimal, hover lock
- [ ] Wire sessionListPinned from configs
- [ ] ChatItem actions: Rename, Delete, Archive, Pin
- [ ] New Task → sessions.create → navigate /chat/[id]
- [ ] Remove Knowledge + Builder nav links

### 2. Dashboard Session Flow
**Slices:** sessions, chat

- [ ] `sessions.create` tRPC before navigate
- [ ] Pass initial message via `?q=` param
- [ ] Wire credit balance from billing
- [ ] Wire taskMode default "agent"

### 3. Stripe Billing (4 TODOs)
**Slice:** billing

- [ ] createSubscriptionCheckout
- [ ] createCreditPurchaseCheckout
- [ ] getBillingPortalUrl
- [ ] deletePaymentMethod
- [ ] Webhook handler
- [ ] Wire creditPackages, personalPlanTiers, teamPlanTiers
- [ ] Wire trials, SSO/SCIM subscriptions

### 4. Files / Library Page
**Slices:** library, fileManagement, filePreviewer, fileShare

- [ ] Grid/list view toggle (viewType)
- [ ] Filter by doc type (filterDocType)
- [ ] Folders (attachmentGroupList)
- [ ] Favorites (isFavorite)
- [ ] Search (searchValue)
- [ ] Upload with progress (uploadProgress)
- [ ] Multi-format preview: PDF, image, code, markdown, slides, video, audio
- [ ] Version history (fileHistory)
- [ ] Share links (fileShare slice)
- [ ] Download tracking

### 5. Agent Workspace Panel
**Slices:** agentWorkspace, codeViewer, timeline

- [ ] Workspace sidebar: agents, sources, files, computer tabs
- [ ] Sandbox preview with drag positioning
- [ ] Planner expand/collapse
- [ ] Code viewer: directory tree, file tabs, syntax highlighting
- [ ] Timeline scrubber: segment events, percentage playback
- [ ] VNC dialog
- [ ] Mobile layout adaptation

---

## P1 — Core UX

### 6. Onboarding Wizard
**Slice:** onboarding

- [ ] Multi-step: welcome → persona → interests → connectors → workspace → complete
- [ ] Persona selection (developer, designer, researcher, etc.)
- [ ] Connector recommendations
- [ ] Team invite suggestions
- [ ] Skip + resume

### 7. Skills System
**Slice:** skills

- [ ] Official skills catalog (seed 7+)
- [ ] User custom skills CRUD
- [ ] Enable/disable per skill
- [ ] Search
- [ ] Skills in chat prompt → agent context

### 8. Knowledge Base
**Slice:** knowledge

- [ ] Knowledge list + pagination
- [ ] AI-suggested knowledge per session
- [ ] Accept/reject suggestions
- [ ] CRUD operations
- [ ] Search + tag filtering
- [ ] Wire to Knowledge Service (RAG)
- [ ] Auto-learn setting (configs.automaticallyLearnKnowledge)

### 9. Notifications
**Slice:** notifications

- [ ] Real-time feed component
- [ ] Category grouping
- [ ] "What's New" page
- [ ] Read/unread + bulk actions
- [ ] Preferences UI
- [ ] Web Push (backend ready)

### 10. Session Switcher (Cmd+K)
**Slice:** sessionSwitch

- [ ] Keyboard shortcut
- [ ] Fuzzy search
- [ ] Arrow key navigation
- [ ] Recent sessions prioritized

### 11. File Storage Connectors
**Slice:** fileConnector

- [ ] Connector list with status
- [ ] OAuth flows
- [ ] 9+ services (Google Drive, OneDrive, Dropbox, Box, Notion, Figma...)

### 12. Example Prompts
**Slice:** example

- [ ] Seed 10-20 curated prompts
- [ ] Dashboard display
- [ ] Category grouping
- [ ] Click → new session

### 13. Agent Mail
**Slice:** agentMail

- [ ] Agent email info display
- [ ] Whitelist management
- [ ] Sub-emails
- [ ] Unread indicator
- [ ] Settings tab

---

## P2 — Power Features

### 14. Web Dev IDE
**Slices:** webDev, webDevUsage, webdevAuth

- [ ] File structure browser
- [ ] Live preview (preview/code/console/network tabs)
- [ ] Database browser
- [ ] Project settings
- [ ] Deploy workflow
- [ ] Usage tracking + budget management

### 15. AI Canvas
**Slices:** aiCanvas, aiCanvasEditor

- [ ] Canvas CRUD + OCR cache
- [ ] Shape tools, selection, pan/zoom
- [ ] Brushing, marking, text editing
- [ ] Screenshots, comments, settings
- [ ] Fullscreen mode

### 16. Slide Editor
**Slice:** slideEditor

- [ ] Slide management
- [ ] Templates (from chat.slideTemplateList)
- [ ] AI-generated slides

### 17. Community / Explore
**Slice:** community

- [ ] Shared session display
- [ ] Group-based organization
- [ ] Fork public sessions

### 18. Map/Reduce UI
**Slice:** mapReduce

- [ ] Parallel processing flow
- [ ] Worker status display
- [ ] Results aggregation

### 19. Timeline Replay
**Slice:** timeline

- [ ] Event visualization
- [ ] Playback scrubber + controls
- [ ] Segment lazy loading
- [ ] Event type rendering

### 20. Playbooks
**Slice:** products

- [ ] Creation form
- [ ] Browse + search
- [ ] Recommended in chat
- [ ] One-click use

### 21. Enterprise
**Slices:** enterpriseTeam, team

- [ ] API keys CRUD
- [ ] Audit log viewer
- [ ] SSO config
- [ ] SCIM integration
- [ ] Access controls

---

## P3 — Polish

### 22. A/B Experiments
**Slice:** experiment — Feature flag SDK + backend variants

### 23. Guest Pages
**Slice:** guestPage — Anonymous viewing + UI adaptation

### 24. Login Flow State
**Slice:** login — Wire to Better-Auth forms

### 25. Meeting Features
**Slice:** meeting — Meeting intro + scheduling

### 26. Browser Extension
**Slice:** myBrowser — Extension settings + install

### 27. Image Styles
**Source:** chat slice — Seed 15+ styles, selection UI

### 28. Data Visualization
**Source:** chat slice — In-chat charts/graphs

---

## Instruction File Index

| File | Covers |
|------|--------|
| `.claude/frontend/dashboard/INSTRUCTIONS.md` | Dashboard, session creation, credits |
| `.claude/frontend/sidebar/INSTRUCTIONS.md` | Sidebar, nav, real chats, filters |
| `.claude/frontend/chat/INSTRUCTIONS.md` | Chat pipeline, tools, Rubic Computer |
| `.claude/frontend/prompt/INSTRUCTIONS.md` | Unified prompt, toolbar, connectors |
| `.claude/frontend/library/INSTRUCTIONS.md` | Files page, upload, preview, folders |
| `.claude/frontend/applications/INSTRUCTIONS.md` | App marketplace, Composio, OAuth |
| `.claude/frontend/devices/INSTRUCTIONS.md` | Device dashboard, smart home, HA |
| `.claude/frontend/FRONTEND_MASTER.md` | Frontend architecture overview |
| `.claude/backend/agent/INSTRUCTIONS.md` | Agent service (1700+ lines) |
| `.claude/backend/BACKEND_MASTER.md` | Backend architecture overview |
| `.claude/database/DATABASE_MASTER.md` | Database schema reference |
| `.claude/business/VISION.md` | Business vision |
| `docs/IMPLEMENTATION_ROADMAP.md` | Full feature roadmap (this companion) |
| `docs/application-feature-specification.md` | Manus feature spec (1294 lines) |
| `Redux-State-Slice-Explanations.md` | What each slice does (source of truth) |
