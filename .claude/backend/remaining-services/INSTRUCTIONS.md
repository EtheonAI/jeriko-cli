# Remaining Services Instructions

This file covers the 6 remaining backend services that are all pure stubs. Each section provides the current state, database tables, and what needs to be built.

---

## 1. Knowledge Service

**Location:** `services/knowledge/src/index.ts` (156 lines)
**Port:** 4011
**Purpose:** Document upload, text extraction, chunking, embedding generation, and vector similarity search (RAG).

### Current Endpoints (All Stubs)

| Method                        | Path                                | Returns |
| ----------------------------- | ----------------------------------- | ------- |
| `GET /users/:userId/groups`   | `{ groups: [] }`                    |
| `POST /groups`                | Random group ID                     |
| `GET /groups/:id`             | `{ status: "not_found" }`           |
| `DELETE /groups/:id`          | `{ deleted: true }`                 |
| `POST /groups/:groupId/items` | Random item ID, status "processing" |
| `GET /items/:id`              | `{ status: "not_found" }`           |
| `DELETE /items/:id`           | `{ deleted: true }`                 |
| `POST /query`                 | `{ results: [], query }`            |
| `GET /items/:id/chunks`       | `{ chunks: [] }`                    |
| `POST /items/:id/reprocess`   | `{ status: "reprocessing" }`        |

### Database Tables (from `packages/database/src/schema/knowledge.ts`)

**`knowledge_groups`** - Folders/collections for organizing knowledge items.

- `userId`, `organizationId`, `parentId` (nested groups)
- `name`, `description`, `icon`, `color`
- `isShared`, `shareSettings` (JSONB: visibility, allowedUserIds, allowedRoles)

**`knowledge_items`** - Individual documents, files, webpages, notes, bookmarks.

- `userId`, `organizationId`, `groupId`
- `type` - "document" | "webpage" | "file" | "note" | "bookmark"
- `name`, `description`, `content` (full text), `contentPreview`
- `sourceUrl`, `sourceType`, `sourceId`
- `mimeType`, `fileSize`, `storageKey`, `thumbnailUrl`
- `status` - "processing" | "ready" | "failed" | "archived"
- `embeddingId`, `embeddingModel`
- `tags` (JSONB), `metadata` (JSONB: author, pageCount, wordCount, language)

**`knowledge_chunks`** - Text chunks for RAG.

- `itemId` (FK to knowledge_items, CASCADE)
- `content` - Chunk text
- `chunkIndex` - Position in document
- `startOffset`, `endOffset`, `pageNumber`
- `embeddingId` - Reference to vector store
- `metadata` (JSONB: heading, section)

**`session_attachments`** - Files attached to chat sessions.

- `sessionId`, `userId`, `knowledgeItemId` (optional link to existing item)
- `name`, `mimeType`, `fileSize`, `storageKey`
- `status` - "uploading" | "processing" | "ready" | "failed"

### What to Build

**Step 1: Document Processing Pipeline**

When a knowledge item is created (`POST /groups/:groupId/items`):

```typescript
// 1. Save item to DB with status "processing"
const [item] = await db
  .insert(knowledgeItems)
  .values({
    userId,
    groupId,
    type,
    name: title,
    content: content || null,
    sourceUrl,
    status: "processing",
  })
  .returning();

// 2. If type is "url", fetch the URL content
if (type === "url" && sourceUrl) {
  const response = await fetch(sourceUrl);
  const html = await response.text();
  // Use turndown or similar to convert HTML to markdown
  content = convertHtmlToMarkdown(html);
}

// 3. If type is "file", extract text from the uploaded file
if (type === "file" && fileId) {
  // Call file service to download
  // Use pdf-parse (PDF), mammoth (DOCX), etc. for text extraction
  content = await extractText(fileId, mimeType);
}

// 4. Update item with extracted content
await db
  .update(knowledgeItems)
  .set({ content, contentPreview: content.slice(0, 500) })
  .where(eq(knowledgeItems.id, item.id));

// 5. Chunk the content
const chunks = chunkText(content, { maxChunkSize: 1000, overlap: 200 });

// 6. Generate embeddings for each chunk
const embeddings = await generateEmbeddings(chunks.map((c) => c.text));

// 7. Save chunks and embeddings
for (let i = 0; i < chunks.length; i++) {
  await db.insert(knowledgeChunks).values({
    itemId: item.id,
    content: chunks[i].text,
    chunkIndex: i,
    startOffset: chunks[i].startOffset,
    endOffset: chunks[i].endOffset,
    embeddingId: embeddings[i].id, // Store in vector DB (pgvector or Pinecone)
  });
}

// 8. Update item status to "ready"
await db
  .update(knowledgeItems)
  .set({
    status: "ready",
    embeddingModel: "text-embedding-3-small",
  })
  .where(eq(knowledgeItems.id, item.id));
```

