# Definitive Guide: Database to State Mapping

## Introduction

This document provides the comprehensive, end-to-end mapping from your PostgreSQL database schema to your application's frontend state, managed by Redux and the Vercel AI SDK. It covers the exact table structures, their relationships, the API queries that interact with them, and how their data populates specific Redux slices and the `useChat` hook.

Your application's data persistence is based on the official Vercel Chat SDK pattern, which uses Drizzle ORM to interact with a PostgreSQL database. The core principle is that the database is the single source of truth for all user and session data, which is then fetched and hydrated into the frontend state upon user login and navigation.

## Core Architecture & Data Flow

The data flows in a clear, unidirectional path from the database to the UI. There are two primary flows:

1.  **Initial Load**: When a user loads a chat session, the server fetches all relevant data (chats, messages, user info) from the database and sends it to the client to populate the initial state of both Redux and the `useChat` hook.
2.  **Real-time Updates**: When a user sends a new message, the AI SDK's `onFinish` callback triggers a server-side function to write the new message back to the database, ensuring persistence.

```mermaid
graph TD
    subgraph Database (PostgreSQL)
        T1[User Table]
        T2[Chat Table]
        T3[Message Table]
        T4[Vote Table]
        T5[Document Table]
    end

    subgraph API Layer (Next.js Route Handlers)
        A1[/api/auth]
        A2[/api/chat]
        A3[/api/history]
        A4[/api/vote]
    end

    subgraph Frontend State
        S1["Redux Store (all-state.json)"]
        S2["AI SDK: useChat Hook"]
    end

    subgraph UI (React Components)
        C1[Chat List]
        C2[Message Stream]
        C3[User Profile]
    end

    T1 -- "getUser()" --> A1
    T2 -- "getChatsByUserId()" --> A3
    T3 -- "getMessagesByChatId()" --> A2
    T4 -- "getVotesByChatId()" --> A4

    A1 -- "Login" --> S1
    A3 -- "Load Session List" --> S1
    A2 -- "Load Initial Messages" --> S2

    A2 -- "onFinish()" --> T3
    A4 -- "voteMessage()" --> T4

    S1 -- "useSelector(state.sessions)" --> C1
    S1 -- "useSelector(state.auth)" --> C3
    S2 -- "messages" --> C2
```

## Database Schema Deep Dive

Based on the Vercel Chat SDK, your database should be structured with the following core tables. I have also included the necessary extensions to support all the features found in your `all-state.json` file.


### 1. `User` Table

This table is the central authority for user identity.

**Schema (Drizzle):**
```typescript
export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
  // Extended for Rubic features
  name: varchar("name"),
  avatarUrl: varchar("avatarUrl"),
  subscriptionTier: varchar("subscriptionTier").default("free"),
  creditBalance: integer("creditBalance").default(0),
});
```

**State Mapping:**

| Database Field | API Query | Redux Slice & Field | UI Feature |
| :--- | :--- | :--- | :--- |
| `id`, `email`, `name`, `avatarUrl` | `getUser(email)` | `auth.userInfo` | User profile display, authentication checks. |
| `subscriptionTier`, `creditBalance` | `getUser(email)` | `auth.usageInfo` | Credit counter, feature gating (Pro vs. Free). |

---

### 2. `Chat` Table

This table stores the metadata for each conversation or session.

**Schema (Drizzle):**
```typescript
export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId").notNull().references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] }).notNull().default("private"),
  // Extended for Rubic features
  projectId: uuid("projectId").references(() => project.id),
});
```

**State Mapping:**

| Database Field | API Query | Redux Slice & Field | UI Feature |
| :--- | :--- | :--- | :--- |
| `id`, `title`, `createdAt` | `getChatsByUserId()` | `sessions.entities` | The list of all chat sessions in the left-hand sidebar. |
| `id` | (URL parameter) | `sessions.currentSessionId` | Determines which chat is currently active and being displayed. |
| `projectId` | `getChatsByUserId()` | `project.projectList` (indirectly) | Used to filter the session list when a specific project is selected. |


### 3. `Message` Table

This is the most critical table, storing the content of every message in a chat. It uses a JSONB column to store the structured `parts` array from the AI SDK.

**Schema (Drizzle):**
```typescript
export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId").notNull().references(() => chat.id),
  role: varchar("role").notNull(), // 'user', 'assistant', 'system', etc.
  parts: json("parts").notNull(), // Stores the UIMessage.parts array
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});
```

**State Mapping:**

