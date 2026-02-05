# Packages Refactoring - Build Instructions

## Overview

The monorepo at `/Users/khaleelmusleh/Desktop/Projects/Etheon/rubic/packages/` contains shared packages used by the Next.js app (`apps/app/`) and microservices (`services/`). Several packages need significant refactoring or implementation from scratch.

---

## 1. packages/storage/ - Refactor from Vercel Blob to AWS S3

### Current State

Two files that simply re-export Vercel Blob:

- `packages/storage/index.ts`: `export * from "@vercel/blob";`
- `packages/storage/client.ts`: `export * from "@vercel/blob/client";`
- `packages/storage/keys.ts`: Env validation (existing)
- `packages/storage/package.json`: Dependencies on `@vercel/blob`

### What to Build

Replace with AWS S3 using presigned URLs for secure client-side uploads/downloads.

**Install:**

```json
{
  "@aws-sdk/client-s3": "^3.x",
  "@aws-sdk/s3-request-presigner": "^3.x",
  "@aws-sdk/lib-storage": "^3.x"
}
```

**Remove:** `@vercel/blob`

**Create files:**

#### `packages/storage/keys.ts` (replace existing)

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      AWS_ACCESS_KEY_ID: z.string().min(1),
      AWS_SECRET_ACCESS_KEY: z.string().min(1),
      AWS_REGION: z.string().default("us-east-1"),
      AWS_S3_BUCKET: z.string().min(1),
      AWS_S3_ENDPOINT: z.string().url().optional(), // For S3-compatible (R2, MinIO)
    },
    runtimeEnv: {
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      AWS_REGION: process.env.AWS_REGION,
      AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
      AWS_S3_ENDPOINT: process.env.AWS_S3_ENDPOINT,
    },
  });