**Step 2: Embedding Generation**

```typescript
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbeddings(texts: string[]): Promise<{ id: string; vector: number[] }[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });

  return response.data.map((item, i) => ({
    id: createId(),
    vector: item.embedding,
  }));
}
```

**Step 3: Vector Similarity Search (`POST /query`)**

```typescript
app.post("/query", async (request, reply) => {
  const { query, groupIds, userId, limit = 5 } = request.body;

  // 1. Generate embedding for the query
  const [queryEmbedding] = await generateEmbeddings([query]);

  // 2. Search vector store for similar chunks
  // If using pgvector:
  //   SELECT * FROM knowledge_chunks
  //   ORDER BY embedding <=> $queryVector
  //   LIMIT $limit;
  //
  // If using Pinecone/Weaviate:
  //   const results = await vectorClient.query({ vector: queryEmbedding.vector, topK: limit });

  // 3. Load full chunk content and parent item info
  // 4. Return ranked results with scores

  return {
    query,
    results: results.map((r) => ({
      chunkId: r.id,
      content: r.content,
      itemId: r.itemId,
      itemName: r.itemName,
      score: r.score,
    })),
  };
});
```

**Step 4: RAG Context Injection**

The agent service should call `POST /query` before making LLM calls to inject relevant knowledge context into the system prompt or user message.

### Environment Variables

| Variable         | Default               | Description                              |
| ---------------- | --------------------- | ---------------------------------------- |
| `PORT`           | `4011`                | Knowledge service port                   |
| `OPENAI_API_KEY` | None                  | For text-embedding-3-small               |
| `VECTOR_DB_URL`  | None                  | pgvector connection or Pinecone endpoint |
| `DATABASE_URL`   | (from @repo/database) | PostgreSQL connection                    |

---

## 2. Notification Service

**Location:** `services/notification/src/index.ts` (117 lines)
**Port:** 4006
**Purpose:** Send notifications via push, email, and in-app. Manage notification preferences.

### Current Endpoints (All Stubs)

| Method                             | Path                    | Returns |
| ---------------------------------- | ----------------------- | ------- |
| `POST /send`                       | Random notification ID  |
| `GET /users/:userId/notifications` | `{ notifications: [] }` |
| `PATCH /notifications/:id/read`    | `{ read: true }`        |
| `POST /push/subscribe`             | `{ subscribed: true }`  |
| `GET /users/:userId/preferences`   | `{ preferences: {} }`   |
| `PUT /users/:userId/preferences`   | `{ updated: true }`     |

### Database Tables (from `packages/database/src/schema/notifications.ts`)

**`notifications`** - Individual notification records.

- `userId`, `organizationId`
- `type` - "system" | "session" | "agent" | "team" | "billing" | "connector" | "task" | "mention" | "share" | "comment"
- `priority` - "low" | "normal" | "high" | "urgent"
- `title`, `message`
- `actionUrl`, `actionLabel`
- `entityType`, `entityId` - Reference to related entity
- `isRead`, `readAt`, `isDismissed`, `dismissedAt`
- `metadata` (JSONB: icon, avatar, senderName, senderId)
- `expiresAt`

**`notification_preferences`** - Per-user settings.

- `userId` (unique)
- `emailEnabled`, `emailDigest` ("instant" | "hourly" | "daily" | "weekly" | "never")
- `pushEnabled`, `inAppEnabled`, `inAppSound`
- `typeSettings` (JSONB) - Per-type overrides: `{ "billing": { email: true, push: false, inApp: true }, ... }`
- `quietHoursEnabled`, `quietHoursStart`, `quietHoursEnd`, `quietHoursTimezone`

