# Rubic Implementation Roadmap

**Last Updated:** 2026-02-06
**Status:** Active — Aligned with Manus 44-slice architecture

---

## Current State Summary

| Metric | Value |
|--------|-------|
| Redux slices | **46** (43 Manus-aligned + 3 Rubic-specific) |
| tRPC routers | **16** (160+ procedures, all real DB queries) |
| Backend services | **14** (11 complete, 3 partial) |
| Agent service | **~4877 LOC Python** — 32 tools, full loop |
| Chat pipeline | **Full SSE** — agent proxy + fallback + DB persistence |
| Frontend pages done | Dashboard, Chat, Applications, Devices, Settings |
| Frontend pages needed | Library, Community, Onboarding, + feature panels |

---

## What's DONE (Do Not Rebuild)

These items from previous roadmaps are **COMPLETE**:

- [x] Agent tool loop — 32 tools, Manus-aligned, full execution loop
- [x] Chat pipeline — useChat + SSE transform + agent proxy + DB persistence
- [x] Applications page — 36 connectors, marketplace UI, OAuth, config panel
- [x] Devices page — 30 device catalog, My Devices, Smart Home, HA integration
- [x] Model selector removed — agent routes internally
- [x] Redux state alignment — 46 slices, 100% Manus coverage
- [x] Task service — Real Inngest + Drizzle (NOT in-memory)
- [x] Connector service — Composio SDK integrated
- [x] All tRPC routers — 160+ procedures with real queries

---

## P0 — Make It Production-Ready

> These block launch. Without them the app doesn't feel complete.

### 1. Sidebar: Real Sessions + Navigation

**Slices:** `sessions`, `navbar`, `configs`
**What it does:** Left sidebar shows real chat sessions grouped by date, nav tab tracking, minimal/expanded mode, pin/lock hover behavior.

- [ ] Replace 8 hardcoded dummy chats with `sessions.list` tRPC query
- [ ] Group sessions by date (Today, Yesterday, Last 7 days, Older)
- [ ] Wire navbar slice: `tabKey` tracking (task, library, etc.), `isNavBarMinimal` toggle, hover expand with lock
- [ ] Wire `sessionListPinned` from configs slice
- [ ] Wire ChatItem actions (Rename, Delete, Archive, Pin/Favorite)
- [ ] New Task button → `sessions.create` → navigate to `/chat/[id]`
- [ ] Remove Knowledge + Builder nav links (pages deleted or redirected)

### 2. Dashboard → Chat Session Flow

**Slices:** `sessions`, `chat`, `configs`
**What it does:** User types prompt on dashboard, session is created in DB, navigates to chat with initial message.

- [ ] Dashboard prompt: call `sessions.create` tRPC mutation FIRST
- [ ] Navigate to `/chat/[sessionId]?q=encodedMessage`
- [ ] Chat page: read `?q=` param, send as first message
- [ ] Replace hardcoded credits with `billing.getCreditBalance` query
- [ ] Wire `taskMode` from chat slice (default "agent")

### 3. Stripe Billing Integration

**Slices:** `billing` (maps to Manus `biz`)
**What it does:** Credit packages, plan tiers (personal + team), SSO/SCIM pricing, trials, auto top-up, Stripe checkout.

- [ ] `createSubscriptionCheckout` — `stripe.checkout.sessions.create()`
- [ ] `createCreditPurchaseCheckout` — `stripe.checkout.sessions.create()`
- [ ] `getBillingPortalUrl` — `stripe.billingPortal.sessions.create()`
- [ ] `deletePaymentMethod` — `stripe.paymentMethods.detach()`
- [ ] Billing service: 4 matching Stripe TODOs
- [ ] Stripe webhook handler for subscription events
- [ ] Wire `creditPackages`, `personalPlanTiers`, `teamPlanTiers` to pricing page
- [ ] Wire `trials`, `teamSSOSubscription`, `teamSCIMSubscription` to enterprise billing

### 4. Files / Library Page

**Slices:** `library`, `fileManagement`, `filePreviewer`, `fileShare`
**What it does:** Central attachment library with grid/list views, folders, favorites, search, file preview with multi-format support, sharing.

