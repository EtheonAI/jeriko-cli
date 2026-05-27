import "server-only";
import { getTypesenseClient } from "../client";
import type { BulkImportResult, SearchCollectionName, SearchDocument } from "../types";

export async function upsertDocument<TDocument extends SearchDocument>(
  collectionName: SearchCollectionName,
  document: TDocument
): Promise<TDocument> {
  const client = getTypesenseClient();

  return client
    .collections(collectionName)
    .documents()
    .upsert(document as Record<string, unknown>) as unknown as Promise<TDocument>;
}

export async function deleteDocument(
  collectionName: SearchCollectionName,
  documentId: string,
  options: { ignoreMissing?: boolean } = { ignoreMissing: true }
): Promise<void> {
  const client = getTypesenseClient();

  try {
    await client.collections(collectionName).documents(documentId).delete();
  } catch (error) {
    if (!options.ignoreMissing) {
      throw error;
    }
  }
}

export async function bulkUpsertDocuments<TDocument extends SearchDocument>(
  collectionName: SearchCollectionName,
  documents: TDocument[],
  options: { batchSize?: number } = {}
): Promise<BulkImportResult> {
  if (documents.length === 0) {
    return { success: 0, failed: 0 };
  }

  const client = getTypesenseClient();
  const results = await client
    .collections(collectionName)
    .documents()
    .import(documents as Record<string, unknown>[], {
      action: "upsert",
      batch_size: options.batchSize ?? 100,
    });

  return summarizeImportResults(results as Array<{ success?: boolean }>);
}

export async function deleteDocumentsByFilter(
  collectionName: SearchCollectionName,
  filterBy: string,
  options: { ignoreMissing?: boolean } = { ignoreMissing: true }
): Promise<void> {
  const client = getTypesenseClient();

  try {
    await client.collections(collectionName).documents().delete({ filter_by: filterBy });
  } catch (error) {
    if (!options.ignoreMissing) {
      throw error;
    }
  }
}

function summarizeImportResults(results: Array<{ success?: boolean }>): BulkImportResult {
  return results.reduce<BulkImportResult>(
    (summary, result) => {
      if (result.success) {
        summary.success += 1;
      } else {
        summary.failed += 1;
      }
      return summary;
    },
    { success: 0, failed: 0 }
  );
}