**`push_subscriptions`** - Web push subscription data.

- `userId`, `endpoint`, `p256dh`, `auth`, `userAgent`, `lastUsedAt`

### What to Build

**Integration with `@repo/notifications` (Knock):**

The `packages/notifications/` package wraps Knock. If Knock is configured:

```typescript
import { Knock } from "@knocklabs/node";
const knock = new Knock(process.env.KNOCK_SECRET_API_KEY!);
```

**POST /send - Create and Deliver Notification:**

```typescript
app.post("/send", async (request, reply) => {
  const { userId, type, title, message, data, priority, actionUrl } = request.body;

  // 1. Check user preferences
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  // Check quiet hours
  if (prefs?.quietHoursEnabled && isQuietHours(prefs)) {
    // Queue for later delivery or skip non-urgent
    if (priority !== "urgent") {
      // Queue notification for after quiet hours
    }
  }

  // 2. Save to database
  const [notification] = await db
    .insert(notifications)
    .values({
      userId,
      type,
      title,
      message,
      priority: priority || "normal",
      actionUrl,
      metadata: data,
    })
    .returning();

  // 3. Deliver via configured channels
  const channels = getActiveChannels(prefs, type);

  if (channels.inApp) {
    // Publish to WebSocket for real-time in-app notification
    await publish(`user:${userId}`, {
      type: "notification",
      data: notification,
    });
  }

  if (channels.push) {
    // Send web push notification
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    for (const sub of subscriptions) {
      await sendWebPush(sub, { title, body: message, data: { url: actionUrl } });
    }
  }

  if (channels.email && prefs?.emailDigest === "instant") {
    // Send email immediately (or use Knock workflow)
    await knock.workflows.trigger("notification", {
      recipients: [userId],
      data: { title, message, actionUrl, type },
    });
  }

  return { id: notification.id, status: "sent", channels };
});
```

**GET /users/:userId/notifications - List with Pagination:**

```typescript
app.get("/users/:userId/notifications", async (request, reply) => {
  const { userId } = request.params;
  const { limit = 50, cursor, unreadOnly } = request.query;

  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly === "true") conditions.push(eq(notifications.isRead, false));
  if (cursor) conditions.push(lte(notifications.createdAt, new Date(cursor)));

  const items = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(parseInt(limit as string));

  const unreadCount = await db
    .select({ count: sql`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return {
    notifications: items,
    unreadCount: unreadCount[0]?.count || 0,
    cursor: items.length ? items[items.length - 1].createdAt.toISOString() : null,
  };
});
```

### Environment Variables

| Variable               | Default               | Description                |
| ---------------------- | --------------------- | -------------------------- |
| `PORT`                 | `4006`                | Notification service port  |
| `KNOCK_SECRET_API_KEY` | None                  | Knock API key              |
| `VAPID_PUBLIC_KEY`     | None                  | Web push VAPID public key  |
| `VAPID_PRIVATE_KEY`    | None                  | Web push VAPID private key |
| `DATABASE_URL`         | (from @repo/database) | PostgreSQL connection      |

---

## 3. Search Service

**Location:** `services/search/src/index.ts` (186 lines)
**Port:** 4013
**Purpose:** Full-text search across sessions, messages, files, projects, and knowledge items. Uses Typesense.

### Current Endpoints (All Stubs)

| Method                             | Path                        | Returns |
| ---------------------------------- | --------------------------- | ------- |
| `POST /search`                     | `{ results: [], total: 0 }` |
| `POST /search/projects`            | `{ results: [], total: 0 }` |
| `POST /search/sessions`            | `{ results: [], total: 0 }` |
| `POST /search/messages`            | `{ results: [], total: 0 }` |
| `POST /search/files`               | `{ results: [], total: 0 }` |
| `POST /search/semantic`            | `{ results: [], total: 0 }` |
| `GET /suggest`                     | `{ suggestions: [] }`       |
| `POST /internal/index`             | `{ indexed: true }`         |
| `DELETE /internal/index/:type/:id` | `{ removed: true }`         |

### What to Build

**Integration with `@repo/search` (Typesense):**

```typescript
import Typesense from "typesense";