```

#### `packages/storage/s3-client.ts`

- Create and export configured `S3Client` instance
- Support custom endpoint for S3-compatible services (Cloudflare R2, MinIO)

#### `packages/storage/upload.ts`

- `uploadFile(key: string, body: Buffer | Readable | Blob, contentType: string, metadata?: Record<string, string>)` - PutObjectCommand
- `uploadMultipart(key: string, body: Readable, contentType: string)` - Use `@aws-sdk/lib-storage` Upload for large files
- `getUploadPresignedUrl(key: string, contentType: string, expiresIn?: number)` - For client-side direct uploads

#### `packages/storage/download.ts`

- `getDownloadPresignedUrl(key: string, expiresIn?: number)` - GetObjectCommand + getSignedUrl
- `getFile(key: string)` - GetObjectCommand returning stream
- `getFileMetadata(key: string)` - HeadObjectCommand

#### `packages/storage/delete.ts`

- `deleteFile(key: string)` - DeleteObjectCommand
- `deleteFiles(keys: string[])` - DeleteObjectsCommand for bulk delete

#### `packages/storage/utils.ts`

- `generateStorageKey(userId: string, fileName: string)` - Generate unique S3 key: `users/{userId}/files/{timestamp}-{randomId}/{fileName}`
- `getPublicUrl(key: string)` - Construct public URL for public files
- `isValidMimeType(mimeType: string, allowedTypes: string[])` - Validate file type

#### `packages/storage/index.ts` (replace existing)

```typescript
export { getS3Client } from "./s3-client";
export { uploadFile, uploadMultipart, getUploadPresignedUrl } from "./upload";
export { getDownloadPresignedUrl, getFile, getFileMetadata } from "./download";
export { deleteFile, deleteFiles } from "./delete";
export { generateStorageKey, getPublicUrl, isValidMimeType } from "./utils";
export { keys } from "./keys";
```

#### `packages/storage/client.ts` (replace existing)

Client-side upload helper using presigned URLs:

```typescript
export async function uploadToPresignedUrl(
  url: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void>;
```

### Consumers to Update

After refactoring, update these files that import from `@repo/storage`:

- `services/file/src/index.ts` - Replace Vercel Blob with S3 uploads
- `apps/app/lib/trpc/routers/files.router.ts` - Use `generateStorageKey`, `deleteFile`
- `apps/app/app/(authenticated)/components/settings/tabs/account-tab.tsx` - Avatar upload (currently uses data URL)

---

## 2. packages/editor/ - EMPTY, Needs Full Implementation

### Current State

Directory exists but is completely empty (`packages/editor/` - 0 files).

### What to Build

A code editor package for the website builder IDE feature. Use Monaco Editor (VS Code's editor) or CodeMirror 6.

**Install (choose one):**

```json
// Option A: Monaco Editor
{ "@monaco-editor/react": "^4.x", "monaco-editor": "^0.x" }

// Option B: CodeMirror (lighter weight, better for embedding)
{
  "@codemirror/view": "^6.x",
  "@codemirror/state": "^6.x",
  "@codemirror/lang-javascript": "^6.x",
  "@codemirror/lang-html": "^6.x",
  "@codemirror/lang-css": "^6.x",
  "@codemirror/lang-json": "^6.x",
  "@codemirror/lang-python": "^6.x",
  "@codemirror/lang-markdown": "^6.x",
  "@codemirror/autocomplete": "^6.x",
  "@codemirror/lint": "^6.x",
  "@codemirror/search": "^6.x",
  "codemirror": "^6.x"
}
```

**Create files:**

#### `packages/editor/package.json`

```json
{
  "name": "@repo/editor",
  "version": "0.0.0",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts",
  ...
}
```

#### `packages/editor/components/code-editor.tsx`

- Core editor component wrapping Monaco or CodeMirror
- Props: `value`, `onChange`, `language`, `theme`, `readOnly`, `lineNumbers`, `minimap`
- Language auto-detection from file extension
- Theme support: light/dark matching app theme

#### `packages/editor/components/file-tree.tsx`

- Tree view of project files
- Expand/collapse folders
- File icons by type
- Right-click context menu (new file, new folder, rename, delete)
- Drag-and-drop to move files
- Active file highlighting

#### `packages/editor/components/tab-bar.tsx`

- Multi-tab editor (like VS Code tabs)
- Close button per tab, middle-click to close
- Modified indicator (dot) on unsaved tabs
- Drag to reorder tabs
- Tab overflow with scroll or dropdown

#### `packages/editor/components/terminal-pane.tsx`

- Embedded terminal output
- Use `xterm.js` for real terminal emulation
- Or simple scrollable output log for command results
- Input line for commands
- Resize handle to adjust height

#### `packages/editor/components/preview-pane.tsx`

- Iframe preview of generated website
- Refresh button, URL bar showing current preview URL
- Device size toggles: Desktop / Tablet / Mobile
- Split view: editor left, preview right

#### `packages/editor/components/ide-layout.tsx`

- Full IDE layout combining all components
- Resizable panels (use `react-resizable-panels`)
- Layout: file tree (left) | editor + tabs (center) | preview (right) | terminal (bottom)
- Collapsible panels

#### `packages/editor/index.ts`

```typescript
export { CodeEditor } from "./components/code-editor";
export { FileTree } from "./components/file-tree";
export { TabBar } from "./components/tab-bar";
export { TerminalPane } from "./components/terminal-pane";
export { PreviewPane } from "./components/preview-pane";
export { IDELayout } from "./components/ide-layout";
```

### Consumers

- Website builder pages in `apps/app/` (not yet created)
- `apps/app/lib/store/slices/webDev.slice.ts` (10950 bytes) - Already has IDE-related state
- `apps/app/lib/store/slices/aiCanvasEditor.slice.ts` (10512 bytes) - Canvas editor state
- `apps/app/lib/store/slices/codeViewer.slice.ts` (7768 bytes) - Code viewer state

---

## 3. packages/ai/ - Enhancements Needed

### Current State

Comprehensive AI package (`packages/ai/`, 5472-byte index.ts) with:

**Agents** (`packages/ai/lib/agents/`):

- `tool-loop-agent.ts` - Agent that loops through tools
- `dag-agent.ts` - DAG-based agent execution
- `router-agent.ts` - Routes to different agents based on input
- `cached-agent.ts` - Agent with caching layer
- `types.ts` - Agent, AgentConfig, AgentStep, etc.

**Orchestration** (`packages/ai/lib/orchestration/`):

- `dag-executor.ts` - Execute DAG of tasks
- `task-planner.ts` - Plan tasks from natural language
- `parallel-runner.ts` - Run tasks in parallel

**Tools** (`packages/ai/lib/tools/`):

- `tool-registry.ts` - ToolRegistry, ToolBuilder, tool definitions
- Only 4 built-in tools: `get-weather.ts`, `update-document.ts`, `request-suggestions.ts`, `create-document.ts`

**Middleware** (`packages/ai/lib/middleware/`):

- `cost-tracking.ts` - Track API costs
- `logging.ts` - Log agent activity
- `rate-limiting.ts` - Rate limit API calls

**Providers** (`packages/ai/lib/providers/`):

- `provider-registry.ts` - Multi-provider management
- `fallback.ts` - Fallback chains (Anthropic, OpenAI, cross-provider)

**Transport** (`packages/ai/lib/transport/`):

- `websocket-transport.ts` - WebSocket-based chat transport
- `http-transport.ts` - HTTP SSE-based transport

**Components** (`packages/ai/components/`):

- Chat, Input, Agents, Tools, Parts components (see chat INSTRUCTIONS.md for full list)

### What to Add

#### A. Composio Tool Registration

Create `packages/ai/tools/composio/`:

```
packages/ai/tools/composio/
  index.ts           # Export Composio tool integration
  composio-tools.ts  # Convert Composio actions to AI SDK tools
  composio-client.ts # Composio client singleton
```

**`composio-tools.ts`:**

- `registerComposioTools(composio, connectedAccountId, appName)` - Fetches available actions from Composio and registers them in the ToolRegistry
- Each action becomes a tool with: name derived from `{app}_{action}`, Composio's parameter schema mapped to Zod, execute function calling `composio.actions.execute()`
- Auto-register tools when a connector status changes to "connected"

#### B. E2B Code Execution Tool

Create `packages/ai/tools/e2b/`:

```
packages/ai/tools/e2b/
  index.ts            # Export E2B tool
  code-execution.ts   # E2B sandbox code execution tool
  sandbox-manager.ts  # Manage sandbox lifecycle
```

**Install:** `e2b` or `@e2b/code-interpreter`

**`code-execution.ts`:**

- Tool name: `execute_code`
- Parameters: `{ language: "python" | "javascript" | "typescript", code: string }`
- Executes code in E2B sandbox, returns stdout/stderr/result
- Manages sandbox lifecycle (create, reuse, destroy)
- Security: Timeout limits, output size limits

#### C. Better Model Configuration

Enhance `packages/ai/lib/models.ts`:

```typescript
// Current: exports a single `models.chat` model
// Enhance to:
export const models = {
  chat: createModel("anthropic", "claude-sonnet-4-20250514"),
  fast: createModel("anthropic", "claude-haiku-3-20240307"),
  powerful: createModel("anthropic", "claude-opus-4-20250514"),
  code: createModel("anthropic", "claude-sonnet-4-20250514"),
  // OpenAI alternatives
  gpt4: createModel("openai", "gpt-4o"),
  gpt4mini: createModel("openai", "gpt-4o-mini"),
  // Google
  gemini: createModel("google", "gemini-2.0-flash"),
};

export function getModelById(modelId: string): LanguageModel;
export function listAvailableModels(): ModelInfo[];
export function getModelPricing(modelId: string): { inputPer1k: number; outputPer1k: number };
```

#### D. Additional Built-in Tools

Create in `packages/ai/tools/`:

- `web-search.ts` - Search the web (via Tavily, Serper, or SearXNG)
- `web-browse.ts` - Fetch and parse a webpage (via Firecrawl or Jina Reader)
- `file-operations.ts` - Read/write/list files in user's storage
- `data-analysis.ts` - Analyze data with Python (via E2B)
- `image-generation.ts` - Generate images (via DALL-E, Stable Diffusion)

---

## 4. packages/payments/ - Stripe Helpers Needed

### Current State

- `packages/payments/index.ts` (9 lines): Creates Stripe client with `apiVersion: "2025-09-30.clover"`
- `packages/payments/keys.ts` (14 lines): Env validation for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `packages/payments/ai.ts` (exists, ~398 bytes): AI-related payment helpers

### What to Add

#### `packages/payments/checkout.ts`

```typescript
export async function createSubscriptionCheckout(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<{ sessionId: string; url: string }>;

export async function createCreditPurchaseCheckout(params: {
  customerId: string;
  amount: number;
  credits: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string }>;

export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }>;
```

#### `packages/payments/webhooks.ts`

```typescript
export function constructWebhookEvent(body: string, signature: string): Stripe.Event;

export async function handleWebhookEvent(event: Stripe.Event): Promise<void>;
// Handle: checkout.session.completed, invoice.paid, invoice.payment_failed,
//         customer.subscription.updated, customer.subscription.deleted
```

#### `packages/payments/subscriptions.ts`

```typescript
export async function getOrCreateCustomer(userId: string, email: string): Promise<string>;
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
export async function cancelSubscription(
  subscriptionId: string,
  atPeriodEnd?: boolean
): Promise<void>;
export async function reactivateSubscription(subscriptionId: string): Promise<void>;
export async function updateSubscription(subscriptionId: string, priceId: string): Promise<void>;
```

#### `packages/payments/credits.ts`

```typescript
export function calculateCreditCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number;
export async function deductCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<boolean>;
export async function addCredits(userId: string, amount: number, source: string): Promise<void>;
```

### Consumer

- `apps/app/lib/trpc/routers/billing.router.ts` - Import helpers instead of raw Stripe calls
- `apps/app/app/api/webhooks/stripe/route.ts` - Create webhook handler endpoint

---

## 5. packages/search/ - Collection Schema & Service Completion

### Current State

`packages/search/src/` has a comprehensive structure:

- `client.ts` - Typesense client configured
- `env.ts` - Environment variables
- `types.ts` - Type definitions for search documents and results
- `collections/index.ts` - Collection schemas: files, sessions, tasks, projects, actions
- `services/index-service.ts` - Indexing operations (create, delete, bulk)
- `services/search-service.ts` - Search and query operations
- `services/sync-service.ts` - Sync wrappers for tRPC integration

The index.ts already exports a comprehensive API:

- `initializeCollections`, `recreateCollection`
- `indexFile`, `deleteFileFromIndex`, `bulkIndexFiles`
- `indexSession`, `indexTask`, `indexProject`, `indexAction` (and bulk/delete variants)
- `search`, `searchCollection`, `quickSearch`
- `syncFileToSearch`, `syncSessionToSearch`, `syncTaskToSearch`, etc.
- `syncAllFilesToSearch`, `syncAllSessionsToSearch`, etc.

### What to Complete

The search package looks fairly complete in structure. What may be needed:

#### A. Collection Schema Definitions Verification

Review `packages/search/src/collections/index.ts` to ensure schemas match current database schema fields. Add any missing fields.

#### B. Full-Text Search Configuration

Ensure search service supports:

- Faceted search (filter by type, date range, status)
- Fuzzy matching
- Search highlighting
- Pagination
- Sort by relevance or date

#### C. Sync Job

Create a recurring sync job that re-indexes all data:

- Triggered via Inngest or cron
- Handles new records, updated records, deleted records
- Conflict resolution

#### D. Search API Route

Create `apps/app/app/api/search/route.ts` for client-side search requests, or use the existing `apps/app/lib/trpc/routers/search.router.ts` (178 lines).

---

## 6. packages/notifications/ - Knock Workflow Triggers

### Current State

- `packages/notifications/index.ts` (6 lines): Creates Knock client
- `packages/notifications/keys.ts`: Env validation for `KNOCK_SECRET_API_KEY`
- `packages/notifications/components/`: Has notification UI components
- `services/notification/src/index.ts`: Notification microservice

### What to Add

#### `packages/notifications/workflows.ts`

```typescript
// Workflow trigger helpers
export async function notifyTaskCompleted(
  userId: string,
  task: { name: string; status: string }
): Promise<void>;
export async function notifyAgentFinished(
  userId: string,
  session: { id: string; title: string; summary: string }
): Promise<void>;
export async function notifyCreditsLow(
  userId: string,
  balance: number,
  threshold: number
): Promise<void>;
export async function notifyConnectorError(
  userId: string,
  connector: { name: string; error: string }
): Promise<void>;
export async function notifyFileReady(
  userId: string,
  file: { name: string; url: string }
): Promise<void>;
export async function notifyScheduleTriggered(
  userId: string,
  task: { name: string; executionId: string }
): Promise<void>;
```

Each function calls `notifications.workflows.trigger(workflowKey, { recipients, data })`.

#### `packages/notifications/templates.ts`

```typescript
// Template management helpers
export const WORKFLOW_KEYS = {
  TASK_COMPLETED: "task-completed",
  AGENT_FINISHED: "agent-finished",
  CREDITS_LOW: "credits-low",
  CONNECTOR_ERROR: "connector-error",
  FILE_READY: "file-ready",
  SCHEDULE_TRIGGERED: "schedule-triggered",
} as const;
```

### Consumer

- `services/task/src/routes/tasks.ts` - Notify on task completion
- `apps/app/lib/trpc/routers/billing.router.ts` - Notify on low credits
- `apps/app/lib/trpc/routers/connectors.router.ts` - Notify on sync errors
- `apps/app/lib/trpc/routers/notifications.router.ts` (208 lines) - Already exists

---

## 7. packages/webhooks/ - Svix Event Types & Delivery

### Current State

- `packages/webhooks/index.ts` (6 lines): Exports `send` and `getAppPortal`
- `packages/webhooks/lib/svix.ts` (53 lines):
  - `send(eventType, payload)` - Sends webhook via Svix with auto-application creation
  - `getAppPortal()` - Gets Svix app portal access for user
- `packages/webhooks/keys.ts`: Env validation for `SVIX_TOKEN`

### What to Add

#### `packages/webhooks/event-types.ts`

```typescript
// Define all webhook event types
export const EVENT_TYPES = {
  // Session events
  "session.created": { description: "A new chat session was created" },
  "session.completed": { description: "A chat session completed" },

  // Task events
  "task.created": { description: "A scheduled task was created" },
  "task.started": { description: "A task execution started" },
  "task.completed": { description: "A task execution completed" },
  "task.failed": { description: "A task execution failed" },

  // File events
  "file.created": { description: "A new file was created" },
  "file.deleted": { description: "A file was deleted" },

  // Connector events
  "connector.connected": { description: "An app connector was connected" },
  "connector.disconnected": { description: "An app connector was disconnected" },
  "connector.sync.completed": { description: "A connector sync completed" },
  "connector.sync.failed": { description: "A connector sync failed" },

  // Billing events
  "billing.subscription.created": { description: "A subscription was created" },
  "billing.subscription.cancelled": { description: "A subscription was cancelled" },
  "billing.credits.purchased": { description: "Credits were purchased" },
  "billing.credits.low": { description: "Credit balance is low" },
} as const;

export type EventType = keyof typeof EVENT_TYPES;

export function registerEventTypes(): Promise<void>;
// Registers all event types with Svix
```

#### `packages/webhooks/delivery.ts`

```typescript
export async function getDeliveryHistory(userId: string, limit?: number): Promise<DeliveryLog[]>;
export async function retryDelivery(userId: string, messageId: string): Promise<void>;
export async function getDeliveryAttempts(
  userId: string,
  messageId: string
): Promise<DeliveryAttempt[]>;
```

#### Enhanced `packages/webhooks/index.ts`

```typescript
export { send, getAppPortal } from "./lib/svix";
export { EVENT_TYPES, type EventType, registerEventTypes } from "./event-types";
export { getDeliveryHistory, retryDelivery, getDeliveryAttempts } from "./delivery";
```

### Consumer

- `apps/app/lib/trpc/routers/webhooks.router.ts` (7323 bytes) - Already exists, wire to enhanced package
- `apps/app/app/(authenticated)/components/settings/tabs/integrations-tab.tsx` - Display event types, delivery logs, app portal

---

## Key File Paths Summary

| Package       | Path                      | Status                                      |
| ------------- | ------------------------- | ------------------------------------------- |
| storage       | `packages/storage/`       | Needs full S3 refactor                      |
| editor        | `packages/editor/`        | EMPTY - needs full implementation           |
| ai            | `packages/ai/`            | Working - needs Composio, E2B, more tools   |
| payments      | `packages/payments/`      | Basic Stripe client - needs helpers         |
| search        | `packages/search/`        | Mostly complete - verify and enhance        |
| notifications | `packages/notifications/` | Knock client only - needs workflow triggers |
| webhooks      | `packages/webhooks/`      | Basic Svix - needs event types, delivery    |

## Priority Order

1. **packages/storage/** - S3 refactor (blocks file uploads across entire app)
2. **packages/payments/** - Stripe helpers (blocks billing completion)
3. **packages/ai/** - Composio tools and model config (enables app integrations)
4. **packages/editor/** - IDE components (blocks website builder feature)
5. **packages/notifications/** - Workflow triggers (enables user notifications)
6. **packages/webhooks/** - Event types (enables developer integrations)
7. **packages/search/** - Verification and enhancement (already mostly working)
