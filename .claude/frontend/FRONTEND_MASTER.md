# Frontend Master Instructions

> **App:** `apps/app/` | **Framework:** Next.js + React + TypeScript + Tailwind + Radix UI

## Architecture

```
apps/app/
├── app/
│   ├── (authenticated)/          # Protected routes
│   │   ├── layout.tsx            # Auth guard, providers, sidebar
│   │   ├── page.tsx              # Homepage with chat input
│   │   ├── chat/[id]/            # Chat sessions
│   │   ├── files/                # Library/file manager
│   │   ├── devices/              # Device dashboard
│   │   ├── applications/         # App marketplace
│   │   ├── actions/              # Tasks/Actions/Schedules
│   │   ├── search/               # Search results
│   │   ├── webhooks/             # Webhook management
│   │   └── components/           # Shared authenticated components
│   │       ├── chat-section.tsx   # Homepage chat input
│   │       ├── rubic-input/      # Prompt input component
│   │       └── settings/         # Settings modal + tabs
│   ├── (unauthenticated)/        # Public routes (login, signup)
│   ├── api/
│   │   ├── auth/                 # Better-Auth handler
│   │   ├── chat/route.ts         # AI streaming endpoint
│   │   ├── collaboration/        # Liveblocks auth
│   │   └── trpc/                 # tRPC handler
│   └── layout.tsx                # Root layout
├── lib/
│   ├── store/                    # Redux store
│   │   ├── store.ts              # Store configuration
│   │   ├── hooks.ts              # useAppDispatch, useAppSelector
│   │   └── slices/               # 45 Redux slices
│   ├── trpc/                     # tRPC setup
│   │   ├── init.ts               # Router/procedure creation
│   │   ├── server.ts             # Server-side caller
│   │   ├── client.ts             # Client-side hooks
│   │   └── routers/              # 15 tRPC routers
│   ├── socket/                   # WebSocket (Socket.io)
│   │   ├── client.ts             # Socket connection
│   │   ├── events.ts             # Typed events
│   │   └── provider.tsx          # React context + Redux sync
│   └── auth-client.ts            # Better-Auth client
└── components/                   # Shared UI (from @repo/design-system)
```

## State Management Pattern

**Redux** is the primary state store. All real-time updates come through WebSocket → Redux dispatch.

```typescript
// Reading state
const messages = useAppSelector((state) => state.chat.messagesBySession[sessionId]);
const isConnected = useAppSelector((state) => state.websocket.status === "connected");

// Dispatching
dispatch(addMessage({ sessionId, id, role, content, createdAt }));
```

**tRPC** is for server communication (CRUD operations).

```typescript
// Queries (auto-cached)
const { data: plans } = trpc.billing.listPlans.useQuery();

// Mutations
const createSession = trpc.sessions.create.useMutation();
await createSession.mutateAsync({ title: "New Chat" });
```

## Key Existing Files (REAL implementations)

| File                                                 | Lines | What It Does                                          |
| ---------------------------------------------------- | ----- | ----------------------------------------------------- |
| `lib/store/slices/chat.slice.ts`                     | 475   | Message management, streaming state, file attachments |
| `lib/store/slices/agents.slice.ts`                   | 166   | Agent types, status tracking, task management         |
| `lib/socket/provider.tsx`                            | 295   | WebSocket ↔ Redux bridge, all event handlers         |
| `lib/trpc/routers/billing.router.ts`                 | 534   | Full billing CRUD with Drizzle queries                |
| `lib/trpc/routers/sessions.router.ts`                | 119   | Session CRUD + search sync                            |
| `lib/trpc/routers/messages.router.ts`                | 103   | Message CRUD (TODO: trigger agent)                    |
| `lib/trpc/routers/search.router.ts`                  | 153   | Typesense integration                                 |
| `lib/trpc/routers/devices.router.ts`                 | 174   | Device service proxy                                  |
| `app/api/chat/route.ts`                              | 50    | AI SDK streamText                                     |
| `app/(authenticated)/layout.tsx`                     | 65    | Auth guard + providers                                |
| `app/(authenticated)/chat/[id]/chat-page-client.tsx` | 327   | useRealTimeChat + Redux                               |

## Pages That Need Work

| Page             | Current State             | What Needs Building                                                 |
| ---------------- | ------------------------- | ------------------------------------------------------------------- |
| **Chat**         | Works for basic streaming | Agent orchestration, tool visualization, file attachments, DAG view |
| **Files**        | Empty placeholder         | Full file manager (grid/list, upload, folders, sharing)             |
| **Devices**      | Mock data, no backend     | Real device cards, controls, automations                            |
| **Applications** | Empty placeholder         | Composio app grid, OAuth connect flow                               |
| **Actions**      | Three empty tabs          | Tasks list/board/calendar, action builder, schedule manager         |
| **Settings**     | Tab structure exists      | Wire all tabs to real data (see settings/INSTRUCTIONS.md)           |
| **Search**       | Basic component           | Full search results with filters                                    |

## Component Patterns

### Page Component Pattern

```typescript
// app/(authenticated)/xyz/page.tsx
export default async function XyzPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return <XyzPageClient user={session.user} />;
}
```

### Client Component Pattern

```typescript
"use client";
export function XyzPageClient({ user }: { user: User }) {
  const { data, isLoading } = trpc.xyz.list.useQuery();
  const dispatch = useAppDispatch();
  // ...
}
```

## Tool UI Components Needed

Reference: `docs/features_manus_reverse_engineering/Manus_Application_Feature_Specification.md`

The chat interface should render rich tool outputs:

- **Location maps** - For location-based tool results
- **Data tables** - For structured data
- **Code blocks** - With syntax highlighting and copy
- **Charts** - For data visualization
- **File cards** - For generated/uploaded files
- **Approval cards** - For actions needing user approval
- **Progress trackers** - For multi-step agent tasks
- **Terminal output** - For code execution results
- **Website preview** - For generated websites (iframe)
- **Image gallery** - For generated/searched images

## Performance Requirements

- **First paint** < 1.5s
- **Chat response start** < 500ms
- **WebSocket reconnect** < 2s
- **Search results** < 200ms
- Optimistic UI updates for all mutations
- Virtual scrolling for long message lists
- Lazy loading for heavy components (editor, charts)