const typesense = new Typesense.Client({
  nodes: [{ host: process.env.TYPESENSE_HOST!, port: 443, protocol: "https" }],
  apiKey: process.env.TYPESENSE_API_KEY!,
});
```

**Step 1: Define Collections**

Create these Typesense collections on service startup:

```typescript
const collections = [
  {
    name: "sessions",
    fields: [
      { name: "title", type: "string" },
      { name: "userId", type: "string", facet: true },
      { name: "status", type: "string", facet: true },
      { name: "createdAt", type: "int64" },
    ],
  },
  {
    name: "messages",
    fields: [
      { name: "content", type: "string" },
      { name: "sessionId", type: "string", facet: true },
      { name: "userId", type: "string", facet: true },
      { name: "role", type: "string", facet: true },
      { name: "createdAt", type: "int64" },
    ],
  },
  {
    name: "files",
    fields: [
      { name: "name", type: "string" },
      { name: "mimeType", type: "string", facet: true },
      { name: "userId", type: "string", facet: true },
      { name: "sessionId", type: "string", optional: true },
      { name: "createdAt", type: "int64" },
    ],
  },
  {
    name: "projects",
    fields: [
      { name: "name", type: "string" },
      { name: "description", type: "string", optional: true },
      { name: "userId", type: "string", facet: true },
      { name: "status", type: "string", facet: true },
      { name: "createdAt", type: "int64" },
    ],
  },
];
```

**Step 2: Indexing on Create/Update**

Other services call `POST /internal/index` when entities are created or updated:

```typescript
app.post("/internal/index", async (request, reply) => {
  const { type, id, data } = request.body;

  await typesense
    .collections(type)
    .documents()
    .upsert({
      id,
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
    });

  return { indexed: true };
});
```

**Step 3: Universal Search**

```typescript
app.post("/search", async (request, reply) => {
  const { query, types, userId, limit = 20, offset = 0 } = request.body;
  const searchTypes = types || ["projects", "sessions", "files", "messages"];

  const results = await Promise.all(
    searchTypes.map((type) =>
      typesense
        .collections(type)
        .documents()
        .search({
          q: query,
          query_by: type === "messages" ? "content" : "name,description",
          filter_by: `userId:=${userId}`,
          limit,
          offset,
        })
        .then((r) => ({ type, hits: r.hits, found: r.found }))
    )
  );

  return {
    query,
    results: results.flatMap(
      (r) => r.hits?.map((h) => ({ type: r.type, ...h.document, score: h.text_match })) || []
    ),
    total: results.reduce((sum, r) => sum + (r.found || 0), 0),
  };
});
```

### Environment Variables

| Variable            | Default               | Description           |
| ------------------- | --------------------- | --------------------- |
| `PORT`              | `4013`                | Search service port   |
| `TYPESENSE_HOST`    | None                  | Typesense host        |
| `TYPESENSE_API_KEY` | None                  | Typesense API key     |
| `DATABASE_URL`      | (from @repo/database) | PostgreSQL connection |

---

## 4. Webhook Service

**Location:** `services/webhook/src/index.ts` (151 lines)
**Port:** 4007
**Purpose:** Manage outgoing webhooks. When events happen in Rubic, deliver payloads to registered webhook URLs.

### Current Endpoints (All Stubs)

| Method                         | Path                      | Returns |
| ------------------------------ | ------------------------- | ------- |
| `POST /webhooks`               | Random webhook ID         |
| `GET /webhooks`                | `{ webhooks: [] }`        |
| `GET /webhooks/:id`            | `{ status: "not_found" }` |
| `PATCH /webhooks/:id`          | Updated fields            |
| `DELETE /webhooks/:id`         | `{ deleted: true }`       |
| `GET /webhooks/:id/deliveries` | `{ deliveries: [] }`      |
| `POST /deliveries/:id/retry`   | `{ retrying: true }`      |
| `POST /internal/dispatch`      | Random event ID           |

### Database Tables (from `packages/database/src/schema/webhooks.ts`)

**`webhooks`** - Webhook endpoint configurations.

- `userId`, `organizationId`, `name`, `description`
- `url` - Target URL
- `secret` - HMAC secret for signing
- `events` (JSONB) - Array of subscribed event types (e.g., "agent.session.completed")
- `status` - "active" | "inactive" | "suspended"
- `headers` (JSONB) - Custom headers to include
- `maxRetries`, `retryDelayMs`, `timeoutMs`, `rateLimitPerMinute`
- `totalDeliveries`, `successfulDeliveries`, `failedDeliveries`, `lastDeliveryAt`

**`webhook_deliveries`** - Individual delivery attempts.

- `webhookId`, `eventType`, `eventId` (for deduplication), `payload`
- `status` - "pending" | "delivered" | "failed" | "retrying"
- `requestHeaders`, `requestBody`, `signature`
- `responseStatus`, `responseHeaders`, `responseBody`
- `error`, `retryCount`, `nextRetryAt`
- `attemptedAt`, `completedAt`, `durationMs`

**`webhook_events`** - Events queue waiting to be dispatched.

- `eventType`, `resourceType`, `resourceId`, `payload`
- `userId`, `organizationId`
- `processed`, `processedAt`

**Supported event types** (defined in schema):

```
agent.session.created, agent.session.completed,
agent.task.created, agent.task.completed, agent.task.failed,
project.created, project.updated, project.deleted,
file.uploaded, file.processed,
connector.synced, connector.error,
billing.subscription.created, billing.subscription.updated,
billing.payment.succeeded, billing.payment.failed
```

### What to Build

**Integration with `@repo/webhooks` (Svix):**

If using Svix for webhook delivery:

```typescript
import { Svix } from "svix";
const svix = new Svix(process.env.SVIX_API_KEY!);
```

**POST /internal/dispatch - Process Event:**

This internal endpoint is called by other services when events occur:

```typescript
app.post("/internal/dispatch", async (request, reply) => {
  const { eventType, resourceType, resourceId, payload, userId, organizationId } = request.body;

  // 1. Save event to queue
  const [event] = await db
    .insert(webhookEvents)
    .values({
      eventType,
      resourceType,
      resourceId,
      payload,
      userId,
      organizationId,
    })
    .returning();

  // 2. Find matching webhooks
  const matchingWebhooks = await db
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.status, "active"),
        userId ? eq(webhooks.userId, userId) : undefined,
        // Filter by event type - need to check JSONB array contains
        sql`${webhooks.events}::jsonb @> ${JSON.stringify([eventType])}::jsonb`
      )
    );

  // 3. Create delivery records and send
  for (const webhook of matchingWebhooks) {
    const deliveryId = createId();
    const body = JSON.stringify({
      event: eventType,
      data: payload,
      timestamp: new Date().toISOString(),
    });
    const signature = generateHmacSignature(body, webhook.secret);

    await db.insert(webhookDeliveries).values({
      id: deliveryId,
      webhookId: webhook.id,
      eventType,
      eventId: event.id,
      payload,
      status: "pending",
      signature,
    });

    // Deliver async
    deliverWebhook(webhook, deliveryId, body, signature).catch(() => {});
  }

  // 4. Mark event as processed
  await db
    .update(webhookEvents)
    .set({ processed: true, processedAt: new Date() })
    .where(eq(webhookEvents.id, event.id));

  return { eventId: event.id, webhooksNotified: matchingWebhooks.length };
});
```

**Delivery with retry:**

```typescript
async function deliverWebhook(webhook: Webhook, deliveryId: string, body: string, signature: string) {
  const startTime = Date.now();
  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Id": deliveryId,
        ...webhook.headers,
      },
      body,
      signal: AbortSignal.timeout(webhook.timeoutMs),
    });

    const durationMs = Date.now() - startTime;
    const responseBody = await response.text();

    await db.update(webhookDeliveries).set({
      status: response.ok ? "delivered" : "failed",
      responseStatus: response.status,
      responseBody: responseBody.slice(0, 5000),
      completedAt: new Date(),
      durationMs,
    }).where(eq(webhookDeliveries.id, deliveryId));

    if (!response.ok && /* retryCount < maxRetries */) {
      // Schedule retry with exponential backoff
    }
  } catch (err) {
    await db.update(webhookDeliveries).set({
      status: "failed",
      error: (err as Error).message,
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
    }).where(eq(webhookDeliveries.id, deliveryId));
  }
}
```

### Environment Variables

| Variable       | Default               | Description             |
| -------------- | --------------------- | ----------------------- |
| `PORT`         | `4007`                | Webhook service port    |
| `SVIX_API_KEY` | None                  | Svix API key (optional) |
| `DATABASE_URL` | (from @repo/database) | PostgreSQL connection   |

---

## 5. Project Service

**Location:** `services/project/src/index.ts` (149 lines)
**Port:** 4010
**Purpose:** Project management -- grouping sessions, managing team members, and organizing work.

### Current Endpoints (All Stubs)

| Method                                 | Path                      | Returns |
| -------------------------------------- | ------------------------- | ------- |
| `GET /users/:userId/projects`          | `{ projects: [] }`        |
| `POST /projects`                       | Random project ID         |
| `GET /projects/:id`                    | `{ status: "not_found" }` |
| `PATCH /projects/:id`                  | Updated fields            |
| `DELETE /projects/:id`                 | `{ deleted: true }`       |
| `GET /projects/:id/members`            | `{ members: [] }`         |
| `POST /projects/:id/members`           | `{ added: true }`         |
| `DELETE /projects/:id/members/:userId` | `{ removed: true }`       |
| `GET /projects/:id/sessions`           | `{ sessions: [] }`        |
| `GET /projects/:id/files`              | `{ files: [] }`           |

### Database Tables (from `packages/database/src/schema/projects.ts`)

**`projects`** - Main project table.

- `userId`, `organizationId`
- `name`, `description`, `icon`, `color`
- `status` - "active" | "archived" | "completed" | "paused"
- `visibility` - "private" | "team" | "public"
- `isPinned`, `sortOrder`
- `settings` (JSONB: defaultAgentId, autoArchiveDays, notificationsEnabled)
- `tags` (JSONB), `lastActivityAt`, `archivedAt`

**`project_members`** - Team members in a project.

- `projectId`, `userId`
- `role` - "owner" | "admin" | "editor" | "viewer"
- `permissions` (JSONB: canEdit, canDelete, canInvite, canManageSettings)
- `notificationsEnabled`

**`project_sessions`** - Links sessions to projects.

- `projectId`, `sessionId` (FK to agentSessions)
- `sortOrder`, `isPinned`

**`project_groups`** - For organizing projects into folders.

- `userId`, `organizationId`, `name`, `color`, `icon`, `sortOrder`

**`project_group_items`** - Links projects to groups.

- `groupId`, `projectId`, `sortOrder`

### What to Build

Wire each endpoint to the corresponding Drizzle table. The queries are straightforward CRUD. Key patterns:

```typescript
// POST /projects
const [project] = await db
  .insert(projects)
  .values({
    userId,
    name,
    description,
    organizationId,
    visibility: visibility || "private",
    status: "active",
  })
  .returning();

