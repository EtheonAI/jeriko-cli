# Dashboard Page - Build Instructions

## Current State

### Dashboard Page (`apps/app/app/(authenticated)/page.tsx`, 67 lines)

Server component that renders:

- `Header` with title "Rubic", version "1.0", credits (600 hardcoded), isPro (false)
- `ChatSection` component with `showConfigBar` prop
- Hero text: "What can I do for you?" + subtitle
- Centered layout with max-w-xl

### ChatSection Component

Located at `apps/app/app/(authenticated)/components/chat-section.tsx`. This wraps the prompt input and optional config bar. The prompt currently does NOT create a session or send messages — it's static UI only.

### ChatInputToolbar (`apps/app/app/(authenticated)/components/chat-input-toolbar.tsx`, 115 lines)

Static toolbar with actions (slides, website, apps, design, more). `handleSubmit` just clears the input — no actual chat integration.

### What's Broken

1. **No session creation**: When user types a prompt and hits Enter, nothing happens — no session is created, no redirect to `/chat/[id]`
2. **No message sending**: The prompt doesn't call any API or tRPC mutation
3. **ChatInputToolbar is disconnected**: Uses local `useState` for input, `handleSubmit` just clears it
4. **Credits are hardcoded**: `credits={600}` in page.tsx, not from billing system
5. **Tool buttons are decorative**: Slides, website, apps, design buttons have no functionality

---

## What Needs Building

### 1. Dashboard Prompt → Session Creation → Chat Redirect (CRITICAL)

**Flow:**

```
User types prompt → Create session via tRPC → Redirect to /chat/[sessionId] → Send first message → Stream response
```

**Implementation:**

In the dashboard prompt component (either `ChatSection` or a new wrapper):

```typescript
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";

const router = useRouter();
const createSession = api.sessions.create.useMutation();

const handleSubmit = async (input: string) => {
  // 1. Create a new session
  const session = await createSession.mutateAsync({
    title: input.slice(0, 100), // Auto-title from first message
    modelId: selectedModel || "claude-sonnet",
    systemPrompt: "You are Rubic, a helpful AI assistant.",
  });

  // 2. Redirect to chat page (the first message will be sent there)
  router.push(`/chat/${session.id}?q=${encodeURIComponent(input)}`);
};
```

**On the chat page** (`apps/app/app/(authenticated)/chat/[id]/chat-page-client.tsx`):

```typescript
// Read the initial query from URL params
const searchParams = useSearchParams();
const initialQuery = searchParams.get("q");

useEffect(() => {
  if (initialQuery && messages.length === 0) {
    // Send the initial message that came from dashboard
    sendMessage({ text: initialQuery });
    // Clean URL
    router.replace(`/chat/${sessionId}`);
  }
}, [initialQuery]);
```

**Files to modify:**

- `apps/app/app/(authenticated)/components/chat-section.tsx` - Wire to tRPC session creation
- `apps/app/app/(authenticated)/chat/[id]/chat-page-client.tsx` - Handle `?q=` param
- `apps/app/lib/trpc/routers/sessions.router.ts` - Ensure `create` mutation works

### 2. Real Credits Display

**Current:** `credits={600}` hardcoded in page.tsx
**Target:** Fetch from `billing.getCreditBalance` tRPC query

```typescript
// In Header or a client wrapper
const { data: creditBalance } = api.billing.getCreditBalance.useQuery();
const { data: subscription } = api.billing.getSubscription.useQuery();

<Header
  credits={creditBalance?.remaining ?? 0}
  isPro={subscription?.planId !== "free"}
/>
```

**Files to modify:**

- `apps/app/app/(authenticated)/page.tsx` - Convert credits to dynamic
- `apps/app/app/(authenticated)/components/header/credits-button.tsx` - Show real balance

### 3. Quick Action Buttons (Toolbar)