- [ ] Create `files-page-client.tsx` with grid/list view toggle (`viewType`)
- [ ] Tab filtering by `filterDocType` (0=all, 1=doc, 2=pdf, 3=image...)
- [ ] Attachment groups/folders (`attachmentGroupList`) management
- [ ] Favorites toggle (`isFavorite`)
- [ ] Search (`searchValue`)
- [ ] File upload with progress tracking (`uploadProgress`)
- [ ] File preview modal — multi-format: PDF, image, code, markdown, slides, video, audio (`mode`, `previewData`)
- [ ] File version history (`fileHistory`, `currentHistoryVersionUid`)
- [ ] Share popover — create shareable links (`fileShare` slice)
- [ ] File sync status (`syncingFile`, `saveStatus`)

### 5. Agent Workspace Panel (Rubic Computer)

**Slices:** `agentWorkspace`, `codeViewer`, `timeline`
**What it does:** Split-screen agent workspace with sandbox preview, code viewer, planner, timeline — the core differentiator from ChatGPT.

- [ ] Workspace sidebar with tabs: agents, sources, files, computer (`sidebarType`)
- [ ] Live sandbox preview with draggable positioning (`initialComputerPosition`)
- [ ] Planner panel expand/collapse (`isPlannerExpanded`)
- [ ] Code viewer — directory tree, file tabs, syntax highlighting (`codeViewer` slice full)
- [ ] Timeline scrubber — session event replay (`percentage`, `segmentEventsMap`)
- [ ] VNC dialog for remote computer access (`vncDialogVisible`)
- [ ] Animation lock for smooth transitions (`animationLock`)
- [ ] Mobile workspace layout (`isSidebarVisibleInMobile`)
- [ ] Chat reply search within agent messages (`chatReplySearchResults`)

---

## P1 — Core User Experience

> Essential features for a complete product. Users expect these.

### 6. Onboarding Wizard

**Slice:** `onboarding`
**What it does:** Multi-step new user flow: welcome → persona selection → interests → connector suggestions → workspace setup → complete.

- [ ] Multi-step wizard component with progress indicator
- [ ] User persona selection (developer, designer, researcher, marketer, analyst, student, business)
- [ ] User type (individual, team, enterprise)
- [ ] Interest/use-case selection
- [ ] Connector recommendations based on persona
- [ ] Team member invitation suggestions (`teamCandidateList`)
- [ ] Skip and resume capability (`skippedSteps`)
- [ ] Completion tracking (`isCompleted`, `completedAt`)

### 7. Skills / Plugins System

**Slice:** `skills`
**What it does:** Extendable AI capabilities — official platform skills + user-created custom skills that get passed as context to the agent.

- [ ] Official skills catalog (seed 7+ platform skills)
- [ ] User-created custom skills CRUD
- [ ] Enable/disable individual skills
- [ ] Search within skills (`searchQuery`)
- [ ] Skills button in chat prompt — shows active skills
- [ ] Pass active skills to agent service as system prompt context

### 8. Knowledge Base

**Slice:** `knowledge`
**What it does:** Personal knowledge store. AI suggests knowledge items during sessions. Users can accept/reject. Used for RAG context injection.

- [ ] Knowledge item list with pagination (`userKnowledgeList`, `cursor`)
- [ ] AI-suggested knowledge items per session (`suggestedKnowledgeMap`)
- [ ] Accept/reject suggested knowledge
- [ ] CRUD: add, update, delete knowledge items
- [ ] Search and tag-based filtering (`searchQuery`, `selectedTags`)
- [ ] Connect to Knowledge Service (RAG pipeline, vector search, embeddings)
- [ ] Auto-learn setting from configs (`automaticallyLearnKnowledge`)

### 9. Notification System

**Slice:** `notifications`
**What it does:** In-app notification feed with categories, "What's New" page, Web Push, email notifications, quiet hours.

- [ ] Real-time notification feed component
- [ ] Category-based notification grouping (`categoryNotifications`)
- [ ] "What's New" update page (`updatePageNotificationList`)
- [ ] Mark read/unread, bulk actions
- [ ] Notification preferences UI (sound, desktop, email)
- [ ] Web Push subscription (service already handles it)
- [ ] Connect to Knock notification service (backend complete)

### 10. Quick Session Switcher

**Slice:** `sessionSwitch`
**What it does:** Cmd+K style quick navigation between sessions with fuzzy search.

- [ ] Cmd+K keyboard shortcut to open
- [ ] Fuzzy search by session title (`keyword`)
- [ ] Keyboard navigation (arrow keys + Enter)
- [ ] Recent sessions prioritized
- [ ] Loading state while searching

