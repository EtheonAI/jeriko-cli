"use client";

/**
 * Enhanced Code Block - Syntax-highlighted code execution
 *
 * Features:
 * - Syntax highlighting with Shiki
 * - Line numbers with highlighting
 * - Collapsible code/output sections
 * - Copy to clipboard
 * - Streaming code animation
 * - Execution metrics (time, memory)
 * - Multi-language support
 */

import * as React from "react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  CheckIcon,
  CopyIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlayIcon,
  CodeIcon,
  AlertCircleIcon,
  ClockIcon,
  TerminalIcon,
  FileIcon,
} from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

// ============================================================================
// Types
// ============================================================================

interface CodeInput {
  code?: string;
  language?: string;
  file?: string;
  timeout?: number;
}

interface CodeOutput {
  stdout?: string;
  stderr?: string;
  result?: unknown;
  error?: string;
  exit_code?: number;
  duration_ms?: number;
  memory_mb?: number;
}

// ============================================================================
// Language Detection
// ============================================================================

const LANGUAGE_PATTERNS: Array<[RegExp, string]> = [
  [/^#!.*python/m, "python"],
  [/^#!.*node|^#!.*js/m, "javascript"],
  [/^#!.*bash|^#!.*sh/m, "bash"],
  [/^import\s+\w+\s+from\s+['"]|^const\s+\w+\s+=\s+require\(/m, "javascript"],
  [/^import\s+\w+|^from\s+\w+\s+import/m, "python"],
  [/^def\s+\w+\s*\(|^class\s+\w+\s*[:(]/m, "python"],
  [/^function\s+\w+\s*\(|^const\s+\w+\s*=\s*\(/m, "javascript"],
  [/^\$\s+|^apt-get|^npm\s+|^pip\s+|^curl\s+|^wget\s+/m, "bash"],
  [/^package\s+main|^func\s+\w+\s*\(/m, "go"],
  [/^fn\s+main\s*\(|^use\s+std::/m, "rust"],
  [/^#include\s*<|^int\s+main\s*\(/m, "c"],
  [/^public\s+class\s+\w+|^import\s+java\./m, "java"],
];

function detectLanguage(code: string, hint?: string): string {
  if (
    hint &&
    [
      "python",
      "javascript",
      "typescript",
      "bash",
      "go",
      "rust",
      "c",
      "java",
      "json",
      "html",
      "css",
      "sql",
    ].includes(hint)
  ) {
    return hint;
  }

  for (const [pattern, lang] of LANGUAGE_PATTERNS) {
    if (pattern.test(code)) {
      return lang;
    }
  }

  return "text";
}

const LANGUAGE_LABELS: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  bash: "Bash",
  go: "Go",
  rust: "Rust",
  c: "C",
  cpp: "C++",
  java: "Java",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  text: "Plain Text",
};

// ============================================================================
// Simple Syntax Highlighting (no external deps)
// ============================================================================

interface HighlightToken {
  text: string;
  type:
    | "keyword"
    | "string"
    | "number"
    | "comment"
    | "function"
    | "operator"
    | "punctuation"
    | "plain";
}

const PYTHON_KEYWORDS =
  /\b(def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|raise|pass|break|continue|and|or|not|in|is|True|False|None|lambda|async|await)\b/g;
const JS_KEYWORDS =
  /\b(function|const|let|var|if|else|for|while|do|switch|case|default|try|catch|finally|throw|return|break|continue|class|extends|new|this|super|import|export|from|async|await|typeof|instanceof|null|undefined|true|false)\b/g;
const BASH_KEYWORDS =
  /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|export|source|alias|cd|echo|printf|read|test)\b/g;

function highlightCode(code: string, language: string): HighlightToken[][] {
  const lines = code.split("\n");
  const keywords =
    language === "python"
      ? PYTHON_KEYWORDS
      : language === "javascript" || language === "typescript"
        ? JS_KEYWORDS
        : language === "bash"
          ? BASH_KEYWORDS
          : null;

  return lines.map((line) => {
    if (!line.trim()) return [{ text: line || " ", type: "plain" as const }];

    const tokens: HighlightToken[] = [];
    let remaining = line;

    // Simple tokenization
    const tokenRegex =
      /(["'`](?:[^"'`\\]|\\.)*["'`])|(\d+(?:\.\d+)?)|([a-zA-Z_]\w*)|([^\w\s]+)|(\s+)/g;
    let match;

    while ((match = tokenRegex.exec(remaining)) !== null) {
      const [fullMatch, string, number, word, operator, whitespace] = match;

      if (string) {
        tokens.push({ text: string, type: "string" });
      } else if (number) {
        tokens.push({ text: number, type: "number" });
      } else if (word) {
        // Check if it's a keyword
        const isKeyword =
          keywords && new RegExp(`\\b${word}\\b`).test(word) && keywords.source.includes(word);
        // Check if followed by ( - likely a function
        const isFunction = remaining
          .slice(match.index + fullMatch.length)
          .trimStart()
          .startsWith("(");

        tokens.push({
          text: word,
          type: isKeyword ? "keyword" : isFunction ? "function" : "plain",
        });
      } else if (operator) {
        // Check for comments
        if (
          (language === "python" && operator.startsWith("#")) ||
          (["javascript", "typescript", "c", "go", "java", "rust"].includes(language) &&
            operator.startsWith("//"))
        ) {
          // Rest of line is comment
          tokens.push({ text: remaining.slice(match.index), type: "comment" });
          break;
        }
        tokens.push({ text: operator, type: "operator" });
      } else if (whitespace) {
        tokens.push({ text: whitespace, type: "plain" });
      }
    }

    return tokens.length > 0 ? tokens : [{ text: line, type: "plain" as const }];
  });
}

const TOKEN_COLORS: Record<HighlightToken["type"], string> = {
  keyword: "text-purple-400",
  string: "text-green-400",
  number: "text-orange-400",
  comment: "text-zinc-500 italic",
  function: "text-blue-400",
  operator: "text-zinc-400",
  punctuation: "text-zinc-400",
  plain: "text-zinc-200",
};

// ============================================================================
// Utilities
// ============================================================================

function useCopyToClipboard(timeout = 2000) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = useCallback(
    async (text: string, id: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), timeout);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), timeout);
      }
    },
    [timeout]
  );

  return { copiedId, copy };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

// ============================================================================
// Main Component
// ============================================================================

export function CodeBlockEnhanced({
  toolName,
  toolCallId,
  state,
  input,
  output,
  errorText,
}: ToolRendererProps<CodeInput, CodeOutput>) {
  const [isCodeExpanded, setIsCodeExpanded] = useState(true);
  const [isOutputExpanded, setIsOutputExpanded] = useState(true);
  const { copiedId, copy } = useCopyToClipboard();

  const typedInput = input as CodeInput | undefined;
  const typedOutput = output as CodeOutput | undefined;

  const code = typedInput?.code ?? "";
  const language = detectLanguage(code, typedInput?.language);
  const file = typedInput?.file;

  const stdout = typedOutput?.stdout ?? "";
  const stderr = typedOutput?.stderr ?? "";
  const result = typedOutput?.result;
  const error = typedOutput?.error ?? errorText;
  const exitCode = typedOutput?.exit_code;
  const duration = typedOutput?.duration_ms;
  const memory = typedOutput?.memory_mb;

  // Highlight code
  const highlightedLines = useMemo(() => highlightCode(code, language), [code, language]);
  const lineCount = highlightedLines.length;

  const hasOutput = state === "output-available" || state === "output-error";
  const isStreaming = state === "input-streaming";
  const isPending = state === "input-available";
  const isSuccess = exitCode === 0 || (hasOutput && !error && exitCode === undefined);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Code section */}
      <div className="bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-800 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <CodeIcon className="size-4 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-300">
              {LANGUAGE_LABELS[language] || language}
            </span>
            {file && (
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                <FileIcon className="size-3" />
                {file}
              </span>
            )}
            <span className="text-xs text-zinc-500">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => copy(code, "code")}
              className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200"
              title="Copy code"
            >
              {copiedId === "code" ? (
                <CheckIcon className="size-3.5 text-green-400" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
            </button>
            <button
              onClick={() => setIsCodeExpanded(!isCodeExpanded)}
              className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200"
            >
              {isCodeExpanded ? (
                <ChevronUpIcon className="size-3.5" />
              ) : (
                <ChevronDownIcon className="size-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Code content */}
        {isCodeExpanded && (
          <div className="overflow-x-auto">
            <pre className="px-3 py-2 text-sm font-mono leading-relaxed">
              {highlightedLines.map((tokens, lineIndex) => (
                <div key={lineIndex} className="flex">
                  <span className="select-none w-8 text-right pr-3 text-zinc-600">
                    {lineIndex + 1}
                  </span>
                  <span
                    className={cn(isStreaming && lineIndex === lineCount - 1 && "typing-cursor")}
                  >
                    {tokens.map((token, tokenIndex) => (
                      <span key={tokenIndex} className={TOKEN_COLORS[token.type]}>
                        {token.text}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </pre>
          </div>
        )}
      </div>

      {/* Execution status */}
      {(isPending || isStreaming) && (
        <div className="px-3 py-3 bg-muted/30 border-t flex items-center gap-2">
          <div className="size-4 border-2 border-muted-foreground/30 border-t-primary rounded-full spinner" />
          <span className="text-sm text-muted-foreground">
            {isStreaming ? "Receiving code..." : "Executing..."}
          </span>
        </div>
      )}

      {/* Output section */}
      {hasOutput && (stdout || stderr || error || result !== undefined) && (
        <div className="border-t">
          {/* Output header */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
            <div className="flex items-center gap-2">
              <TerminalIcon className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium">Output</span>

              {duration && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ClockIcon className="size-3" />
                  {formatDuration(duration)}
                </span>
              )}

              {memory && (
                <span className="text-xs text-muted-foreground">{memory.toFixed(1)} MB</span>
              )}

              {exitCode !== undefined && (
                <span
                  className={cn(
                    "text-xs font-mono px-1.5 py-0.5 rounded",
                    isSuccess ? "text-green-600 bg-green-500/10" : "text-red-600 bg-red-500/10"
                  )}
                >
                  exit {exitCode}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => copy(stdout + stderr, "output")}
                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                title="Copy output"
              >
                {copiedId === "output" ? (
                  <CheckIcon className="size-3.5 text-green-500" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
              </button>
              <button
                onClick={() => setIsOutputExpanded(!isOutputExpanded)}
                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
              >
                {isOutputExpanded ? (
                  <ChevronUpIcon className="size-3.5" />
                ) : (
                  <ChevronDownIcon className="size-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Output content */}
          {isOutputExpanded && (
            <div className="px-3 py-2 text-sm font-mono">
              {/* Stdout */}
              {stdout && (
                <pre className="whitespace-pre-wrap break-words text-foreground">{stdout}</pre>
              )}

              {/* Stderr */}
              {stderr && (
                <pre className="whitespace-pre-wrap break-words text-yellow-600 dark:text-yellow-400 mt-2">
                  {stderr}
                </pre>
              )}

              {/* Result */}
              {result !== undefined && (
                <div className="mt-2 p-2 bg-muted/50 rounded">
                  <span className="text-xs text-muted-foreground block mb-1">Result:</span>
                  <pre className="whitespace-pre-wrap break-words text-primary">
                    {typeof result === "object" ? JSON.stringify(result, null, 2) : String(result)}
                  </pre>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 mt-2 text-red-600 dark:text-red-400">
                  <AlertCircleIcon className="size-4 mt-0.5 flex-shrink-0" />
                  <pre className="whitespace-pre-wrap break-words">{error}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CodeBlockEnhanced;
