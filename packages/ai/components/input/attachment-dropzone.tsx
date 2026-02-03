"use client";

import * as React from "react";
import { useCallback, useRef, useState, useEffect } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { UploadIcon } from "lucide-react";

export interface AttachmentDropzoneProps {
  onDrop: (files: FileList) => void;
  onDragChange?: (isDragging: boolean) => void;
  className?: string;
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * AttachmentDropzone - Drag and drop file upload zone
 */
export function AttachmentDropzone({
  onDrop,
  onDragChange,
  className,
  accept,
  maxSize,
  maxFiles,
  disabled = false,
  children,
}: AttachmentDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      dragCounterRef.current++;
      if (dragCounterRef.current === 1) {
        setIsDragging(true);
        onDragChange?.(true);
      }
    },
    [disabled, onDragChange]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
        onDragChange?.(false);
      }
    },
    [disabled, onDragChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      dragCounterRef.current = 0;
      setIsDragging(false);
      onDragChange?.(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        onDrop(files);
      }
    },
    [disabled, onDragChange, onDrop]
  );

  // Reset drag counter on unmount
  useEffect(() => {
    return () => {
      dragCounterRef.current = 0;
    };
  }, []);

  if (children) {
    return (
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={className}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/50",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <UploadIcon
        className={cn(
          "size-8 mb-2",
          isDragging ? "text-primary" : "text-muted-foreground"
        )}
      />
      <p className="text-sm text-muted-foreground">
        {isDragging ? "Drop files here" : "Drag & drop files here"}
      </p>
      {(maxSize || maxFiles) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {maxSize && `Max ${formatBytes(maxSize)}`}
          {maxSize && maxFiles && " • "}
          {maxFiles && `Up to ${maxFiles} files`}
        </p>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}