| Database Field | API Query | State Hook & Field | UI Feature |
| :--- | :--- | :--- | :--- |
| `id`, `role`, `parts`, `createdAt` | `getMessagesByChatId()` | `useChat().messages` | This is the primary data source for the entire chat message stream. The `MessagePartsRenderer` iterates over the `parts` array to render each piece of content (text, code, tools, etc.). |
| `attachments` | `getMessagesByChatId()` | `useChat().messages` | Populates the attachment previews at the bottom of each message. |

**Data Flow:**
1.  **Load**: `getMessagesByChatId()` is called on page load, and the result is passed to `useChat({ initialMessages: ... })`.
2.  **Save**: After a new AI response is streamed, the `onFinish` callback in your API route calls `saveMessages()` to insert the new message row into this table.

---

### 4. `Vote` Table

Stores user feedback (upvotes/downvotes) on assistant messages.

**Schema (Drizzle):**
```typescript
export const vote = pgTable("Vote_v2", {
  chatId: uuid("chatId").notNull().references(() => chat.id),
  messageId: uuid("messageId").notNull().references(() => message.id),
  isUpvoted: boolean("isUpvoted").notNull(),
}, (table) => ({ pk: primaryKey({ columns: [table.chatId, table.messageId] }) }));
```

**State Mapping:**

| Database Field | API Query | Redux Slice & Field | UI Feature |
| :--- | :--- | :--- | :--- |
| `messageId`, `isUpvoted` | `getVotesByChatId()` | `chat.votes` | Determines the highlighted state of the thumbs-up/thumbs-down buttons on each assistant message. |


## Extended Tables for Rubic Features

To fully support all features in your `all-state.json`, the following additional tables are required. They follow the same pattern: a database table as the source of truth, API endpoints for CRUD operations, and a Redux slice to hold the data on the frontend.

### 6. `Project` Table

**Schema:**
```typescript
export const project = pgTable("Project", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: varchar("name").notNull(),
  userId: uuid("userId").notNull().references(() => user.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
```
**State Mapping:**
- **DB Fields:** `id`, `name`
- **API Query:** `getProjectsByUserId()`
- **Redux Slice:** `project.projectList`
- **UI Feature:** The list of projects in the main navigation and project management pages.

### 7. `ScheduledTask` Table

**Schema:**
```typescript
export const scheduledTask = pgTable("ScheduledTask", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: varchar("name").notNull(),
  prompt: text("prompt").notNull(),
  cron: varchar("cron").notNull(),
  userId: uuid("userId").notNull().references(() => user.id),
  isActive: boolean("isActive").default(true),
});
```
**State Mapping:**
- **DB Fields:** `id`, `name`, `prompt`, `cron`, `isActive`
- **API Query:** `getScheduledTasksByUserId()`
- **Redux Slice:** `scheduledTask.allScheduleList`
- **UI Feature:** The list of all recurring tasks in the "Scheduled Tasks" settings page.

### 8. `Skill` Table

**Schema:**
```typescript
export const skill = pgTable("Skill", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  content: text("content").notNull(), // The skill's prompt or code
  userId: uuid("userId").notNull().references(() => user.id),
});
```
**State Mapping:**
- **DB Fields:** `id`, `name`, `description`
- **API Query:** `getSkillsByUserId()`
- **Redux Slice:** `skills.userAddedSkills`
- **UI Feature:** The list of custom skills in the "Skills" settings page.

### 9. `Connector` & `UserConnector` Tables

**Schema:**
```typescript
// Master list of all available connectors
export const connector = pgTable("Connector", {
  id: varchar("id").primaryKey(), // e.g., 'gmail', 'github'
  name: varchar("name").notNull(),
  description: text("description"),
  logoUrl: varchar("logoUrl"),
});

// Junction table for user's enabled connectors
export const userConnector = pgTable("UserConnector", {
  userId: uuid("userId").notNull().references(() => user.id),
  connectorId: varchar("connectorId").notNull().references(() => connector.id),
  isEnabled: boolean("isEnabled").default(true),
  // Store encrypted OAuth tokens here
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
}, (table) => ({ pk: primaryKey({ columns: [table.userId, table.connectorId] }) }));
```
**State Mapping:**
- **DB Fields:** `connector.*`, `userConnector.isEnabled`
- **API Query:** `getConnectors()` (joins `connector` and `userConnector`)
- **Redux Slice:** `connectors.connectors`
- **UI Feature:** The grid of all available tool integrations on the "Connectors" page, showing which are enabled.

### 10. `KnowledgeBase` & `KnowledgeSource` Tables

