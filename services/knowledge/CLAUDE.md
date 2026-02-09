# services/knowledge — Testing Rules

## What This Is
RAG pipeline: document ingestion, embedding generation, vector search, retrieval. 515 LOC.

## What to Test

### Embedding Generation (P0)
1. Text input → embedding vector (array of floats)
2. Empty text → handled gracefully
3. Long text → chunked before embedding
4. Embedding dimensions match expected model output

### Document Ingestion (P0)
1. Plain text → chunked, embedded, stored
2. Markdown → parsed, chunked, embedded
3. PDF → extracted, chunked, embedded
4. Duplicate document → updated (not duplicated)

### Vector Search (P0)
1. Query → returns semantically similar documents
2. Relevance ranking (most similar first)
3. Top-K limiting
4. Filtering by source/collection

### Retrieval (P1)
1. Retrieval includes source metadata
2. Retrieved chunks are coherent (not split mid-sentence)

### User Isolation (P0)
1. User A's knowledge base not searchable by User B
