# File Service Instructions

## Overview

The file service (`services/file/`) handles file uploads, downloads, metadata management, and versioning. Files are stored in S3 (or S3-compatible storage like R2) and metadata is persisted in the database.

**Port:** 4005 (configurable via `PORT` env var)
**Framework:** Node.js / Fastify with `@fastify/multipart`
**Status:** Has multipart plugin registered with 100MB limit. 4 endpoints all stubbed with TODO comments.

---

## Current File Structure

```
services/file/src/
  index.ts              # 105 lines - Fastify bootstrap, multipart registered, 4 endpoints all TODO
```

### Related Packages

```
packages/storage/       # Currently uses Vercel Blob - needs refactoring to S3
```

---

## Current Endpoints (All Stubs)

| Method                    | Path    | Status                                                                    | Returns |
| ------------------------- | ------- | ------------------------------------------------------------------------- | ------- |
| `POST /upload`            | PARTIAL | Reads multipart data, generates UUID, does NOT upload to S3 or save to DB |
| `GET /files/:id`          | STUB    | Returns `{ id, status: "not_implemented" }`                               |
| `GET /files/:id/download` | STUB    | Returns `{ url: "", expiresIn: 3600 }`                                    |
| `DELETE /files/:id`       | STUB    | Returns `{ deleted: true }`                                               |

The multipart plugin is correctly configured:

```typescript
await app.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10,
  },
});
```

---

## Database Tables

From `packages/database/src/schema/files.ts`:

### `files`

Main file metadata table.

- `id` - CUID2 primary key
- `sessionId` - Optional link to agent session (SET NULL on cascade)
- `userId` - Required, CASCADE on delete
- `name` - Original filename
- `path` - Virtual path (e.g., `/project/docs/readme.md`)
- `mimeType` - MIME type string
- `size` - File size in bytes
- `storageKey` - S3 object key (e.g., `users/{userId}/files/{fileId}/{name}`)
- `storageProvider` - "local" | "s3" | "r2" | "vercel_blob"
- `isPublic` - Whether the file is publicly accessible
- `metadata` (JSONB) - `{ width, height, duration, encoding, ... }` for media files
- `createdAt`, `updatedAt`

### `file_versions`

Version history for files.

- `id` - CUID2 primary key
- `fileId` - FK to files table (CASCADE on delete)
- `version` - Integer version number
- `storageKey` - S3 key for this specific version
- `size` - Size of this version
- `changeDescription` - Optional description of what changed
- `createdAt`

---

## What Needs to Be Built

### 1. S3 Client Setup

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  // For R2 or MinIO:
  // endpoint: process.env.S3_ENDPOINT,
  // forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET || "rubic-files";
