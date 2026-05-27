import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const collectionStore = new Map<string, Record<string, unknown>>();
const documentStore = new Map<string, Record<string, unknown>>();

vi.mock("typesense", () => {
  class MockTypesenseClient {
    collections = vi.fn((collectionName?: string) => {
      if (collectionName) {
        return {
          retrieve: vi.fn().mockImplementation(async () => {
            const collection = collectionStore.get(collectionName);
            if (!collection) {
              throw new Error("missing collection");
            }
            return collection;
          }),
          delete: vi.fn().mockImplementation(async () => {
            collectionStore.delete(collectionName);
            return {};
          }),
          documents: vi.fn(() => ({
            upsert: vi.fn().mockImplementation(async (document) => {
              documentStore.set(`${collectionName}:${document.id}`, document);
              return document;
            }),
            delete: vi.fn().mockResolvedValue({ id: "deleted" }),
            search: vi.fn().mockResolvedValue({
              found: 1,
              hits: [{ document: { id: "doc_1", title: "Workflow run" } }],
            }),
            import: vi
              .fn()
              .mockImplementation(async (documents) => documents.map(() => ({ success: true }))),
          })),
        };
      }

      return {
        create: vi.fn().mockImplementation(async (schema) => {
          collectionStore.set(schema.name, {
            name: schema.name,
            num_documents: 0,
            num_memory_bytes_used: 0,
          });
          return schema;
        }),
      };
    });

    multiSearch = {
      perform: vi.fn().mockResolvedValue({ results: [] }),
    };

    health = {
      retrieve: vi.fn().mockResolvedValue({ ok: true }),
    };
  }

  return {
    default: {
      Client: MockTypesenseClient,
    },
  };
});

vi.mock("../src/env", () => ({
  env: {
    TYPESENSE_HOST: "localhost",
    TYPESENSE_PORT: 8108,
    TYPESENSE_PROTOCOL: "http",
    TYPESENSE_API_KEY: "test-key",
  },
}));

describe("@repo/search", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    collectionStore.clear();
    documentStore.clear();
    const { resetTypesenseClient } = await import("../src/client");
    resetTypesenseClient();
  });

  it("creates a collection when ensureCollection cannot retrieve it", async () => {
    const { ensureCollection, getCollectionStats } = await import("../src/collections");

    await ensureCollection({
      name: "workflow_runs",
      fields: [
        { name: "id", type: "string" },
        { name: "userId", type: "string", facet: true },
        { name: "title", type: "string" },
        { name: "updatedAt", type: "int64" },
      ],
      default_sorting_field: "updatedAt",
    });

    const stats = await getCollectionStats("workflow_runs");
    expect(stats.name).toBe("workflow_runs");
    expect(stats.numDocuments).toBe(0);
  });

  it("upserts documents through the generic document boundary", async () => {
    const { upsertDocument } = await import("../src/services");

    const document = await upsertDocument("workflow_runs", {
      id: "run_1",
      userId: "user_1",
      title: "Run one",
    });

    expect(document.id).toBe("run_1");
    expect(documentStore.get("workflow_runs:run_1")).toMatchObject({
      title: "Run one",
    });
  });

  it("summarizes bulk imports", async () => {
    const { bulkUpsertDocuments } = await import("../src/services");

    const result = await bulkUpsertDocuments("workflow_runs", [
      { id: "run_1", title: "Run one" },
      { id: "run_2", title: "Run two" },
    ]);

    expect(result).toEqual({ success: 2, failed: 0 });
  });

  it("searches a collection and returns generic hits", async () => {
    const { searchCollection } = await import("../src/services");

    const result = await searchCollection<{ id: string; title: string }>({
      collection: "workflow_runs",
      query: "workflow",
      queryBy: "title",
      perPage: 5,
    });

    expect(result.found).toBe(1);
    expect(result.hits[0]).toEqual({ id: "doc_1", title: "Workflow run" });
  });

  it("checks Typesense health", async () => {
    const { checkTypesenseHealth } = await import("../src/client");

    await expect(checkTypesenseHealth()).resolves.toBe(true);
  });
});
