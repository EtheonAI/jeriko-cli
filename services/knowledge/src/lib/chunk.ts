export interface Chunk {
  content: string;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
}

interface ChunkOptions {
  maxSize?: number;
  overlap?: number;
}

/**
 * Split text into overlapping chunks, respecting sentence boundaries where possible.
 */
export function chunkText(text: string, opts?: ChunkOptions): Chunk[] {
  const maxSize = opts?.maxSize ?? 1000;
  const overlap = opts?.overlap ?? 200;

  if (!text || text.trim().length === 0) {
    return [];
  }

  // If text fits in one chunk, return it directly
  if (text.length <= maxSize) {
    return [
      {
        content: text,
        chunkIndex: 0,
        startOffset: 0,
        endOffset: text.length,
      },
    ];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    let end = Math.min(start + maxSize, text.length);

    // Try to break at a sentence boundary
    if (end < text.length) {
      const segment = text.slice(start, end);
      // Look for the last sentence-ending punctuation followed by space
      const sentenceBreak = segment.search(/[.!?]\s+(?=[A-Z])[^.]*$/);
      if (sentenceBreak !== -1 && sentenceBreak > maxSize * 0.3) {
        end = start + sentenceBreak + 1; // Include the punctuation
      } else {
        // Fallback: try to break at a paragraph or line break
        const lineBreak = segment.lastIndexOf("\n\n");
        if (lineBreak !== -1 && lineBreak > maxSize * 0.3) {
          end = start + lineBreak;
        } else {
          // Fallback: break at a space
          const spaceBreak = segment.lastIndexOf(" ");
          if (spaceBreak !== -1 && spaceBreak > maxSize * 0.3) {
            end = start + spaceBreak;
          }
        }
      }
    }

    chunks.push({
      content: text.slice(start, end).trim(),
      chunkIndex,
      startOffset: start,
      endOffset: end,
    });

    chunkIndex++;

    // Advance start, accounting for overlap
    const advance = end - start - overlap;
    start = start + Math.max(advance, 1);
  }

  return chunks.filter((c) => c.content.length > 0);
}