### 11. File Storage Connectors

**Slice:** `fileConnector`
**What it does:** Connect cloud storage services (Google Drive, OneDrive, Dropbox, Box, Notion, Figma, etc.) for file access.

- [ ] File connector list with connect/disconnect status
- [ ] OAuth connection flow per service
- [ ] Sync status per connector
- [ ] Settings page integration
- [ ] 9+ file storage integrations (matching Manus: Google Drive, OneDrive, Dropbox, Box, Notion, Figma, Google Docs, Google Sheets, Microsoft Office)

### 12. Example Prompts / Homepage Gallery

**Slice:** `example`
**What it does:** Example prompts displayed on the homepage/dashboard to inspire users.

- [ ] Seed example prompts (10-20 curated prompts across categories)
- [ ] Display on dashboard when no active session
- [ ] Category grouping (coding, research, writing, data analysis, etc.)
- [ ] Click to start new session with prompt
- [ ] Loading state (`exampleListLoading`)

### 13. Agent Mail

**Slice:** `agentMail` (Manus: `mailManus`)
**What it does:** Special email address for each user to interact with the agent via email. Whitelist management, sub-emails, unread tracking.

- [ ] Agent email info display (`agentEmailInfo`)
- [ ] Email whitelist management — add/remove allowed senders
- [ ] Sub-email addresses (`agentSubEmails`)
- [ ] Unread unknown email indicator (`hasUnreadUnknownEmail`)
- [ ] Settings tab for agent mail configuration
- [ ] `initTab` for default view on open

---

## P2 — Advanced Features

> Differentiators and power-user features. Build after P0/P1 are solid.

### 14. Web Dev IDE

**Slices:** `webDev`, `webDevUsage`, `webdevAuth`
**What it does:** Full web development workspace — file structure, live preview, database browser, project settings, cloud storage, publishing (including mobile/iOS builds).

- [ ] Project file structure browser
- [ ] Live preview panel (preview, code, console, network tabs)
- [ ] Database browser for project databases
- [ ] Project settings management
- [ ] Cloud storage integration
- [ ] Publish/deploy workflow
- [ ] Mobile build support (iOS build logs)
- [ ] Usage/billing tracking per web dev project (`webDevUsage`)
- [ ] Budget management per project
- [ ] Fullscreen mode (`isFullscreenMode`)

### 15. AI Canvas

**Slices:** `aiCanvas`, `aiCanvasEditor`
**What it does:** AI-powered drawing/annotation canvas with OCR, shapes, brushing, marking, text editing, screenshots, comments.

- [ ] Canvas creation and management (`allAiCanvas`)
- [ ] OCR cache for image text extraction (`ocrCache`)
- [ ] Shape drawing tools (rectangle, circle, line, freehand, etc.)
- [ ] Camera pan/zoom controls
- [ ] Selection, hovering, multi-select
- [ ] Brushing and marking tools
- [ ] Text editing mode
- [ ] Screenshot capture
- [ ] Comment system with history
- [ ] Context menu
- [ ] Editor settings (grid, snap, etc.)
- [ ] Fullscreen mode

### 16. Slide Editor

**Slice:** `slideEditor`
**What it does:** Presentation slide editor for creating/editing slide decks.

- [ ] Slide array management (`slides`)
- [ ] Session-linked slide decks (`sessionUid`)
- [ ] Slide templates (from `slideTemplateList` in chat slice)
- [ ] Pinned slide template (`pinnedSlideTemplateId`)
- [ ] AI-generated slides from prompts

### 17. Community / Explore Page

**Slice:** `community`
**What it does:** Public page showing shared sessions/projects from other users, organized into groups.

- [ ] Data source loading and display (`dataSource`)
- [ ] Grouped display by category (`groupedIds`, `groupedTotalMap`)
- [ ] Search/filter shared content
- [ ] "Use this" to fork a public session

### 18. Map/Reduce (Parallel Processing)

**Slice:** `mapReduce`
**What it does:** UI for the orchestrator-worker pattern — split tasks into parallel sub-tasks.

- [ ] Start parallel processing flow (`startLoading`)
- [ ] Fullscreen parallel task view (`isFullscreen`)
- [ ] Visual worker status display
- [ ] Results aggregation view

### 19. Session Timeline Replay

**Slice:** `timeline`
**What it does:** Full session replay — scrub through every event (messages, tool calls, file changes, browser actions).

