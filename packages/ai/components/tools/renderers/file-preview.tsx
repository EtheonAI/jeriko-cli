"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";
import {
  FileIcon,
  FileTextIcon,
  FileCodeIcon,
  FolderIcon,
  CheckIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  ExternalLinkIcon,
  DownloadIcon,
} from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

interface FileReadInput {
  path: string;
  encoding?: string;
  start_line?: number;
  end_line?: number;
}

interface FileReadOutput {
  content: string;
  path: string;
  size?: number;
  encoding?: string;
  lines?: number;
}

interface FileWriteInput {
  path: string;
  content: string;
  mode?: "write" | "append" | "create";
  encoding?: string;
}

interface FileWriteOutput {
  success: boolean;
  path: string;
  bytes_written?: number;
  created?: boolean;
}

type FileInput = FileReadInput | FileWriteInput;
type FileOutput = FileReadOutput | FileWriteOutput;

export interface FilePreviewProps extends ToolRendererProps<FileInput, FileOutput> {}

/**
 * FilePreview - File read/write operations with preview
 */
export function FilePreview({
  toolName,
  state,
  input,
  output,
}: FilePreviewProps) {
  const isWriteOperation = toolName.includes("write") || toolName.includes("create") || toolName.includes("edit");
  const filePath = input?.path ?? "unknown";
  const fileName = filePath.split("/").pop() ?? filePath;
  const extension = fileName.split(".").pop() ?? "";

  const Icon = getFileIcon(extension, isWriteOperation);

  // During execution, show file path
  if (state !== "output-available") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        <span>
          {isWriteOperation ? "Writing to" : "Reading"}: <span className="font-mono text-foreground">{filePath}</span>
        </span>
      </div>
    );
  }

  // Read operation output
  if (!isWriteOperation && output && "content" in output) {
    const readOutput = output as FileReadOutput;
    const language = getLanguageFromExtension(extension);
    const lines = readOutput.content.split("\n");

    return (
      <div className="space-y-2">
        {/* File info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" />
            <span className="font-mono text-sm">{filePath}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {readOutput.lines && <span>{readOutput.lines} lines</span>}
            {readOutput.size && <span>{formatBytes(readOutput.size)}</span>}
          </div>
        </div>

        {/* File content */}
        <div className="overflow-hidden rounded-lg border border-border">
          <pre className="max-h-80 overflow-auto bg-zinc-950 p-4 dark:bg-zinc-900">
            <code className="text-sm text-zinc-100">
              {lines.slice(0, 100).map((line, i) => (
                <div key={i} className="flex">
                  <span className="mr-4 w-8 select-none text-right text-zinc-500">
                    {(input as FileReadInput).start_line ? (input as FileReadInput).start_line! + i : i + 1}
                  </span>
                  <span>{line || " "}</span>
                </div>
              ))}
              {lines.length > 100 && (
                <div className="mt-2 text-center text-zinc-500">
                  ... {lines.length - 100} more lines
                </div>
              )}
            </code>
          </pre>
        </div>
      </div>
    );
  }

  // Write operation output
  if (isWriteOperation && output && "success" in output) {
    const writeOutput = output as FileWriteOutput;

    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-lg",
            writeOutput.success ? "bg-green-500/10" : "bg-red-500/10"
          )}
        >
          {writeOutput.success ? (
            writeOutput.created ? (
              <PlusIcon className="size-5 text-green-500" />
            ) : (
              <PencilIcon className="size-5 text-green-500" />
            )
          ) : (
            <TrashIcon className="size-5 text-red-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium">
            {writeOutput.created ? "File created" : "File updated"}
          </span>
          <span className="block truncate font-mono text-xs text-muted-foreground">
            {filePath}
          </span>
        </div>
        {writeOutput.bytes_written !== undefined && (
          <span className="text-xs text-muted-foreground">
            {formatBytes(writeOutput.bytes_written)}
          </span>
        )}
      </div>
    );
  }

  return null;
}

function getFileIcon(extension: string, isWrite: boolean) {
  if (isWrite) return PencilIcon;

  const codeExtensions = ["js", "ts", "jsx", "tsx", "py", "rb", "go", "rs", "java", "c", "cpp", "h", "hpp"];
  const textExtensions = ["txt", "md", "json", "yaml", "yml", "xml", "html", "css"];

  if (codeExtensions.includes(extension)) return FileCodeIcon;
  if (textExtensions.includes(extension)) return FileTextIcon;
  return FileIcon;
}

function getLanguageFromExtension(extension: string): string {
  const map: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    html: "html",
    css: "css",
    md: "markdown",
  };
  return map[extension] ?? "text";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