// Also add creator as owner member
await db.insert(projectMembers).values({
  projectId: project.id,
  userId,
  role: "owner",
});

// GET /projects/:id/sessions - Get sessions linked to project
const sessions = await db
  .select({
    link: projectSessions,
    session: agentSessions,
  })
  .from(projectSessions)
  .innerJoin(agentSessions, eq(projectSessions.sessionId, agentSessions.id))
  .where(eq(projectSessions.projectId, id))
  .orderBy(projectSessions.sortOrder);
```

On create/update, call the search service to index: `POST /internal/index` with `{ type: "projects", id, data }`.

### Environment Variables

| Variable             | Default                 | Description                 |
| -------------------- | ----------------------- | --------------------------- |
| `PORT`               | `4010`                  | Project service port        |
| `DATABASE_URL`       | (from @repo/database)   | PostgreSQL connection       |
| `SEARCH_SERVICE_URL` | `http://localhost:4013` | Search service for indexing |

---

## 6. Website Service

**Location:** `services/website/src/` (4 files)
**Port:** 4004
**Purpose:** AI-powered website generation, file management, preview via E2B/WebContainer, deployment, and database provisioning.

### Current File Structure

```
services/website/src/
  index.ts                  # 64 lines - Fastify bootstrap with CORS
  routes/
    websites.ts             # 372 lines - Website CRUD, file management, AI code generation
    deploy.ts               # 180 lines - Preview, deploy, custom domain
    database.ts             # 187 lines - TiDB database provisioning
```

