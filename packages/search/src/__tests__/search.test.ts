import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only (throws in client-side environments)
vi.mock("server-only", () => ({}));

// Mock the Typesense client
vi.mock("typesense", () => ({
  default: {
    Client: vi.fn().mockImplementation(() => ({
      collections: vi.fn(() => ({
        retrieve: vi.fn().mockResolvedValue({ num_documents: 0 }),
        documents: vi.fn(() => ({
          upsert: vi.fn().mockImplementation((doc) => Promise.resolve(doc)),
          delete: vi.fn().mockResolvedValue({ id: "test" }),
          search: vi.fn().mockResolvedValue({
            found: 0,
            hits: [],
          }),
          import: vi.fn().mockResolvedValue([{ success: true }]),
        })),
        create: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
      })),
      multiSearch: {
        perform: vi.fn().mockResolvedValue({
          results: [],
        }),
      },
      health: {
        retrieve: vi.fn().mockResolvedValue({ ok: true }),
      },
    })),
  },
}));

// Mock environment
vi.mock("../env", () => ({
  env: {
    TYPESENSE_HOST: "localhost",
    TYPESENSE_PORT: 8108,
    TYPESENSE_PROTOCOL: "http",
    TYPESENSE_API_KEY: "test-key",
  },
}));

describe("Search Package", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Types", () => {
    it("should export correct collection names", async () => {
      const { COLLECTION_NAMES } = await import("../types");
      expect(COLLECTION_NAMES.FILES).toBe("files");
      expect(COLLECTION_NAMES.SESSIONS).toBe("sessions");
      expect(COLLECTION_NAMES.TASKS).toBe("tasks");
      expect(COLLECTION_NAMES.PROJECTS).toBe("projects");
      expect(COLLECTION_NAMES.ACTIONS).toBe("actions");
    });
  });

  describe("Collections", () => {
    it("should have all collection schemas defined", async () => {
      const {
        filesCollectionSchema,
        sessionsCollectionSchema,
        tasksCollectionSchema,
        projectsCollectionSchema,
        actionsCollectionSchema,
      } = await import("../collections");

      expect(filesCollectionSchema.name).toBe("files");
      expect(sessionsCollectionSchema.name).toBe("sessions");
      expect(tasksCollectionSchema.name).toBe("tasks");
      expect(projectsCollectionSchema.name).toBe("projects");
      expect(actionsCollectionSchema.name).toBe("actions");
    });

    it("should have required fields in files schema", async () => {
      const { filesCollectionSchema } = await import("../collections");
      const fieldNames = filesCollectionSchema.fields.map((f) => f.name);

      expect(fieldNames).toContain("id");
      expect(fieldNames).toContain("userId");
      expect(fieldNames).toContain("name");
      expect(fieldNames).toContain("path");
    });
  });

  describe("Search Service", () => {
    it("should perform multi-collection search", async () => {
      const { search } = await import("../services/search-service");

      const results = await search({
        query: "test",
        userId: "user123",
      });

      expect(results).toHaveProperty("query", "test");
      expect(results).toHaveProperty("totalFound");
      expect(results).toHaveProperty("results");
      expect(results).toHaveProperty("processingTimeMs");
    });

    it("should filter by collection", async () => {
      const { search } = await import("../services/search-service");

      const results = await search({
        query: "test",
        userId: "user123",
        collections: ["files", "projects"],
      });

      expect(results).toHaveProperty("results");
    });
  });

  describe("Index Service", () => {
    it("should index a file document", async () => {
      const { indexFile } = await import("../services/index-service");

      const file = {
        id: "file123",
        userId: "user123",
        name: "test.txt",
        path: "/files/test.txt",
        isPublic: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = await indexFile(file);
      expect(result.id).toBe("file123");
    });

    it("should index a session document", async () => {
      const { indexSession } = await import("../services/index-service");

      const session = {
        id: "session123",
        userId: "user123",
        title: "Test Session",
        status: "active" as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = await indexSession(session);
      expect(result.id).toBe("session123");
    });

    it("should index a project document", async () => {
      const { indexProject } = await import("../services/index-service");

      const project = {
        id: "project123",
        userId: "user123",
        name: "Test Project",
        status: "active" as const,
        visibility: "private" as const,
        isPinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = await indexProject(project);
      expect(result.id).toBe("project123");
    });
  });

  describe("Health Check", () => {
    it("should check Typesense health", async () => {
      const { checkTypesenseHealth } = await import("../client");
      const isHealthy = await checkTypesenseHealth();
      expect(isHealthy).toBe(true);
    });
  });
});
