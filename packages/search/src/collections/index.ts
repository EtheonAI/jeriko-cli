import "server-only";
import { getTypesenseClient } from "../client";
import type { SearchCollectionSchema, SearchCollectionStats, SearchCollectionName } from "../types";

export async function ensureCollection(schema: SearchCollectionSchema): Promise<void> {
  const client = getTypesenseClient();

  try {
    await client.collections(schema.name).retrieve();
  } catch {
    await client.collections().create(schema);
  }
}

export async function ensureCollections(schemas: SearchCollectionSchema[]): Promise<void> {
  for (const schema of schemas) {
    await ensureCollection(schema);
  }
}

export async function recreateCollection(schema: SearchCollectionSchema): Promise<void> {
  await deleteCollection(schema.name, { ignoreMissing: true });
  const client = getTypesenseClient();
  await client.collections().create(schema);
}

export async function deleteCollection(
  collectionName: SearchCollectionName,
  options: { ignoreMissing?: boolean } = {}
): Promise<void> {
  const client = getTypesenseClient();

  try {
    await client.collections(collectionName).delete();
  } catch (error) {
    if (!options.ignoreMissing) {
      throw error;
    }
  }
}

export async function getCollectionStats(
  collectionName: SearchCollectionName
): Promise<SearchCollectionStats> {
  const client = getTypesenseClient();
  const collection = await client.collections(collectionName).retrieve();

  return {
    name: collection.name,
    numDocuments: collection.num_documents || 0,
    numMemoryBytesUsed: Number(
      (collection as unknown as Record<string, unknown>).num_memory_bytes_used || 0
    ),
  };
}