### Current Status

This is the most feature-rich stub. Has working:

- Website CRUD with in-memory `Map<string, Website>` storage
- File tree management (create, read, update, list files)
- Next.js template initialization (package.json, page.tsx, layout.tsx, globals.css, tailwind.config.ts)
- Deployment simulation with status progression (queued -> building -> ready)
- TiDB database provisioning simulation
- Database branch creation for preview deployments
- SQL execution with keyword deny-list (DROP DATABASE, GRANT, etc.)

### Database Tables (from `packages/database/src/schema/websites.ts`)

**`websites`** - Website project records.

- `userId`, `organizationId`, `projectId`
- `name`, `url`, `domain`
- `status` - "pending" | "crawling" | "completed" | "failed" | "paused"
- `config` (JSONB: maxDepth, maxPages, includePatterns, excludePatterns, crawlDelay)
- `crawlFrequency` - "once" | "daily" | "weekly" | "monthly"

**`website_pages`** - Individual crawled pages.

- `websiteId`, `url`, `path`, `title`
- `rawHtml`, `textContent`, `markdown`
- `links`, `images`, `headings` (JSONB arrays)
- `statusCode`, `contentType`, `depth`
- `contentHash`, `lastChangedAt`

**`website_crawl_jobs`** - Crawl job records.

