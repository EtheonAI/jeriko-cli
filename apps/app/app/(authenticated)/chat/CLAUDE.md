# chat page — Testing Rules

## What This Is
Chat page: message display, input, streaming, tool rendering, canvas, planner bar.

## Key Files
- `[id]/page.tsx` — Server component, loads session + messages from DB
- `[id]/components/chat-client.tsx` — Client wrapper, canvas layout
- `[id]/components/chat-messages.tsx` — Message list + input
- `[id]/components/message-renderer.tsx` — Individual message rendering
- `[id]/components/thinking-indicator.tsx` — Streaming indicator
- `[id]/hooks/use-chat-session.ts` — Wraps useChat with Redux sync + body injection

## Critical Rules

### use-chat-session.ts (P0)
1. Wraps `useChat` from `@ai-sdk/react`
2. Syncs messages to Redux store
3. Injects session metadata in request body
4. Handles abort (stop) — BUT `resume` is NOT compatible with abort
5. `resume: true` auto-sends GET on mount to resume active streams

### page.tsx (P0)
1. Loads messages from DB with `parts` column
2. Filters out `role: "tool"` rows
3. Deduplicates user + assistant messages
4. Passes messages as initial data to client

### Message Rendering (P0)
1. User messages → user bubble
2. Assistant messages → assistant bubble with parts
3. Tool invocations → delegated to tool-registry renderers
4. show_plan → PlanWindow card inline + PlannerBar above input
5. Streaming → thinking indicator shown

## What to Test
1. Session loads correctly from URL param
2. Messages display in correct order
3. New message submission triggers POST to /api/chat
4. Streaming response renders incrementally
5. Tool calls render with correct renderer
6. Canvas opens for browser/terminal/code tools
7. Planner bar appears when show_plan is in messages
8. Error states (network failure, auth expiry) handled gracefully

## Test Stream Page (`test-stream/page.tsx`)
- **URL**: `/chat/test-stream`
- **Purpose**: E2E integration test for orchestrator + sandbox + SSE streaming
- **4 tabs**: Tests (10 automated), Browser (noVNC iframe), Terminal (shell exec), Files (CRUD)
- **Sandbox calls**: Via same-origin `/api/sandbox/*` proxy routes (NOT direct :4012)
- **Orchestrator calls**: Direct to :4014 (requires `crossOriginResourcePolicy: cross-origin` in Helmet)
- **sandboxIdRef**: Uses `useRef` to share sandboxId across async test closures (React state is stale in loops)
- **Desktop env**: noVNC + x11vnc + Xvfb + Chromium, auto-starts after sandbox creation, polls for readiness
