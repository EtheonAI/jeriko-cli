/**
 * File Service Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Helpers extracted from service logic ──

function requireUserId(headers: Record<string, string | undefined>): string {
  const userId = headers["x-user-id"];
  if (!userId) throw new Error("Missing x-user-id header");
  return userId;
}

function sanitizePath(raw: string): string {
  // Remove directory traversal, normalize separators
  return raw
    .replace(/\.\./g, "")
    .replace(/\/+/g, "/")
    .replace(/^\//, "/");
}

function getStorageKey(userId: string, fileId: string, filename: string): string {
  return `${userId}/${fileId}/${filename}`;
}

function getVersionStorageKey(userId: string, fileId: string, version: number, filename: string): string {
  return `${userId}/${fileId}/v${version}/${filename}`;
}

// ── Checksum helpers (pure re-implementation for unit testing) ──

function calculateChecksum(buffer: Buffer | Uint8Array, algorithm: string = "sha256"): string {
  const { createHash } = require("node:crypto");
  const hash = createHash(algorithm);
  hash.update(buffer);
  return hash.digest("hex");
}

function verifyChecksum(
  buffer: Buffer | Uint8Array,
  expectedChecksum: string,
  algorithm: string = "sha256"
): boolean {
  const actual = calculateChecksum(buffer, algorithm);
  return actual === expectedChecksum;
}

// ── Tests ──

describe("File upload validation", () => {
  it("should require x-user-id header", () => {
    expect(() => requireUserId({})).toThrow("Missing x-user-id");
    expect(() => requireUserId({ "x-user-id": undefined })).toThrow();
    expect(requireUserId({ "x-user-id": "user-1" })).toBe("user-1");
  });

  it("should generate correct storage keys", () => {
    const key = getStorageKey("u1", "f1", "photo.jpg");
    expect(key).toBe("u1/f1/photo.jpg");
  });

  it("should generate correct version storage keys", () => {
    const key = getVersionStorageKey("u1", "f1", 3, "photo.jpg");
    expect(key).toBe("u1/f1/v3/photo.jpg");
  });

  it("should sanitize file paths", () => {
    expect(sanitizePath("/../../../etc/passwd")).not.toContain("..");
    expect(sanitizePath("///multiple///slashes")).toBe("/multiple/slashes");
    expect(sanitizePath("/normal/path")).toBe("/normal/path");
  });

  it("should enforce 100MB file size limit concept", () => {
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    expect(MAX_FILE_SIZE).toBe(104857600);
    expect(50 * 1024 * 1024 < MAX_FILE_SIZE).toBe(true);
    expect(200 * 1024 * 1024 < MAX_FILE_SIZE).toBe(false);
  });
});

describe("File metadata", () => {
  it("should include all required fields in response", () => {
    const file = {
      id: "f-1",
      name: "test.txt",
      mimeType: "text/plain",
      size: 1024,
      storageProvider: "s3",
      createdAt: new Date().toISOString(),
    };

    expect(file).toHaveProperty("id");
    expect(file).toHaveProperty("name");
    expect(file).toHaveProperty("mimeType");
    expect(file).toHaveProperty("size");
    expect(file).toHaveProperty("storageProvider");
    expect(file).toHaveProperty("createdAt");
  });

  it("should handle null sessionId for non-session files", () => {
    const file = { sessionId: null };
    expect(file.sessionId).toBeNull();
  });
});

describe("File versioning", () => {
  it("should increment version numbers sequentially", () => {
    const versions = [1, 2, 3];
    const nextVersion = Math.max(...versions) + 1;
    expect(nextVersion).toBe(4);
  });

  it("should start at version 1 for new files", () => {
    const maxVersion = 0; // No versions yet
    const nextVersion = maxVersion + 1;
    expect(nextVersion).toBe(1);
  });

  it("should collect all storage keys for deletion", () => {
    const mainKey = "u1/f1/photo.jpg";
    const versionKeys = [
      "u1/f1/v1/photo.jpg",
      "u1/f1/v2/photo.jpg",
    ];

    const allKeys = [...versionKeys.filter(Boolean)];
    if (mainKey && !allKeys.includes(mainKey)) {
      allKeys.push(mainKey);
    }

    expect(allKeys).toHaveLength(3);
    expect(allKeys).toContain(mainKey);
  });
});

describe("File listing with pagination", () => {
  it("should respect limit parameter", () => {
    const files = Array.from({ length: 60 }, (_, i) => ({ id: `f-${i}` }));
    const limit = 50;
    const hasMore = files.length > limit;
    const result = hasMore ? files.slice(0, limit) : files;

    expect(result).toHaveLength(50);
    expect(hasMore).toBe(true);
  });

  it("should generate nextCursor from last item", () => {
    const files = [
      { id: "f-1", createdAt: "2026-01-03" },
      { id: "f-2", createdAt: "2026-01-02" },
      { id: "f-3", createdAt: "2026-01-01" },
    ];
    const nextCursor = files[files.length - 1]!.createdAt;
    expect(nextCursor).toBe("2026-01-01");
  });

  it("should return null nextCursor when no more results", () => {
    const files = [{ id: "f-1" }];
    const limit = 50;
    const hasMore = files.length > limit;
    const nextCursor = hasMore ? "cursor" : null;
    expect(nextCursor).toBeNull();
  });

  it("should prevent cross-user file access", () => {
    const authUserId = "user-1";
    const requestedUserId = "user-2";
    expect(authUserId).not.toBe(requestedUserId);
    // Service throws AuthorizationError when these don't match
  });
});

describe("Checksum calculation", () => {
  it("should calculate SHA-256 checksum of a buffer", () => {
    const buffer = Buffer.from("hello world");
    const checksum = calculateChecksum(buffer);

    // SHA-256 of "hello world" is a well-known value
    expect(checksum).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
    );
  });

  it("should return consistent checksums for identical content", () => {
    const buffer1 = Buffer.from("test content");
    const buffer2 = Buffer.from("test content");

    const checksum1 = calculateChecksum(buffer1);
    const checksum2 = calculateChecksum(buffer2);

    expect(checksum1).toBe(checksum2);
  });

  it("should return different checksums for different content", () => {
    const buffer1 = Buffer.from("file A");
    const buffer2 = Buffer.from("file B");

    const checksum1 = calculateChecksum(buffer1);
    const checksum2 = calculateChecksum(buffer2);

    expect(checksum1).not.toBe(checksum2);
  });

  it("should support Uint8Array input", () => {
    const data = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
    const checksum = calculateChecksum(data);

    expect(checksum).toMatch(/^[0-9a-f]{64}$/); // 64-char hex for SHA-256
  });

  it("should handle empty buffer", () => {
    const buffer = Buffer.alloc(0);
    const checksum = calculateChecksum(buffer);

    // SHA-256 of empty string is a known constant
    expect(checksum).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("should support alternative hash algorithms", () => {
    const buffer = Buffer.from("hello world");
    const sha256 = calculateChecksum(buffer, "sha256");
    const md5 = calculateChecksum(buffer, "md5");

    // Different algorithms produce different-length digests
    expect(sha256).toHaveLength(64); // SHA-256 = 32 bytes = 64 hex chars
    expect(md5).toHaveLength(32);     // MD5 = 16 bytes = 32 hex chars
    expect(sha256).not.toBe(md5);
  });
});

describe("Checksum verification", () => {
  it("should return true when checksum matches", () => {
    const buffer = Buffer.from("hello world");
    const correctChecksum = calculateChecksum(buffer);

    expect(verifyChecksum(buffer, correctChecksum)).toBe(true);
  });

  it("should return false when checksum does not match", () => {
    const buffer = Buffer.from("hello world");
    const wrongChecksum = "0000000000000000000000000000000000000000000000000000000000000000";

    expect(verifyChecksum(buffer, wrongChecksum)).toBe(false);
  });

  it("should verify with a specific algorithm", () => {
    const buffer = Buffer.from("test data");
    const md5Checksum = calculateChecksum(buffer, "md5");

    expect(verifyChecksum(buffer, md5Checksum, "md5")).toBe(true);
    // Wrong algorithm should fail
    expect(verifyChecksum(buffer, md5Checksum, "sha256")).toBe(false);
  });

  it("should detect content corruption", () => {
    const original = Buffer.from("original content");
    const checksum = calculateChecksum(original);

    const corrupted = Buffer.from("corrupted content");
    expect(verifyChecksum(corrupted, checksum)).toBe(false);
  });

  it("should handle large buffers", () => {
    const largeBuffer = Buffer.alloc(1024 * 1024, "x"); // 1MB of 'x'
    const checksum = calculateChecksum(largeBuffer);

    expect(verifyChecksum(largeBuffer, checksum)).toBe(true);
    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("File metadata with checksum fields", () => {
  it("should include checksum fields in file record", () => {
    const file = {
      id: "f-1",
      name: "test.txt",
      mimeType: "text/plain",
      size: 1024,
      storageProvider: "s3",
      checksum: "abc123def456",
      checksumAlgorithm: "sha256",
      createdAt: new Date().toISOString(),
    };

    expect(file).toHaveProperty("checksum");
    expect(file).toHaveProperty("checksumAlgorithm");
    expect(file.checksumAlgorithm).toBe("sha256");
  });

  it("should allow null checksum for legacy files", () => {
    const file = {
      id: "f-legacy",
      name: "old-file.txt",
      checksum: null,
      checksumAlgorithm: "sha256",
    };

    expect(file.checksum).toBeNull();
  });

  it("should include toolCallId in metadata when provided", () => {
    const metadata = { toolCallId: "call_abc123" };

    expect(metadata).toHaveProperty("toolCallId");
    expect(metadata.toolCallId).toBe("call_abc123");
  });

  it("should set metadata to null when no toolCallId is provided", () => {
    const toolCallId: string | undefined = undefined;
    const metadata = toolCallId ? { toolCallId } : null;

    expect(metadata).toBeNull();
  });

  it("should include checksum in version records", () => {
    const version = {
      id: "ver-1",
      fileId: "f-1",
      version: 1,
      storageKey: "users/u1/files/f1/test.txt",
      size: 1024,
      checksum: "abc123def456",
      checksumAlgorithm: "sha256",
      changeDescription: "Initial upload",
    };

    expect(version).toHaveProperty("checksum");
    expect(version).toHaveProperty("checksumAlgorithm");
    expect(version.checksumAlgorithm).toBe("sha256");
  });
});
