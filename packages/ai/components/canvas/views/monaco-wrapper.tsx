"use client";

import * as React from "react";
import { useRef, useCallback } from "react";
import { Loader2Icon } from "lucide-react";
import type { Monaco } from "@monaco-editor/react";

// Lazy-load Monaco (~2MB) — only when editor view renders
const MonacoEditor = React.lazy(() => import("@monaco-editor/react"));

// ============================================================================
// Language mapping — file extension / shorthand → Monaco language ID
// ============================================================================

const LANG_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  shell: "shell",
  shellscript: "shell",
  yml: "yaml",
  yaml: "yaml",
  md: "markdown",
  markdown: "markdown",
  json: "json",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  sql: "sql",
  xml: "xml",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  php: "php",
  swift: "swift",
  kotlin: "kotlin",
  dockerfile: "dockerfile",
  docker: "dockerfile",
  toml: "ini",
  graphql: "graphql",
  r: "r",
  lua: "lua",
  perl: "perl",
  dart: "dart",
  vue: "html",
  svelte: "html",
};

function resolveMonacoLanguage(lang?: string): string {
  if (!lang) return "plaintext";
  const lower = lang.toLowerCase();
  return LANG_MAP[lower] ?? lower;
}

// ============================================================================
// Types
// ============================================================================

export interface MonacoWrapperProps {
  content: string;
  language?: string;
  readOnly?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function MonacoWrapper({
  content,
  language,
  readOnly = true,
}: MonacoWrapperProps) {
  const monacoLang = resolveMonacoLanguage(language);
  const contentRef = useRef(content);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editorRef = useRef<unknown>(null);

  // Debounce content updates during streaming (150ms max)
  const currentContent = React.useMemo(() => {
    contentRef.current = content;
    return content;
  }, [content]);

  // Register rubic-dark theme on mount
  const handleBeforeMount = useCallback((monaco: Monaco) => {
    monaco.editor.defineTheme("rubic-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "858481", fontStyle: "italic" },
        { token: "keyword", foreground: "c792ea" },
        { token: "string", foreground: "c3e88d" },
        { token: "number", foreground: "f78c6c" },
        { token: "type", foreground: "ffcb6b" },
      ],
      colors: {
        "editor.background": "#19191a",
        "editor.foreground": "#dadada",
        "editorLineNumber.foreground": "#858481",
        "editorLineNumber.activeForeground": "#dadada",
        "editor.selectionBackground": "#2d3748",
        "editor.lineHighlightBackground": "#1e1e20",
        "editorCursor.foreground": "#aeafad",
        "editorWidget.background": "#1e1e20",
        "editorWidget.border": "#2d2d2f",
        "scrollbar.shadow": "#00000000",
        "scrollbarSlider.background": "#3a3a3c40",
        "scrollbarSlider.hoverBackground": "#4a4a4c60",
        "scrollbarSlider.activeBackground": "#5a5a5c80",
      },
    });
  }, []);

  const handleEditorDidMount = useCallback((editor: unknown) => {
    editorRef.current = editor;
  }, []);

  return (
    <React.Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-canvas-deep">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground/40" />
        </div>
      }
    >
      <MonacoEditor
        height="100%"
        language={monacoLang}
        value={currentContent}
        theme="rubic-dark"
        beforeMount={handleBeforeMount}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          automaticLayout: true,
          scrollBeyondLastLine: false,
          folding: true,
          wordWrap: "off",
          renderLineHighlight: "line",
          renderWhitespace: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          padding: { top: 12, bottom: 12 },
          domReadOnly: readOnly,
          contextmenu: !readOnly,
        }}
      />
    </React.Suspense>
  );
}
