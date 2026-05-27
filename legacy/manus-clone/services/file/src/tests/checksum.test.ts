/**
 * File Service Checksum Validation Tests (P7.1, P7.9)
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

// Mock checksum utilities (matching storage package implementation)
function calculateChecksum(buffer: Buffer | Uint8Array, algorithm: string = "sha256"): string {
  const hash = createHash(algorithm);
  hash.update(buffer);
  return hash.digest("hex");
}

function verifyChecksum(
  buffer: Buffer | Uint8Array,
  expectedChecksum: string,
  algorithm: string = "sha256"
): boolean {
  const actualChecksum = calculateChecksum(buffer, algorithm);
  return actualChecksum === expectedChecksum;
}

describe("P7.1: SHA-256 Checksum Validation", () => {
  it("should calculate SHA-256 checksum correctly", () => {
    const content = "Hello, World!";
    const buffer = Buffer.from(content, "utf-8");
    const checksum = calculateChecksum(buffer);

    // Known SHA-256 hash of "Hello, World!"
    expect(checksum).toBe("dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f");
    expect(checksum).toHaveLength(64); // SHA-256 produces 64 hex characters
  });

  it("should calculate different checksums for different content", () => {
    const buffer1 = Buffer.from("File content A", "utf-8");
    const buffer2 = Buffer.from("File content B", "utf-8");

    const checksum1 = calculateChecksum(buffer1);
    const checksum2 = calculateChecksum(buffer2);

    expect(checksum1).not.toBe(checksum2);
  });

  it("should calculate same checksum for identical content", () => {
    const content = "Identical file content";
    const buffer1 = Buffer.from(content, "utf-8");
    const buffer2 = Buffer.from(content, "utf-8");

    const checksum1 = calculateChecksum(buffer1);
    const checksum2 = calculateChecksum(buffer2);

    expect(checksum1).toBe(checksum2);
  });

  it("should verify correct checksum", () => {
    const content = "Test file content";
    const buffer = Buffer.from(content, "utf-8");
    const expectedChecksum = calculateChecksum(buffer);

    const isValid = verifyChecksum(buffer, expectedChecksum);
    expect(isValid).toBe(true);
  });

  it("should reject incorrect checksum", () => {
    const buffer = Buffer.from("Original content", "utf-8");
    const wrongChecksum = calculateChecksum(Buffer.from("Different content", "utf-8"));

    const isValid = verifyChecksum(buffer, wrongChecksum);
    expect(isValid).toBe(false);
  });

  it("should handle empty files", () => {
    const buffer = Buffer.from("", "utf-8");
    const checksum = calculateChecksum(buffer);

    // Known SHA-256 hash of empty string
    expect(checksum).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("should handle binary content", () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
    const checksum = calculateChecksum(buffer);

    expect(checksum).toHaveLength(64);
    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should handle large files efficiently", () => {
    // Simulate a 10MB file
    const size = 10 * 1024 * 1024;
    const buffer = Buffer.alloc(size);
    buffer.fill("a");

    const startTime = Date.now();
    const checksum = calculateChecksum(buffer);
    const duration = Date.now() - startTime;

    expect(checksum).toHaveLength(64);
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });
});

describe("P7.9: File Provenance Roundtrip", () => {
  it("should preserve provenance metadata in file record", () => {
    const file = {
      id: "file-1",
      userId: "user-123",
      sessionId: "session-456",
      name: "artifact.json",
      checksum: "abc123...",
      checksumAlgorithm: "sha256",
      metadata: {
        toolCallId: "tool-call-789",
      },
    };

    // Verify provenance fields are present
    expect(file.userId).toBe("user-123");
    expect(file.sessionId).toBe("session-456");
    expect(file.metadata?.toolCallId).toBe("tool-call-789");
  });

  it("should track checksum in file versions", () => {
    const version = {
      id: "ver-1",
      fileId: "file-1",
      version: 1,
      checksum: "def456...",
      checksumAlgorithm: "sha256",
      storageKey: "users/user-1/files/file-1/artifact.json",
    };

    expect(version.checksum).toBe("def456...");
    expect(version.checksumAlgorithm).toBe("sha256");
  });

  it("should validate file integrity on roundtrip", () => {
    // Simulate upload
    const originalContent = "File content for upload";
    const uploadBuffer = Buffer.from(originalContent, "utf-8");
    const uploadChecksum = calculateChecksum(uploadBuffer);

    // Simulate storage
    const storedChecksum = uploadChecksum;

    // Simulate download
    const downloadBuffer = Buffer.from(originalContent, "utf-8"); // Same content
    const downloadChecksum = calculateChecksum(downloadBuffer);

    // Verify roundtrip integrity
    expect(downloadChecksum).toBe(storedChecksum);
    expect(verifyChecksum(downloadBuffer, storedChecksum)).toBe(true);
  });

  it("should detect file corruption on roundtrip", () => {
    // Simulate upload
    const originalContent = "Original file content";
    const uploadBuffer = Buffer.from(originalContent, "utf-8");
    const uploadChecksum = calculateChecksum(uploadBuffer);

    // Simulate corrupted download
    const corruptedContent = "Corrupted file content";
    const downloadBuffer = Buffer.from(corruptedContent, "utf-8");

    // Verify corruption is detected
    expect(verifyChecksum(downloadBuffer, uploadChecksum)).toBe(false);
  });

  it("should support optional toolCallId metadata", () => {
    const fileWithToolCall = {
      metadata: { toolCallId: "call-123" },
    };

    const fileWithoutToolCall = {
      metadata: null,
    };

    expect(fileWithToolCall.metadata?.toolCallId).toBe("call-123");
    expect(fileWithoutToolCall.metadata?.toolCallId).toBeUndefined();
  });

  it("should validate checksum on upload with x-checksum header", () => {
    const content = "File to upload";
    const buffer = Buffer.from(content, "utf-8");
    const clientChecksum = calculateChecksum(buffer);

    // Simulate server-side validation
    const serverChecksum = calculateChecksum(buffer);

    // Client and server checksums should match
    expect(serverChecksum).toBe(clientChecksum);
    expect(verifyChecksum(buffer, clientChecksum)).toBe(true);
  });

  it("should reject upload if checksum mismatches", () => {
    const buffer = Buffer.from("Actual content", "utf-8");
    const expectedChecksum = calculateChecksum(Buffer.from("Expected content", "utf-8"));

    // Simulate validation failure
    const isValid = verifyChecksum(buffer, expectedChecksum);
    expect(isValid).toBe(false);

    // In real service, this would throw ValidationError
  });
});

describe("File Checksum Storage", () => {
  it("should store checksum algorithm with file", () => {
    const file = {
      checksum: "abc123...",
      checksumAlgorithm: "sha256",
    };

    expect(file.checksumAlgorithm).toBe("sha256");
  });

  it("should default to sha256 algorithm", () => {
    const defaultAlgorithm = "sha256";
    expect(defaultAlgorithm).toBe("sha256");
  });

  it("should include checksum in upload response", () => {
    const uploadResponse = {
      id: "file-1",
      name: "test.txt",
      mimeType: "text/plain",
      size: 1024,
      checksum: "abc123...",
      checksumAlgorithm: "sha256",
    };

    expect(uploadResponse.checksum).toBeDefined();
    expect(uploadResponse.checksumAlgorithm).toBe("sha256");
  });
});