```

### 2. POST /upload - Upload File to S3

```typescript
app.post("/upload", async (request, reply) => {
  const userId = request.headers["x-user-id"] as string;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const data = await request.file();
  if (!data) return reply.status(400).send({ error: "No file provided" });

  const fileId = createId();
  const sessionId = (request.query as { sessionId?: string }).sessionId || null;
  const projectId = (request.query as { projectId?: string }).projectId || null;

  // 1. Generate S3 key
  const storageKey = `users/${userId}/files/${fileId}/${data.filename}`;

  // 2. Read file buffer
  const buffer = await data.toBuffer();

  // 3. Upload to S3
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: data.mimetype,
      Metadata: {
        userId,
        fileId,
        originalName: data.filename,
      },
    })
  );

  // 4. Extract metadata (optional, for images/video)
  const metadata: Record<string, unknown> = {};
  if (data.mimetype.startsWith("image/")) {
    // Use sharp to get dimensions: const { width, height } = await sharp(buffer).metadata();
    // metadata.width = width; metadata.height = height;
  }

  // 5. Save to database
  const [file] = await db
    .insert(files)
    .values({
      id: fileId,
      sessionId,
      userId,
      name: data.filename,
      path: `/${data.filename}`, // Default path, can be overridden
      mimeType: data.mimetype,
      size: buffer.length,
      storageKey,
      storageProvider: "s3",
      isPublic: false,
      metadata,
    })
    .returning();

  // 6. Create initial version
  await db.insert(fileVersions).values({
    fileId,
    version: 1,
    storageKey,
    size: buffer.length,
    changeDescription: "Initial upload",
  });

  // 7. Index in search service (async)
  fetch(`${process.env.SEARCH_SERVICE_URL}/internal/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "file",
      id: fileId,
      data: { name: data.filename, mimeType: data.mimetype, userId, sessionId, projectId },
    }),
  }).catch(() => {}); // Fire and forget

  return reply.status(201).send(file);
});
```

### 3. GET /files/:id - Get File Metadata

```typescript
app.get("/files/:id", async (request, reply) => {
  const userId = request.headers["x-user-id"] as string;
  const { id } = request.params as { id: string };

  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.userId, userId)))
    .limit(1);

  if (!file) {
    return reply.status(404).send({ error: "File not found" });
  }

  // Include versions
  const versions = await db
    .select()
    .from(fileVersions)
    .where(eq(fileVersions.fileId, id))
    .orderBy(desc(fileVersions.version));

  return { ...file, versions };
});
```

### 4. GET /files/:id/download - Generate Presigned Download URL

```typescript
app.get("/files/:id/download", async (request, reply) => {
  const userId = request.headers["x-user-id"] as string;
  const { id } = request.params as { id: string };
  const { version } = request.query as { version?: string };

  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.userId, userId)))
    .limit(1);

  if (!file) {
    return reply.status(404).send({ error: "File not found" });
  }

  let storageKey = file.storageKey!;

  // If specific version requested, get that version's storage key
  if (version) {
    const [ver] = await db
      .select()
      .from(fileVersions)
      .where(and(eq(fileVersions.fileId, id), eq(fileVersions.version, parseInt(version))))
      .limit(1);
    if (ver) storageKey = ver.storageKey;
  }

  // Generate presigned URL (expires in 1 hour)
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: storageKey,
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return { id, url, expiresIn: 3600 };
});
```

### 5. DELETE /files/:id - Delete from S3 + Database

```typescript
app.delete("/files/:id", async (request, reply) => {
  const userId = request.headers["x-user-id"] as string;
  const { id } = request.params as { id: string };

  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.userId, userId)))
    .limit(1);

  if (!file) {
    return reply.status(404).send({ error: "File not found" });
  }

  // 1. Get all versions to delete from S3
  const versions = await db.select().from(fileVersions).where(eq(fileVersions.fileId, id));

  // 2. Delete all version objects from S3
  for (const ver of versions) {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: ver.storageKey,
      })
    );
  }

  // Also delete the main file object if different from v1
  if (file.storageKey && !versions.some((v) => v.storageKey === file.storageKey)) {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: file.storageKey,
      })
    );
  }

  // 3. Delete from database (cascade will handle file_versions)
  await db.delete(files).where(eq(files.id, id));

  // 4. Remove from search index
  fetch(`${process.env.SEARCH_SERVICE_URL}/internal/index/file/${id}`, {
    method: "DELETE",
  }).catch(() => {});

  return { deleted: true };
});
```

### 6. Additional Endpoints to Add

**PUT /files/:id - Update file (new version):**

```typescript
app.put("/files/:id", async (request, reply) => {
  const userId = request.headers["x-user-id"] as string;
  const { id } = request.params as { id: string };
  const data = await request.file();

  // 1. Verify file exists and belongs to user
  // 2. Get current max version number
  // 3. Upload new version to S3 with key: users/{userId}/files/{fileId}/v{version}/{name}
  // 4. Create new file_versions record
  // 5. Update files table with new storageKey, size, updatedAt
});
```

**GET /users/:userId/files - List user's files:**

```typescript
app.get("/users/:userId/files", async (request, reply) => {
  const { userId } = request.params as { userId: string };
  const { sessionId, projectId, mimeType, limit, cursor } = request.query;

  const conditions = [eq(files.userId, userId)];
  if (sessionId) conditions.push(eq(files.sessionId, sessionId));
  // Add more filters...

  const results = await db
    .select()
    .from(files)
    .where(and(...conditions))
    .orderBy(desc(files.createdAt))
    .limit(parseInt(limit || "20"));

  return { files: results };
});
```

**POST /upload/bulk - Bulk upload:**

```typescript
app.post("/upload/bulk", async (request, reply) => {
  const parts = request.files();
  const results = [];
  for await (const part of parts) {
    // Upload each file to S3 and save to DB
    // Same logic as single upload
    results.push({ filename: part.filename, id: fileId });
  }
  return { files: results };
});
```

---

## Storage Package Refactoring

The `packages/storage/` package currently uses Vercel Blob. It should be refactored to use S3:

1. Replace `@vercel/blob` with `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
2. Export a `StorageClient` class with methods: `upload`, `download`, `getSignedUrl`, `delete`, `list`
3. Both the file service and other services can import from `@repo/storage`

---

## Environment Variables

| Variable                | Default                 | Description                       |
| ----------------------- | ----------------------- | --------------------------------- |
| `PORT`                  | `4005`                  | File service port                 |
| `AWS_REGION`            | `us-east-1`             | AWS region for S3                 |
| `AWS_ACCESS_KEY_ID`     | None                    | AWS access key                    |
| `AWS_SECRET_ACCESS_KEY` | None                    | AWS secret key                    |
| `S3_BUCKET`             | `rubic-files`           | S3 bucket name                    |
| `S3_ENDPOINT`           | None                    | Custom S3 endpoint (for R2/MinIO) |
| `DATABASE_URL`          | (from @repo/database)   | PostgreSQL connection             |
| `SEARCH_SERVICE_URL`    | `http://localhost:4013` | Search service for indexing       |
