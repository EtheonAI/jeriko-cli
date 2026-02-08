"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { WrapTextIcon } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ShikiCodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
}

// ============================================================================
// Shiki lazy loader — only loads grammars we need
// ============================================================================

// Map of supported languages to their Shiki grammar import
const LANG_IMPORTS: Record<string, () => Promise<unknown>> = {
  typescript: () => import("shiki/langs/typescript.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  bash: () => import("shiki/langs/bash.mjs"),
  shell: () => import("shiki/langs/shellscript.mjs"),
  shellscript: () => import("shiki/langs/shellscript.mjs"),
  c: () => import("shiki/langs/c.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  ruby: () => import("shiki/langs/ruby.mjs"),
  php: () => import("shiki/langs/php.mjs"),
  swift: () => import("shiki/langs/swift.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
  dockerfile: () => import("shiki/langs/dockerfile.mjs"),
};

// Language aliases
const LANG_ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  "c++": "cpp",
  "objective-c": "c",
  docker: "dockerfile",
};

function resolveLanguage(lang?: string): string {
  if (!lang) return "text";
  const lower = lang.toLowerCase();
  return LANG_ALIASES[lower] ?? lower;
}

// Highlighter singleton — lazy loaded once
let highlighterPromise: Promise<
  import("shiki").HighlighterGeneric<import("shiki").BundledLanguage, import("shiki").BundledTheme>
> | null = null;
const loadedLangs = new Set<string>();

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then((mod) =>
      mod.createHighlighter({
        themes: [import("shiki/themes/vitesse-dark.mjs")],
        langs: [],
      })
    );
  }
  return highlighterPromise;
}

async function ensureLanguage(lang: string) {
  if (loadedLangs.has(lang)) return true;

  const importer = LANG_IMPORTS[lang];
  if (!importer) return false;

  try {
    const highlighter = await getHighlighter();
    const grammar = await importer();
    await highlighter.loadLanguage(grammar as Parameters<typeof highlighter.loadLanguage>[0]);
    loadedLangs.add(lang);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Component
// ============================================================================

export function ShikiCodeBlock({
  code,
  language,
  showLineNumbers = true,
  className,
}: ShikiCodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [wordWrap, setWordWrap] = useState(false);
  const resolvedLang = useMemo(() => resolveLanguage(language), [language]);

  useEffect(() => {
    let cancelled = false;

    async function highlight() {
      try {
        const langAvailable = await ensureLanguage(resolvedLang);
        if (cancelled) return;

        if (!langAvailable) {
          setHtml(null);
          return;
        }

        const highlighter = await getHighlighter();
        if (cancelled) return;

        const result = highlighter.codeToHtml(code, {
          lang: resolvedLang,
          theme: "vitesse-dark",
        });

        if (!cancelled) {
          setHtml(result);
        }
      } catch {
        if (!cancelled) setHtml(null);
      }
    }

    highlight();
    return () => {
      cancelled = true;
    };
  }, [code, resolvedLang]);

  // Fallback: plain text with line numbers
  if (html === null) {
    return (
      <PlainCodeBlock
        code={code}
        showLineNumbers={showLineNumbers}
        wordWrap={wordWrap}
        onToggleWrap={() => setWordWrap((w) => !w)}
        language={resolvedLang}
        className={className}
      />
    );
  }

  const lines = code.split("\n");
  const lineCount = lines.length;

  return (
    <div className={cn("relative group", className)}>
      {/* Toolbar */}
      <div className="absolute right-2 top-1 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {resolvedLang !== "text" && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 px-1.5 py-0.5 bg-canvas-surface/50 rounded">
            {resolvedLang}
          </span>
        )}
        <button
          type="button"
          onClick={() => setWordWrap((w) => !w)}
          className={cn(
            "p-1 rounded hover:bg-muted/20 transition-colors",
            wordWrap ? "text-blue-400" : "text-muted-foreground/50"
          )}
          title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
        >
          <WrapTextIcon className="size-3.5" />
        </button>
      </div>

      <div
        className={cn(
          "shiki-code-block overflow-auto font-mono text-xs leading-relaxed",
          wordWrap && "shiki-word-wrap"
        )}
      >
        {showLineNumbers ? (
          <div className="flex">
            {/* Line number gutter */}
            <div className="flex-shrink-0 select-none pr-3 text-right text-muted-foreground/25 pt-0">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="leading-relaxed">
                  {i + 1}
                </div>
              ))}
            </div>
            {/* Highlighted code */}
            <div className="flex-1 min-w-0" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Plain fallback (no Shiki)
// ============================================================================

function PlainCodeBlock({
  code,
  showLineNumbers,
  wordWrap,
  onToggleWrap,
  language,
  className,
}: {
  code: string;
  showLineNumbers: boolean;
  wordWrap: boolean;
  onToggleWrap: () => void;
  language: string;
  className?: string;
}) {
  const lines = code.split("\n");

  return (
    <div className={cn("relative group", className)}>
      {/* Toolbar */}
      <div className="absolute right-2 top-1 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {language !== "text" && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 px-1.5 py-0.5 bg-canvas-surface/50 rounded">
            {language}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleWrap}
          className={cn(
            "p-1 rounded hover:bg-muted/20 transition-colors",
            wordWrap ? "text-blue-400" : "text-muted-foreground/50"
          )}
          title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
        >
          <WrapTextIcon className="size-3.5" />
        </button>
      </div>

      <pre
        className={cn(
          "overflow-auto font-mono text-xs leading-relaxed text-foreground/80",
          wordWrap && "whitespace-pre-wrap break-words"
        )}
      >
        {lines.map((line, i) => (
          <div key={i} className="flex">
            {showLineNumbers && (
              <span className="inline-block w-10 flex-shrink-0 select-none pr-3 text-right text-muted-foreground/25">
                {i + 1}
              </span>
            )}
            <span className="flex-1 min-w-0 whitespace-pre">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
