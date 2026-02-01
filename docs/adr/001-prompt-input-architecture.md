# Architecture Decision Record: Prompt Input & AI Integration Architecture

**Status:** Proposed
**Date:** 2026-02-01
**Decision Makers:** Engineering Team
**Technical Story:** Refactoring prompt input component placement and AI integration architecture

---

## Executive Summary

This ADR analyzes the current architectural mistake of placing the prompt input component in `apps/app/components/prompt-input/` instead of following the established monorepo patterns. After thorough analysis of three reference architectures, we present options for the optimal structure.

---

## Context and Problem Statement

### Current State (Incorrect)
```
apps/app/app/(authenticated)/components/prompt-input/
├── types.ts
├── prompt-input.tsx
├── file-upload-button.tsx
├── voice-input-button.tsx
├── connections-button.tsx
├── attachment-preview.tsx
├── connect-tools-banner.tsx
└── index.tsx
```

### Why This is Wrong
1. **Violates monorepo principles** - Feature code mixed with app-specific components
2. **No reusability** - Cannot be shared between `apps/app`, `apps/api`, `apps/web`
3. **Inconsistent with existing patterns** - `@repo/ai` already has `components/message.tsx` and `components/thread.tsx`
4. **Breaks separation of concerns** - AI/chat logic tightly coupled with UI presentation
5. **Missing integration** - Not connected to existing `@repo/ai` hooks and utilities

---

## Reference Architecture Analysis

### 1. Vercel AI Chatbot Template (ai-chatbot)

**Structure:**
```
/
├── app/
│   └── (chat)/
│       └── api/chat/route.ts          # Streaming endpoint
├── components/
│   ├── multimodal-input.tsx           # Main input component
│   ├── chat.tsx                       # Chat controller
│   ├── messages.tsx                   # Message list
│   └── ui/                            # Radix primitives
├── lib/
│   └── ai/
│       ├── providers.ts               # Model configuration
│       ├── prompts.ts                 # System prompts
│       ├── models.ts                  # Model registry
│       └── tools/
│           ├── create-document.ts
│           ├── update-document.ts
│           ├── request-suggestions.ts
│           └── get-weather.ts
├── artifacts/
│   ├── code/
│   │   ├── client.tsx
│   │   └── server.ts
│   ├── text/
│   ├── image/
│   └── sheet/
└── hooks/
    ├── use-chat-visibility.ts
    ├── use-auto-resume.ts
    └── use-scroll-to-bottom.tsx
```

**Key Patterns:**
- Flat structure (single app, not monorepo)
- `lib/ai/` for all AI configuration and tools
- `artifacts/` for document generation handlers
- `components/` at root level for UI
- Heavy use of AI SDK hooks (`useChat`)

**Pros:** Simple, all-in-one, optimized for single app
**Cons:** Not designed for monorepo, no package separation

---

### 2. Next-Forge (Rubic's Foundation)

**Monorepo Structure:**
```
/
├── packages/
│   ├── ai/                            # AI Package
│   │   ├── components/
│   │   │   ├── message.tsx
│   │   │   └── thread.tsx
│   │   ├── tools/
│   │   │   ├── create-document.ts
│   │   │   ├── update-document.ts
│   │   │   ├── request-suggestions.ts
│   │   │   └── get-weather.ts
│   │   ├── lib/
│   │   │   ├── models.ts
│   │   │   ├── react.ts
│   │   │   └── types/
│   │   ├── index.ts
│   │   └── keys.ts
│   │
│   ├── design-system/                 # UI Package
│   │   ├── components/ui/             # 40+ Radix components
│   │   ├── providers/
│   │   ├── hooks/
│   │   └── lib/utils.ts
│   │
│   └── database/                      # Data Package
│       └── src/schema/
│
└── apps/
    ├── app/                           # Main application
    │   ├── app/api/chat/route.ts
    │   ├── lib/                       # App-specific utilities
    │   │   ├── store/                 # Redux state
    │   │   ├── trpc/                  # RPC layer
    │   │   └── socket/                # WebSocket
    │   └── components/                # App-specific components
    └── api/                           # API server
```

**Key Patterns:**
- Clear package separation (`@repo/ai`, `@repo/design-system`, `@repo/database`)
- AI components in `packages/ai/components/`
- AI tools in `packages/ai/tools/`
- UI primitives in `packages/design-system/components/ui/`
- App-specific logic stays in `apps/app/lib/`