- [ ] Timeline visualization component
- [ ] Playback scrubber (0-100%, default at end)
- [ ] Play/pause controls with speed adjustment
- [ ] Segment-based event grouping with lazy loading
- [ ] Event type rendering (tool calls, messages, files, browser)
- [ ] Selected event detail view

### 20. Playbooks / Products

**Slice:** `products`
**What it does:** Reusable workflow templates (playbooks) — create from chat prompt with file attachments.

- [ ] Playbook creation form (`inputValue`, `files`)
- [ ] Playbook info display (`playbookInfo`)
- [ ] Recommended playbooks in chat (`recommendedPlaybooksV2` in chat slice)
- [ ] Playbook browser/search
- [ ] One-click use from chat prompt

### 21. Enterprise Features

**Slices:** `enterpriseTeam`, `team`
**What it does:** Enterprise team management — API keys, audit logs, SSO, SCIM, access controls.

- [ ] API key management (create, revoke, list with permissions)
- [ ] Audit log viewer with pagination
- [ ] SSO configuration (`ssoInfo`)
- [ ] SCIM integration (`scimUnmanagedAccounts`)
- [ ] Access controls management
- [ ] Team renewal settings
- [ ] Enterprise billing (SSO/SCIM subscriptions from billing slice)

---

## P3 — Infrastructure & Polish

> Not user-facing features but important for production.

### 22. A/B Experiment System

**Slice:** `experiment`
**What it does:** Feature flags with client-side SDK variants + server-side backend variants.

- [ ] Experiment SDK integration (Statsig/LaunchDarkly/custom)
- [ ] Frontend variant application (`variants`)
- [ ] Backend variant sync (`backendVariants`)
- [ ] Feature gating in components

### 23. Guest Page Support

**Slice:** `guestPage`
**What it does:** Anonymous/unauthenticated page viewing with UI adaptation.

- [ ] Guest detection flag (`isInGuestPage`)
- [ ] UI adaptation — hide auth-required elements
- [ ] Public session/file viewing
- [ ] CTA to sign up

### 24. Login Flow State

**Slice:** `login`
**What it does:** Multi-step login/registration form state (email check → login/register → verify code → complete).

- [ ] Wire login slice to Better-Auth forms
- [ ] Email verification code flow
- [ ] Captcha integration
- [ ] Team/edu invitation acceptance during login
- [ ] Loading states per step

### 25. Meeting Features

**Slice:** `meeting`
**What it does:** Meeting-related features with intro guide.

- [ ] Meeting intro modal (`shouldShowMeetingIntro`)
- [ ] Meeting scheduling integration
- [ ] Meeting notes with AI summary

### 26. Browser Extension

**Slice:** `myBrowser`
**What it does:** Browser extension settings and install tracking.

- [ ] Browser extension detection
- [ ] Settings management (`browserSettings`)
- [ ] Install permission/prompt (`allowInstall`)

### 27. Image Generation Styles

**Source:** `chat` slice (`imageStyleList`, `imageStyleListLoading`)
**What it does:** Curated image generation styles for AI image creation.

- [ ] Seed image style list (15+ styles per Manus)
- [ ] Style selection UI in chat prompt
- [ ] Pass selected style to image generation tool

### 28. Data Visualization

**Source:** `chat` slice (`dataVisualization`)
**What it does:** In-chat data visualization for analysis results.

- [ ] Chart/graph rendering in chat messages
- [ ] Support for common chart types (bar, line, pie, scatter)
- [ ] Interactive visualization controls

---

## Slice → Feature Cross-Reference

