# Unified Prompt Component - Build Instructions

## Overview

The prompt input component is used on both the **Dashboard** (for starting new chats) and the **Chat page** (for continuing conversations). It needs to be a unified, feature-rich component.

## Current State

### Existing Prompt Components

1. **ChatInputToolbar** (`apps/app/app/(authenticated)/components/chat-input-toolbar.tsx`, 115 lines)

   - Used on Dashboard
   - Has quick action buttons (slides, website, apps, design, more)
   - `handleSubmit` just clears input — no actual functionality
   - Simple Input + Button layout

2. **PromptInput** (`apps/app/app/(authenticated)/components/prompt-input/index.tsx`)

   - More advanced component with:
     - Auto-resizing textarea
     - File attachment support (`file-upload-button.tsx`)
     - Attachment preview with remove
     - Voice button placeholder
     - Submit/Cancel buttons
     - Character count
   - Types defined in `types.ts`: `Attachment`, `AttachmentSource`, `FileUploadConfig`

3. **RubicInput** (`apps/app/app/(authenticated)/components/rubic-input/`)

   - Another input variant, similar to PromptInput

4. **ChatComposer** (`packages/ai/components/input/chat-composer.tsx`)
   - Used in chat page via `@repo/ai`
   - Handles message sending via `useRealTimeChat` hook

### FileUploadButton (`components/prompt-input/file-upload-button.tsx`, 127 lines)

- Dropdown with options: Upload from computer, Google Drive, OneDrive, Dropbox
- Cloud uploads are TODO (`console.log`)
- Local upload works via hidden file input

---

## What Needs Building

### 1. Unified PromptInput Component

Create a single, reusable prompt component used everywhere.

**Create:** `apps/app/app/(authenticated)/components/prompt-input/unified-prompt.tsx`

**Features:**

```
┌─────────────────────────────────────────────────────┐
│ [Attachment previews row]                           │
│                                                     │
│ [Auto-resizing textarea with placeholder]           │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [+Files] [Connectors] [Skills] │ [Model] [Send ↑]  │
└─────────────────────────────────────────────────────┘
```

**Props:**

```typescript
interface UnifiedPromptProps {
  onSubmit: (input: string, attachments: Attachment[], options: SubmitOptions) => void;
  placeholder?: string;
  disabled?: boolean;
  isStreaming?: boolean;
  onCancel?: () => void;
  showConfigBar?: boolean; // Show model selector + connected apps
  showQuickActions?: boolean; // Show action buttons below (dashboard only)
  initialValue?: string;
  maxLength?: number;
  className?: string;
}

interface SubmitOptions {
  model?: string;
  taskType?: "search" | "build" | "analyze" | "schedule" | "command" | "code" | "general";
}
```

### 2. Bottom Toolbar Buttons

#### Files Button (+)

Opens dropdown with:

- **Upload from computer** — file picker
- **Google Drive** — opens Google Drive picker (via Composio Google Drive integration)
- **OneDrive** — opens OneDrive picker (via Composio)
- **Dropbox** — opens Dropbox picker (via Composio)
- **From Library** — opens file picker from Rubic Library (/files)

**Implementation:** Enhance existing `FileUploadButton`. For cloud pickers, check if user has the connector connected:

```typescript
const { data: connectors } = api.connectors.list.useQuery();
const hasGoogleDrive = connectors?.some(
  (c) => c.type === "google_drive" && c.status === "connected"
);
```

If not connected, show "Connect Google Drive" option that triggers OAuth flow.

#### Connectors Button

Opens a popover showing:

- **Tab 1: Connected Apps** — List of user's connected Composio apps with toggle
- **Tab 2: Devices** — List of connected devices

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="sm" className="gap-1.5">
      <PlugIcon className="size-4" />
      <span className="text-xs">{connectedCount}</span>
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-80">
    <Tabs defaultValue="apps">
      <TabsList>
        <TabsTrigger value="apps">Apps ({appsCount})</TabsTrigger>
        <TabsTrigger value="devices">Devices ({devicesCount})</TabsTrigger>
      </TabsList>
      <TabsContent value="apps">
        {/* Grid of connected app icons with names */}
        {/* "Browse more" link to /applications */}
      </TabsContent>
      <TabsContent value="devices">
        {/* List of connected devices with status */}
        {/* "Manage devices" link to /devices */}
      </TabsContent>
    </Tabs>
  </PopoverContent>
</Popover>
```

#### Skills Button

Opens a popover showing available AI skills/capabilities:

```typescript
const skills = [
  { id: "web_search", name: "Web Search", icon: SearchIcon, enabled: true },
  { id: "code_execution", name: "Code Execution", icon: CodeIcon, enabled: true },
  { id: "browser_use", name: "Browser Use", icon: GlobeIcon, enabled: false },
  { id: "file_ops", name: "File Operations", icon: FileIcon, enabled: true },
  { id: "data_analysis", name: "Data Analysis", icon: BarChartIcon, enabled: true },
  { id: "image_gen", name: "Image Generation", icon: ImageIcon, enabled: false },
];
```

Each skill has a toggle. Enabled skills are available to the AI agent during the conversation.

#### Model Selector

Dropdown to select the AI model:

```typescript
const models = [
  { id: "claude-sonnet", name: "Claude Sonnet", provider: "anthropic", speed: "fast" },
  { id: "claude-opus", name: "Claude Opus", provider: "anthropic", speed: "slow" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai", speed: "fast" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai", speed: "medium" },
  { id: "gemini-pro", name: "Gemini Pro", provider: "google", speed: "fast" },
];
```

Show model name as a small badge/button next to send. Clicking opens selector.

### 3. Config Bar (Dashboard Only)

When `showConfigBar` is true, show a row above or below the prompt with:

- Connected apps count: "3 apps connected"
- Active devices count: "1 device online"
- Selected model badge
- Credits remaining badge

### 4. Quick Actions (Dashboard Only)

When `showQuickActions` is true, show action chips below the prompt:

```tsx
<div className="flex flex-wrap gap-2 mt-3">
  {quickActions.map((action) => (
    <Button
      key={action.id}
      variant="outline"
      size="sm"
      className="gap-1.5 rounded-full"
      onClick={() => prefillPrompt(action.prefix)}
    >
      <action.icon className="size-3.5" />
      {action.label}
    </Button>
  ))}
</div>
```

Actions: Search, Write Code, Analyze Data, Schedule Task, Build Website, Design

---

## Key File Paths

| Purpose            | Path                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| Prompt input dir   | `apps/app/app/(authenticated)/components/prompt-input/`                       |
| File upload button | `apps/app/app/(authenticated)/components/prompt-input/file-upload-button.tsx` |
| Types              | `apps/app/app/(authenticated)/components/prompt-input/types.ts`               |
| Chat input toolbar | `apps/app/app/(authenticated)/components/chat-input-toolbar.tsx`              |
| Rubic input        | `apps/app/app/(authenticated)/components/rubic-input/`                        |
| AI chat composer   | `packages/ai/components/input/chat-composer.tsx`                              |
| Connectors router  | `apps/app/lib/trpc/routers/connectors.router.ts`                              |
| Devices router     | `apps/app/lib/trpc/routers/devices.router.ts`                                 |

---

## Priority Order

1. Unified prompt component with textarea + send button
2. File upload button (local upload working)
3. Model selector dropdown
4. Connectors popover (apps + devices tabs)
5. Skills toggle popover
6. Cloud file pickers (Google Drive, OneDrive, Dropbox via Composio)
7. Quick actions for dashboard
8. Config bar
