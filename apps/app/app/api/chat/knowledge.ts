import { log } from "@repo/observability/log";

const KNOWLEDGE_SERVICE_URL = process.env.KNOWLEDGE_SERVICE_URL || "http://localhost:4011";
const SIMILARITY_THRESHOLD = 0.5;
const MAX_RESULTS = 5;

interface KnowledgeResult {
  chunk_id: string;
  chunk_content: string;
  chunk_index: number;
  item_id: string;
  item_name: string;
  item_type: string;
  similarity: number;
}

/**
 * Query the knowledge service for relevant context based on the user's message.
 * Returns a formatted context string, or null if no relevant results.
 */
export async function queryKnowledge(
  userId: string,
  query: string,
  groupIds?: string[]
): Promise<string | null> {
  try {
    const response = await fetch(`${KNOWLEDGE_SERVICE_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        userId,
        groupIds,
        limit: MAX_RESULTS,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      log.error(`Knowledge query failed: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { results: KnowledgeResult[] };
    const results = data.results;

    if (!results || results.length === 0) {
      return null;
    }

    // Filter by similarity threshold
    const relevant = results.filter((r) => r.similarity >= SIMILARITY_THRESHOLD);
    if (relevant.length === 0) {
      return null;
    }

    // Format context
    const contextBlocks = relevant.map(
      (r) => `From "${r.item_name}" (similarity: ${r.similarity.toFixed(2)}):\n${r.chunk_content}`
    );

    return `[Knowledge Context]\n${contextBlocks.join("\n---\n")}`;
  } catch (error) {
    log.error("Knowledge query error:", error as Error);
    return null;
  }
}
