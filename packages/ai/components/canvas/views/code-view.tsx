"use client";

import * as React from "react";
import { useState } from "react";
import {
  CodeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import { ShikiCodeBlock } from "./shiki-code-block";
import { LanguageFileIcon } from "./file-icon";

// ============================================================================
// Types
// ============================================================================

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface FileTab {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
  isModified?: boolean;
}

export interface CodeViewProps {
  fileTree?: FileNode[];
  fileTabs?: FileTab[];
  activeFileContent?: string;
  activeFileLanguage?: string;
  onSelectFile?: (path: string) => void;
  onSelectTab?: (id: string) => void;
  onCloseTab?: (id: string) => void;
}

// ============================================================================
// File Tree Node (Recursive)
// ============================================================================

function FileTreeNode({
  node,
  depth = 0,
  onSelect,
  selectedPath,
}: {
  node: FileNode;
  depth?: number;
  onSelect?: (path: string) => void;
  selectedPath?: string;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const isDirectory = node.type === "directory";
  const isSelected = node.path === selectedPath;

  return (
    <div>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-1.5 px-2 py-1 text-xs transition-colors hover:bg-muted/10",
          isSelected
            ? "bg-muted/20 text-foreground"
            : "text-muted-foreground/70"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (isDirectory) setIsOpen(!isOpen);
          else onSelect?.(node.path);
        }}
      >
        {isDirectory ? (
          isOpen ? (
            <ChevronDownIcon className="size-3" />
          ) : (
            <ChevronRightIcon className="size-3" />
          )
        ) : (
          <span className="w-3" />
        )}
        <LanguageFileIcon
          name={node.name}
          isDirectory={isDirectory}
          isOpen={isOpen}
          className="size-3.5"
        />
        <span className="truncate">{node.name}</span>
      </button>
      {isDirectory && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// File Tabs Bar
// ============================================================================

function FileTabsBar({
  tabs,
  onSelectTab,
  onCloseTab,
}: {
  tabs: FileTab[];
  onSelectTab?: (id: string) => void;
  onCloseTab?: (id: string) => void;
}) {
  return (
    <div className="flex items-center overflow-x-auto border-b border-border/10 bg-canvas-surface scrollbar-none">
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          className={cn(
            "group/tab flex items-center gap-1.5 whitespace-nowrap border-r border-border/10 px-3 py-2 text-xs transition-colors",
            tab.isActive
              ? "border-b-2 border-b-blue-500 bg-canvas-deep text-foreground"
              : "text-muted-foreground/60 hover:bg-muted/10"
          )}
          onClick={() => onSelectTab?.(tab.id)}
        >
          <LanguageFileIcon name={tab.name} className="size-3" />
          {tab.name}
          {tab.isModified && (
            <span className="ml-0.5 size-1.5 rounded-full bg-blue-400 flex-shrink-0" />
          )}
          {onCloseTab && (
            <span
              role="button"
              tabIndex={0}
              className="ml-1 rounded p-0.5 opacity-0 hover:bg-muted/20 group-hover/tab:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }
              }}
            >
              <XIcon className="size-2.5" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function CodeView({
  fileTree,
  fileTabs,
  activeFileContent,
  activeFileLanguage,
  onSelectFile,
  onSelectTab,
  onCloseTab,
}: CodeViewProps) {
  // Derive selected path from the active tab (parent-controlled)
  const activeTab = fileTabs?.find((t) => t.isActive);
  const [localSelectedPath, setLocalSelectedPath] = useState<string>("");

  // Sync: prefer parent's active tab path, fall back to local state
  const selectedPath = activeTab?.path || localSelectedPath;

  const handleSelect = (path: string) => {
    setLocalSelectedPath(path);
    onSelectFile?.(path);
  };

  return (
    <div className="flex h-full">
      {/* File Tree Sidebar */}
      <div className="w-52 flex-shrink-0 overflow-y-auto border-r border-border/10 bg-canvas-bg">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
          Explorer
        </div>
        {fileTree?.map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            onSelect={handleSelect}
            selectedPath={selectedPath}
          />
        ))}
        {(!fileTree || fileTree.length === 0) && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground/40">
            No files yet
          </div>
        )}
      </div>

      {/* Editor Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {fileTabs && fileTabs.length > 0 && (
          <FileTabsBar tabs={fileTabs} onSelectTab={onSelectTab} onCloseTab={onCloseTab} />
        )}
        <div className="flex-1 overflow-auto bg-canvas-deep p-4">
          {activeFileContent ? (
            <ShikiCodeBlock
              code={activeFileContent}
              language={activeFileLanguage}
              showLineNumbers
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/40">
              <div className="text-center">
                <CodeIcon className="mx-auto mb-3 size-12 opacity-30" />
                <p className="text-sm">Select a file to view its contents</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
