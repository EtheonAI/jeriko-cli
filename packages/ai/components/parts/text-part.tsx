"use client";

import * as React from "react";
import { Suspense, useState, useCallback } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { CheckIcon, CopyIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type { TextUIPart } from "../../lib/types/ui-message";
import remarkGfm from "remark-gfm";

const Markdown = React.lazy(() => import("react-markdown"));

export interface TextPartProps {
  part: TextUIPart;
  className?: string;
  enableMarkdown?: boolean;
}

/**
 * TextPart - Renders text with markdown, syntax-highlighted code blocks,
 * copy buttons, and a streaming cursor.
 */
export function TextPart({ part, className, enableMarkdown = true }: TextPartProps) {
  const isStreaming = part.state === "streaming";

  if (!enableMarkdown) {
    return (
      <div className={cn("text-sm leading-relaxed", className)}>
        <p className="whitespace-pre-wrap">{part.text}</p>
        {isStreaming && <StreamingCursor />}
      </div>
    );
  }

  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      <Suspense fallback={<p className="whitespace-pre-wrap">{part.text}</p>}>
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="mb-4 mt-6 text-2xl font-semibold tracking-tight first:mt-0">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="mb-3 mt-5 text-xl font-semibold tracking-tight first:mt-0">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h3>
            ),
            h4: ({ children }) => (
              <h4 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h4>
            ),
            p: ({ children }) => <p className="mb-3 last:mb-0 leading-7">{children}</p>,
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              >
                {children}
              </a>
            ),
            ul: ({ children }) => (
              <ul className="mb-3 ml-6 list-disc space-y-1 [&>li]:pl-1">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-3 ml-6 list-decimal space-y-1 [&>li]:pl-1">{children}</ol>
            ),
            li: ({ children }) => <li className="leading-7">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
            hr: () => <hr className="my-4 border-border" />,
            blockquote: ({ children }) => (
              <blockquote className="mb-3 border-l-2 border-primary/40 pl-4 italic text-muted-foreground">
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="my-4 w-full overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="border-b border-border bg-muted/50">{children}</thead>
            ),
            th: ({ children }) => (
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-4 py-2.5 border-t border-border/50">{children}</td>
            ),
            code: ({ className: codeClassName, children, ...props }) => {
              const match = /language-(\w+)/.exec(codeClassName || "");
              const isInline = !match && !String(children).includes("\n");

              if (isInline) {
                return (
                  <code
                    className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground"
                    {...props}
                  >
                    {children}
                  </code>
                );
              }

              const codeString = String(children).replace(/\n$/, "");
              const language = match?.[1] ?? "text";

              return <CodeBlock code={codeString} language={language} />;
            },
            pre: ({ children }) => <>{children}</>,
          }}
        >
          {part.text}
        </Markdown>
      </Suspense>
      {isStreaming && <StreamingCursor />}
    </div>
  );
}

// ============================================================================
// Code Block with Syntax Highlighting
// ============================================================================

const PYTHON_KEYWORDS = new Set([
  "def", "class", "if", "elif", "else", "for", "while", "try", "except",
  "finally", "with", "as", "import", "from", "return", "yield", "raise",
  "pass", "break", "continue", "and", "or", "not", "in", "is", "True",
  "False", "None", "lambda", "async", "await", "global", "nonlocal", "del",
  "assert",
]);

const JS_KEYWORDS = new Set([
  "function", "const", "let", "var", "if", "else", "for", "while", "do",
  "switch", "case", "default", "try", "catch", "finally", "throw", "return",
  "break", "continue", "class", "extends", "new", "this", "super", "import",
  "export", "from", "async", "await", "typeof", "instanceof", "null",
  "undefined", "true", "false", "void", "delete", "yield", "of", "in",
  "type", "interface", "enum", "implements", "abstract", "readonly",
]);

const GO_KEYWORDS = new Set([
  "func", "package", "import", "var", "const", "type", "struct", "interface",
  "map", "chan", "range", "select", "case", "default", "if", "else", "for",
  "switch", "return", "break", "continue", "go", "defer", "nil", "true",
  "false", "make", "new", "append", "len", "cap", "error",
]);

const RUST_KEYWORDS = new Set([
  "fn", "let", "mut", "const", "if", "else", "for", "while", "loop",
  "match", "return", "break", "continue", "struct", "enum", "impl", "trait",
  "pub", "use", "mod", "crate", "self", "super", "async", "await",
  "true", "false", "None", "Some", "Ok", "Err", "Self", "where", "type",
]);