**Pros:** Scalable, reusable, proper separation
**Cons:** More complex, requires careful boundary management

---

### 3. Current Rubic Implementation (Hybrid)

**Current Issues:**
```
apps/app/app/(authenticated)/
├── components/
│   ├── prompt-input/          # ❌ WRONG LOCATION
│   │   ├── types.ts
│   │   ├── prompt-input.tsx
│   │   ├── file-upload-button.tsx
│   │   ├── voice-input-button.tsx
│   │   ├── connections-button.tsx
│   │   ├── attachment-preview.tsx
│   │   └── connect-tools-banner.tsx
│   ├── chatbot.tsx            # Uses @repo/ai components
│   └── chat-section.tsx       # Wrapper for prompt-input
│
└── lib/
    ├── store/slices/
    │   ├── chat.slice.ts      # Message state
    │   └── agents.slice.ts    # Agent orchestration
    ├── trpc/routers/
    │   ├── messages.router.ts # Message endpoints
    │   └── agents.router.ts   # Agent endpoints
    └── socket/
        ├── client.ts          # Socket.io client
        └── events.ts          # Typed events
```

**Problems Identified:**
1. `prompt-input/` should be in `packages/ai/components/`
2. Voice input types should be in `packages/ai/lib/types/`
3. File upload logic should integrate with `@repo/storage`
4. Connection logic should integrate with existing app connections system
5. Missing integration with `useChat` from `@repo/ai/lib/react`

---

## Decision Options

### Option A: Extend `@repo/ai` Package (Recommended)

**Rationale:** Follow the established next-forge pattern where AI-related components live in `packages/ai/`.

**Proposed Structure:**
```
packages/ai/
├── components/
│   ├── message.tsx                    # Existing
│   ├── thread.tsx                     # Existing
│   ├── prompt-input/                  # NEW
│   │   ├── index.tsx
│   │   ├── prompt-input.tsx           # Main component
│   │   ├── multimodal-input.tsx       # Text + file + voice
│   │   ├── attachment-preview.tsx
│   │   ├── suggested-actions.tsx
│   │   └── voice-indicator.tsx
│   ├── chat/                          # NEW
│   │   ├── index.tsx
│   │   ├── chat-container.tsx
│   │   ├── chat-header.tsx
│   │   └── chat-messages.tsx
│   └── artifacts/                     # NEW (from ai-chatbot)
│       ├── index.tsx
│       ├── artifact-panel.tsx
│       └── document-preview.tsx
├── tools/
│   ├── create-document.ts             # Existing
│   ├── update-document.ts             # Existing
│   ├── request-suggestions.ts         # Existing
│   ├── get-weather.ts                 # Existing
│   ├── web-search.ts                  # NEW
│   ├── file-operations.ts             # NEW
│   └── code-execution.ts              # NEW
├── lib/
│   ├── models.ts                      # Existing
│   ├── react.ts                       # Existing (useChat export)
│   ├── prompts.ts                     # NEW - System prompts
│   ├── streaming.ts                   # NEW - Stream utilities
│   └── types/
│       ├── index.d.ts                 # Existing
│       ├── messages.ts                # NEW - Message types
│       ├── attachments.ts             # NEW - Attachment types
│       └── tools.ts                   # NEW - Tool types
├── hooks/                             # NEW
│   ├── use-chat-stream.ts
│   ├── use-voice-input.ts
│   ├── use-file-upload.ts
│   └── use-artifact.ts
├── providers/                         # NEW
│   ├── chat-provider.tsx
│   └── data-stream-provider.tsx
└── index.ts
```

**Package Exports (package.json):**
```json
{
  "exports": {
    ".": "./index.ts",
    "./components/prompt-input": "./components/prompt-input/index.tsx",
    "./components/chat": "./components/chat/index.tsx",
    "./components/message": "./components/message.tsx",
    "./components/thread": "./components/thread.tsx",
    "./components/artifacts": "./components/artifacts/index.tsx",
    "./tools/*": "./tools/*.ts",
    "./hooks/*": "./hooks/*.ts",
    "./providers/*": "./providers/*.tsx",
    "./lib/models": "./lib/models.ts",
    "./lib/react": "./lib/react.ts",
    "./lib/prompts": "./lib/prompts.ts",
    "./lib/streaming": "./lib/streaming.ts",
    "./lib/types": "./lib/types/index.ts"
  }
}
```

