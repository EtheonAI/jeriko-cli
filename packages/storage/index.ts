import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
import { getStorageConfig, type StorageConfig } from "./keys";

export { getStorageConfig, type StorageConfig } from "./keys";

const S3_DELETE_OBJECTS_LIMIT = 1000;

let _client: S3Client | null = null;
let _config: StorageConfig | null = null;

function getClient(): S3Client {
  if (!_client) {
    _config = getStorageConfig();
    _client = new S3Client({
      region: _config.region,
      ...(_config.endpoint ? { endpoint: _config.endpoint } : {}),
      forcePathStyle: _config.forcePathStyle,
      ...(_config.accessKeyId && _config.secretAccessKey
        ? {
            credentials: {
              accessKeyId: _config.accessKeyId,
              secretAccessKey: _config.secretAccessKey,
            },
          }
        : {}),
    });
  }
  return _client;
}

function getBucket(): string {
  if (!_config) {
    _config = getStorageConfig();
  }
  return _config.bucket;
}

/** Generate a consistent S3 key path for a file */
export function getStorageKey(userId: string, fileId: string, filename: string): string {
  return `users/${userId}/files/${fileId}/${filename}`;
}

/** Generate an S3 key for a specific file version */
export function getVersionStorageKey(
  userId: string,
  fileId: string,
  version: number,
  filename: string
): string {
  return `users/${userId}/files/${fileId}/v${version}/${filename}`;
}

/** Calculate SHA-256 checksum of file buffer */
export function calculateChecksum(
  buffer: Buffer | Uint8Array,
  algorithm: string = "sha256"
): string {
  const hash = createHash(algorithm);
  hash.update(buffer);
  return hash.digest("hex");
}

/** Verify file checksum matches expected value */
export function verifyChecksum(
  buffer: Buffer | Uint8Array,
  expectedChecksum: string,
  algorithm: string = "sha256"
): boolean {
  const actualChecksum = calculateChecksum(buffer, algorithm);
  return actualChecksum === expectedChecksum;
}

/** Upload a file to S3 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | ReadableStream,
  contentType?: string,
  metadata?: Record<string, string>
): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    })
  );
}

/**
 * Upload a file for permanent public hosting.
 * Assumes public access is controlled by bucket policy or CDN configuration.
 * Returns the permanent public URL (CDN preferred, then direct S3 URL).
 */
export async function uploadPublicFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType?: string
): Promise<string> {
  const client = getClient();
  const config = getConfig();
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return getPublicUrl(key);
}

/**
 * Get a permanent public URL for an S3 key.
 * CDN → S3-compatible endpoint → AWS virtual-hosted style.
 */
export function getPublicUrl(key: string): string {
  const config = getConfig();
  if (config.cdnUrl) {
    return joinUrlPath(config.cdnUrl, key);
  }
  if (config.endpoint) {
    return config.forcePathStyle
      ? joinUrlPath(config.endpoint, config.bucket, key)
      : joinUrlPath(config.endpoint, key);
  }
  return joinUrlPath(`https://${config.bucket}.s3.${config.region}.amazonaws.com`, key);
}

/** Get the raw storage config (for building URLs) */
function getConfig(): StorageConfig {
  if (!_config) {
    _config = getStorageConfig();
  }
  return _config;
}

/** Get CDN URL if configured, otherwise return null */
export function getCdnUrl(key: string): string | null {
  if (!_config) {
    _config = getStorageConfig();
  }
  if (_config.cdnUrl) {
    return joinUrlPath(_config.cdnUrl, key);
  }
  return null;
}

/** Generate a presigned download URL or CDN URL for public files */
export async function getPresignedUrl(
  key: string,
  expiresIn: number = 3600,
  isPublic: boolean = false
): Promise<string> {
  // For public files, prefer CDN URL if available
  if (isPublic) {
    const cdnUrl = getCdnUrl(key);
    if (cdnUrl) {
      return cdnUrl;
    }
  }

  // Fall back to presigned S3 URL
  const client = getClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
    { expiresIn }
  );
}

/** Generate a presigned upload (PUT) URL for direct S3 uploads */
export async function getPresignedUploadUrl(
  key: string,
  contentType?: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getClient();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ...(contentType ? { ContentType: contentType } : {}),
    }),
    { expiresIn }
  );
}

/** Delete a single file from S3 */
export async function deleteFile(key: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
}

/** Delete multiple files from S3 in a single request */
export async function deleteFiles(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const client = getClient();
  const bucket = getBucket();

  for (let index = 0; index < keys.length; index += S3_DELETE_OBJECTS_LIMIT) {
    const chunk = keys.slice(index, index + S3_DELETE_OBJECTS_LIMIT);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
        },
      })
    );
  }
}

/** List files under a prefix */
export async function listFiles(
  prefix: string
): Promise<{ key: string; size: number; lastModified: Date }[]> {
  const client = getClient();
  const bucket = getBucket();
  const files: { key: string; size: number; lastModified: Date }[] = [];
  let continuationToken: string | undefined;

  do {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
      })
    );

    for (const obj of result.Contents ?? []) {
      if (!obj.Key) {
        continue;
      }
      files.push({
        key: obj.Key,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ?? new Date(),
      });
    }

    continuationToken = result.NextContinuationToken;
  } while (continuationToken);

  return files;
}

/** Fetch the first N bytes of a file directly from S3 (no presigned URL round-trip) */
export async function getFileContentHead(
  key: string,
  maxBytes: number = 3072
): Promise<string | null> {
  const client = getClient();
  try {
    const result = await client.send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
        Range: `bytes=0-${maxBytes - 1}`,
      })
    );
    if (!result.Body) return null;
    return result.Body.transformToString("utf-8");
  } catch {
    return null;
  }
}

function joinUrlPath(baseUrl: string, ...segments: string[]): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const encodedSegments = segments
    .filter((segment) => segment.length > 0)
    .map(encodeStorageKey)
    .join("/");

  return encodedSegments ? `${normalizedBaseUrl}/${encodedSegments}` : normalizedBaseUrl;
}

function encodeStorageKey(key: string): string {
  return key
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(encodeURIComponent)
    .join("/");
}