- `websiteId`, `status`, progress counters
- `startedAt`, `completedAt`

Note: The schema is more oriented toward web crawling/scraping. For the website builder feature, you may need additional tables or repurpose these tables for storing generated website files and deployments.

### What to Build

1. **Replace in-memory Map with database** - Move website data from the `Map` to the database
2. **AI Code Generation** - Wire `POST /websites/:id/generate` to the agent service:
   ```typescript
   const response = await fetch(`${AGENT_SERVICE_URL}/v1/complete`, {
     method: "POST",
     headers: { "Content-Type": "application/json", "x-user-id": userId },
     body: JSON.stringify({
       prompt: `Generate code for: ${input.prompt}`,
       system_prompt: "You are a frontend developer. Generate React/Next.js code...",
       stream: true,
     }),
   });
   ```
3. **E2B Preview** - Call sandbox service to create a sandbox, write website files, run `npm install && npm run dev`, return the preview URL
4. **TiDB Database** - Replace simulation with real TiDB Serverless API calls
5. **Deployment** - Integrate with Vercel API (`@vercel/client`) or Netlify API for production deployments

### Environment Variables

| Variable              | Default                 | Description                       |
| --------------------- | ----------------------- | --------------------------------- |
| `PORT`                | `4004`                  | Website service port              |
| `AGENT_SERVICE_URL`   | `http://localhost:8000` | Agent service for code generation |
| `SANDBOX_SERVICE_URL` | `http://localhost:4012` | Sandbox service for preview       |
| `TIDB_API_KEY`        | None                    | TiDB Cloud API key                |
| `VERCEL_TOKEN`        | None                    | Vercel deployment token           |
| `DATABASE_URL`        | (from @repo/database)   | PostgreSQL connection             |

---

## Common Patterns Across All Services

Every service in the Rubic backend follows the same structure:

```typescript
import Fastify from "fastify";
import { createLogger, getEnv } from "@repo/service-utils";

const logger = createLogger({ service: "SERVICE_NAME" });

async function main() {
  const port = parseInt(getEnv("PORT", "DEFAULT_PORT"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Health check
  app.get("/health", async () => ({ status: "ok", service: "SERVICE_NAME" }));

  // Request logging hooks
  app.addHook("onRequest", async (request) => { ... });
  app.addHook("onResponse", async (request, reply) => { ... });

  // Routes...

  await app.listen({ port, host });

  // Graceful shutdown
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => { await app.close(); process.exit(0); });
  }
}

main();
```

All services:

- Use `createLogger` from `@repo/service-utils` for structured logging
- Use `getEnv` for environment variable access
- Generate request IDs via `crypto.randomUUID()`
- Listen on `0.0.0.0` for Docker compatibility
- Have graceful shutdown handling
- Expect `x-user-id` and `x-request-id` headers from the gateway
- Use `@repo/database` for Drizzle ORM (once wired)
- Follow the `successResponse` / `errorResponse` patterns from `@repo/service-utils`
