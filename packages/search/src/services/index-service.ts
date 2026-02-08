import "server-only";
import { getTypesenseClient } from "../client";
import { allCollectionSchemas, COLLECTION_NAMES } from "../collections";
import type {
  FileDocument,
  SessionDocument,
  TaskDocument,
  ProjectDocument,
  ActionDocument,
  CollectionName,
} from "../types";

const client = getTypesenseClient();

// Initialize all collections
export async function initializeCollections(): Promise<void> {
  for (const schema of allCollectionSchemas) {
    try {
      // Check if collection exists
      await client.collections(schema.name).retrieve();
    } catch {
      // Collection doesn't exist, create it
      await client.collections().create(schema);
    }
  }
}

// Delete and recreate a collection (for reindexing)
export async function recreateCollection(collectionName: CollectionName): Promise<void> {
  const schema = allCollectionSchemas.find((s) => s.name === collectionName);
  if (!schema) {
    throw new Error(`Unknown collection: ${collectionName}`);
  }

  try {
    await client.collections(collectionName).delete();
  } catch {
    // Collection might not exist, that's okay
  }

  await client.collections().create(schema);
}

// Generic document indexing
async function indexDocument<T extends { id: string }>(
  collectionName: CollectionName,
  document: T
): Promise<T> {
  return client
    .collections(collectionName)
    .documents()
    .upsert(document as unknown as Record<string, unknown>) as unknown as Promise<T>;
}

// Generic document deletion
async function deleteDocument(collectionName: CollectionName, documentId: string): Promise<void> {
  try {
    await client.collections(collectionName).documents(documentId).delete();
  } catch {
    // Document might not exist, that's okay
  }
}

// Bulk import documents
async function bulkImportDocuments<T extends { id: string }>(
  collectionName: CollectionName,
  documents: T[]
): Promise<{ success: number; failed: number }> {
  if (documents.length === 0) {
    return { success: 0, failed: 0 };
  }

  const results = await client
    .collections(collectionName)
    .documents()
    .import(documents as unknown as Record<string, unknown>[], {
      action: "upsert",
      batch_size: 100,
    });

  const success = results.filter((r: { success: boolean }) => r.success).length;
  const failed = results.filter((r: { success: boolean }) => !r.success).length;

  return { success, failed };
}

// File indexing
export async function indexFile(file: FileDocument): Promise<FileDocument> {
  return indexDocument(COLLECTION_NAMES.FILES, file);
}

export async function deleteFileFromIndex(fileId: string): Promise<void> {
  return deleteDocument(COLLECTION_NAMES.FILES, fileId);
}

export async function bulkIndexFiles(files: FileDocument[]): Promise<{ success: number; failed: number }> {
  return bulkImportDocuments(COLLECTION_NAMES.FILES, files);
}

// Session indexing
export async function indexSession(session: SessionDocument): Promise<SessionDocument> {
  return indexDocument(COLLECTION_NAMES.SESSIONS, session);
}

export async function deleteSessionFromIndex(sessionId: string): Promise<void> {
  return deleteDocument(COLLECTION_NAMES.SESSIONS, sessionId);
}

export async function bulkIndexSessions(
  sessions: SessionDocument[]
): Promise<{ success: number; failed: number }> {
  return bulkImportDocuments(COLLECTION_NAMES.SESSIONS, sessions);
}

// Task indexing
export async function indexTask(task: TaskDocument): Promise<TaskDocument> {
  return indexDocument(COLLECTION_NAMES.TASKS, task);
}

export async function deleteTaskFromIndex(taskId: string): Promise<void> {
  return deleteDocument(COLLECTION_NAMES.TASKS, taskId);
}

export async function bulkIndexTasks(tasks: TaskDocument[]): Promise<{ success: number; failed: number }> {
  return bulkImportDocuments(COLLECTION_NAMES.TASKS, tasks);
}

// Project indexing
export async function indexProject(project: ProjectDocument): Promise<ProjectDocument> {
  return indexDocument(COLLECTION_NAMES.PROJECTS, project);
}

export async function deleteProjectFromIndex(projectId: string): Promise<void> {
  return deleteDocument(COLLECTION_NAMES.PROJECTS, projectId);
}

export async function bulkIndexProjects(
  projects: ProjectDocument[]
): Promise<{ success: number; failed: number }> {
  return bulkImportDocuments(COLLECTION_NAMES.PROJECTS, projects);
}

// Action indexing
export async function indexAction(action: ActionDocument): Promise<ActionDocument> {
  return indexDocument(COLLECTION_NAMES.ACTIONS, action);
}

export async function deleteActionFromIndex(actionId: string): Promise<void> {
  return deleteDocument(COLLECTION_NAMES.ACTIONS, actionId);
}

export async function bulkIndexActions(
  actions: ActionDocument[]
): Promise<{ success: number; failed: number }> {
  return bulkImportDocuments(COLLECTION_NAMES.ACTIONS, actions);
}

// Delete all documents for a user (for GDPR compliance)
export async function deleteAllUserDocuments(userId: string): Promise<void> {
  const collections = Object.values(COLLECTION_NAMES);

  for (const collection of collections) {
    try {
      await client.collections(collection).documents().delete({
        filter_by: `userId:=${userId}`,
      });
    } catch {
      // Collection might not exist or be empty
    }
  }
}

// Get collection stats
export async function getCollectionStats(
  collectionName: CollectionName
): Promise<{ numDocuments: number; numMemoryBytesUsed: number }> {
  const collection = await client.collections(collectionName).retrieve();
  return {
    numDocuments: collection.num_documents || 0,
    numMemoryBytesUsed: (collection as unknown as Record<string, unknown>).num_memory_bytes_used as number || 0,
  };
}

// Get all collection stats
export async function getAllCollectionStats(): Promise<
  Record<CollectionName, { numDocuments: number; numMemoryBytesUsed: number }>
> {
  const stats: Record<string, { numDocuments: number; numMemoryBytesUsed: number }> = {};

  for (const name of Object.values(COLLECTION_NAMES)) {
    try {
      stats[name] = await getCollectionStats(name);
    } catch {
      stats[name] = { numDocuments: 0, numMemoryBytesUsed: 0 };
    }
  }

  return stats as Record<CollectionName, { numDocuments: number; numMemoryBytesUsed: number }>;
}
