"use client";

import { useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc/client";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading editor...
    </div>
  ),
});

const extensionToLanguage: Record<string, string> = {
  tsx: "typescript",
  ts: "typescript",
  jsx: "javascript",
  js: "javascript",
  css: "css",
  scss: "scss",
  html: "html",
  json: "json",
  md: "markdown",
  py: "python",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  svg: "xml",
  sh: "shell",
  bash: "shell",
  sql: "sql",
  graphql: "graphql",
};

function getLanguageFromFilename(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return extensionToLanguage[ext] ?? "plaintext";
}

interface CodeEditorProps {
  fileId: string;
  fileName: string;
  content: string;
}

export function CodeEditor({ fileId, fileName, content }: CodeEditorProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateFile = trpc.websiteBuilder.filesUpdate.useMutation();

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        updateFile.mutate({ id: fileId, content: value });
      }, 1000);
    },
    [fileId, updateFile]
  );

  const language = getLanguageFromFilename(fileName);

  return (
    <MonacoEditor
      height="100%"
      language={language}
      value={content}
      theme="vs-dark"
      onChange={handleChange}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: "on",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        padding: { top: 8 },
      }}
    />
  );
}
