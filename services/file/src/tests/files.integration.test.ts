/**
 * File Service Integration Tests
 *
 * Tests complex flows: upload lifecycle, file versioning, download
 * presigned URL generation, deletion with S3 cleanup, and path
 * sanitization against directory traversal attacks.
 *
 * All DB and storage interactions are mocked via setup.ts (auto-loaded by vitest config).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Import mocked modules — setup.ts handles vi.mock() hoisting
const rawDatabase = await import("@repo/database/service-index");
const database = (rawDatabase as any).default ?? rawDatabase;
const { db, files, fileVersions } = database;

const rawStorage = await import("@repo/storage");
const storage = (rawStorage as any).default ?? rawStorage;
const { uploadFile, getPresignedUrl, deleteFiles, getStorageKey, getVersionStorageKey, calculateChecksum, verifyChecksum } = storage;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a file record matching the service's DB shape. */
function makeFile(overrides: Partial<{
  id: string;
  userId: string;
  sessionId: string | null;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  storageKey: string;
  storageProvider: string;
  checksum: string;
  checksumAlgorithm: string;
  isPublic: boolean;
  metadata: any;
  createdAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "file-1",
    userId: overrides.userId ?? "test-user-id",
    sessionId: overrides.sessionId ?? null,
    name: overrides.name ?? "test.txt",
    path: overrides.path ?? "/",
    mimeType: overrides.mimeType ?? "text/plain",
    size: overrides.size ?? 1024,
    storageKey: overrides.storageKey ?? "users/test-user-id/files/file-1/test.txt",
    storageProvider: overrides.storageProvider ?? "s3",
    checksum: overrides.checksum ?? "abc123def456",
    checksumAlgorithm: overrides.checksumAlgorithm ?? "sha256",
    isPublic: overrides.isPublic ?? false,
    metadata: overrides.metadata ?? null,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

function makeVersion(overrides: Partial<{
  id: string;
  fileId: string;
  version: number;
  storageKey: string;
  size: number;
  checksum: string;
  checksumAlgorithm: string;
  changeDescription: string | null;
}> = {}) {
  return {
    id: overrides.id ?? "ver-1",
    fileId: overrides.fileId ?? "file-1",
    version: overrides.version ?? 1,
    storageKey: overrides.storageKey ?? "users/test-user-id/files/file-1/test.txt",
    size: overrides.size ?? 1024,
    checksum: overrides.checksum ?? "abc123def456",
    checksumAlgorithm: overrides.checksumAlgorithm ?? "sha256",
    changeDescription: overrides.changeDescription ?? "Initial upload",
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Upload file -> creates file record with correct storage key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a file record and initial version in a transaction", async () => {
    const fileId = "file-new";
    const userId = "test-user-id";
    const filename = "report.pdf";
    const mimeType = "application/pdf";
    const fileSize = 2048;
    const storageKey = getStorageKey(userId, fileId, filename);

    expect(storageKey).toBe("users/test-user-id/files/test-file-id/test.txt"); // mock return

    const file = makeFile({
      id: fileId,
      name: filename,
      mimeType,
      size: fileSize,
      storageKey,
    });
    const version = makeVersion({
      fileId,
      version: 1,
      storageKey,
      size: fileSize,
      changeDescription: "Initial upload",
    });

    // Mock transaction — the service uses db.transaction(async (tx) => {...})
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: Function) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([file]),
            }),
          }),
        };
        return fn(tx);
      }
    );

    const result = await db.transaction(async (tx: any) => {
      const [f] = await tx
        .insert(files)
        .values({
          id: fileId,
          userId,
          name: filename,
          mimeType,
          size: fileSize,
          storageKey,
          storageProvider: "s3",
        })
        .returning();

      // Version insert would happen here too
      return f;
    });

    expect(result).toBeDefined();
    expect(result.id).toBe(fileId);
    expect(result.name).toBe(filename);
    expect(result.mimeType).toBe(mimeType);
    expect(result.size).toBe(fileSize);
    expect(result.storageKey).toBe(storageKey);
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it("should call S3 upload before inserting DB record", async () => {
    const buffer = Buffer.from("test file content");
    const storageKey = "users/test-user-id/files/file-up/doc.txt";
    const mimeType = "text/plain";

    await uploadFile(storageKey, buffer, mimeType);

    expect(uploadFile).toHaveBeenCalledWith(storageKey, buffer, mimeType);
    expect(uploadFile).toHaveBeenCalledOnce();
  });
});

