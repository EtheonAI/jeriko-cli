# File Service Instructions

> **VERIFIED against actual codebase -- Feb 2026 audit**

## Overview

The file service (`services/file/`) handles file uploads, downloads, metadata management, and versioning. Files are stored in S3 (or S3-compatible storage like R2) via the `@repo/storage` package and metadata is persisted in the database via Drizzle.

**Port:** 4005 (configurable via `PORT` env var)
**Framework:** Node.js / Fastify with `@fastify/multipart`
**Status:** FULLY IMPLEMENTED (492 LOC)

---

## Current State -- Fully Implemented

### File Service (`services/file/src/index.ts` -- 492 lines)

All 7 endpoints are working with real S3 uploads and real Drizzle database queries:

| Method                     | Path               | Status | Description                                                                                                                                       |
| -------------------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /upload`             | Single file upload | DONE   | Reads multipart, uploads to S3 via `@repo/storage`, inserts into `files` + `file_versions` tables, dispatches `file.uploaded` webhook event       |
| `POST /upload/bulk`        | Multi-file upload  | DONE   | Iterates `request.files()`, uploads each to S3 + DB. Returns `{ files, errors }` for partial failure handling                                     |
| `GET /files/:id`           | File metadata      | DONE   | Fetches file record + all versions from DB. Ownership check via `x-user-id` header                                                                |
| `GET /files/:id/download`  | Presigned URL      | DONE   | Generates 1-hour presigned download URL via `getPresignedUrl()`. Supports `?version=N` query param                                                |
| `PUT /files/:id`           | New version upload | DONE   | Auto-increments version number (`coalesce(max(version), 0) + 1`), uploads to versioned S3 key, updates main file record                           |
| `DELETE /files/:id`        | Delete file        | DONE   | Collects all version storage keys + main key, batch deletes from S3 via `deleteFiles()`, then deletes DB record (cascade handles `file_versions`) |
| `GET /users/:userId/files` | List user files    | DONE   | Pagination via cursor (createdAt-based), filters by `sessionId` and `mimeType`, max 100 per page, returns `{ files, nextCursor }`                 |

Additional infrastructure:

- Health check at `GET /health`
- Request/response logging hooks (requestId, method, URL, statusCode, responseTime)
- Graceful shutdown on SIGINT/SIGTERM
- Auth via `x-user-id` header on all endpoints
- Session association via `x-session-id` header on uploads
- Version change descriptions via `x-change-description` header on PUT

### Storage Package (`packages/storage/index.ts` -- 133 lines)

Already fully S3-based using AWS SDK v3. No Vercel Blob anywhere.

Exported functions:

- `uploadFile(key, body, contentType?, metadata?)` -- PutObjectCommand
- `getPresignedUrl(key, expiresIn?)` -- GetObjectCommand + s3-request-presigner (default 1hr)
- `deleteFile(key)` -- DeleteObjectCommand
- `deleteFiles(keys[])` -- DeleteObjectsCommand (batch delete)
- `listFiles(prefix)` -- ListObjectsV2Command
- `getStorageKey(userId, fileId, filename)` -- generates `users/{userId}/files/{fileId}/{filename}`
- `getVersionStorageKey(userId, fileId, version, filename)` -- generates `users/{userId}/files/{fileId}/v{version}/{filename}`
- `getStorageConfig()` -- Zod-validated config from env vars

Config (`packages/storage/keys.ts`): Lazy-initialized S3Client. Supports custom endpoints (R2/MinIO) via `S3_ENDPOINT` with automatic `forcePathStyle`.

### tRPC Router (`apps/app/lib/trpc/routers/files.router.ts` -- 243 lines)

7 procedures with real Drizzle queries:

| Procedure       | Type     | Description                                                                                                                          |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `list`          | query    | List user files, optional `sessionId` filter. Verifies session ownership                                                             |
| `get`           | query    | Get single file by ID with ownership check                                                                                           |
| `create`        | mutation | Create file DB record (actual upload handled by file service). Syncs to search index                                                 |
| `update`        | mutation | Update name, isPublic, metadata. Syncs to search index                                                                               |
| `delete`        | mutation | Delete file from DB (cascade handles versions). Removes from search index. **BUG: Does NOT call file service DELETE to clean up S3** |
| `versions`      | query    | Get all versions of a file, ordered by version desc                                                                                  |
| `createVersion` | mutation | Create a new version record with auto-incrementing version number                                                                    |

---

## File Structure

```
services/file/src/
  index.ts              # 492 lines - Fastify server, all 7 endpoints fully implemented