**App Usage:**
```typescript
// apps/app/app/(authenticated)/page.tsx
import { PromptInput } from '@repo/ai/components/prompt-input';
import { ChatContainer } from '@repo/ai/components/chat';
import { useChat } from '@repo/ai/lib/react';
import { useChatStream } from '@repo/ai/hooks/use-chat-stream';
```

**Pros:**
- Follows established monorepo patterns
- Reusable across all apps
- Proper separation of concerns
- Type-safe with explicit exports
- Matches ai-chatbot's organizational pattern

**Cons:**
- Requires refactoring existing code
- Package boundary management complexity
- More initial setup work

---

### Option B: Split Between `@repo/ai` and `@repo/design-system`

**Rationale:** Separate pure UI components from AI-specific components.

**Structure:**
```
packages/design-system/
├── components/
│   ├── ui/
│   │   ├── ... (existing)
│   │   ├── multimodal-textarea.tsx    # Pure textarea with auto-resize
│   │   ├── voice-recorder.tsx         # Pure voice recording UI
│   │   └── file-drop-zone.tsx         # Pure file upload UI
│   └── chat/                          # Chat UI primitives
│       ├── chat-bubble.tsx
│       ├── chat-list.tsx
│       ├── typing-indicator.tsx
│       └── attachment-badge.tsx

packages/ai/
├── components/
│   ├── prompt-input.tsx               # Combines design-system primitives + AI logic
│   ├── chat-interface.tsx             # Full chat experience
│   └── artifact-viewer.tsx            # Document viewing
├── hooks/
│   ├── use-chat.ts                    # AI-specific chat hook
│   ├── use-voice-transcription.ts     # AI voice processing
│   └── use-file-analysis.ts           # AI file processing
└── ... (tools, lib, etc.)
```

**Pros:**
- Maximum reusability of UI primitives
- Clear separation of UI vs AI logic
- Design system stays pure

**Cons:**
- More complex import paths
- Potential circular dependency issues
- Harder to maintain cohesion

---

### Option C: Create New `@repo/chat` Package

**Rationale:** Create a dedicated package for all chat-related functionality.

**Structure:**
```
packages/chat/
├── components/
│   ├── prompt-input/
│   ├── message/
│   ├── thread/
│   ├── artifacts/
│   └── sidebar/
├── hooks/
│   ├── use-chat.ts
│   ├── use-messages.ts
│   ├── use-voice.ts
│   └── use-attachments.ts
├── lib/
│   ├── types.ts
│   ├── utils.ts
│   └── constants.ts
├── providers/
│   └── chat-provider.tsx
└── index.ts

packages/ai/
├── tools/                             # AI tools only
├── lib/
│   ├── models.ts
│   ├── prompts.ts
│   └── streaming.ts
└── index.ts
```

**Pros:**
- Clean separation of chat UI from AI core
- Easy to understand package purpose
- Independent versioning

**Cons:**
- Creates another package to maintain
- May fragment related functionality
- Deviates from ai-chatbot patterns

---

### Option D: Keep in App with Proper Abstraction

**Rationale:** Some components are truly app-specific and shouldn't be shared.

**Structure:**
```
apps/app/
├── components/
│   ├── chat/                          # App-specific chat UI
│   │   ├── chat-section.tsx
│   │   ├── chat-sidebar.tsx
│   │   └── chat-header.tsx
│   └── prompt-input/                  # App-specific input
│       └── ... (current files)
├── features/
│   └── chat/                          # Feature module
│       ├── api/
│       │   └── chat.api.ts
│       ├── hooks/
│       │   ├── use-chat-session.ts
│       │   └── use-chat-submit.ts
│       ├── store/
│       │   └── chat.slice.ts
│       └── types/
│           └── chat.types.ts
└── lib/
    └── ai/                            # App-specific AI utilities
        ├── prompts.ts
        └── tools.ts
```

**Pros:**
- Simpler for single-app scenarios
- No package boundary complexity
- Faster iteration

**Cons:**
- Not reusable
- Violates monorepo principles
- Inconsistent with existing patterns

---

## Recommendation: Option A (Extend `@repo/ai`)

### Rationale

1. **Consistency** - Follows the established pattern where `@repo/ai` already has `components/message.tsx` and `components/thread.tsx`

2. **Alignment with ai-chatbot** - The ai-chatbot template organizes all AI-related code under `lib/ai/` and `components/`. Our monorepo equivalent is `packages/ai/`