const BASH_KEYWORDS = new Set([
  "if", "then", "else", "elif", "fi", "for", "while", "do", "done",
  "case", "esac", "function", "return", "exit", "export", "source",
  "alias", "cd", "echo", "printf", "read", "test", "local", "declare",
]);

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE",
  "DROP", "ALTER", "TABLE", "INDEX", "JOIN", "LEFT", "RIGHT", "INNER",
  "OUTER", "ON", "AND", "OR", "NOT", "NULL", "IS", "IN", "LIKE",
  "ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET", "AS", "SET",
  "VALUES", "INTO", "DISTINCT", "COUNT", "SUM", "AVG", "MAX", "MIN",
  "UNION", "ALL", "EXISTS", "BETWEEN", "CASE", "WHEN", "THEN", "END",
  "ELSE", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "UNIQUE", "DEFAULT",
  "CASCADE", "CONSTRAINT", "WITH", "RECURSIVE",
  // lowercase variants
  "select", "from", "where", "insert", "update", "delete", "create",
  "drop", "alter", "table", "index", "join", "left", "right", "inner",
  "outer", "on", "and", "or", "not", "null", "is", "in", "like",
  "order", "by", "group", "having", "limit", "offset", "as", "set",
  "values", "into", "distinct",
]);

const HTML_KEYWORDS = new Set([
  "html", "head", "body", "div", "span", "p", "a", "img", "ul", "ol",
  "li", "table", "tr", "td", "th", "form", "input", "button", "select",
  "option", "textarea", "label", "h1", "h2", "h3", "h4", "h5", "h6",
  "header", "footer", "nav", "main", "section", "article", "aside",
  "script", "style", "link", "meta", "title", "class", "id", "src",
  "href", "type", "name", "value", "placeholder", "alt", "width", "height",
]);

const CSS_KEYWORDS = new Set([
  "display", "flex", "grid", "block", "inline", "none", "position",
  "relative", "absolute", "fixed", "sticky", "top", "right", "bottom",
  "left", "width", "height", "margin", "padding", "border", "background",
  "color", "font", "text", "align", "justify", "items", "content",
  "overflow", "opacity", "transition", "transform", "animation", "z-index",
  "important", "hover", "focus", "active", "before", "after", "var",
  "calc", "inherit", "initial", "unset", "auto", "solid", "dashed",
  "media", "keyframes", "import", "from", "to",
]);

const YAML_KEYWORDS = new Set([
  "true", "false", "null", "yes", "no", "on", "off",
]);

function getKeywordSet(lang: string): Set<string> | null {
  switch (lang) {
    case "python": case "py": return PYTHON_KEYWORDS;
    case "javascript": case "js": case "jsx": case "typescript": case "ts": case "tsx":
      return JS_KEYWORDS;
    case "go": case "golang": return GO_KEYWORDS;
    case "rust": case "rs": return RUST_KEYWORDS;
    case "bash": case "sh": case "shell": case "zsh": return BASH_KEYWORDS;
    case "sql": case "postgresql": case "mysql": return SQL_KEYWORDS;
    case "html": case "xml": case "svg": return HTML_KEYWORDS;
    case "css": case "scss": case "less": return CSS_KEYWORDS;
    case "yaml": case "yml": return YAML_KEYWORDS;
    case "json": case "jsonc": return null; // JSON uses string/number/keyword highlighting only
    default: return null;
  }
}

function isCommentStart(lang: string, text: string): boolean {
  if (["python", "py", "bash", "sh", "shell", "zsh", "yaml", "yml", "ruby", "rb"].includes(lang)) {
    return text.startsWith("#");
  }
  if (["javascript", "js", "jsx", "typescript", "ts", "tsx", "go", "golang",
       "rust", "rs", "c", "cpp", "java", "kotlin", "swift", "css", "scss", "less"].includes(lang)) {
    return text.startsWith("//");
  }
  if (["html", "xml", "svg"].includes(lang)) {
    return text.startsWith("<!--");
  }
  return false;
}

type TokenType = "keyword" | "string" | "number" | "comment" | "function" | "operator" | "plain";

interface Token {
  text: string;
  type: TokenType;
}

