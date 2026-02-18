"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { FileTextIcon } from "lucide-react";
import { ShikiCodeBlock } from "./shiki-code-block";
import { LanguageFileIcon } from "./file-icon";

// ============================================================================
// Types
// ============================================================================

export interface EditorViewProps {
  /** File path or name displayed in the header */
  filePath?: string;
  /** File content to display */
  content?: string;
  /** Language for syntax highlighting */
  language?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Extract filename from full path (strip sandbox prefixes) */
function displayName(path?: string): string {
  if (!path) return "Untitled";
  const stripped = path
    .replace(/^\/home\/ubuntu\//, "")
    .replace(/^\/home\/user\//, "")
    .replace(/^~\//, "");
  return stripped || path.split("/").pop() || path;
}

// ============================================================================
// Component — Manus-style FileToolView
// Simple: header (filename) + read-only syntax-highlighted code.
// No file tree, no tabs, no IDE chrome.
// ============================================================================

export function EditorView({ filePath, content, language }: EditorViewProps) {
  const name = displayName(filePath);
  const fileName = filePath?.split("/").pop() ?? "file";

  return (
    <div className="flex h-full flex-col">
      {/* Header — Manus: h-[36px], centered filename, gray bg, border-b */}
      <div className="flex h-9 items-center px-3 border-b border-border/10 bg-canvas-surface">
        <div className="flex flex-1 items-center justify-center gap-2 min-w-0">
          <LanguageFileIcon name={fileName} className="size-3.5 flex-shrink-0" />
          <span className="max-w-[300px] truncate text-sm font-medium text-muted-foreground">
            {name}
          </span>
        </div>
      </div>

      {/* Editor content — read-only, syntax highlighted */}
      <div className="flex-1 overflow-auto bg-canvas-deep p-4">
        {content ? (
          <ShikiCodeBlock
            code={content}
            language={language}
            showLineNumbers
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/40">
            <div className="text-center">
              <FileTextIcon className="mx-auto mb-3 size-12 opacity-30" />
              <p className="text-sm">No file content</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