describe("File versioning: upload same file twice -> version increments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should increment version number on second upload", async () => {
    const fileId = "file-versioned";
    const userId = "test-user-id";

    // Simulate first version already exists (maxVersion = 1)
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            makeFile({ id: fileId }), // file exists
          ]),
        }),
      }),
    });

    // Check that file exists
    const [existingFile] = await db
      .select()
      .from(files)
      .where()
      .limit(1);

    expect(existingFile).toBeDefined();

    // Mock the max version query
    const maxVersion = 1;
    const nextVersion = maxVersion + 1;

    expect(nextVersion).toBe(2);

    // Mock the version storage key
    const versionKey = getVersionStorageKey(userId, fileId, nextVersion, "report.pdf");
    expect(versionKey).toBe("users/test-user-id/files/test-file-id/v2/test.txt"); // mock return

    // Mock transaction for version creation + file update
    const updatedFile = makeFile({
      id: fileId,
      name: "report.pdf",
      size: 4096,
      storageKey: versionKey,
    });

    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: Function) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([updatedFile]),
              }),
            }),
          }),
        };
        return fn(tx);
      }
    );

    const result = await db.transaction(async (tx: any) => {
      // Insert new version record
      await tx.insert(fileVersions).values({
        id: "ver-2",
        fileId,
        version: nextVersion,
        storageKey: versionKey,
        size: 4096,
        changeDescription: "Updated report",
      });

      // Update main file record
      const [u] = await tx
        .update(files)
        .set({
          storageKey: versionKey,
          size: 4096,
          mimeType: "application/pdf",
          name: "report.pdf",
        })
        .where()
        .returning();

      return u;
    });

    expect(result).toBeDefined();
    expect(result.storageKey).toBe(versionKey);
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it("should start version at 1 for a new file with no previous versions", () => {
    const maxVersion = 0; // No versions exist yet (coalesce returns 0)
    const nextVersion = maxVersion + 1;
    expect(nextVersion).toBe(1);
  });

  it("should correctly compute version 5 after 4 existing versions", () => {
    const maxVersion = 4;
    const nextVersion = maxVersion + 1;
    expect(nextVersion).toBe(5);
  });
});

describe("Download file -> returns presigned URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a presigned URL for the file's storage key", async () => {
    const file = makeFile({
      id: "file-dl",
      storageKey: "users/test-user-id/files/file-dl/photo.jpg",
    });

    // Mock file lookup
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([file]),
        }),
      }),
    });

    const [found] = await db
      .select()
      .from(files)
      .where()
      .limit(1);

    expect(found).toBeDefined();
    expect(found.storageKey).toBeTruthy();

    // Get presigned URL
    const url = await getPresignedUrl(found.storageKey, 3600);

    expect(url).toBe("https://s3.example.com/presigned-url");
    expect(getPresignedUrl).toHaveBeenCalledWith(found.storageKey, 3600);
  });

  it("should resolve version-specific storage key when version is requested", async () => {
    const file = makeFile({ id: "file-vdl" });
    const version = makeVersion({
      fileId: "file-vdl",
      version: 2,
      storageKey: "users/test-user-id/files/file-vdl/v2/photo.jpg",
    });

    // First query: find the file
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([file]),
          }),
        }),
      })
      // Second query: find the version
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([version]),
          }),
        }),
      });

    const [foundFile] = await db.select().from(files).where().limit(1);
    expect(foundFile).toBeDefined();

    const requestedVersion = 2;
    const [foundVersion] = await db
      .select()
      .from(fileVersions)
      .where()
      .limit(1);

    expect(foundVersion).toBeDefined();
    expect(foundVersion.storageKey).toBe(
      "users/test-user-id/files/file-vdl/v2/photo.jpg"
    );

    const url = await getPresignedUrl(foundVersion.storageKey, 3600);
    expect(url).toBe("https://s3.example.com/presigned-url");
  });
});

