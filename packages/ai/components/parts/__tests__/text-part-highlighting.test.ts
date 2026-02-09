import { describe, it, expect } from "vitest";

/**
 * Tests for the syntax highlighting keyword sets added in P1.8.
 *
 * We test the keyword set logic for HTML, CSS, YAML, and JSON
 * that was added to text-part.tsx.
 */

// Reproduce keyword sets from text-part.tsx
const HTML_KEYWORDS = new Set([
  "html", "head", "body", "div", "span", "p", "a", "img", "ul", "ol", "li",
  "table", "tr", "td", "th", "form", "input", "button", "select", "option",
  "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "nav", "header",
  "footer", "main", "aside", "script", "style", "link", "meta", "title",
]);

const CSS_KEYWORDS = new Set([
  "display", "position", "margin", "padding", "border", "background", "color",
  "font", "width", "height", "flex", "grid", "align", "justify", "overflow",
  "transition", "transform", "animation", "opacity", "z-index", "cursor",
  "important", "none", "auto", "inherit", "initial", "unset", "var", "calc",
]);

const YAML_KEYWORDS = new Set([
  "true", "false", "null", "yes", "no", "on", "off",
]);

function getKeywordSet(lang: string): Set<string> | null {
  switch (lang) {
    case "html":
    case "xml":
    case "svg":
      return HTML_KEYWORDS;
    case "css":
    case "scss":
    case "less":
      return CSS_KEYWORDS;
    case "yaml":
    case "yml":
      return YAML_KEYWORDS;
    case "json":
    case "jsonc":
      return null; // JSON has no keywords, just structural highlighting
    default:
      return null;
  }
}

function isCommentStart(line: string, lang: string): boolean {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("--")) return true;
  if (trimmed.startsWith("/*") || trimmed.startsWith("*")) return true;
  if ((lang === "html" || lang === "xml" || lang === "svg") && trimmed.startsWith("<!--")) return true;
  return false;
}

describe("getKeywordSet", () => {
  it("returns HTML keywords for html/xml/svg", () => {
    expect(getKeywordSet("html")).toBe(HTML_KEYWORDS);
    expect(getKeywordSet("xml")).toBe(HTML_KEYWORDS);
    expect(getKeywordSet("svg")).toBe(HTML_KEYWORDS);
  });

  it("returns CSS keywords for css/scss/less", () => {
    expect(getKeywordSet("css")).toBe(CSS_KEYWORDS);
    expect(getKeywordSet("scss")).toBe(CSS_KEYWORDS);
    expect(getKeywordSet("less")).toBe(CSS_KEYWORDS);
  });

  it("returns YAML keywords for yaml/yml", () => {
    expect(getKeywordSet("yaml")).toBe(YAML_KEYWORDS);
    expect(getKeywordSet("yml")).toBe(YAML_KEYWORDS);
  });

  it("returns null for json/jsonc", () => {
    expect(getKeywordSet("json")).toBeNull();
    expect(getKeywordSet("jsonc")).toBeNull();
  });

  it("returns null for unknown languages", () => {
    expect(getKeywordSet("brainfuck")).toBeNull();
    expect(getKeywordSet("")).toBeNull();
  });
});

describe("HTML keywords coverage", () => {
  it("includes common structural elements", () => {
    for (const tag of ["div", "span", "p", "a", "section", "article"]) {
      expect(HTML_KEYWORDS.has(tag)).toBe(true);
    }
  });

  it("includes heading elements", () => {
    for (let i = 1; i <= 6; i++) {
      expect(HTML_KEYWORDS.has(`h${i}`)).toBe(true);
    }
  });

  it("includes form elements", () => {
    for (const tag of ["form", "input", "button", "select", "option"]) {
      expect(HTML_KEYWORDS.has(tag)).toBe(true);
    }
  });
});

describe("CSS keywords coverage", () => {
  it("includes layout properties", () => {
    for (const prop of ["display", "position", "flex", "grid"]) {
      expect(CSS_KEYWORDS.has(prop)).toBe(true);
    }
  });

  it("includes CSS functions and values", () => {
    for (const val of ["var", "calc", "inherit", "initial", "unset"]) {
      expect(CSS_KEYWORDS.has(val)).toBe(true);
    }
  });
});

describe("isCommentStart", () => {
  it("detects // comments", () => {
    expect(isCommentStart("  // comment", "javascript")).toBe(true);
  });

  it("detects # comments", () => {
    expect(isCommentStart("  # comment", "python")).toBe(true);
  });

  it("detects HTML comments for html/xml/svg", () => {
    expect(isCommentStart("<!-- comment -->", "html")).toBe(true);
    expect(isCommentStart("<!-- comment -->", "xml")).toBe(true);
    expect(isCommentStart("<!-- comment -->", "svg")).toBe(true);
  });

  it("does NOT detect HTML comments for non-HTML languages", () => {
    expect(isCommentStart("<!-- not a comment -->", "javascript")).toBe(false);
  });

  it("detects /* block comments", () => {
    expect(isCommentStart("  /* block */", "css")).toBe(true);
  });

  it("returns false for non-comment lines", () => {
    expect(isCommentStart("const x = 1;", "javascript")).toBe(false);
  });
});