| Slice | Feature | Priority | Status |
|-------|---------|----------|--------|
| `_persist` | — | — | Skipped (infra) |
| `agentWorkspace` | Agent Workspace Panel | P0-5 | Slice done, UI needed |
| `aiCanvas` | AI Canvas | P2-15 | Slice done, UI needed |
| `aiCanvasEditor` | AI Canvas Editor | P2-15 | Slice done, UI needed |
| `api` | RTK Query | — | **DONE** |
| `auth` | Authentication | — | **DONE** (Better-Auth) |
| `billing` | Stripe Billing | P0-3 | Slice done, 4 Stripe TODOs |
| `chat` | Chat Interface | — | **DONE** (streaming) |
| `codeViewer` | Code Viewer Panel | P0-5 | Slice done, UI needed |
| `community` | Explore Page | P2-17 | Slice done, UI needed |
| `configs` | Client Preferences | — | **DONE** |
| `connectors` | Applications | — | **DONE** |
| `enterpriseTeam` | Enterprise Features | P2-21 | Slice done, UI needed |
| `example` | Example Prompts | P1-12 | Slice done, seed + UI needed |
| `experiment` | A/B Testing | P3-22 | Slice done, SDK needed |
| `fileConnector` | Cloud Storage | P1-11 | Slice done, UI needed |
| `fileManagement` | File Management | P0-4 | Slice done, wire to library |
| `filePreviewer` | File Preview | P0-4 | Slice done, UI needed |
| `fileShare` | File Sharing | P0-4 | Slice done, UI needed |
| `guestPage` | Guest Pages | P3-23 | Slice done, route guard needed |
| `knowledge` | Knowledge Base | P1-8 | Slice done, UI needed |
| `library` | Library/Files Page | P0-4 | Slice done, UI needed |
| `login` | Login Flow State | P3-24 | Slice done, wire to auth |
| `agentMail` | Agent Mail | P1-13 | Slice done, UI needed |
| `mapReduce` | Parallel Processing | P2-18 | Slice done, UI needed |
| `meeting` | Meeting Features | P3-25 | Slice done, feature TBD |
| `myBrowser` | Browser Extension | P3-26 | Slice done, extension TBD |
| `navbar` | Navigation | P0-1 | Slice done, wire to sidebar |
| `notifications` | Notifications | P1-9 | Slice done, UI needed |
| `onboarding` | Onboarding Wizard | P1-6 | Slice done, UI needed |
| `products` | Playbooks | P2-20 | Slice done, UI needed |
| `projects` | Projects | — | **DONE** (tRPC complete) |
| `scheduledTasks` | Scheduled Tasks | — | **DONE** (Inngest + DB) |
| `search` | Search | — | **DONE** (Typesense) |
| `sessionSwitch` | Quick Switcher | P1-10 | Slice done, UI needed |
| `sessions` | Sessions | P0-1 | Slice done, wire to sidebar |
| `skills` | Skills/Plugins | P1-7 | Slice done, UI needed |
| `slideEditor` | Slide Editor | P2-16 | Slice done, UI needed |
| `team` | Team Management | P2-21 | Slice done, partial UI |
| `timeline` | Session Replay | P2-19 | Slice done, UI needed |
| `ui` | Global UI State | — | **DONE** |
| `webDev` | Web Dev IDE | P2-14 | Slice done, UI needed |
| `webDevUsage` | Web Dev Usage | P2-14 | Slice done, wire to billing |
| `webdevAuth` | Web Dev Auth | P2-14 | Slice done (empty) |
| `websocket` | Real-time Events | — | **DONE** |
| `agents` | Agent Management | — | **DONE** (Rubic-specific) |
| `devices` | Device Management | — | **DONE** (Rubic-specific) |

---

## Acceptance Criteria

### Must Work (P0)

- [ ] Type prompt → creates DB session → chat responds with tools → workspace shows sandbox
- [ ] Sidebar shows real sessions grouped by date
- [ ] Library page: upload, download, preview (multi-format), folders, search, share
- [ ] Agent workspace: code viewer, sandbox preview, planner, timeline
- [ ] Stripe checkout works for subscriptions and credit purchases

### Should Work (P1)

- [ ] New user onboarding wizard with persona + connector suggestions
- [ ] Skills system: browse, create, enable/disable, used in agent context
- [ ] Knowledge base: CRUD, AI suggestions, RAG integration
- [ ] Notifications: real-time feed, categories, Web Push
- [ ] Cmd+K session switcher
- [ ] File storage connectors (Google Drive, OneDrive, etc.)
- [ ] Example prompts on dashboard
- [ ] Agent mail configuration

### Power Features (P2)

- [ ] Web Dev IDE with live preview + deploy
- [ ] AI Canvas with drawing/annotation/OCR
- [ ] Slide editor with AI generation
- [ ] Community/explore page
- [ ] Map/reduce parallel processing UI
- [ ] Session timeline replay
- [ ] Playbook creation and marketplace
- [ ] Enterprise: API keys, audit logs, SSO, SCIM

### Infrastructure (P3)

- [ ] A/B experiment system
- [ ] Guest page support
- [ ] Login flow state management
- [ ] Meeting features
- [ ] Browser extension
- [ ] Image style gallery
- [ ] Data visualization in chat