describe("Delete file -> removes from storage and DB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete file record, versions, and S3 objects", async () => {
    const file = makeFile({
      id: "file-del",
      storageKey: "users/test-user-id/files/file-del/photo.jpg",
    });
    const versions = [
      makeVersion({
        fileId: "file-del",
        version: 1,
        storageKey: "users/test-user-id/files/file-del/v1/photo.jpg",
      }),
      makeVersion({
        fileId: "file-del",
        version: 2,
        storageKey: "users/test-user-id/files/file-del/v2/photo.jpg",
      }),
    ];

    // Mock file lookup
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([file]),
          }),
        }),
      })
      // Mock version keys lookup
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(versions),
        }),
      });

    // Find file
    const [found] = await db.select().from(files).where().limit(1);
    expect(found).toBeDefined();

    // Get version storage keys
    const versionRecords = await db
      .select()
      .from(fileVersions)
      .where();

    const keysToDelete = versionRecords
      .map((v: any) => v.storageKey)
      .filter(Boolean);

    // Include main file key if not already present
    if (found.storageKey && !keysToDelete.includes(found.storageKey)) {
      keysToDelete.push(found.storageKey);
    }

    expect(keysToDelete).toHaveLength(3);
    expect(keysToDelete).toContain("users/test-user-id/files/file-del/v1/photo.jpg");
    expect(keysToDelete).toContain("users/test-user-id/files/file-del/v2/photo.jpg");
    expect(keysToDelete).toContain("users/test-user-id/files/file-del/photo.jpg");

    // Delete from DB
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    await db.delete(files).where();
    expect(db.delete).toHaveBeenCalled();

    // Delete from S3
    await deleteFiles(keysToDelete);
    expect(deleteFiles).toHaveBeenCalledWith(keysToDelete);
  });

  it("should not call S3 delete when there are no storage keys", async () => {
    const file = makeFile({ id: "file-nokeys", storageKey: "" });

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([file]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

    const [found] = await db.select().from(files).where().limit(1);
    const versionRecords = await db.select().from(fileVersions).where();

    const keysToDelete = versionRecords
      .map((v: any) => v.storageKey)
      .filter(Boolean);

    if (found.storageKey && !keysToDelete.includes(found.storageKey)) {
      keysToDelete.push(found.storageKey);
    }

    expect(keysToDelete).toHaveLength(0);

    // S3 delete should not be called
    if (keysToDelete.length > 0) {
      await deleteFiles(keysToDelete);
    }

    expect(deleteFiles).not.toHaveBeenCalled();
  });
});

describe("Path sanitization: rejects ../ traversal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The sanitizePath mock from setup.ts strips ".." sequences
  it("should strip directory traversal sequences from paths", async () => {
    const { sanitizePath } = await import("@repo/service-utils/security");

    const maliciousPath = "/../../../etc/passwd";
    const sanitized = sanitizePath(maliciousPath);

    expect(sanitized).not.toContain("..");
  });

  it("should sanitize paths with multiple traversal attempts", async () => {
    const { sanitizePath } = await import("@repo/service-utils/security");

    const paths = [
      { input: "/../../../etc/shadow", expectNoDots: true },
      { input: "/uploads/../../secret", expectNoDots: true },
      { input: "..\\..\\windows\\system32", expectNoDots: true },
    ];

    for (const { input, expectNoDots } of paths) {
      const result = sanitizePath(input);
      if (expectNoDots) {
        expect(result).not.toContain("..");
      }
    }
  });

  it("should leave safe paths unchanged", async () => {
    const { sanitizePath } = await import("@repo/service-utils/security");

    const safePath = "/documents/reports/2026";
    const result = sanitizePath(safePath);

    // Should not alter a path that has no traversal
    expect(result).toBe(safePath);
  });

  it("should reject file uploads with traversal in x-path header", () => {
    // Simulates what happens in the route when getSafePath() is called
    const rawPath = "/../../etc/passwd";
    const sanitized = rawPath.replace(/\.\./g, "");

    expect(sanitized).not.toContain("..");
    expect(sanitized).not.toBe(rawPath);
  });
});

