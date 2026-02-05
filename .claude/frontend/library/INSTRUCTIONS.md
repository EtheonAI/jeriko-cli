# File Manager (Library) - Build Instructions

## Current State

### What's ALREADY Working (Backend)

#### File Service (`services/file/src/index.ts`, 493 lines) - FULLY IMPLEMENTED

- `POST /upload` - Single file upload (100MB limit) with S3 storage + DB record
- `POST /upload/bulk` - Multi-file upload
- `GET /files/:id` - Get file metadata + versions
- `GET /files/:id/download` - Presigned download URL (1hr expiry)
- `PUT /files/:id` - Upload new version (auto-incrementing version numbers)
- `DELETE /files/:id` - S3 cleanup + DB deletion
- `GET /users/:userId/files` - List user files with pagination, filters
- Multipart file handling (@fastify/multipart)
- Webhook events (`file.uploaded`)
- Session association via `x-session-id` header
- Auth via `x-user-id` header

#### Storage Package (`packages/storage/index.ts`, 133 lines) - FULLY IMPLEMENTED

- `uploadFile(key, body, contentType)` - S3 PutObject
- `getPresignedUrl(key, expiresIn)` - Signed download URL
- `deleteFile(key)` - Single file deletion
- `deleteFiles(keys)` - Bulk deletion
- `listFiles(prefix)` - List by prefix
- `getStorageKey(userId, fileId, filename)` - Key generation
- `getVersionStorageKey(userId, fileId, version, filename)` - Version key generation
- AWS SDK v3, configurable for S3/R2/compatible

#### tRPC Router (`apps/app/lib/trpc/routers/files.router.ts`, 243 lines)

- `list` - List files by user or session, ordered by createdAt desc
- `get` - Get single file by ID (ownership check)
- `create` - Create file record, syncs to Typesense search index
- `update` - Update name, isPublic, metadata
- `delete` - Delete file record + remove from search index (TODO: delete from storage)
- `versions` - List file versions ordered by version desc
- `createVersion` - Create new version with auto-incrementing version number

#### Database Schema (`packages/database/src/schema/files.ts`, 73 lines)

**files table:**

- `id` (text, PK, cuid2), `sessionId` (FK -> agentSessions, nullable), `userId` (FK -> users)
- `name`, `path`, `mimeType`, `size` (bytes), `storageKey`, `storageProvider` (local/s3/r2/vercel_blob)
- `isPublic` (default false), `metadata` (jsonb: width, height, duration, encoding)
- `createdAt`, `updatedAt`

**fileVersions table:**

- `id`, `fileId` (FK -> files, cascade), `version` (integer), `storageKey`, `size`, `changeDescription`, `createdAt`

#### Redux Slices (Comprehensive)

- `fileManagement.slice.ts` (348 lines, 45 actions) - Spaces, tabs, download mode, selection, Google Drive integration, upload queue with progress
- `files.slice.ts` (~90 lines) - Basic addFile/removeFile, WebSocket wired
- `filePreviewer.slice.ts` - File preview state
- `fileConnector.slice.ts` - File connector state
- `fileShare.slice.ts` - File sharing state
- `library.slice.ts` - Library browsing state

### What's NOT Working (Frontend)

#### Files Page (`apps/app/app/(authenticated)/files/page.tsx`, 54 lines)

- **Empty placeholder** with "No files yet" dashed border
- Server component, NO client component exists
- No sub-components in the directory
- "Create new task" button links to `/` (wrong behavior)

---

## What Needs Building

### 1. File Manager Client Component (Google Drive-Style)

**Create:** `apps/app/app/(authenticated)/files/files-page-client.tsx`

