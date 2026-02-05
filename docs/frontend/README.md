# Rubic Frontend Documentation

**Version:** 1.0.0  
**Status:** In Development  
**Last Updated:** 2026-02-04

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [State Management](#state-management)
5. [Component Architecture](#component-architecture)
6. [Real-Time Communication](#real-time-communication)
7. [Authentication & Authorization](#authentication--authorization)
8. [API Integration](#api-integration)
9. [Styling & Theming](#styling--theming)
10. [Development Guidelines](#development-guidelines)

---

## Overview

Rubic's frontend is built as a modern, real-time AI agent interface. It uses Next.js 16 with React 19, featuring a sophisticated chat interface, device management, and a comprehensive settings system.

### Key Features

- **Real-time streaming** - WebSocket-based live updates
- **Multi-modal input** - Text, voice, file attachments
- **Device control** - PC, MQTT, WiFi, Bluetooth device management
- **AI-powered chat** - Multi-agent orchestration with tool calling
- **Responsive design** - Mobile-first with desktop optimization

### Technology Stack

| Layer         | Technology                   | Version   |
| ------------- | ---------------------------- | --------- |
| Framework     | Next.js                      | 16.1.5    |
| React         | React                        | 19.2.3    |
| Language      | TypeScript                   | 5.9+      |
| State         | Redux Toolkit + RTK Query    | 2.x       |
| Styling       | Tailwind CSS                 | 4.x       |
| UI Components | Radix UI + shadcn/ui         | Latest    |
| Real-time     | Socket.io / Native WebSocket | -         |
| Charts        | Recharts                     | 2.x       |
| Forms         | React Hook Form + Zod        | 7.x / 3.x |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATION                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Next.js    │  │  Redux Store │  │  WebSocket   │              │
│  │   App Router │  │  (Redux TK)  │  │   Client     │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                        │
│         └─────────────────┼─────────────────┘                        │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Feature Slices                            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │   Chat   │ │ Devices  │ │ Projects │ │ Settings │       │   │
│  │  │   Slice  │ │  Slice   │ │  Slice   │ │  Slice   │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API LAYER (tRPC + REST)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   tRPC       │  │   REST       │  │ WebSocket    │              │
│  │  (Internal)  │  │  (External)  │  │ Gateway      │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action → Dispatch Action → Redux Store → API Call → Server
                                              ↓
User UI ← Component Re-render ← State Update ← Response
```

---

## Project Structure

```
apps/app/
├── app/                          # Next.js App Router
│   ├── (authenticated)/          # Protected routes
│   │   ├── components/           # Page-specific components
│   │   │   ├── prompt-input/     # Chat input component
│   │   │   ├── settings/         # Settings components
│   │   │   │   ├── settings-content.tsx
│   │   │   │   ├── settings-context.tsx
│   │   │   │   ├── settings-dialog.tsx
│   │   │   │   ├── settings-nav.tsx
│   │   │   │   └── tabs/         # Settings tabs
│   │   │   │       ├── account-tab.tsx
│   │   │   │       ├── billing-tab.tsx
│   │   │   │       ├── connectors-tab.tsx
│   │   │   │       ├── data-controls-tab.tsx
│   │   │   │       ├── devices-tab.tsx
│   │   │   │       ├── help-tab.tsx
│   │   │   │       ├── integrations-tab.tsx
│   │   │   │       ├── personalization-tab.tsx
│   │   │   │       ├── scheduled-tasks-tab.tsx
│   │   │   │       ├── settings-tab.tsx
│   │   │   │       └── usage-tab.tsx
│   │   │   └── chat-section.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── api/                      # API routes
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing page
│
├── components/                   # Shared components
│   └── ui/                       # UI primitives
│
├── lib/                          # Utilities
│   ├── store/                    # Redux store
│   │   ├── index.ts
│   │   └── slices/
│   │       ├── chat.slice.ts
│   │       ├── agents.slice.ts
│   │       ├── devices.slice.ts
│   │       └── projects.slice.ts
│   ├── trpc/                     # tRPC client
│   │   ├── client.ts
│   │   ├── provider.tsx
│   │   └── routers/
│   │       ├── index.ts
│   │       ├── devices.router.ts
│   │       ├── user.router.ts
│   │       └── webhooks.router.ts
│   └── socket/                   # WebSocket client
│       ├── client.ts
│       └── events.ts
│
├── hooks/                        # Custom hooks
├── types/                        # TypeScript types
└── styles/                       # Global styles
```

---

## State Management

### Redux Store Structure

```typescript
interface RootState {
  // Chat state
  chat: {
    sessions: ChatSession[];
    currentSessionId: string | null;
    messages: Message[];
    isStreaming: boolean;
    streamingContent: string;
  };

  // Agent state
  agents: {
    profiles: AgentProfile[];
    activeProfile: string;
    tasks: AgentTask[];
    isExecuting: boolean;
  };

  // Device state
  devices: {
    devices: Device[];
    activeDeviceId: string | null;
    deviceStatus: Record<string, DeviceStatus>;
    pendingCommands: DeviceCommand[];
  };

  // Project state
  projects: {
    projects: Project[];
    currentProject: Project | null;
    templates: ProjectTemplate[];
  };

  // Settings state
  settings: {
    theme: "light" | "dark" | "system";
    language: string;
    notifications: NotificationSettings;
    shortcuts: KeyboardShortcut[];
  };

  // UI state
  ui: {
    sidebarOpen: boolean;
    settingsOpen: boolean;
    modalStack: Modal[];
    toastQueue: Toast[];
  };
}
```

### State Management Patterns

```typescript
// 1. Feature Slices
// Each feature has its own slice with actions and reducers

// chat.slice.ts
export const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
    updateStreamingContent: (state, action: PayloadAction<string>) => {
      state.streamingContent += action.payload;
    },
    // ... more reducers
  },
});

// 2. Async Thunks for API Calls
export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async (message: string, { dispatch, getState }) => {
    const response = await api.post("/v1/chat", { message });
    dispatch(chatSlice.actions.addMessage(response.data));
    return response.data;
  }
);

// 3. Selectors for Derived State
export const selectCurrentSession = (state: RootState) =>
  state.chat.sessions.find((s) => s.id === state.chat.currentSessionId);

export const selectUnreadCount = (state: RootState) =>
  state.chat.messages.filter((m) => !m.read).length;
```

---

## Component Architecture

### Component Hierarchy

```
App
├── Layout
│   ├── Sidebar
│   │   ├── Navigation
│   │   ├── ProjectList
│   │   └── DeviceList
│   │
│   └── Main Content
│       ├── ChatSection
│       │   ├── ChatHeader
│       │   ├── MessageList
│       │   │   └── MessageBubble (recursive for threads)
│       │   └── PromptInput
│       │       ├── TextArea
│       │       ├── FileUploadButton
│       │       ├── VoiceInputButton
│       │       └── SubmitButton
│       │
│       └── SettingsDialog
│           ├── SettingsNav
│           └── SettingsContent
│               └── SettingsTab
```

### Component Patterns

```typescript
// 1. Container/Presentational Pattern
// Container component handles data fetching and state
const ChatContainer = () => {
  const messages = useSelector(selectMessages);
  const dispatch = useDispatch();

  const handleSend = useCallback((text: string) => {
    dispatch(sendMessage(text));
  }, [dispatch]);

  return <ChatView messages={messages} onSend={handleSend} />;
};

// Presentational component handles UI rendering
interface ChatViewProps {
  messages: Message[];
  onSend: (text: string) => void;
}

const ChatView = ({ messages, onSend }: ChatViewProps) => {
  return (
    <div className="chat-container">
      <MessageList messages={messages} />
      <PromptInput onSend={onSend} />
    </div>
  );
};

// 2. Compound Component Pattern
// Settings components work together
const Settings = {
  Dialog: SettingsDialog,
  Nav: SettingsNav,
  Content: SettingsContent,
  Tab: SettingsTab,
};

// Usage
<Settings.Dialog>
  <Settings.Nav />
  <Settings.Content>
    <Settings.Tab id="account">
      <AccountSettings />
    </Settings.Tab>
  </Settings.Content>
</Settings.Dialog>
```

### Key Components

#### PromptInput Component

```typescript
interface PromptInputProps {
  onSubmit: (message: { parts: MessagePart[] }) => void;
  onCancel?: () => void;
  disabled?: boolean;
  loading?: boolean;
  showFileUpload?: boolean;
  showVoice?: boolean;
  showConnections?: boolean;
}

// Features:
// - Auto-resizing textarea
// - File attachment support
// - Voice input
// - Connection tools
// - Suggested actions
// - Keyboard shortcuts (Cmd+Enter to submit)
```

#### DeviceList Component

```typescript
interface DeviceListProps {
  devices: Device[];
  onDeviceSelect: (deviceId: string) => void;
  onDeviceConnect: (deviceId: string) => void;
  onDeviceDisconnect: (deviceId: string) => void;
}

// Features:
// - Device status indicators
// - Connection state
// - Device type icons
// - Quick actions
// - Search and filter
```

---

## Real-Time Communication

### WebSocket Architecture

```
┌─────────────┐     WebSocket      ┌─────────────────┐
│   Client    │◄──────────────────►│ Gateway Service │
│  (Socket)   │                    │   (Fastify+WS)  │
└──────┬──────┘                    └────────┬────────┘
       │                                    │
       │         Redis Pub/Sub              │
       └────────────────────────────────────┘
```

### WebSocket Client Implementation

```typescript
// lib/socket/client.ts
import { io, Socket } from "socket.io-client";

class SocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token: string) {
    this.socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      auth: { token },
      transports: ["websocket"],
    });

    this.socket.on("connect", () => {
      console.log("Connected to WebSocket");
      this.reconnectAttempts = 0;
    });

    this.socket.on("task_update", (data) => {
      store.dispatch(updateTask(data));
    });

    this.socket.on("device_status", (data) => {
      store.dispatch(updateDeviceStatus(data));
    });

    this.socket.on("output_delta", (data) => {
      store.dispatch(appendStreamingContent(data.delta));
    });

    this.socket.on("disconnect", () => {
      this.handleReconnect();
    });
  }

  subscribe(channels: string[]) {
    this.socket?.emit("subscribe", { channels });
  }

  sendCommand(deviceId: string, command: string) {
    this.socket?.emit("device_command", { deviceId, command });
  }

  disconnect() {
    this.socket?.disconnect();
  }
}