3. **Reusability** - Chat functionality could be used in:
   - `apps/app` (main application)
   - `apps/api` (API documentation chatbot)
   - `apps/web` (marketing site chatbot)

4. **Type Safety** - Explicit package exports ensure proper TypeScript support

5. **Separation of Concerns** - AI logic stays in AI package, app-specific customization stays in app

### Migration Plan

**Phase 1: Create Package Structure**
```bash
# Create directories
mkdir -p packages/ai/components/prompt-input
mkdir -p packages/ai/components/chat
mkdir -p packages/ai/hooks
mkdir -p packages/ai/providers
mkdir -p packages/ai/lib/types
```

**Phase 2: Move and Refactor Components**
```bash
# Move from apps/app to packages/ai
mv apps/app/app/(authenticated)/components/prompt-input/* packages/ai/components/prompt-input/

# Update imports in moved files
# Change: import { Button } from "@repo/design-system/..."
# Keep:   Same imports, just update internal references
```

**Phase 3: Update Package Exports**
```typescript
// packages/ai/package.json - add new exports
// packages/ai/index.ts - add new re-exports
```

**Phase 4: Update App Imports**
```typescript
// Before
import { PromptInput } from "./components/prompt-input";

// After
import { PromptInput } from "@repo/ai/components/prompt-input";
```

**Phase 5: Integration with Existing Hooks**
```typescript
// packages/ai/components/prompt-input/prompt-input.tsx
import { useChat } from '../lib/react';
import { useChatStream } from '../hooks/use-chat-stream';
```

---

## Detailed Implementation Plan

### 1. Package Structure Update

**packages/ai/package.json:**
```json
{
  "name": "@repo/ai",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./index.ts"
    },
    "./components/prompt-input": {
      "types": "./dist/components/prompt-input/index.d.ts",
      "default": "./components/prompt-input/index.tsx"
    },
    "./components/chat": {
      "types": "./dist/components/chat/index.d.ts",
      "default": "./components/chat/index.tsx"
    },
    "./components/message": {
      "types": "./dist/components/message.d.ts",
      "default": "./components/message.tsx"
    },
    "./components/thread": {
      "types": "./dist/components/thread.d.ts",
      "default": "./components/thread.tsx"
    },
    "./hooks": {
      "types": "./dist/hooks/index.d.ts",
      "default": "./hooks/index.ts"
    },
    "./providers": {
      "types": "./dist/providers/index.d.ts",
      "default": "./providers/index.tsx"
    },
    "./tools": {
      "types": "./dist/tools/index.d.ts",
      "default": "./tools/index.ts"
    },
    "./lib/models": {
      "types": "./dist/lib/models.d.ts",
      "default": "./lib/models.ts"
    },
    "./lib/react": {
      "types": "./dist/lib/react.d.ts",
      "default": "./lib/react.ts"
    },
    "./lib/prompts": {
      "types": "./dist/lib/prompts.d.ts",
      "default": "./lib/prompts.ts"
    },
    "./lib/types": {
      "types": "./dist/lib/types/index.d.ts",
      "default": "./lib/types/index.ts"
    }
  },
  "dependencies": {
    "@ai-sdk/openai": "^2.0.77",
    "@ai-sdk/react": "^3.0.29",
    "@repo/auth": "workspace:*",
    "@repo/design-system": "workspace:*",
    "@repo/storage": "workspace:*",
    "ai": "^6.0.27",
    "react": "^19.2.3",
    "react-markdown": "^9.0.3",
    "zod": "^3.25.67"
  }
}
```

### 2. Type Definitions

**packages/ai/lib/types/messages.ts:**
```typescript
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'file'; url: string; name: string; mimeType: string }
  | { type: 'audio'; url: string; duration?: number }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; result: unknown };

export type Message = {
  id: string;
  role: MessageRole;
  parts: MessagePart[];
  createdAt: Date;
  metadata?: {
    model?: string;
    tokens?: { input: number; output: number };
    latency?: number;
  };
};

export type ChatThread = {
  id: string;
  title: string | null;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
};
```

