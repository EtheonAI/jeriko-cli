import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

/**
 * Extract plain text from content based on its type
 */
export async function extractText(content: string, mimeType: string): Promise<string> {
  if (mimeType === "text/html" || mimeType === "application/xhtml+xml") {
    return turndown.turndown(content);
  }
  // Plain text, markdown, etc. — return as-is
  return content;
}

/**
 * Extract text from a PDF buffer using pdf-parse
 */
export async function extractFromPdf(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Fetch a web URL and convert HTML to markdown text
 */
export async function extractFromUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; JerikoBot/1.0; +https://jeriko.dev)",
      Accept: "text/html,application/xhtml+xml,text/plain,*/*",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();

  if (contentType.includes("text/html") || contentType.includes("xhtml")) {
    return turndown.turndown(body);
  }

  return body;
}
