# File Manager (Library) - Build Instructions

## Current State

### Frontend Page

`apps/app/app/(authenticated)/files/page.tsx` (54 lines) - Empty placeholder showing "No files yet" with a dashed border empty state and a "Create new task" button. Server component that fetches auth session.

### Redux State

`apps/app/lib/store/slices/files.slice.ts` (exists, ~90 lines) - Basic slice with `addFile`, `removeFile` actions. The WebSocket provider (`apps/app/lib/socket/provider.tsx`) already dispatches `addFile` and `removeFile` on `file:new` and `file:deleted` socket events.

Additional relevant slices:

- `apps/app/lib/store/slices/fileManagement.slice.ts` (8623 bytes) - Full file management state with folder navigation, selection, sorting, bulk operations
- `apps/app/lib/store/slices/filePreviewer.slice.ts` (5104 bytes) - File preview state
- `apps/app/lib/store/slices/fileConnector.slice.ts` (6420 bytes) - File connector state
- `apps/app/lib/store/slices/fileShare.slice.ts` (4691 bytes) - File sharing state
- `apps/app/lib/store/slices/library.slice.ts` (9511 bytes) - Library browsing state

### tRPC Router

`apps/app/lib/trpc/routers/files.router.ts` (243 lines) - Working Drizzle queries:

- `list` - List files by user or session, ordered by createdAt desc
- `get` - Get single file by ID (ownership check)
- `create` - Create file record with fields: name, path, mimeType, size, storageKey, storageProvider (local/s3/r2/vercel_blob), sessionId, isPublic, metadata. Syncs to Typesense search index via `syncFileToSearch()`
- `update` - Update name, isPublic, metadata
- `delete` - Delete file record + remove from search index. Has TODO: "Delete actual file from storage"
- `versions` - List file versions ordered by version desc
- `createVersion` - Create new version with auto-incrementing version number, storageKey, size, changeDescription

### Database Schema

`packages/database/src/schema/files.ts` (73 lines):

**files table:**

- `id` (text, PK, cuid2)
- `sessionId` (text, FK -> agentSessions, nullable)
- `userId` (text, FK -> users, not null)
- `name` (text, not null)
- `path` (text, not null)
- `mimeType` (text, nullable)
- `size` (integer, nullable, bytes)
- `storageKey` (text, nullable) - S3/R2 key
- `storageProvider` (text enum: local/s3/r2/vercel_blob, default: "local")
- `isPublic` (boolean, default: false)
- `metadata` (jsonb: { width?, height?, duration?, encoding?, ... })
- `createdAt`, `updatedAt` (timestamps)

**fileVersions table:**

- `id` (text, PK, cuid2)
- `fileId` (text, FK -> files, cascade delete)
- `version` (integer, not null)
- `storageKey` (text, not null)
- `size` (integer, nullable)
- `changeDescription` (text, nullable)
- `createdAt` (timestamp)

Relations: files -> user, session, versions. fileVersions -> file.

### Storage Package

`packages/storage/` - Currently just re-exports `@vercel/blob`:

- `index.ts`: `export * from "@vercel/blob";`
- `client.ts`: `export * from "@vercel/blob/client";`

### File Service

`services/file/src/index.ts` (104 lines) - Fastify service on port 4005:

- `GET /health` - Health check
- `POST /upload` - Accepts multipart (100MB limit, 10 files max). Has TODO: "Upload to S3 and save to database"
- `GET /files/:id` - TODO: Fetch from database
- `GET /files/:id/download` - TODO: Generate presigned S3 URL
- `DELETE /files/:id` - TODO: Delete from S3 and database

---

## What Needs Building

### 1. Storage Refactoring (PREREQUISITE)

Refactor `packages/storage/` from Vercel Blob to AWS S3.

**Install dependencies:**

```
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
```

**Create in `packages/storage/`:**