function tokenizeLine(line: string, lang: string): Token[] {
  if (!line.trim()) return [{ text: line || " ", type: "plain" }];

  const keywords = getKeywordSet(lang);
  const tokens: Token[] = [];
  const regex = /(["'`](?:[^"'`\\]|\\.)*["'`])|(\d+(?:\.\d+)?(?:e[+-]?\d+)?)|([a-zA-Z_$]\w*)|([^\w\s]+)|(\s+)/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = regex.exec(line)) !== null) {
    // Fill any gap
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), type: "plain" });
    }
    lastIndex = match.index + match[0].length;

    const [, str, num, word, op, ws] = match;

    if (str) {
      tokens.push({ text: str, type: "string" });
    } else if (num) {
      tokens.push({ text: num, type: "number" });
    } else if (word) {
      const isKw = keywords?.has(word) ?? false;
      const rest = line.slice(lastIndex).trimStart();
      const isFn = rest.startsWith("(");
      tokens.push({ text: word, type: isKw ? "keyword" : isFn ? "function" : "plain" });
    } else if (op) {
      if (isCommentStart(lang, line.slice(match.index))) {
        tokens.push({ text: line.slice(match.index), type: "comment" });
        lastIndex = line.length;
        break;
      }
      tokens.push({ text: op, type: "operator" });
    } else if (ws) {
      tokens.push({ text: ws, type: "plain" });
    }
  }

  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), type: "plain" });
  }

  return tokens.length > 0 ? tokens : [{ text: line, type: "plain" }];
}

const TOKEN_CLASSES: Record<TokenType, string> = {
  keyword: "text-purple-400",
  string: "text-green-400",
  number: "text-amber-400",
  comment: "text-zinc-500 italic",
  function: "text-blue-400",
  operator: "text-zinc-400",
  plain: "text-zinc-200",
};

const LANG_LABELS: Record<string, string> = {
  javascript: "JavaScript", js: "JavaScript", jsx: "JSX",
  typescript: "TypeScript", ts: "TypeScript", tsx: "TSX",
  python: "Python", py: "Python",
  bash: "Bash", sh: "Shell", zsh: "Zsh", shell: "Shell",
  go: "Go", golang: "Go",
  rust: "Rust", rs: "Rust",
  c: "C", cpp: "C++",
  java: "Java", kotlin: "Kotlin", swift: "Swift",
  html: "HTML", css: "CSS", scss: "SCSS",
  json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML",
  sql: "SQL", postgresql: "PostgreSQL", mysql: "MySQL",
  ruby: "Ruby", rb: "Ruby",
  php: "PHP",
  dockerfile: "Dockerfile", docker: "Docker",
  text: "Plain Text", plaintext: "Plain Text",
  markdown: "Markdown", md: "Markdown",
  xml: "XML", graphql: "GraphQL",
};

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const lines = React.useMemo(() => code.split("\n"), [code]);
  const tokenizedLines = React.useMemo(
    () => lines.map((line) => tokenizeLine(line, language)),
    [lines, language]
  );
  const lineCount = lines.length;
  const isLong = lineCount > 30;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const displayedLines = collapsed ? tokenizedLines.slice(0, 10) : tokenizedLines;
  const label = LANG_LABELS[language] ?? language;
  const gutterWidth = String(lineCount).length;

  return (
    <div className="group/code my-3 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          {copied ? (
            <>
              <CheckIcon className="size-3.5 text-green-400" />
              <span className="text-green-400">Copied</span>
            </>
          ) : (
            <>
              <CopyIcon className="size-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <div className="overflow-x-auto">
        <pre className="p-4 text-[13px] leading-6">
          {displayedLines.map((tokens, i) => (
            <div key={i} className="flex">
              <span
                className="select-none pr-4 text-right text-zinc-600"
                style={{ minWidth: `${gutterWidth + 1}ch` }}
              >
                {i + 1}
              </span>
              <span className="flex-1">
                {tokens.map((token, j) => (
                  <span key={j} className={TOKEN_CLASSES[token.type]}>
                    {token.text}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </pre>
      </div>

      {/* Collapse toggle for long blocks */}
      {isLong && (
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center gap-1 border-t border-zinc-800 bg-zinc-900 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
        >
          {collapsed ? (
            <>
              <ChevronDownIcon className="size-3.5" />
              Show all {lineCount} lines
            </>
          ) : (
            <>
              <ChevronRightIcon className="size-3.5" />
              Collapse
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Streaming Cursor
// ============================================================================

function StreamingCursor() {
  return (
    <span className="ml-0.5 inline-block h-[18px] w-[2px] animate-pulse rounded-full bg-foreground align-text-bottom" />
  );
}