The toolbar buttons (slides, website, apps, design, more) should pre-fill the prompt with context or open specific flows.

**Implementation:**

```typescript
const toolbarActions = [
  {
    id: "search",
    label: "Search",
    icon: <SearchIcon />,
    promptPrefix: "Search the web for: ",
  },
  {
    id: "code",
    label: "Write code",
    icon: <CodeIcon />,
    promptPrefix: "Write code to: ",
  },
  {
    id: "analyze",
    label: "Analyze",
    icon: <BarChartIcon />,
    promptPrefix: "Analyze this: ",
  },
  {
    id: "schedule",
    label: "Schedule",
    icon: <CalendarIcon />,
    promptPrefix: "Schedule: ",
  },
  {
    id: "more",
    label: "More",
    icon: <MoreHorizontalIcon />,
    onClick: () => openSkillsPanel(),
  },
];
```

When clicked, each button should either:

- Pre-fill the prompt textarea with the prefix
- Or open a specialized dialog (like file picker for "Analyze")

### 4. Suggested Prompts / Examples

Show clickable example prompts below the input when empty:

```typescript
const examplePrompts = [
  "Research the latest trends in AI agents",
  "Build a landing page for my product",
  "Analyze this spreadsheet and create a report",
  "Schedule a daily email summary of my GitHub notifications",
];
```

Clicking an example should fill the prompt and auto-submit.

### 5. Recent Sessions Quick Access

Show 3-4 recent sessions below the prompt for quick access:

```typescript
const { data: recentSessions } = api.sessions.list.useQuery({
  limit: 4,
  orderBy: "updatedAt",
});
```

Display as small cards with title, last message preview, and timestamp.

---

## Architecture

```
Dashboard Page (server component)
├── Header (with real credits from billing)
├── ChatSection (client component)
│   ├── PromptInput (unified prompt component - see prompt/INSTRUCTIONS.md)
│   │   ├── Textarea with auto-resize
│   │   ├── Toolbar: Connectors, Skills, Files, Send
│   │   └── Config bar: Model selector, connected apps count
│   ├── Quick Actions (search, code, analyze, schedule)
│   ├── Example Prompts (clickable suggestions)
│   └── Recent Sessions (last 4 sessions)
```

---

## Key File Paths

| Purpose            | Path                                                                |
| ------------------ | ------------------------------------------------------------------- |
| Dashboard page     | `apps/app/app/(authenticated)/page.tsx`                             |
| Chat section       | `apps/app/app/(authenticated)/components/chat-section.tsx`          |
| Chat input toolbar | `apps/app/app/(authenticated)/components/chat-input-toolbar.tsx`    |
| Header             | `apps/app/app/(authenticated)/components/header/index.tsx`          |
| Credits button     | `apps/app/app/(authenticated)/components/header/credits-button.tsx` |
| Sessions router    | `apps/app/lib/trpc/routers/sessions.router.ts`                      |
| Billing router     | `apps/app/lib/trpc/routers/billing.router.ts`                       |
| Chat page client   | `apps/app/app/(authenticated)/chat/[id]/chat-page-client.tsx`       |
| Prompt input (new) | See `.claude/frontend/prompt/INSTRUCTIONS.md`                       |

---

## Testing

1. **Session creation**: Type a prompt → should create session in DB → redirect to `/chat/[id]`
2. **First message**: After redirect, the prompt text should appear as first user message
3. **Streaming**: AI should respond with streaming text
4. **Credits**: Real credit balance should show in header
5. **Quick actions**: Clicking "Search" should pre-fill "Search the web for: " in prompt
6. **Recent sessions**: Should show last 4 sessions from DB
7. **Empty state**: When no sessions exist, show example prompts

## Priority Order

1. Session creation + redirect flow (CRITICAL — without this, dashboard is useless)
2. Chat page handling of `?q=` parameter
3. Real credits display
4. Quick action buttons
5. Example prompts
6. Recent sessions