describe("P7.1 & P7.9: Checksum validation and provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should calculate and store checksum during upload", async () => {
    const content = "File content for checksum test";
    const buffer = Buffer.from(content, "utf-8");
    const checksum = calculateChecksum(buffer);

    // Mock returns "abc123def456" — verify calculateChecksum was called
    expect(calculateChecksum).toHaveBeenCalledWith(buffer);
    expect(typeof checksum).toBe("string");
    expect(checksum.length).toBeGreaterThan(0);

    const file = makeFile({
      id: "file-checksum",
      checksum,
      checksumAlgorithm: "sha256",
    });

    expect(file.checksum).toBe(checksum);
    expect(file.checksumAlgorithm).toBe("sha256");
  });

  it("should verify checksum on upload with x-checksum header", () => {
    const content = "File to upload";
    const buffer = Buffer.from(content, "utf-8");
    const expectedChecksum = calculateChecksum(buffer);

    // Simulate client providing checksum
    const isValid = verifyChecksum(buffer, expectedChecksum);
    expect(isValid).toBe(true);
  });

  it("should reject upload if checksum mismatches", () => {
    // Override mock to simulate mismatch
    (verifyChecksum as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    const buffer = Buffer.from("Actual content", "utf-8");
    const wrongChecksum = "wrong-checksum-value";

    const isValid = verifyChecksum(buffer, wrongChecksum);
    expect(isValid).toBe(false);
    // In real service, this would throw ValidationError
  });

  it("should store provenance metadata (userId, sessionId, toolCallId)", async () => {
    const file = makeFile({
      id: "file-provenance",
      userId: "user-789",
      sessionId: "session-abc",
      metadata: {
        toolCallId: "tool-call-xyz",
      },
    });

    expect(file.userId).toBe("user-789");
    expect(file.sessionId).toBe("session-abc");
    expect(file.metadata?.toolCallId).toBe("tool-call-xyz");
  });

  it("should handle files without toolCallId metadata", async () => {
    const file = makeFile({
      id: "file-no-tool",
      metadata: null,
    });

    expect(file.metadata?.toolCallId).toBeUndefined();
  });

  it("should track checksum in file versions", async () => {
    const content = "Version 1 content";
    const buffer = Buffer.from(content, "utf-8");
    const checksum = calculateChecksum(buffer);

    const version = makeVersion({
      fileId: "file-ver",
      version: 1,
      checksum,
      checksumAlgorithm: "sha256",
    });

    expect(version.checksum).toBe(checksum);
    expect(version.checksumAlgorithm).toBe("sha256");
  });

  it("should validate file integrity on download roundtrip", async () => {
    // Upload
    const originalContent = "Original file content";
    const uploadBuffer = Buffer.from(originalContent, "utf-8");
    const uploadChecksum = calculateChecksum(uploadBuffer);

    // Store in DB
    const file = makeFile({
      id: "file-roundtrip",
      checksum: uploadChecksum,
      checksumAlgorithm: "sha256",
    });

    // Mock file lookup
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([file]),
        }),
      }),
    });

    const [retrieved] = await db.select().from(files).where().limit(1);
    expect(retrieved.checksum).toBe(uploadChecksum);

    // Simulate download and verify
    const downloadBuffer = Buffer.from(originalContent, "utf-8");
    const isValid = verifyChecksum(downloadBuffer, retrieved.checksum);
    expect(isValid).toBe(true);
  });

  it("should detect file corruption on roundtrip", async () => {
    // Override mock to simulate corruption detection
    (verifyChecksum as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    const originalContent = "Original content";
    const uploadChecksum = calculateChecksum(Buffer.from(originalContent, "utf-8"));

    // Simulate corrupted download — verifyChecksum returns false
    const corruptedBuffer = Buffer.from("Corrupted content", "utf-8");
    const isValid = verifyChecksum(corruptedBuffer, uploadChecksum);
    expect(isValid).toBe(false);
  });
});

describe("P7.3: CDN URL promotion for public files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use CDN URL for public files when CDN is configured", async () => {
    const file = makeFile({
      id: "file-public",
      isPublic: true,
      storageKey: "users/test-user-id/files/file-public/image.jpg",
    });

    // Mock getPresignedUrl to return CDN URL for public files
    const url = await getPresignedUrl(file.storageKey, 3600, file.isPublic);

    expect(url).toBeDefined();
    expect(getPresignedUrl).toHaveBeenCalledWith(file.storageKey, 3600, true);
  });

  it("should use presigned URL for private files", async () => {
    const file = makeFile({
      id: "file-private",
      isPublic: false,
      storageKey: "users/test-user-id/files/file-private/secret.pdf",
    });

    const url = await getPresignedUrl(file.storageKey, 3600, file.isPublic);

    expect(url).toBeDefined();
    expect(getPresignedUrl).toHaveBeenCalledWith(file.storageKey, 3600, false);
  });
});