**packages/ai/lib/types/attachments.ts:**
```typescript
export type AttachmentType = 'file' | 'image' | 'document' | 'audio' | 'video';

export type AttachmentSource = 'local' | 'onedrive' | 'google-drive' | 'dropbox' | 'url';

export type Attachment = {
  id: string;
  name: string;
  type: AttachmentType;
  source: AttachmentSource;
  url?: string;
  file?: File;
  size: number;
  mimeType: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  progress?: number;
  error?: string;
};

export type AttachmentUploadConfig = {
  maxSize: number;
  allowedTypes: string[];
  maxFiles: number;
  uploadEndpoint: string;
};
```

**packages/ai/lib/types/tools.ts:**
```typescript
import { z } from 'zod';

export type ToolDefinition<TInput = unknown, TOutput = unknown> = {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  execute: (input: TInput) => Promise<TOutput>;
};

export type BuiltInTools = {
  createDocument: ToolDefinition<
    { title: string; kind: 'text' | 'code' | 'image' | 'sheet' },
    { id: string; url: string }
  >;
  updateDocument: ToolDefinition<
    { id: string; description: string },
    { success: boolean }
  >;
  webSearch: ToolDefinition<
    { query: string; maxResults?: number },
    { results: Array<{ title: string; url: string; snippet: string }> }
  >;
  codeExecution: ToolDefinition<
    { code: string; language: string },
    { output: string; error?: string }
  >;
};
```

### 3. Prompt Input Component (Refactored)

**packages/ai/components/prompt-input/prompt-input.tsx:**
```typescript
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@repo/design-system/components/ui/button';
import { cn } from '@repo/design-system/lib/utils';
import { ArrowUpIcon, LoaderIcon, StopCircleIcon } from 'lucide-react';

import { FileUploadButton } from './file-upload-button';
import { VoiceInputButton } from './voice-input-button';
import { ConnectionsButton } from './connections-button';
import { AttachmentPreview } from './attachment-preview';
import { SuggestedActions } from './suggested-actions';

import type { Attachment, AttachmentSource, AttachmentUploadConfig } from '../../lib/types/attachments';
import type { Message, MessagePart } from '../../lib/types/messages';

export type PromptInputProps = {
  onSubmit: (message: { parts: MessagePart[] }) => void;
  onCancel?: () => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  minHeight?: number;
  maxHeight?: number;
  showFileUpload?: boolean;
  showVoice?: boolean;
  showConnections?: boolean;
  showSuggestions?: boolean;
  uploadConfig?: Partial<AttachmentUploadConfig>;
  suggestedActions?: Array<{ label: string; prompt: string }>;
  className?: string;
};

const defaultUploadConfig: AttachmentUploadConfig = {
  maxSize: 50 * 1024 * 1024,
  allowedTypes: ['image/*', 'application/pdf', 'text/*'],
  maxFiles: 10,
  uploadEndpoint: '/api/files/upload',
};

export function PromptInput({
  onSubmit,
  onCancel,
  placeholder = 'Ask anything...',
  disabled = false,
  loading = false,
  autoFocus = true,
  maxLength = 10000,
  minHeight = 50,
  maxHeight = 216,
  showFileUpload = true,
  showVoice = true,
  showConnections = false,
  showSuggestions = true,
  uploadConfig,
  suggestedActions,
  className,
}: PromptInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const config = { ...defaultUploadConfig, ...uploadConfig };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
  }, [input, minHeight, maxHeight]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = useCallback(() => {
    if (loading || disabled) return;
    if (!input.trim() && attachments.length === 0) return;

    const parts: MessagePart[] = [];

    // Add attachments as file parts
    for (const attachment of attachments) {
      if (attachment.type === 'image' && attachment.url) {
        parts.push({ type: 'image', url: attachment.url });
      } else if (attachment.url) {
        parts.push({
          type: 'file',
          url: attachment.url,
          name: attachment.name,
          mimeType: attachment.mimeType,
        });
      }
    }

    // Add text part
    if (input.trim()) {
      parts.push({ type: 'text', text: input.trim() });
    }

    onSubmit({ parts });
    setInput('');
    setAttachments([]);
  }, [input, attachments, loading, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleFilesSelected = useCallback(
    async (files: File[], source: AttachmentSource) => {
      const newAttachments: Attachment[] = files.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        source,
        file,
        size: file.size,
        mimeType: file.type,
        status: 'pending' as const,
        progress: 0,
      }));

      setAttachments((prev) => [...prev, ...newAttachments]);

      // Upload files
      for (const attachment of newAttachments) {
        try {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachment.id ? { ...a, status: 'uploading' as const } : a
            )
          );

          const formData = new FormData();
          formData.append('file', attachment.file!);

          const response = await fetch(config.uploadEndpoint, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) throw new Error('Upload failed');

          const { url } = await response.json();

          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachment.id
                ? { ...a, status: 'uploaded' as const, url, progress: 100 }
                : a
            )
          );
        } catch (error) {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachment.id
                ? { ...a, status: 'error' as const, error: 'Upload failed' }
                : a
            )
          );
        }
      }
    },
    [config.uploadEndpoint]
  );

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleVoiceTranscript = useCallback((text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
  }, []);

  const handleSuggestedAction = useCallback(
    (prompt: string) => {
      setInput(prompt);
      // Auto-submit after setting
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 0);
    },
    []
  );

  const canSubmit = !loading && !disabled && (input.trim().length > 0 || attachments.length > 0);
  const showSuggestionsPanel = showSuggestions && suggestedActions && !input && attachments.length === 0;

  return (
    <div className={cn('w-full', className)}>
      {/* Suggested Actions */}
      {showSuggestionsPanel && (
        <SuggestedActions actions={suggestedActions} onSelect={handleSuggestedAction} />
      )}

      {/* Main Input Container */}
      <div
        className={cn(
          'flex flex-col gap-3 rounded-[22px] relative',
          'bg-background py-3 w-full',
          'shadow-[0px_12px_32px_0px_rgba(0,0,0,0.02)]',
          'border border-border/60',
          'transition-colors duration-200',
          isFocused && 'border-border'
        )}
      >
        {/* Attachment Preview */}
        <AttachmentPreview
          attachments={attachments}
          onRemove={handleRemoveAttachment}
        />

        {/* Textarea */}
        <div className="overflow-auto px-4 bg-transparent">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled || loading}
            maxLength={maxLength}
            rows={1}
            className={cn(
              'w-full bg-transparent resize-none outline-none',
              'placeholder:text-muted-foreground/60',
              'text-[15px] leading-6',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
            style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
          />
        </div>

        {/* Controls Row */}
        <div className="px-3">
          <div className="flex items-center justify-between gap-2">
            {/* Left Controls */}
            <div className="flex items-center gap-2">
              {showFileUpload && (
                <FileUploadButton
                  onFilesSelected={handleFilesSelected}
                  config={config}
                  disabled={disabled || loading}
                />
              )}
              {showConnections && (
                <ConnectionsButton disabled={disabled || loading} />
              )}
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              {showVoice && (
                <VoiceInputButton
                  onTranscript={handleVoiceTranscript}
                  disabled={disabled || loading}
                />
              )}

              {/* Submit/Stop Button */}
              {loading ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onCancel}
                  className="h-8 w-8 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  <StopCircleIcon className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={cn(
                    'h-8 w-8 rounded-full transition-all',
                    canSubmit
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <ArrowUpIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Character count */}
      {input.length > maxLength * 0.8 && (
        <div className="flex justify-end mt-1 px-2">
          <span
            className={cn(
              'text-xs',
              input.length > maxLength * 0.95 ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {input.length.toLocaleString()} / {maxLength.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
```

