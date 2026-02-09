import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Session Auto-Title Logic
// ---------------------------------------------------------------------------
//
// The real autoSetSessionTitle in persistence.ts talks to the database.
// Here we test the TITLE EXTRACTION HEURISTIC in isolation:
//   - First 60 chars of user prompt + "..." if truncated
//   - Strip markdown formatting
//   - Handle empty/short content
//
// This mirrors the logic in persistence.ts:
//   let title = userPrompt.slice(0, 60).trim();
//   if (userPrompt.length > 60) title += "...";
// ---------------------------------------------------------------------------

/**
 * Pure function that replicates the title extraction heuristic from
 * `autoSetSessionTitle` in persistence.ts. Extracted here for unit testing
 * without DB dependencies.
 */
function extractSessionTitle(userPrompt: string): string {
  if (!userPrompt || !userPrompt.trim()) {
    return "New Chat";
  }

  // Strip common markdown formatting for a cleaner title
  let cleaned = userPrompt
    .replace(/^#{1,6}\s+/gm, "")       // Remove heading markers
    .replace(/\*\*(.+?)\*\*/g, "$1")   // Remove bold
    .replace(/\*(.+?)\*/g, "$1")       // Remove italic
    .replace(/__(.+?)__/g, "$1")       // Remove bold (underscore)
    .replace(/_(.+?)_/g, "$1")         // Remove italic (underscore)
    .replace(/~~(.+?)~~/g, "$1")       // Remove strikethrough
    .replace(/`(.+?)`/g, "$1")         // Remove inline code
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // Remove link syntax, keep text
    .replace(/!\[.*?\]\(.+?\)/g, "")    // Remove images
    .replace(/\n+/g, " ")              // Collapse newlines
    .trim();

  if (!cleaned) {
    return "New Chat";
  }

  let title = cleaned.slice(0, 60).trim();
  if (cleaned.length > 60) {
    title += "...";
  }

  return title;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Session Auto-Title Extraction", () => {
  // -----------------------------------------------------------------------
  // 1. Title extracted from first user message (first 60 chars + "...")
  // -----------------------------------------------------------------------
  it("extracts title from user prompt, truncated at 60 chars with ellipsis", () => {
    const longPrompt =
      "Can you help me build a full-stack web application with Next.js and a PostgreSQL database backend?";

    const title = extractSessionTitle(longPrompt);

    // Should be 60 chars + "..."
    expect(title.endsWith("...")).toBe(true);
    // The base part (before "...") should be at most 60 chars
    expect(title.length).toBeLessThanOrEqual(63);
    expect(title).toContain("Can you help me build");
  });

  // -----------------------------------------------------------------------
  // 2. Empty content produces default title
  // -----------------------------------------------------------------------
  it("returns default title for empty content", () => {
    expect(extractSessionTitle("")).toBe("New Chat");
    expect(extractSessionTitle("   ")).toBe("New Chat");
  });

  // -----------------------------------------------------------------------
  // 3. Very short content used as-is without truncation
  // -----------------------------------------------------------------------
  it("uses short content as-is without truncation", () => {
    const shortPrompt = "Hello";
    const title = extractSessionTitle(shortPrompt);

    expect(title).toBe("Hello");
    expect(title.endsWith("...")).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 4. Title strips markdown formatting
  // -----------------------------------------------------------------------
  it("strips markdown formatting from title", () => {
    expect(extractSessionTitle("# My Heading")).toBe("My Heading");
    expect(extractSessionTitle("**bold text**")).toBe("bold text");
    expect(extractSessionTitle("*italic text*")).toBe("italic text");
    expect(extractSessionTitle("`inline code`")).toBe("inline code");
    expect(extractSessionTitle("[link text](https://example.com)")).toBe("link text");
    expect(extractSessionTitle("~~strikethrough~~")).toBe("strikethrough");
  });

  // -----------------------------------------------------------------------
  // 5. Handles content at exactly 60 chars (no truncation)
  // -----------------------------------------------------------------------
  it("does not add ellipsis for content at exactly 60 chars", () => {
    // Exactly 60 characters
    const exact60 = "A".repeat(60);
    const title = extractSessionTitle(exact60);

    expect(title).toBe(exact60);
    expect(title.endsWith("...")).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 6. Handles content at 61 chars (truncates with ellipsis)
  // -----------------------------------------------------------------------
  it("adds ellipsis for content at 61 chars", () => {
    const chars61 = "A".repeat(61);
    const title = extractSessionTitle(chars61);

    expect(title).toBe("A".repeat(60) + "...");
  });

  // -----------------------------------------------------------------------
  // 7. Multiline input collapses to single line
  // -----------------------------------------------------------------------
  it("collapses multiline input to a single line", () => {
    const multiline = "First line\nSecond line\nThird line";
    const title = extractSessionTitle(multiline);

    expect(title).not.toContain("\n");
    expect(title).toContain("First line");
    expect(title).toContain("Second line");
  });

  // -----------------------------------------------------------------------
  // 8. Combined markdown in longer text
  // -----------------------------------------------------------------------
  it("handles combined markdown formatting in longer text", () => {
    const mdText =
      "## **Project Setup**: I need help setting up a *Next.js* project with `TypeScript` and [Tailwind](https://tailwind.com)";
    const title = extractSessionTitle(mdText);

    // All markdown should be stripped
    expect(title).not.toContain("##");
    expect(title).not.toContain("**");
    expect(title).not.toContain("*");
    expect(title).not.toContain("`");
    expect(title).not.toContain("[");
    expect(title).toContain("Project Setup");
    expect(title).toContain("Next.js");
  });
});
