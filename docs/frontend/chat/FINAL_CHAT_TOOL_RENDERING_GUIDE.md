# The Definitive Chat-Side Tool Rendering Guide

> This guide maps every one of your 33 Rubic tools to the correct Elements AI component with **verified, production-ready code** using the actual component APIs. It covers the complete data flow from `useChat()` to pixel, including state connections, streaming handling, and the exact props for every component.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [AI SDK v6 Data Flow](#2-ai-sdk-v6-data-flow)
3. [The Complete Page Structure](#3-the-complete-page-structure)
4. [The Master Message Renderer](#4-the-master-message-renderer)
5. [Tool Renderer — Every Tool Mapped](#5-tool-renderer--every-tool-mapped)
6. [State Connections](#6-state-connections)
7. [Installation Checklist](#7-installation-checklist)

---

## 1. Architecture Overview

Your chat page has three layers:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Page Shell                                         │
│   <Conversation>  +  <PromptInput>  +  <AgentCanvas>       │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Message Renderer (per message)                     │
│   Iterates message.parts[] and delegates to:                │
│   - TextRenderer     (type: "text")                         │
│   - ReasoningRenderer(type: "reasoning")                    │
│   - SourceRenderer   (type: "source-url")                   │
│   - ToolRenderer     (type: "tool-invocation")              │
│   - FileRenderer     (type: "file")                         │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Tool-Specific Renderers (per tool-invocation)      │
│   switch(toolName) → specialized Elements AI component      │
│   show_plan    → <Plan>                                     │
│   web_search   → <Sources>                                  │
│   shell_exec   → <Terminal>                                 │
│   code_execute → <Sandbox>                                  │
│   file_write   → <CodeBlock> inside <Artifact>              │
│   browser_*    → <WebPreview>                               │
│   generate_image → <Image>                                  │
│   message_ask  → <Confirmation>                             │
│   ...etc                                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. AI SDK v6 Data Flow

The `useChat` hook from `@ai-sdk/react` is the single source of truth. It returns a `messages` array where each message has a `parts` array. Each part has a `type` field that determines what to render.

```typescript
// The types you will work with:
import type { UIMessage } from "ai";

// UIMessage.parts contains:
// { type: "text", text: string }
// { type: "reasoning", text: string }
// { type: "source-url", url: string }
// { type: "file", ... }
// { type: "tool-invocation", toolInvocationId: string, toolName: string,
//   args: any, state: ToolState, result?: any, approval?: any }
//
// ToolState = "partial-call" | "call" | "partial-result" | "result"
```

**Key insight**: The `state` field on tool-invocation parts tells you where the tool is in its lifecycle:

| State | Meaning | What to Show |
|-------|---------|--------------|
| `partial-call` | Args still streaming in | Shimmer / loading |
| `call` | Args complete, executing | Spinner / "Running..." |
| `partial-result` | Result streaming in | Partial output |
| `result` | Complete | Full output |

If you use `experimental_toolCallApproval`, you also get:

| State | Meaning |
|-------|---------|
| `approval-requested` | Waiting for user to approve |
| `approval-responded` | User responded |
| `output-denied` | User rejected |

---

## 3. The Complete Page Structure

This is the top-level page using Elements AI's `Conversation`, `Message`, and `PromptInput` components.

```tsx
// app/chat/[id]/chat-client.tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputBody,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { MessageSquare, Globe, Copy, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react";
import { useState } from "react";
import { MessagePartsRenderer } from "./message-parts-renderer";

const suggestions = [
  "Help me build a landing page",
  "Search for the latest AI news",
  "Write a Python script to process CSV files",
];

export function ChatClient({ chatId }: { chatId: string }) {
  const [input, setInput] = useState("");

  const {
    messages,
    sendMessage,
    status,
    addToolApprovalResponse,
  } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isStreaming = status === "streaming";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput("");
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };

  return (
    <div className="flex flex-col h-full">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-12" />}
              title="How can I help you?"
              description="Ask me anything or pick a suggestion below."
            />
          ) : (
            messages.map((message, index) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  <MessagePartsRenderer
                    message={message}
                    isLastMessage={index === messages.length - 1}
                    isStreaming={isStreaming}
                    addToolApprovalResponse={addToolApprovalResponse}
                  />
                </MessageContent>
                {message.role === "assistant" && (
                  <MessageActions>
                    <MessageAction tooltip="Copy" label="Copy">
                      <Copy className="size-4" />
                    </MessageAction>
                    <MessageAction tooltip="Like" label="Like">
                      <ThumbsUp className="size-4" />
                    </MessageAction>
                    <MessageAction tooltip="Dislike" label="Dislike">
                      <ThumbsDown className="size-4" />
                    </MessageAction>
                    <MessageAction tooltip="Retry" label="Retry">
                      <RefreshCw className="size-4" />
                    </MessageAction>
                  </MessageActions>
                )}
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Suggestions (show when empty or after last message) */}
      {messages.length === 0 && (
        <Suggestions>
          {suggestions.map((s) => (
            <Suggestion key={s} suggestion={s} onClick={handleSuggestionClick} />
          ))}
        </Suggestions>
      )}

      {/* Prompt Input */}
      <PromptInput onSubmit={handleSubmit} className="mt-4">
        <PromptInputBody>
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputButton tooltip="Search the web">
              <Globe size={16} />
              <span>Search</span>
            </PromptInputButton>
          </PromptInputTools>
          <PromptInputSubmit
            status={isStreaming ? "streaming" : "ready"}
            disabled={!input.trim()}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
```

---

## 4. The Master Message Renderer

This component receives a single `UIMessage` and renders every part. It handles the critical logic of:
1. Consolidating multiple `reasoning` parts into one `<Reasoning>` block
2. Collecting `source-url` parts into one `<Sources>` block
3. Delegating `tool-invocation` parts to the `ToolRenderer`

```tsx
// components/message-parts-renderer.tsx
"use client";

import type { UIMessage } from "ai";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
  Source,
} from "@/components/ai-elements/sources";
import { MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ToolRenderer } from "./tool-renderer";

interface MessagePartsRendererProps {
  message: UIMessage;
  isLastMessage: boolean;
  isStreaming: boolean;
  addToolApprovalResponse: (response: { id: string; approved: boolean }) => void;
}

export function MessagePartsRenderer({
  message,
  isLastMessage,
  isStreaming,
  addToolApprovalResponse,
}: MessagePartsRendererProps) {
  // ─── 1. Consolidate all reasoning parts into one block ───
  const reasoningParts = message.parts.filter((p) => p.type === "reasoning");
  const reasoningText = reasoningParts.map((p) => p.text).join("\n\n");
  const hasReasoning = reasoningParts.length > 0;
  const lastPart = message.parts.at(-1);
  const isReasoningStreaming =
    isLastMessage && isStreaming && lastPart?.type === "reasoning";

  // ─── 2. Collect all source-url parts ───
  const sourceParts = message.parts.filter((p) => p.type === "source-url");
  const hasSources = sourceParts.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Reasoning (consolidated, rendered once at top) */}
      {hasReasoning && (
        <Reasoning isStreaming={isReasoningStreaming}>
          <ReasoningTrigger />
          <ReasoningContent>{reasoningText}</ReasoningContent>
        </Reasoning>
      )}

      {/* Sources (consolidated, rendered once) */}
      {hasSources && (
        <Sources>
          <SourcesTrigger count={sourceParts.length} />
          <SourcesContent>
            {sourceParts.map((part, i) => (
              <Source
                key={`source-${i}`}
                href={(part as any).url}
                title={(part as any).url}
              />
            ))}
          </SourcesContent>
        </Sources>
      )}

      {/* Render non-reasoning, non-source parts sequentially */}
      {message.parts.map((part, index) => {
        switch (part.type) {
          case "text":
            return (
              <MessageResponse key={`${message.id}-text-${index}`}>
                {part.text}
              </MessageResponse>
            );

          case "tool-invocation":
            return (
              <ToolRenderer
                key={`${message.id}-tool-${index}`}
                part={part}
                addToolApprovalResponse={addToolApprovalResponse}
              />
            );

          case "file":
            // File parts (images, documents uploaded by user or generated)
            return null; // Handled by MessageAttachments if needed

          case "reasoning":
          case "source-url":
            // Already rendered above
            return null;

          default:
            return null;
        }
      })}

      {/* Shimmer loading indicator when waiting for response */}
      {isLastMessage && isStreaming && message.parts.length === 0 && (
        <Shimmer>Thinking...</Shimmer>
      )}
    </div>
  );
}
```

---

## 5. Tool Renderer — Every Tool Mapped

This is the core of the system. Each tool gets its own specialized rendering using the correct Elements AI component with the correct props.

```tsx
// components/tool-renderer.tsx
"use client";

import type { ToolInvocationUIPart } from "ai";

// ─── Plan ───
import {
  Plan,
  PlanHeader,
  PlanTitle,
  PlanDescription,
  PlanTrigger,
  PlanContent,
} from "@/components/ai-elements/plan";

// ─── Task (for plan steps) ───
import {
  Queue,
  QueueList,
  QueueItem,
  QueueItemIndicator,
  QueueItemContent,
} from "@/components/ai-elements/queue";

// ─── Tool (generic wrapper + collapsible) ───
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";

// ─── Terminal ───
import {
  Terminal,
  TerminalHeader,
  TerminalTitle,
  TerminalContent,
  TerminalCopyButton,
} from "@/components/ai-elements/terminal";

// ─── Code Block ───
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockFilename,
  CodeBlockActions,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";

// ─── Sandbox (for code_execute) ───
import {
  Sandbox,
  SandboxHeader,
  SandboxContent,
  SandboxTabs,
  SandboxTabsBar,
  SandboxTabsList,
  SandboxTabsTrigger,
  SandboxTabContent,
} from "@/components/ai-elements/sandbox";

// ─── Sources ───
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
  Source,
} from "@/components/ai-elements/sources";

// ─── Web Preview ───
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewUrl,
} from "@/components/ai-elements/web-preview";

// ─── Artifact ───
import {
  Artifact,
  ArtifactHeader,
  ArtifactTitle,
  ArtifactDescription,
  ArtifactContent,
  ArtifactActions,
  ArtifactAction,
} from "@/components/ai-elements/artifact";

// ─── Image ───
import { Image } from "@/components/ai-elements/image";

// ─── Confirmation ───
import {
  Confirmation,
  ConfirmationRequest,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationActions,
  ConfirmationAction,
} from "@/components/ai-elements/confirmation";

// ─── Shimmer ───
import { Shimmer } from "@/components/ai-elements/shimmer";

// ─── File Tree ───
import {
  FileTree,
  FileTreeFile,
  FileTreeFolder,
} from "@/components/ai-elements/file-tree";

// ─── Inline Citation ───
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationSource,
  InlineCitationQuote,
} from "@/components/ai-elements/inline-citation";

import { CheckIcon, XIcon, FileIcon, TerminalIcon, GlobeIcon, SearchIcon } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Helper: Map tool state to a human-readable status label
// ─────────────────────────────────────────────────────────────
function getToolStatusLabel(state: string): string {
  switch (state) {
    case "partial-call": return "Preparing...";
    case "call": return "Running...";
    case "partial-result": return "Receiving...";
    case "result": return "Done";
    default: return state;
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: Extract file extension for syntax highlighting
// ─────────────────────────────────────────────────────────────
function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", rs: "rust", go: "go", rb: "ruby",
    css: "css", html: "html", json: "json", md: "markdown",
    yaml: "yaml", yml: "yaml", sh: "bash", sql: "sql",
  };
  return map[ext] || ext;
}

// ─────────────────────────────────────────────────────────────
// Helper: Build file tree from a list of paths
// ─────────────────────────────────────────────────────────────
interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
}

function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode[] = [];
  for (const p of paths) {
    const parts = p.split("/").filter(Boolean);
    let current = root;
    let currentPath = "";
    for (let i = 0; i < parts.length; i++) {
      currentPath += "/" + parts[i];
      const isLast = i === parts.length - 1;
      let existing = current.find((n) => n.name === parts[i]);
      if (!existing) {
        existing = {
          name: parts[i],
          path: currentPath,
          type: isLast ? "file" : "folder",
          children: isLast ? undefined : [],
        };
        current.push(existing);
      }
      if (!isLast) current = existing.children!;
    }
  }
  return root;
}

function renderFileTree(nodes: FileNode[]): React.ReactNode {
  return nodes.map((node) => {
    if (node.type === "folder") {
      return (
        <FileTreeFolder key={node.path} name={node.name} path={node.path}>
          {node.children && renderFileTree(node.children)}
        </FileTreeFolder>
      );
    }
    return <FileTreeFile key={node.path} name={node.name} path={node.path} />;
  });
}

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════

interface ToolRendererProps {
  part: ToolInvocationUIPart;
  addToolApprovalResponse: (response: { id: string; approved: boolean }) => void;
}

export function ToolRenderer({ part, addToolApprovalResponse }: ToolRendererProps) {
  const { toolName, args, state } = part;
  const result = "result" in part ? part.result : undefined;
  const isComplete = state === "result";
  const isRunning = state === "call" || state === "partial-result";
  const isStreaming = state === "partial-call" || state === "partial-result";

  switch (toolName) {

    // ═══════════════════════════════════════════════════════
    // CATEGORY 1: PLANNING — show_plan
    // ═══════════════════════════════════════════════════════
    case "show_plan": {
      const goal = args?.goal || "Working...";
      const todos = args?.todos || [];
      const completedCount = todos.filter(
        (t: any) => t.status === "completed"
      ).length;

      return (
        <Plan isStreaming={isStreaming} defaultOpen>
          <PlanHeader>
            <div>
              <PlanTitle>{goal}</PlanTitle>
              <PlanDescription>
                {completedCount}/{todos.length} tasks completed
              </PlanDescription>
            </div>
            <PlanTrigger />
          </PlanHeader>
          <PlanContent>
            <Queue>
              <QueueList>
                {todos.map((todo: any) => (
                  <QueueItem key={todo.id}>
                    <div className="flex items-center gap-2">
                      <QueueItemIndicator
                        completed={todo.status === "completed"}
                      />
                      <QueueItemContent
                        completed={todo.status === "completed"}
                      >
                        {todo.label}
                      </QueueItemContent>
                    </div>
                  </QueueItem>
                ))}
              </QueueList>
            </Queue>
          </PlanContent>
        </Plan>
      );
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORY 2: COMMUNICATION — message_notify_user, message_ask_user
    // ═══════════════════════════════════════════════════════
    case "message_notify_user": {
      // Notifications are typically rendered as text by the LLM.
      // If you want to show them as a distinct UI element:
      return (
        <Tool>
          <ToolHeader
            title="Notification"
            type={`tool-${toolName}`}
            state={state}
          />
        </Tool>
      );
    }

    case "message_ask_user": {
      // This tool requires user approval/input
      const approval = (part as any).approval;
      if (approval) {
        return (
          <Confirmation approval={approval} state={state}>
            <ConfirmationRequest>
              {args?.message || "The agent needs your input."}
            </ConfirmationRequest>
            <ConfirmationAccepted>
              <CheckIcon className="size-4" />
              <span>You approved this action</span>
            </ConfirmationAccepted>
            <ConfirmationRejected>
              <XIcon className="size-4" />
              <span>You rejected this action</span>
            </ConfirmationRejected>
            <ConfirmationActions>
              <ConfirmationAction
                variant="outline"
                onClick={() =>
                  addToolApprovalResponse({
                    id: approval.id,
                    approved: false,
                  })
                }
              >
                Reject
              </ConfirmationAction>
              <ConfirmationAction
                variant="default"
                onClick={() =>
                  addToolApprovalResponse({
                    id: approval.id,
                    approved: true,
                  })
                }
              >
                Approve
              </ConfirmationAction>
            </ConfirmationActions>
          </Confirmation>
        );
      }
      // Fallback if no approval workflow
      return (
        <Tool>
          <ToolHeader
            title="Asking user"
            type={`tool-${toolName}`}
            state={state}
          />
          <ToolContent>
            <ToolOutput output={args?.message} />
          </ToolContent>
        </Tool>
      );
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORY 3: FILE SYSTEM — file_read, file_write, file_str_replace,
    //   file_find_in_content, file_find_by_name
    // ═══════════════════════════════════════════════════════
    case "file_write": {
      const filePath = args?.path || "untitled";
      const content = args?.content || "";
      const language = getLanguageFromPath(filePath);
      const fileName = filePath.split("/").pop() || filePath;

      return (
        <Artifact>
          <ArtifactHeader>
            <ArtifactTitle>{fileName}</ArtifactTitle>
            <ArtifactDescription>{filePath}</ArtifactDescription>
            <ArtifactActions>
              <ArtifactAction tooltip="Copy" label="Copy" />
            </ArtifactActions>
          </ArtifactHeader>
          <ArtifactContent>
            <CodeBlock code={content} language={language}>
              <CodeBlockHeader>
                <CodeBlockTitle>
                  <FileIcon size={14} />
                  <CodeBlockFilename>{fileName}</CodeBlockFilename>
                </CodeBlockTitle>
                <CodeBlockActions>
                  <CodeBlockCopyButton />
                </CodeBlockActions>
              </CodeBlockHeader>
            </CodeBlock>
          </ArtifactContent>
        </Artifact>
      );
    }

    case "file_read": {
      const filePath = args?.path || "untitled";
      const content = isComplete ? result?.content || "" : "";
      const language = getLanguageFromPath(filePath);
      const fileName = filePath.split("/").pop() || filePath;

      if (!isComplete) {
        return (
          <Tool>
            <ToolHeader
              title={`Reading ${fileName}`}
              type={`tool-${toolName}`}
              state={state}
            />
          </Tool>
        );
      }

      return (
        <Artifact>
          <ArtifactHeader>
            <ArtifactTitle>{fileName}</ArtifactTitle>
            <ArtifactDescription>{filePath}</ArtifactDescription>
          </ArtifactHeader>
          <ArtifactContent>
            <CodeBlock code={content} language={language}>
              <CodeBlockHeader>
                <CodeBlockTitle>
                  <FileIcon size={14} />
                  <CodeBlockFilename>{fileName}</CodeBlockFilename>
                </CodeBlockTitle>
                <CodeBlockActions>
                  <CodeBlockCopyButton />
                </CodeBlockActions>
              </CodeBlockHeader>
            </CodeBlock>
          </ArtifactContent>
        </Artifact>
      );
    }

    case "file_str_replace": {
      const filePath = args?.path || "";
      const fileName = filePath.split("/").pop() || filePath;
      return (
        <Tool>
          <ToolHeader
            title={`Editing ${fileName}`}
            type={`tool-${toolName}`}
            state={state}
          />
          <ToolContent>
            <ToolInput input={args} />
            {isComplete && <ToolOutput output={result} />}
          </ToolContent>
        </Tool>
      );
    }

    case "file_find_in_content":
    case "file_find_by_name": {
      const query = args?.pattern || args?.glob || "";
      const results = isComplete ? result?.matches || [] : [];

      if (!isComplete) {
        return (
          <Tool>
            <ToolHeader
              title={`Searching for "${query}"`}
              type={`tool-${toolName}`}
              state={state}
            />
          </Tool>
        );
      }

      // Show results as a file tree
      const paths = results.map((r: any) => r.path || r);
      const tree = buildFileTree(paths);

      return (
        <Tool defaultOpen>
          <ToolHeader
            title={`Found ${results.length} results for "${query}"`}
            type={`tool-${toolName}`}
            state={state}
          />
          <ToolContent>
            <FileTree>{renderFileTree(tree)}</FileTree>
          </ToolContent>
        </Tool>
      );
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORY 4: SHELL — shell_exec, shell_view, shell_wait,
    //   shell_write_to_process, shell_kill_process
    // ═══════════════════════════════════════════════════════
    case "shell_exec":
    case "shell_view":
    case "shell_wait":
    case "shell_write_to_process":
    case "shell_kill_process": {
      const command = args?.command || args?.input || "";
      const output = isComplete
        ? result?.stdout || result?.output || result?.stderr || ""
        : "";

      return (
        <Terminal isStreaming={isRunning} autoScroll>
          <TerminalHeader>
            <TerminalTitle>
              <TerminalIcon size={14} />
              <span>{command ? `$ ${command}` : "Terminal"}</span>
            </TerminalTitle>
            <TerminalCopyButton />
          </TerminalHeader>
          <TerminalContent>
            {isRunning && !output ? (
              <Shimmer>Executing...</Shimmer>
            ) : (
              output
            )}
          </TerminalContent>
        </Terminal>
      );
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORY 5: CODE EXECUTION — code_execute
    // ═══════════════════════════════════════════════════════
    case "code_execute": {
      const code = args?.code || "";
      const language = args?.language || "python";
      const output = isComplete ? result?.logs || result?.output || "" : "";
      const filename = args?.filename || `code.${language === "python" ? "py" : language}`;

      return (
        <Sandbox>
          <SandboxHeader state={state} title={filename} />
          <SandboxContent>
            <SandboxTabs defaultValue="code">
              <SandboxTabsBar>
                <SandboxTabsList>
                  <SandboxTabsTrigger value="code">Code</SandboxTabsTrigger>
                  <SandboxTabsTrigger value="output">Output</SandboxTabsTrigger>
                </SandboxTabsList>
              </SandboxTabsBar>
              <SandboxTabContent value="code">
                <CodeBlock code={code} language={language} showLineNumbers />
              </SandboxTabContent>
              <SandboxTabContent value="output">
                <Terminal output={output} isStreaming={isRunning} />
              </SandboxTabContent>
            </SandboxTabs>
          </SandboxContent>
        </Sandbox>
      );
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORY 6: WEB SEARCH — web_search
    // ═══════════════════════════════════════════════════════
    case "web_search": {
      const query = args?.query || "";
      const searchResults = isComplete ? result?.results || [] : [];

      if (!isComplete) {
        return (
          <Tool>
            <ToolHeader
              title={`Searching "${query}"`}
              type={`tool-${toolName}`}
              state={state}
              toolName="web_search"
            />
          </Tool>
        );
      }

      return (
        <Sources>
          <SourcesTrigger count={searchResults.length} />
          <SourcesContent>
            {searchResults.map((r: any, i: number) => (
              <Source
                key={i}
                href={r.url}
                title={r.title || r.url}
              />
            ))}
          </SourcesContent>
        </Sources>
      );
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORY 7: BROWSER — all browser_* tools
    // ═══════════════════════════════════════════════════════
    case "browser_navigate": {
      const url = args?.url || "";
      return (
        <Tool defaultOpen>
          <ToolHeader
            title={`Navigating to ${new URL(url).hostname}`}
            type={`tool-${toolName}`}
            state={state}
            toolName="browser_navigate"
          />
          <ToolContent>
            <WebPreview defaultUrl={url}>
              <WebPreviewNavigation>
                <WebPreviewUrl />
              </WebPreviewNavigation>
              {isComplete && result?.screenshot && (
                <img
                  src={`data:image/png;base64,${result.screenshot}`}
                  alt="Browser screenshot"
                  className="w-full rounded-b-lg"
                />
              )}
            </WebPreview>
          </ToolContent>
        </Tool>
      );
    }

    case "browser_click":
    case "browser_input":
    case "browser_scroll":
    case "browser_scroll_up":
    case "browser_scroll_down":
    case "browser_move_mouse":
    case "browser_press_key":
    case "browser_select_option":
    case "browser_screenshot": {
      const action = toolName.replace("browser_", "").replace(/_/g, " ");
      return (
        <Tool>
          <ToolHeader
            title={`Browser: ${action}`}
            type={`tool-${toolName}`}
            state={state}
          />
          {isComplete && result?.screenshot && (
            <ToolContent>
              <img
                src={`data:image/png;base64,${result.screenshot}`}
                alt="Browser screenshot"
                className="w-full rounded-lg"
              />
            </ToolContent>
          )}
        </Tool>
      );
    }

    case "browser_view": {
      return (
        <Tool>
          <ToolHeader
            title="Viewing page"
            type={`tool-${toolName}`}
            state={state}
          />
          {isComplete && result?.screenshot && (
            <ToolContent>
              <img
                src={`data:image/png;base64,${result.screenshot}`}
                alt="Browser screenshot"
                className="w-full rounded-lg"
              />
            </ToolContent>
          )}
        </Tool>
      );
    }

    case "browser_console_exec":
    case "browser_console_view": {
      const code = args?.code || args?.javascript || "";
      const output = isComplete ? result?.output || "" : "";
      return (
        <Terminal isStreaming={isRunning}>
          <TerminalHeader>
            <TerminalTitle>Browser Console</TerminalTitle>
            <TerminalCopyButton />
          </TerminalHeader>
          <TerminalContent>
            {code && `> ${code}\n`}
            {output}
          </TerminalContent>
        </Terminal>
      );
    }

    case "browser_restart": {
      return (
        <Tool>
          <ToolHeader
            title="Restarting browser"
            type={`tool-${toolName}`}
            state={state}
          />
        </Tool>
      );
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORY 8: DEPLOYMENT — deploy_expose_port, deploy_apply_deployment
    // ═══════════════════════════════════════════════════════
    case "deploy_expose_port":
    case "deploy_apply_deployment": {
      const url = isComplete ? result?.url || "" : "";
      return (
        <Tool defaultOpen>
          <ToolHeader
            title={toolName === "deploy_expose_port" ? "Exposing port" : "Deploying"}
            type={`tool-${toolName}`}
            state={state}
          />
          <ToolContent>
            {url ? (
              <WebPreview defaultUrl={url}>
                <WebPreviewNavigation>
                  <WebPreviewUrl />
                </WebPreviewNavigation>
                <WebPreviewBody src={url} />
              </WebPreview>
            ) : (
              <Shimmer>Deploying...</Shimmer>
            )}
          </ToolContent>
        </Tool>
      );
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORY 9: IMAGE GENERATION — generate_image
    // ═══════════════════════════════════════════════════════
    case "generate_image": {
      const prompt = args?.prompt || "Generated image";

      if (!isComplete) {
        return (
          <Tool>
            <ToolHeader
              title={`Generating: "${prompt}"`}
              type={`tool-${toolName}`}
              state={state}
            />
            <ToolContent>
              <Shimmer>Creating image...</Shimmer>
            </ToolContent>
          </Tool>
        );
      }

      // result should contain { base64, mediaType } or { url }
      const imageData = result;
      if (imageData?.base64) {
        return (
          <Image
            base64={imageData.base64}
            mediaType={imageData.mediaType}
            alt={prompt}
            className="max-w-md rounded-lg"
          />
        );
      }
      if (imageData?.url) {
        return (
          <img
            src={imageData.url}
            alt={prompt}
            className="max-w-md rounded-lg"
          />
        );
      }
      return null;
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORY 10: SCHEDULING — schedule_create, schedule_delete
    // ═══════════════════════════════════════════════════════
    case "schedule_create":
    case "schedule_delete": {
      return (
        <Tool>
          <ToolHeader
            title={toolName === "schedule_create" ? "Creating schedule" : "Deleting schedule"}
            type={`tool-${toolName}`}
            state={state}
          />
          <ToolContent>
            <ToolInput input={args} />
            {isComplete && <ToolOutput output={result} />}
          </ToolContent>
        </Tool>
      );
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORY 11: ANALYTICS — track_event
    // ═══════════════════════════════════════════════════════
    case "track_event": {
      return (
        <Tool>
          <ToolHeader
            title="Tracking event"
            type={`tool-${toolName}`}
            state={state}
          />
        </Tool>
      );
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORY 12: DYNAMIC TOOLS (Composio, IoT, etc.)
    // ═══════════════════════════════════════════════════════
    // These are tools loaded at runtime. They all get the generic Tool wrapper.

    // ═══════════════════════════════════════════════════════
    // DEFAULT FALLBACK — Any unrecognized tool
    // ═══════════════════════════════════════════════════════
    default: {
      return (
        <Tool defaultOpen>
          <ToolHeader
            title={toolName.replace(/_/g, " ")}
            type={`tool-${toolName}`}
            state={state}
            toolName={toolName}
          />
          <ToolContent>
            <ToolInput input={args} />
            {isComplete && (
              <ToolOutput
                output={
                  typeof result === "string"
                    ? result
                    : JSON.stringify(result, null, 2)
                }
              />
            )}
          </ToolContent>
        </Tool>
      );
    }
  }
}
```

---

## 6. State Connections

Here is how the chat rendering connects to your Redux state:

### 6.1 Primary State: `useChat()` (AI SDK)

This is the **most important** state. It is NOT Redux — it's React state managed by the `useChat` hook. It provides:

| Field | Type | Used By |
|-------|------|---------|
| `messages` | `UIMessage[]` | `MessagePartsRenderer` — the entire message list |
| `status` | `"streaming" \| "submitted" \| "ready" \| "error"` | `PromptInputSubmit` (status prop), `Reasoning` (isStreaming), `Terminal` (isStreaming) |
| `sendMessage` | `function` | `PromptInput` (onSubmit), `Suggestion` (onClick) |
| `addToolApprovalResponse` | `function` | `Confirmation` (approve/reject buttons) |

### 6.2 Redux State Slices That Connect to Chat Rendering

| Redux Slice | What It Controls | Connected Component |
|-------------|-----------------|---------------------|
| `chat.currentSessionId` | Which chat is active | `ChatClient` (determines which `useChat` instance) |
| `sessions.list` | Session metadata | `ChatHeader` (title, created date) |
| `agentWorkspace.sidebarType` | Which canvas view is open | `AgentCanvas` (switches between code/terminal/browser/etc.) |
| `agentWorkspace.currentFile` | Active file in IDE | `CodeIDEView` (which tab is selected) |
| `codeViewer.files` | File contents for IDE | `CodeIDEView` (file content display) |
| `webDev.previewUrl` | Live preview URL | `WebPreview` in canvas |
| `ui.isSidebarOpen` | Canvas panel visibility | `ChatLayout` (split panel width) |
| `timeline.events` | Activity log | `AgentActivityTracker` (floating plan window) |

### 6.3 The Critical Insight: Chat vs Canvas

The **chat panel** (left side) is driven entirely by `useChat().messages`. No Redux needed.

The **canvas panel** (right side) is driven by Redux state that gets updated when tool results come back. The bridge between them is:

```
useChat messages → tool-invocation part with result
                          ↓
                   onToolResult callback
                          ↓
                   dispatch(setCanvasView(...))
                          ↓
                   Redux agentWorkspace.sidebarType updates
                          ↓
                   AgentCanvas re-renders with new view
```

---

## 7. Installation Checklist

Run these commands to install all required Elements AI components:

```bash
# Core chatbot components
npx ai-elements@latest add conversation
npx ai-elements@latest add message
npx ai-elements@latest add prompt-input
npx ai-elements@latest add reasoning
npx ai-elements@latest add sources
npx ai-elements@latest add suggestion
npx ai-elements@latest add shimmer
npx ai-elements@latest add tool
npx ai-elements@latest add plan
npx ai-elements@latest add queue
npx ai-elements@latest add confirmation
npx ai-elements@latest add inline-citation
npx ai-elements@latest add attachments

# Code & agent components
npx ai-elements@latest add code-block
npx ai-elements@latest add terminal
npx ai-elements@latest add sandbox
npx ai-elements@latest add artifact
npx ai-elements@latest add file-tree
npx ai-elements@latest add web-preview
npx ai-elements@latest add image

# Don't forget the Streamdown CSS import in globals.css:
# @source "../node_modules/streamdown/dist/*.js";
```

### NPM Dependencies

```bash
npm install @ai-sdk/react ai streamdown
```

---

## Summary: What Renders Where

| Your Tool | Chat Panel Component | Canvas Panel Component |
|-----------|---------------------|----------------------|
| `show_plan` | `<Plan>` + `<Queue>` with tasks | — |
| `message_notify_user` | `<Tool>` (compact header only) | — |
| `message_ask_user` | `<Confirmation>` with approve/reject | — |
| `file_write` | `<Artifact>` + `<CodeBlock>` | `CodeIDEView` |
| `file_read` | `<Artifact>` + `<CodeBlock>` | `CodeIDEView` |
| `file_str_replace` | `<Tool>` with input/output | `CodeIDEView` |
| `file_find_*` | `<Tool>` + `<FileTree>` | `CodeIDEView` |
| `shell_exec` | `<Terminal>` | `TerminalView` |
| `shell_view/wait/write/kill` | `<Terminal>` | `TerminalView` |
| `code_execute` | `<Sandbox>` (code + output tabs) | `CodeIDEView` + `TerminalView` |
| `web_search` | `<Sources>` | — |
| `browser_navigate` | `<Tool>` + `<WebPreview>` | `BrowserView` |
| `browser_click/input/scroll` | `<Tool>` (compact) | `BrowserView` |
| `browser_console_*` | `<Terminal>` | `BrowserView` |
| `deploy_*` | `<Tool>` + `<WebPreview>` | `WebPreview` (live) |
| `generate_image` | `<Image>` | `ImageView` |
| `schedule_*` | `<Tool>` generic | — |
| `track_event` | `<Tool>` (compact) | — |
| Dynamic tools | `<Tool>` generic fallback | — |

---

## References

- [1] [Elements AI Components](https://elements.ai-sdk.dev/components)
- [2] [AI SDK v6 Tool Usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage)
- [3] [AI SDK useChat Reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
