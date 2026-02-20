"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { FileTextIcon, XIcon } from "lucide-react";
import { MonacoWrapper } from "./monaco-wrapper";
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
  /** Multi-file tabs */
  fileTabs?: Array<{ id: string; name: string; path: string; isActive: boolean }>;
  /** All file contents for tab switching */
  allFileContents?: Record<string, string>;
  /** Select a file tab */
  onSelectTab?: (tabId: string) => void;
  /** Close a file tab */
  onCloseTab?: (tabId: string) => void;
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
// Component — Manus-style FileToolView with multi-file tab support
// Header with filename (single file) or tab bar (multiple files) +
// read-only syntax-highlighted code.
// ============================================================================

export function EditorView({
  filePath,
  content,
  language,
  fileTabs,
  allFileContents,
  onSelectTab,
  onCloseTab,
}: EditorViewProps) {
  const hasMultipleTabs = fileTabs && fileTabs.length > 1;
  const activeTab = fileTabs?.find((t) => t.isActive);
  const name = displayName(activeTab?.path ?? filePath);
  const fileNameStr = (activeTab?.path ?? filePath)?.split("/").pop() ?? "file";

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar — shown when multiple files are open */}
      {hasMultipleTabs ? (
        <div className="flex h-9 items-center border-b border-border/10 bg-canvas-surface overflow-x-auto scrollbar-none">
          {fileTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab?.(tab.id)}
              className={cn(
                "group flex h-full items-center gap-1.5 border-r border-border/10 px-3 text-xs font-medium transition-colors min-w-0 shrink-0",
                tab.isActive
                  ? "bg-canvas-deep text-foreground"
                  : "text-muted-foreground hover:bg-canvas-deep/50 hover:text-foreground"
              )}
            >
              <LanguageFileIcon name={tab.name} className="size-3.5 flex-shrink-0" />
              <span className="truncate max-w-[120px]">{tab.name}</span>
              {onCloseTab && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className={cn(
                    "ml-1 rounded p-0.5 flex-shrink-0",
                    tab.isActive
                      ? "text-muted-foreground/60 hover:text-foreground hover:bg-muted/30"
                      : "text-transparent group-hover:text-muted-foreground/40 hover:!text-foreground hover:bg-muted/30"
                  )}
                >
                  <XIcon className="size-3" />
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        /* Single-file header — Manus: h-[36px], centered filename, gray bg */
        <div className="flex h-9 items-center px-3 border-b border-border/10 bg-canvas-surface">
          <div className="flex flex-1 items-center justify-center gap-2 min-w-0">
            <LanguageFileIcon name={fileNameStr} className="size-3.5 flex-shrink-0" />
            <span className="max-w-[300px] truncate text-sm font-medium text-muted-foreground">
              {name}
            </span>
          </div>
        </div>
      )}

      {/* Editor content — Monaco editor, read-only, syntax highlighted */}
      <div className="flex-1 overflow-hidden bg-canvas-deep">
        {content ? (
          <MonacoWrapper
            content={content}
            language={language}
            readOnly
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
