# Package Playbook: @repo/storage

Package: `@repo/storage`

Date: 2026-05-26

Status: completed for S3 edge-case cleanup

Priority: P2 platform package

## Ownership

What this package owns:

- Object storage client boundary.
- Storage key helpers.
- Presigned upload/download URL helpers.
- Public/CDN URL construction.
- Small direct file reads for previews.
- Future artifact storage adapter surface.

What this package must not own:

- Artifact metadata model; future `@repo/artifacts` owns that.
- App route handlers.
- UI file rendering.
- Provider credentials outside package-local env validation.
- Vercel Blob migration decision without a separate storage MADR.

## Current Surface

Exports:

- `getStorageConfig`
- `getStorageKey`
- `getVersionStorageKey`
- `calculateChecksum`
- `verifyChecksum`
- `uploadFile`
- `uploadPublicFile`
- `getPublicUrl`
- `getCdnUrl`
- `getPresignedUrl`
- `getPresignedUploadUrl`
- `deleteFile`
- `deleteFiles`
- `listFiles`
- `getFileContentHead`

Consumers:

- No active app/package imports found in the current reset shell.
- Database schemas store storage keys, but do not import this package.

Provider SDKs:

- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`

Env keys:

- `AWS_REGION`
- `S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_ENDPOINT`
- `CDN_URL`

## Sources Checked

| Source                                                                                                           | Type               | Checked Date | Claim Used                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | ------------------ | -----------: | ------------------------------------------------------------------------------------------------------------------------------ |
| https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html               | Official docs      |   2026-05-26 | Use AWS SDK for JavaScript v3 clients and commands for S3 operations.                                                          |
| https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeletingObjects.html                                       | Official docs      |   2026-05-26 | `DeleteObjects` can delete up to 1,000 objects in one request.                                                                 |
| https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectsV2.html                                           | Official docs      |   2026-05-26 | List pagination uses continuation tokens / next continuation token.                                                            |
| https://vercel.com/docs/vercel-blob                                                                              | Official docs      |   2026-05-26 | Vercel Blob is a potential future provider; do not migrate during this package cleanup without a separate decision.            |
| `pnpm view @aws-sdk/client-s3 version engines peerDependencies --registry https://registry.npmjs.org`            | Registry metadata  |   2026-05-26 | Latest `@aws-sdk/client-s3` is `3.1054.0`; installed package matches and requires Node `>=20.0.0`.                             |
| `pnpm view @aws-sdk/s3-request-presigner version engines peerDependencies --registry https://registry.npmjs.org` | Registry metadata  |   2026-05-26 | Latest `@aws-sdk/s3-request-presigner` is `3.1054.0`; installed package matches and requires Node `>=20.0.0`.                  |
| `pnpm outdated -r`                                                                                               | Registry metadata  |   2026-05-26 | No outdated dependencies after contracts deletion and lock refresh.                                                            |
| `packages/storage/**` local audit                                                                                | Local source/types |   2026-05-26 | `deleteFiles` did not chunk >1,000 keys; `listFiles` only returned first page; public URL helpers did not encode key segments. |

## Local Audit

Commands:

```bash
find packages/storage -maxdepth 3 -type f | sort
rg -n "@repo/storage|@aws-sdk/client-s3|@aws-sdk/s3-request-presigner|S3Client|presign|storage" apps packages --glob '!node_modules/**' --glob '!legacy/**'
pnpm --filter @repo/storage typecheck
```

Findings:

- No active app imports; package is ready for future artifact/file rendering work.
- Env validation is package-local through T3 Env and does not force app boot to require storage secrets.
- The S3 SDK versions are current.
- `deleteFiles` must chunk requests to respect S3's 1,000-object limit.
- `listFiles` must paginate with continuation tokens.
- URL helpers should encode key path segments and normalize trailing slashes.

## Decision

Verdict: keep and refactor lightly

Reason:

- The platform needs object storage for artifacts, file previews, generated assets, and future workflow run outputs.
- AWS S3-compatible storage is acceptable for now and already package-isolated.
- Vercel Blob may be evaluated later, but switching providers now would be premature because artifact ownership is not built yet.

## Refactor Checklist

- [x] Preserve package-local T3 Env boundary.
- [x] Add safe URL key encoding helper.
- [x] Normalize CDN/endpoint URL joins.
- [x] Chunk `deleteFiles` into S3-compatible 1,000-key requests.
- [x] Paginate `listFiles` through `NextContinuationToken`.
- [x] Keep no app imports or route logic in package.
- [x] Run package typecheck.
- [x] Run active package/app/graph validation after refactor.

## Validation

```bash
pnpm --filter @repo/storage typecheck
pnpm --filter "./packages/*" typecheck
pnpm --filter app --filter web typecheck
pnpm boundaries:cruise
```

Result:

- `pnpm --filter @repo/storage typecheck` passed.
- `pnpm --filter "./packages/*" typecheck` passed.
- `pnpm test` passed: 2 files, 14 tests.
- `pnpm --filter app --filter web typecheck` passed.
- `pnpm boundaries:cruise` passed with 0 errors and 0 warnings.

## Open Risks

- No storage tests exist yet. Add tests when artifact APIs are introduced or when a provider mock strategy is selected.
- Vercel Blob migration requires a separate MADR because it changes env, provider capabilities, and deployment coupling.