packages/storage/
  index.ts              # 133 lines - S3 client wrapper (AWS SDK v3)
  keys.ts               # 23 lines  - StorageConfig Zod schema + env var parsing

apps/app/lib/trpc/routers/
  files.router.ts       # 243 lines - 7 tRPC procedures with Drizzle queries
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
- `size` - File size in bytes (integer)
- `storageKey` - S3 object key (e.g., `users/{userId}/files/{fileId}/{name}`)
- `storageProvider` - "local" | "s3" | "r2" | "vercel_blob" (default: "local")
- `isPublic` - Whether the file is publicly accessible (default: false)
- `metadata` (JSONB) - `{ width, height, duration, encoding, ... }` for media files
- `createdAt`, `updatedAt` (auto-updated via `$onUpdate`)

Relations: `user` (one), `session` (one), `versions` (many)

### `file_versions`

Version history for files.

- `id` - CUID2 primary key
- `fileId` - FK to files table (CASCADE on delete)
- `version` - Integer version number
- `storageKey` - S3 key for this specific version (not null)
- `size` - Size of this version in bytes
- `changeDescription` - Optional description of what changed
- `createdAt`

Relations: `file` (one)

---

## What Needs Building

### 1. Fix: tRPC `delete` Procedure -- S3 Cleanup (BUG)

**File:** `apps/app/lib/trpc/routers/files.router.ts`, line ~166-173

The `delete` mutation currently only deletes from the database. It has a `// TODO: Delete actual file from storage` comment. It should call the file service `DELETE /files/:id` endpoint (or directly use `@repo/storage` `deleteFiles()`) to also remove the file and all versions from S3.

### 2. `createFolder` Procedure

Add a tRPC mutation to create folder entries. Folders are files with `mimeType: "application/folder"` and no `storageKey`. This enables a virtual file tree in the UI.

### 3. `move` Procedure

Add a tRPC mutation to change a file's `path` field. This is purely a DB update (the S3 key does not change).

### 4. `duplicate` Procedure

Add a tRPC mutation that:

1. Reads the original file record
2. Copies the S3 object to a new key (use `CopyObjectCommand`)
3. Creates a new file DB record pointing to the copy
4. Creates an initial `file_versions` record

### 5. `bulkDelete` Procedure

Add a tRPC mutation that accepts an array of file IDs, verifies ownership for each, collects all S3 keys, batch deletes from S3 via `deleteFiles()`, then batch deletes from DB.

### 6. File Sharing (`fileShares` Table)

The database schema does not yet have a `fileShares` table. Needs:

- Schema: `fileShares` table with `fileId`, `sharedWithUserId`, `permission` (view/edit), `expiresAt`
- tRPC procedures: `share`, `unshare`, `listShared`, `listSharedWithMe`
- File service: Modify `GET /files/:id` and `GET /files/:id/download` to check share permissions in addition to ownership

### 7. `getStorageUsage` Procedure

Add a tRPC query that aggregates `SUM(files.size)` for the current user. Useful for displaying storage quota in the settings/billing UI.

---

## Environment Variables

| Variable                | Default               | Description                                                                            |
| ----------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| `PORT`                  | `4005`                | File service port                                                                      |
| `HOST`                  | `0.0.0.0`             | File service bind host                                                                 |
| `AWS_REGION`            | `us-east-1`           | AWS region for S3                                                                      |
| `AWS_ACCESS_KEY_ID`     | None                  | AWS access key                                                                         |
| `AWS_SECRET_ACCESS_KEY` | None                  | AWS secret key                                                                         |
| `S3_BUCKET`             | `rubic-files`         | S3 bucket name                                                                         |
| `S3_ENDPOINT`           | None                  | Custom S3 endpoint (for R2/MinIO). When set, `forcePathStyle` is automatically enabled |
| `DATABASE_URL`          | (from @repo/database) | PostgreSQL connection                                                                  |