**Schema:**
```typescript
export const knowledgeBase = pgTable("KnowledgeBase", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: varchar("name").notNull(),
  userId: uuid("userId").notNull().references(() => user.id),
});

export const knowledgeSource = pgTable("KnowledgeSource", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  knowledgeBaseId: uuid("knowledgeBaseId").notNull().references(() => knowledgeBase.id),
  type: varchar("type", { enum: ["file", "url"] }).notNull(),
  source: varchar("source").notNull(), // File path or URL
  status: varchar("status").default("pending"),
});
```
**State Mapping:**
- **DB Fields:** `knowledgeBase.*`, `knowledgeSource.*`
- **API Query:** `getKnowledgeBasesByUserId()`
- **Redux Slice:** `knowledge.userKnowledgeList`
- **UI Feature:** The list of knowledge bases and their associated sources in the "Knowledge" settings page.


### 11. `Stream` Table

This table supports the **resumable streams** feature. When a client disconnects mid-stream (e.g., closes the browser tab), the stream ID is stored so the client can reconnect and resume where it left off.

**Schema (Drizzle):**
```typescript
export const stream = pgTable("Stream", {
  id: uuid("id").notNull().defaultRandom(),
  chatId: uuid("chatId").notNull().references(() => chat.id),
  createdAt: timestamp("createdAt").notNull(),
}, (table) => ({ pk: primaryKey({ columns: [table.id] }) }));
```

**State Mapping:**

| Database Field | API Query | State Hook & Field | UI Feature |
| :--- | :--- | :--- | :--- |
| `id`, `chatId` | `getStreamIdsByChatId()` | `useChat` (internal) | Not directly visible. Used internally by the AI SDK to resume an interrupted stream on page reload. |

### 12. `Suggestion` Table

This table stores AI-generated suggestions for improving documents (artifacts).

**Schema (Drizzle):**
```typescript
export const suggestion = pgTable("Suggestion", {
  id: uuid("id").notNull().defaultRandom(),
  documentId: uuid("documentId").notNull(),
  documentCreatedAt: timestamp("documentCreatedAt").notNull(),
  originalText: text("originalText").notNull(),
  suggestedText: text("suggestedText").notNull(),
  description: text("description"),
  isResolved: boolean("isResolved").notNull().default(false),
  userId: uuid("userId").notNull().references(() => user.id),
  createdAt: timestamp("createdAt").notNull(),
});
```

**State Mapping:**

| Database Field | API Query | Redux Slice & Field | UI Feature |
| :--- | :--- | :--- | :--- |
| `originalText`, `suggestedText`, `isResolved` | `getSuggestionsByDocumentId()` | `codeViewer` (inline decorations) | Inline diff suggestions displayed in the Monaco editor, allowing the user to accept or reject AI-proposed changes. |

---

## Complete API Operations Reference

The following table maps every database operation to its trigger, the table it affects, and the state it updates.

| API Operation | Trigger | DB Table | State Updated | Direction |
| :--- | :--- | :--- | :--- | :--- |
| `getUser(email)` | Login / Auth check | `User` | `auth.userInfo`, `auth.usageInfo` | DB → State |
| `createUser(email, password)` | Signup | `User` | `auth.userInfo` | State → DB |
| `getChatsByUserId()` | App load / Sidebar render | `Chat` | `sessions.entities`, `sessions.ids` | DB → State |
| `saveChat()` | First message in new chat | `Chat` | `sessions.entities` (append) | State → DB |
| `deleteChatById()` | User deletes a chat | `Chat`, `Message`, `Vote`, `Stream` | `sessions.entities` (remove) | State → DB |
| `updateChatTitleById()` | Auto-title after first response | `Chat` | `sessions.entities[id].title` | State → DB |
| `updateChatVisibilityById()` | User toggles public/private | `Chat` | `sessions.entities[id].visibility` | State → DB |
| `getMessagesByChatId()` | Page load for a chat | `Message` | `useChat().messages` (initialMessages) | DB → State |
| `saveMessages()` | `onFinish` callback in `/api/chat` | `Message` | None (already in `useChat` from stream) | State → DB |
| `updateMessage()` | User edits a message | `Message` | `useChat().messages` (updated part) | State → DB |
| `deleteMessagesByChatIdAfterTimestamp()` | User edits a message (deletes subsequent) | `Message`, `Vote` | `useChat().messages` (truncated) | State → DB |
| `getVotesByChatId()` | Page load for a chat | `Vote` | `chat.votes` | DB → State |
| `voteMessage()` | User clicks thumbs up/down | `Vote` | `chat.votes` (upsert) | State → DB |
| `saveDocument()` | Agent creates an artifact | `Document` | `fileManagement.sessionFileList` | State → DB |
| `getDocumentsById()` | User opens file manager | `Document` | `fileManagement.sessionFileList` | DB → State |
| `getDocumentById()` | User opens a file in IDE | `Document` | `codeViewer.fileDataSource` | DB → State |
| `createStreamId()` | Start of each AI response | `Stream` | None (internal) | State → DB |
| `getStreamIdsByChatId()` | Page reload during active stream | `Stream` | `useChat` (internal resume) | DB → State |
| `getProjectsByUserId()` | App load | `Project` | `project.projectList` | DB → State |
| `getScheduledTasksByUserId()` | Settings page load | `ScheduledTask` | `scheduledTask.allScheduleList` | DB → State |
| `getSkillsByUserId()` | Settings page load | `Skill` | `skills.userAddedSkills` | DB → State |
| `getConnectors()` | Settings page load | `Connector`, `UserConnector` | `connectors.connectors` | DB → State |
| `getKnowledgeBasesByUserId()` | Settings page load | `KnowledgeBase` | `knowledge.userKnowledgeList` | DB → State |