### 4. Chat Provider with Streaming

**packages/ai/providers/chat-provider.tsx:**
```typescript
'use client';

import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';
import type { Message, MessagePart } from '../lib/types/messages';

type ChatContextValue = {
  messages: Message[];
  isStreaming: boolean;
  sendMessage: (parts: MessagePart[]) => Promise<void>;
  stopStreaming: () => void;
  clearMessages: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
}

type ChatProviderProps = {
  children: ReactNode;
  apiEndpoint?: string;
  initialMessages?: Message[];
  onError?: (error: Error) => void;
};

export function ChatProvider({
  children,
  apiEndpoint = '/api/chat',
  initialMessages = [],
  onError,
}: ChatProviderProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const sendMessage = useCallback(
    async (parts: MessagePart[]) => {
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        parts,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);

      const controller = new AbortController();
      setAbortController(controller);

      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [...messages, userMessage] }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          parts: [{ type: 'text', text: '' }],
          createdAt: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process SSE events
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'text-delta') {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMessage = updated[updated.length - 1];
                    if (lastMessage.role === 'assistant') {
                      const textPart = lastMessage.parts.find((p) => p.type === 'text');
                      if (textPart && textPart.type === 'text') {
                        textPart.text += parsed.textDelta;
                      }
                    }
                    return updated;
                  });
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          onError?.(error);
        }
      } finally {
        setIsStreaming(false);
        setAbortController(null);
      }
    },
    [messages, apiEndpoint, onError]
  );

  const stopStreaming = useCallback(() => {
    abortController?.abort();
    setIsStreaming(false);
  }, [abortController]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <ChatContext.Provider
      value={{ messages, isStreaming, sendMessage, stopStreaming, clearMessages }}
    >
      {children}
    </ChatContext.Provider>
  );
}
```