export const socketClient = new SocketClient();
```

### Event Types

```typescript
// lib/socket/events.ts
export interface ServerEvents {
  task_update: { taskId: string; status: TaskStatus; data?: any };
  task_progress: { taskId: string; message: string; progress?: number };
  task_output: { taskId: string; content: MessagePart[] };
  device_status: { deviceId: string; status: DeviceStatus };
  device_output: { deviceId: string; output: string };
  notification: { notification: Notification };
  error: { code: string; message: string };
}

export interface ClientEvents {
  subscribe: { channels: string[] };
  unsubscribe: { channels: string[] };
  task_command: { taskId: string; action: "cancel" | "pause" | "resume" };
  device_command: { deviceId: string; command: string };
}
```

---

## Authentication & Authorization

### Auth Flow

```
User Login → Better-Auth → JWT Token → Store in Cookie
     ↓
API Requests → Auth Middleware → Verify JWT → Proceed
```

### Protected Routes

```typescript
// middleware.ts
import { authMiddleware } from '@repo/auth/middleware';

export default authMiddleware({
  publicRoutes: ['/login', '/signup', '/forgot-password'],
  protectedRoutes: ['/app', '/settings'],
});

// Component-level protection
const ProtectedPage = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (!user) return <Redirect to="/login" />;

  return <PageContent />;
};
```

---

## API Integration

### tRPC Setup

```typescript
// lib/trpc/routers/index.ts
export const appRouter = router({
  devices: devicesRouter,
  user: userRouter,
  webhooks: webhooksRouter,
  tasks: tasksRouter,
  projects: projectsRouter,
  knowledge: knowledgeRouter,
  billing: billingRouter,
  notifications: notificationsRouter,
});