---

## Master Wiring Diagram: Database → State → UI

This table provides the definitive, single-glance reference for the entire data architecture.

| Database Table | Redux Slice | Key State Fields | Primary UI Component(s) |
| :--- | :--- | :--- | :--- |
| `User` | `auth` | `userInfo`, `usageInfo`, `clientConfig` | User profile, credit counter, settings |
| `Chat` | `sessions` | `entities`, `ids`, `currentSessionId` | Session sidebar list, active chat indicator |
| `Message` | `useChat()` | `messages` (array of `UIMessage`) | `MessagePartsRenderer`, `AssistantMessage`, `UserMessage` |
| `Vote` | `chat` | `votes` | Thumbs up/down buttons on messages |
| `Document` | `fileManagement`, `codeViewer` | `sessionFileList`, `fileDataSource` | File manager panel, IDE code editor |
| `Suggestion` | `codeViewer` | (inline decorations) | Monaco editor inline diff suggestions |
| `Stream` | `useChat()` (internal) | (internal) | Resumable stream on page reload |
| `Project` | `project` | `projectList`, `currentProjectId` | Project navigation, session filtering |
| `ScheduledTask` | `scheduledTask` | `allScheduleList` | Scheduled tasks settings page |
| `Skill` | `skills` | `userAddedSkills` | Skills settings page |
| `Connector` + `UserConnector` | `connectors` | `connectors` | Connectors settings page |
| `KnowledgeBase` + `KnowledgeSource` | `knowledge` | `userKnowledgeList` | Knowledge settings page |

---

## The `Message.parts` Column: The Heart of Everything

The most important thing to understand is that the `Message` table's `parts` column is a JSONB blob that stores the entire `UIMessage.parts[]` array from the AI SDK. This single column is the source of truth for **everything** that renders in the chat stream.

When a message is loaded from the database, its `parts` array might look like this:

```json
[
  { "type": "reasoning", "text": "The user wants to search for AI news..." },
  { "type": "tool-invocation", "toolName": "show_plan", "state": "output-available", "args": { "goal": "Research AI news", "phases": [...] }, "output": { "success": true } },
  { "type": "tool-invocation", "toolName": "web_search", "state": "output-available", "args": { "query": "latest AI news 2026" }, "output": { "results": [...] } },
  { "type": "source-url", "sourceId": "src_1", "url": "https://example.com", "title": "AI News" },
  { "type": "text", "text": "Here are the latest AI developments..." },
  { "type": "tool-invocation", "toolName": "shell_execute", "state": "output-available", "args": { "command": "ls -la" }, "output": { "stdout": "..." } }
]
```

Your `MessagePartsRenderer` component iterates over this array and renders each part using the appropriate Elements AI component. The `useCanvas` hook also scans this array (backwards, from the latest message) to determine which canvas view to display.

This means:
1.  **The database stores the full rendering instructions** for every message.
2.  **No separate "tool results" table is needed** — tool inputs, outputs, and states are all embedded in the `parts` JSONB.
3.  **The `useChat` hook is the bridge** — it loads `parts` from the DB on page load and appends new parts in real-time during streaming.

---

## References

[1]: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence "AI SDK: Chatbot Message Persistence"
[2]: https://chat-sdk.dev/docs/architecture "Chat SDK: Architecture"
[3]: https://github.com/vercel/ai-chatbot/blob/main/lib/db/schema.ts "Vercel Chat SDK: Database Schema"
[4]: https://github.com/vercel/ai-chatbot/blob/main/lib/db/queries.ts "Vercel Chat SDK: Database Queries"
[5]: https://github.com/vercel-labs/ai-sdk-persistence-db "AI SDK Persistence DB Example"