---

## File Organization Summary

### Before (Current - Wrong)
```
apps/app/app/(authenticated)/components/
├── prompt-input/              # ❌ App-specific, not reusable
│   ├── types.ts
│   ├── prompt-input.tsx
│   ├── file-upload-button.tsx
│   ├── voice-input-button.tsx
│   ├── connections-button.tsx
│   ├── attachment-preview.tsx
│   └── connect-tools-banner.tsx
├── chat-section.tsx           # ❌ Tight coupling
└── chatbot.tsx                # Uses @repo/ai
```

### After (Recommended)
```
packages/ai/
├── components/
│   ├── prompt-input/          # ✅ Reusable across apps
│   │   ├── index.tsx
│   │   ├── prompt-input.tsx
│   │   ├── file-upload-button.tsx
│   │   ├── voice-input-button.tsx
│   │   ├── connections-button.tsx
│   │   ├── attachment-preview.tsx
│   │   └── suggested-actions.tsx
│   ├── chat/                  # ✅ Reusable chat components
│   │   ├── index.tsx
│   │   ├── chat-container.tsx
│   │   └── chat-messages.tsx
│   ├── message.tsx            # Existing
│   └── thread.tsx             # Existing
├── hooks/                     # ✅ Reusable hooks
│   ├── index.ts
│   ├── use-chat-stream.ts
│   ├── use-voice-input.ts
│   └── use-file-upload.ts
├── providers/                 # ✅ Context providers
│   ├── index.tsx
│   ├── chat-provider.tsx
│   └── data-stream-provider.tsx
├── tools/                     # Existing
│   ├── create-document.ts
│   ├── update-document.ts
│   └── ...
├── lib/
│   ├── models.ts              # Existing
│   ├── react.ts               # Existing
│   ├── prompts.ts             # ✅ NEW - System prompts
│   ├── streaming.ts           # ✅ NEW - Stream utilities
│   └── types/
│       ├── index.ts
│       ├── messages.ts        # ✅ NEW
│       ├── attachments.ts     # ✅ NEW
│       └── tools.ts           # ✅ NEW
└── index.ts

apps/app/app/(authenticated)/
├── components/
│   ├── chat-section.tsx       # ✅ App-specific wrapper only
│   └── connect-tools-banner.tsx # ✅ App-specific CTA
└── page.tsx                   # Uses @repo/ai/components/prompt-input
```

---

## Decision

**Selected Option:** Option A - Extend `@repo/ai` Package

**Reasoning:**
1. Matches established monorepo patterns
2. Aligns with ai-chatbot template organization
3. Enables reusability across applications
4. Maintains proper separation of concerns
5. Type-safe with explicit package exports

---

## Action Items

1. [ ] Create new directory structure in `packages/ai/`
2. [ ] Move prompt-input components from `apps/app/` to `packages/ai/`
3. [ ] Create type definitions in `packages/ai/lib/types/`
4. [ ] Update `packages/ai/package.json` with new exports
5. [ ] Create chat provider and hooks
6. [ ] Update app imports to use `@repo/ai/components/prompt-input`
7. [ ] Add system prompts in `packages/ai/lib/prompts.ts`
8. [ ] Integrate with existing `useChat` hook
9. [ ] Add streaming utilities
10. [ ] Update documentation

---

## Consequences

### Positive
- Consistent with monorepo best practices
- Reusable across all applications
- Better type safety and IntelliSense
- Easier testing in isolation
- Clear ownership and maintenance boundaries

### Negative
- Requires migration effort
- More complex import paths
- Package boundary management overhead

### Risks
- Breaking changes during migration
- Potential circular dependency issues

### Mitigation
- Implement incrementally
- Maintain backwards compatibility during transition
- Thorough testing before removing old code

---

## References

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [ai-chatbot Template](https://github.com/vercel/ai-chatbot)
- [next-forge Monorepo](https://github.com/haydenbleasel/next-forge)
- [Turborepo Documentation](https://turbo.build/repo/docs)
