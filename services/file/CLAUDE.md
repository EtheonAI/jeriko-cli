# services/file — Testing Rules

## What This Is
File management: S3 upload/download (AWS SDK v3), versioning, webhooks, pagination. 492 LOC.

## What to Test

### Upload (P0)
1. Single file upload → S3 key + DB record
2. Multipart upload → large file support
3. File size limit enforcement (reject oversized)
4. MIME type validation (reject dangerous types)
5. Presigned URL generation

### Download (P0)
1. Download by ID → correct content
2. Download non-existent → 404
3. Stream download for large files

### Versioning (P1)
1. Upload same filename → creates new version
2. List versions → ordered by creation date
3. Download specific version

### User Isolation (P0)
1. User A can't access User B's files

### Webhooks (P2)
1. File upload triggers webhook event
2. File delete triggers webhook event

## Pattern
- Uses AWS SDK v3 (`@aws-sdk/client-s3`)
- S3 client in `packages/storage/index.ts` (133 lines)
- Mock S3 client in tests, not real S3