// lib/trpc/client.ts
export const trpc = createTRPCReact<AppRouter>();

// Usage in component
function DeviceList() {
  const { data: devices } = trpc.devices.list.useQuery();
  const connect = trpc.devices.connect.useMutation();

  return (
    <div>
      {devices?.map(device => (
        <DeviceCard
          key={device.id}
          device={device}
          onConnect={() => connect.mutate(device.id)}
        />
      ))}
    </div>
  );
}
```

### REST API Integration

```typescript
// lib/api/client.ts
import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for auth
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);
```

---

## Styling & Theming

### Tailwind Configuration

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... more colors
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
```

### CSS Variables (Theming)

```css
/* globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
  }
}
```

---

## Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow functional component patterns with hooks
- Use `const` for function components
- Implement proper error boundaries
- Write unit tests for utilities and integration tests for features

### Performance Optimization

```typescript
// 1. Memoize expensive computations
const sortedMessages = useMemo(() =>
  messages.sort((a, b) => a.timestamp - b.timestamp),
  [messages]
);

// 2. Callback memoization
const handleSend = useCallback((text: string) => {
  dispatch(sendMessage(text));
}, [dispatch]);

// 3. Virtualize long lists
import { Virtualizer } from '@tanstack/react-virtual';

// 4. Lazy load components
const SettingsDialog = lazy(() => import('./settings-dialog'));

// 5. Image optimization
import Image from 'next/image';
<Image src="/logo.png" width={100} height={50} alt="Logo" priority />
```

### Accessibility

```typescript
// Use semantic HTML
<button
  aria-label="Send message"
  aria-disabled={isLoading}
  onClick={handleSend}
>
  <SendIcon />
</button>

// Keyboard navigation support
// Focus management
// Screen reader announcements
// Color contrast compliance (WCAG 2.1 AA)
```

### Testing

```typescript
// Component tests with React Testing Library
import { render, screen, fireEvent } from '@testing-library/react';

test('sends message on button click', () => {
  const onSend = jest.fn();
  render(<PromptInput onSend={onSend} />);

  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Hello' },
  });
  fireEvent.click(screen.getByRole('button', { name: /send/i }));

  expect(onSend).toHaveBeenCalledWith('Hello');
});
```

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Deployment

### Build Commands

```bash
# Development
pnpm dev

# Production build
pnpm build

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Testing
pnpm test
```

### Docker

```dockerfile
# Dockerfile
FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable pnpm && pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

---

## Related Documentation

- [Backend Architecture](../backend/README.md)
- [Testing Guide](../testing/README.md)
- [ADR-001: Prompt Input Architecture](../adr/001-prompt-input-architecture.md)
- [ADR-006: Monorepo Structure](../adr/006-monorepo-structure.md)