- `keys.ts` - Env vars: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`
- `s3-client.ts` - Configure S3Client with credentials
- `upload.ts` - `uploadFile(key, body, contentType)` using PutObjectCommand
- `download.ts` - `getPresignedUrl(key, expiresIn)` using GetObjectCommand + getSignedUrl
- `delete.ts` - `deleteFile(key)` using DeleteObjectCommand
- `index.ts` - Re-export all utilities

**Then update `services/file/src/index.ts`:**

- `POST /upload`: Stream file to S3 via `uploadFile()`, save record to DB via Drizzle
- `GET /files/:id/download`: Generate presigned URL via `getPresignedUrl()`
- `DELETE /files/:id`: Delete from S3 via `deleteFile()`, delete DB record

### 2. File Manager Page (Google Drive-style)

Convert `apps/app/app/(authenticated)/files/page.tsx` from server component placeholder to a client component with full file management.

**Create:** `apps/app/app/(authenticated)/files/files-page-client.tsx`

**Features to implement:**

#### View Modes

- Grid view: File cards in responsive grid (icon, name, size, modified date, preview thumbnail)
- List view: Table with columns (Name, Size, Modified, Type, Actions)
- Toggle button between views, persist preference in localStorage

#### Folder Navigation

- Breadcrumb trail at top (Root > Folder > Subfolder)
- Double-click folder to navigate in
- Back button in breadcrumbs
- Add `parentId` field to files table for folder hierarchy (or use path-based: `/folder/subfolder/file.txt`)

#### File Actions (per file)

- Preview: Open file preview modal (images: full-size view, PDFs: embedded viewer, code: syntax-highlighted, documents: rendered)
- Download: Get presigned URL from file service, trigger browser download
- Share: Open share dialog with access levels
- Rename: Inline rename with Enter to confirm
- Delete: Confirmation dialog, then `files.router.ts` `delete` mutation
- Version History: Side panel showing versions from `files.router.ts` `versions` query
- Move to folder: Drag-and-drop or "Move to" dialog
- Duplicate: Create copy with "(copy)" suffix

#### Bulk Operations

- Checkbox selection on each file card/row
- Select all checkbox in header
- Bulk action bar appears when items selected: Move, Copy, Delete, Download as ZIP
- Shift-click for range selection

#### Upload Modal

- Drag-and-drop zone (full area overlay)
- File browser button
- Upload progress bars per file
- Cancel individual uploads
- Auto-detect file type and set mimeType
- Upload flow: Client -> `services/file/src/index.ts` `POST /upload` -> S3 -> DB record via `files.router.ts` `create`

#### Sharing

- Share dialog with email input
- Access levels: Viewer (read-only), Editor (can modify)
- Generate shareable link with expiration
- Requires new DB table: `fileShares` (fileId, sharedWithUserId, accessLevel, linkToken, expiresAt)
- Use `fileShare.slice.ts` for state management

#### Storage Usage Display

- Progress bar showing used/total storage
- Breakdown by file type (images, documents, code, other)
- Query total size from `files.router.ts` (add `getStorageUsage` procedure)

**Components to create in `apps/app/app/(authenticated)/files/components/`:**

- `file-grid.tsx` - Grid view of file cards
- `file-list.tsx` - Table/list view
- `file-card.tsx` - Individual file card (grid mode)
- `file-row.tsx` - Individual file row (list mode)
- `file-preview-modal.tsx` - Full preview modal
- `upload-modal.tsx` - Upload dialog with drag-drop
- `folder-breadcrumbs.tsx` - Navigation breadcrumbs
- `file-actions-menu.tsx` - Right-click/overflow menu
- `share-dialog.tsx` - Sharing settings
- `version-history-panel.tsx` - Version list side panel
- `storage-usage.tsx` - Storage usage indicator
- `bulk-action-bar.tsx` - Actions for selected files
- `view-toggle.tsx` - Grid/list toggle

### 3. tRPC Router Enhancements

Add to `apps/app/lib/trpc/routers/files.router.ts`:

```typescript
// New procedures needed:
getStorageUsage; // Sum of file sizes for user
rename; // Update file name
move; // Change file path/parentId
duplicate; // Copy file record + storage copy
bulkDelete; // Delete multiple files
bulkMove; // Move multiple files
share; // Create file share record
listShared; // List files shared with user
listSharedByMe; // List files user has shared
revokeShare; // Remove sharing
getShareLink; // Generate/get share link
listFolders; // List only folders for move dialog
createFolder; // Create empty folder entry
```

### 4. Search Integration

The search package (`packages/search/src/`) already has `syncFileToSearch` and `removeFileFromSearch`. File search is already wired in `files.router.ts` create/update/delete operations.

Add a search bar to the files page that uses `quickSearch` from `@repo/search` to search file names and metadata.

---

## Key File Paths

| Purpose               | Path                                                |
| --------------------- | --------------------------------------------------- |
| Files page            | `apps/app/app/(authenticated)/files/page.tsx`       |
| Files router          | `apps/app/lib/trpc/routers/files.router.ts`         |
| Files schema          | `packages/database/src/schema/files.ts`             |
| Files slice           | `apps/app/lib/store/slices/files.slice.ts`          |
| File management slice | `apps/app/lib/store/slices/fileManagement.slice.ts` |
| File previewer slice  | `apps/app/lib/store/slices/filePreviewer.slice.ts`  |
| File share slice      | `apps/app/lib/store/slices/fileShare.slice.ts`      |
| Library slice         | `apps/app/lib/store/slices/library.slice.ts`        |
| Storage package       | `packages/storage/index.ts`                         |
| File service          | `services/file/src/index.ts`                        |
| Search sync           | `packages/search/src/services/sync-service.ts`      |
| WebSocket file events | `apps/app/lib/socket/provider.tsx` (lines 220-242)  |

## Priority Order

1. Storage refactoring (packages/storage/ -> S3) - blocks everything
2. File service S3 implementation (services/file/) - blocks uploads
3. File manager page with grid/list views and folder navigation
4. Upload modal with progress
5. File preview modal
6. File actions (rename, delete, download)
7. Bulk operations
8. Sharing system
9. Version history UI
10. Storage usage display
