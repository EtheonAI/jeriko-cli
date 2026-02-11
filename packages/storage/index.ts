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
export function calculateChecksum(buffer: Buffer | Uint8Array, algorithm: string = "sha256"): string {
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

/** Get CDN URL if configured, otherwise return null */
export function getCdnUrl(key: string): string | null {
  if (!_config) {
    _config = getStorageConfig();
  }
  if (_config.cdnUrl) {
    return `${_config.cdnUrl}/${key}`;
  }
  return null;
}

/** Generate a presigned download URL or CDN URL for public files */
export async function getPresignedUrl(key: string, expiresIn: number = 3600, isPublic: boolean = false): Promise<string> {
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
  await client.send(
    new DeleteObjectsCommand({
      Bucket: getBucket(),
      Delete: {
        Objects: keys.map((Key) => ({ Key })),
      },
    })
  );
}

/** List files under a prefix */
export async function listFiles(
  prefix: string
): Promise<{ key: string; size: number; lastModified: Date }[]> {
  const client = getClient();
  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: getBucket(),
      Prefix: prefix,
    })
  );
  return (result.Contents ?? []).map((obj) => ({
    key: obj.Key!,
    size: obj.Size ?? 0,
    lastModified: obj.LastModified ?? new Date(),
  }));
}