**Convert** `page.tsx` from server-only placeholder to wrapping this client component.

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│ [Breadcrumbs: Root > Folder > Subfolder]                 │
│ [Search] [Upload ▲] [New Folder +] │ [Grid|List] [Sort]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │
│  │ 📁   │ │ 📄   │ │ 🖼️   │ │ 📊   │ │ 📝   │          │
│  │Folder│ │Doc   │ │Image │ │Sheet │ │Note  │          │
│  │      │ │2.3MB │ │1.1MB │ │450KB │ │12KB  │          │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘          │
│                                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐                             │
│  │ 🎥   │ │ 💻   │ │ 🎵   │                             │
│  │Video │ │Code  │ │Audio │                             │
│  │45MB  │ │8KB   │ │3.2MB │                             │
│  └──────┘ └──────┘ └──────┘                             │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ Storage: ████████░░ 2.3 GB / 10 GB                      │
└──────────────────────────────────────────────────────────┘
```

**Features:**

#### View Modes

- **Grid view**: File cards in responsive grid (thumbnail/icon, name, size, modified date)
- **List view**: Table with columns (Name, Size, Modified, Type, Actions)
- Toggle between views, persist in localStorage
- Use `fileManagement.slice.ts` `setFileTab` for filtering (all/documents/images/videos/audio/other)

#### Tab Filtering (From Redux Slice)

```typescript
// Already in fileManagement.slice.ts:
type FileTab = "all" | "documents" | "images" | "videos" | "audio" | "other";
```

Render tab pills above the file grid for quick filtering by type.

#### Folder Navigation

- **Breadcrumb trail** at top (Root > Folder > Subfolder)
- Double-click folder to navigate in
- Back button in breadcrumbs
- **Path-based hierarchy**: Use the `path` field on files (e.g., `/folder/subfolder/file.txt`)
- Create folder = create file record with `mimeType: "application/folder"` and no storageKey

#### File Actions (per file - context menu + dropdown)

| Action          | Implementation                                                                               |
| --------------- | -------------------------------------------------------------------------------------------- |
| Preview         | Open file preview modal (images: full-size, PDFs: embedded viewer, code: syntax-highlighted) |
| Download        | `files.router.ts` → `services/file` → presigned S3 URL → browser download                    |
| Share           | Open share dialog with access levels (requires `fileShares` table)                           |
| Rename          | `files.update` mutation with inline input                                                    |
| Delete          | Confirmation dialog → `files.delete` mutation                                                |
| Version History | Side panel showing versions from `files.versions` query                                      |
| Move to folder  | "Move to" dialog with folder tree                                                            |
| Duplicate       | Create copy with "(copy)" suffix via `files.create` + S3 copy                                |
| Open in chat    | Create new session referencing this file                                                     |

#### Bulk Operations

- Checkbox selection on each file card/row
- Select all in header
- Bulk action bar when items selected: Move, Delete, Download as ZIP
- Shift-click for range selection
- Use `fileManagement.slice.ts` selection actions: `toggleFileSelection`, `selectAllFiles`, `clearSelection`

#### Upload Flow

- **Drag-and-drop zone** (full area overlay on dragenter)
- **Upload button** → file picker
- **Progress tracking** via `fileManagement.slice.ts` upload queue: `addToUploadQueue`, `updateUploadProgress`, `completeUpload`, `failUpload`
- Upload target: `POST /upload` on file service (via gateway proxy)
- After upload, call `files.create` tRPC to register in DB, or rely on service doing it

#### Google Drive / Cloud File Import

```typescript
// Already in fileManagement.slice.ts:
showGoogleDrivePicker: boolean;
setShowGoogleDrivePicker(show: boolean);
```

- Google Drive picker via Composio Google Drive integration
- OneDrive picker via Composio
- Dropbox picker via Composio
- Check if connector is connected: `connectors.list.useQuery()`, filter by type

### 2. File Preview Modal

**Create:** `apps/app/app/(authenticated)/files/components/file-preview-modal.tsx`

**Rendering by type:**
| MIME Type | Renderer |
|-----------|----------|
| `image/*` | `<img>` with zoom/pan |
| `application/pdf` | `react-pdf` or `<iframe>` |
| `text/*`, `application/json` | Syntax-highlighted code viewer (Monaco or Prism) |
| `video/*` | `<video>` with controls |
| `audio/*` | `<audio>` with waveform |
| `application/vnd.openxmlformats*` (docx/xlsx/pptx) | Use libraries: mammoth (docx), xlsx (excel), or convert server-side |
| `application/folder` | Navigate into folder |

**Features:**

- Keyboard navigation: Left/Right arrow to navigate between files
- Download button in modal header
- Share button in modal header
- Version history sidebar toggle
- File info panel (name, size, type, created, modified, owner)

### 3. tRPC Router Enhancements

Add to `apps/app/lib/trpc/routers/files.router.ts`:

```typescript
// New procedures needed:
getStorageUsage; // Sum of file sizes for user, breakdown by type
rename; // Update file name (alias for update with just name)
move; // Change file path (move to different folder)
duplicate; // Copy file record + S3 object copy
bulkDelete; // Delete multiple files by IDs
bulkMove; // Move multiple files to new path
share; // Create file share record (new fileShares table)
listShared; // List files shared with user
listSharedByMe; // List files user has shared
revokeShare; // Remove sharing access
getShareLink; // Generate/get shareable link with token
listFolders; // List only folder-type entries for move dialog
createFolder; // Create folder entry (mimeType: "application/folder")
search; // Search files by name using quickSearch from @repo/search
```

### 4. Database Schema Additions

**New table needed: `fileShares`**

```typescript
// Add to packages/database/src/schema/files.ts:
export const fileShares = pgTable("file_shares", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  fileId: text("file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  sharedByUserId: text("shared_by_user_id")
    .notNull()
    .references(() => users.id),
  sharedWithUserId: text("shared_with_user_id").references(() => users.id), // null = public link
  accessLevel: text("access_level", { enum: ["viewer", "editor"] }).default("viewer"),
  linkToken: text("link_token").unique(), // For shareable links
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### 5. Search Integration

The search package already syncs files. Add a search bar to the files page:

```typescript
const { data: results } = api.search.quickSearch.useQuery(
  { query: searchQuery, collections: ["files"] },
  { enabled: searchQuery.length > 2 }
);
```

### 6. Storage Usage Display

Show at the bottom of the files page:

```typescript
const { data: usage } = api.files.getStorageUsage.useQuery();
// Returns: { totalBytes, breakdown: { documents: N, images: N, videos: N, ... } }
```

Progress bar with used/total based on plan limits from billing.

---

## Components to Create

In `apps/app/app/(authenticated)/files/components/`:

| Component                   | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `file-grid.tsx`             | Responsive grid of file cards                               |
| `file-list.tsx`             | Table/list view with sortable columns                       |
| `file-card.tsx`             | Individual file card (grid mode) with thumbnail, name, size |
| `file-row.tsx`              | Individual file row (list mode)                             |
| `file-preview-modal.tsx`    | Full preview modal with type-specific renderers             |
| `upload-zone.tsx`           | Drag-and-drop upload overlay + button                       |
| `folder-breadcrumbs.tsx`    | Navigation breadcrumbs with clickable segments              |
| `file-actions-menu.tsx`     | Right-click context menu / overflow dropdown                |
| `share-dialog.tsx`          | Sharing settings with email input + access levels           |
| `version-history-panel.tsx` | Slide-out panel with version list                           |
| `storage-usage.tsx`         | Storage usage bar at bottom                                 |
| `bulk-action-bar.tsx`       | Floating bar for selected files                             |
| `view-toggle.tsx`           | Grid/List view toggle                                       |
| `file-tab-filter.tsx`       | Tab pills for filtering by type                             |
| `cloud-import-dialog.tsx`   | Google Drive / OneDrive / Dropbox import picker             |

---

## Key File Paths

| Purpose                    | Path                                                       |
| -------------------------- | ---------------------------------------------------------- |
| Files page (server)        | `apps/app/app/(authenticated)/files/page.tsx`              |
| Files page client (CREATE) | `apps/app/app/(authenticated)/files/files-page-client.tsx` |
| Files components (CREATE)  | `apps/app/app/(authenticated)/files/components/`           |
| Files router               | `apps/app/lib/trpc/routers/files.router.ts`                |
| Files schema               | `packages/database/src/schema/files.ts`                    |
| File management slice      | `apps/app/lib/store/slices/fileManagement.slice.ts`        |
| File previewer slice       | `apps/app/lib/store/slices/filePreviewer.slice.ts`         |
| File share slice           | `apps/app/lib/store/slices/fileShare.slice.ts`             |
| Library slice              | `apps/app/lib/store/slices/library.slice.ts`               |
| Files slice                | `apps/app/lib/store/slices/files.slice.ts`                 |
| Storage package            | `packages/storage/index.ts`                                |
| File service               | `services/file/src/index.ts`                               |
| Search sync                | `packages/search/src/services/sync-service.ts`             |
| WebSocket events           | `apps/app/lib/socket/provider.tsx`                         |

---

## Important Notes

1. **Storage is ALREADY S3** - `packages/storage/` already uses AWS SDK v3. Do NOT refactor from Vercel Blob - it's already done.
2. **File service is FULLY IMPLEMENTED** (493 lines) - Do NOT rewrite it. It has real DB queries, S3 integration, versioning, webhooks.
3. **Redux slices are comprehensive** - `fileManagement.slice.ts` already has 45 actions for spaces, tabs, selection, upload queue, Google Drive picker. USE these existing actions.
4. **tRPC router works** - The 7 existing procedures use real Drizzle queries. Just ADD new procedures, don't rewrite existing ones.
5. **Upload flow**: Client → Gateway proxy → File service POST /upload → S3 + DB. The file service handles everything.
6. **Delete TODO**: `files.router.ts` has a TODO to delete actual file from storage on delete. Fix this by calling the file service DELETE endpoint.
7. **Search already wired**: `syncFileToSearch` / `removeFileFromSearch` called on create/delete in tRPC router.

## Priority Order

1. Create `files-page-client.tsx` with grid/list views and tRPC integration
2. Tab filtering (documents/images/videos/audio/other)
3. Folder navigation with breadcrumbs and `createFolder` procedure
4. Upload zone with drag-and-drop + progress
5. File preview modal (type-specific renderers)
6. File actions (rename, delete, download, duplicate)
7. Bulk operations (select, bulk delete, bulk move)
8. Share dialog + `fileShares` table + sharing procedures
9. Cloud import (Google Drive, OneDrive, Dropbox via Composio)
10. Version history panel
11. Storage usage display
12. Search bar integration
