"use client";

import { useState, useMemo } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  FilePlusIcon,
  FolderPlusIcon,
  Trash2Icon,
  ChevronRightIcon,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";

interface FileEntry {
  id: string;
  path: string;
  name: string;
  isDirectory: boolean;
  language: string | null;
}

interface TreeNode {
  id: string;
  name: string;
  isDirectory: boolean;
  language: string | null;
  fullPath: string;
  children: TreeNode[];
}

interface FileTreeProps {
  files: FileEntry[];
  activeFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onCreateFile: (path: string, name: string, isDirectory: boolean) => void;
  onDeleteFile: (fileId: string) => void;
}

function buildFileTree(files: FileEntry[]): TreeNode[] {
  const rootChildren: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();

  // Sort: directories first, then by name
  const sorted = [...files].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Create nodes for directories first
  for (const file of sorted) {
    if (file.isDirectory) {
      const fullPath = file.path === "/" ? `/${file.name}` : `${file.path}/${file.name}`;
      const node: TreeNode = {
        id: file.id,
        name: file.name,
        isDirectory: true,
        language: null,
        fullPath,
        children: [],
      };
      dirMap.set(fullPath, node);
    }
  }

  // Place all nodes
  for (const file of sorted) {
    const fullPath = file.path === "/" ? `/${file.name}` : `${file.path}/${file.name}`;
    const node: TreeNode = file.isDirectory
      ? dirMap.get(fullPath)!
      : {
          id: file.id,
          name: file.name,
          isDirectory: false,
          language: file.language,
          fullPath,
          children: [],
        };

    const parent = dirMap.get(file.path);
    if (parent) {
      parent.children.push(node);
    } else {
      rootChildren.push(node);
    }
  }

  return rootChildren;
}

function TreeItem({
  node,
  depth,
  activeFileId,
  onSelectFile,
  onDeleteFile,
}: {
  node: TreeNode;
  depth: number;
  activeFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);

  if (node.isDirectory) {
    return (
      <div>
        <button
          className={cn(
            "flex w-full items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent"
          )}
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
          onClick={() => setOpen(!open)}
        >
          <ChevronRightIcon
            className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-90")}
          />
          {open ? (
            <FolderOpenIcon className="h-4 w-4 shrink-0 text-blue-400" />
          ) : (
            <FolderIcon className="h-4 w-4 shrink-0 text-blue-400" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open && (
          <div>
            {node.children.map((child) => (
              <TreeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                activeFileId={activeFileId}
                onSelectFile={onSelectFile}
                onDeleteFile={onDeleteFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      className={cn(
        "group flex w-full items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent",
        activeFileId === node.id && "bg-accent text-accent-foreground"
      )}
      style={{ paddingLeft: `${depth * 12 + 6 + 18}px` }}
      onClick={() => onSelectFile(node.id)}
    >
      <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
      <button
        className="ml-auto hidden shrink-0 rounded p-0.5 hover:bg-destructive/20 group-hover:block"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteFile(node.id);
        }}
      >
        <Trash2Icon className="h-3 w-3 text-muted-foreground" />
      </button>
    </button>
  );
}

export function FileTree({
  files,
  activeFileId,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
}: FileTreeProps) {
  const [newItemType, setNewItemType] = useState<"file" | "folder" | null>(null);
  const [newItemName, setNewItemName] = useState("");

  const tree = useMemo(() => buildFileTree(files), [files]);

  const handleCreateSubmit = () => {
    if (!newItemName.trim()) return;
    onCreateFile("/", newItemName.trim(), newItemType === "folder");
    setNewItemType(null);
    setNewItemName("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">Files</span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setNewItemType("file")}
          >
            <FilePlusIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setNewItemType("folder")}
          >
            <FolderPlusIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {newItemType && (
          <div className="flex items-center gap-1 px-2 py-1">
            {newItemType === "folder" ? (
              <FolderIcon className="h-4 w-4 shrink-0 text-blue-400" />
            ) : (
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateSubmit();
                if (e.key === "Escape") {
                  setNewItemType(null);
                  setNewItemName("");
                }
              }}
              onBlur={() => {
                if (newItemName.trim()) handleCreateSubmit();
                else {
                  setNewItemType(null);
                  setNewItemName("");
                }
              }}
              className="h-6 text-sm"
              placeholder={newItemType === "folder" ? "folder name" : "file name"}
              autoFocus
            />
          </div>
        )}

        {tree.map((node) => (
          <TreeItem
            key={node.id}
            node={node}
            depth={0}
            activeFileId={activeFileId}
            onSelectFile={onSelectFile}
            onDeleteFile={onDeleteFile}
          />
        ))}
      </div>
    </div>
  );
}
