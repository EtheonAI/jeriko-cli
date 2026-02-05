"use client";

import { useCallback, useRef } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { PlusIcon, UploadIcon, FolderOpenIcon } from "lucide-react";

interface FilesButtonProps {
  onFilesSelected: (files: FileList) => void;
  disabled?: boolean;
}

export function FilesButton({ onFilesSelected, disabled }: FilesButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFilesSelected(files);
      }
      e.target.value = "";
    },
    [onFilesSelected]
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={handleFileChange}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="h-7 w-7 p-0 rounded-full border border-border hover:bg-accent"
          >
            <PlusIcon className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px] rounded-2xl p-1.5">
          <DropdownMenuGroup className="space-y-0.5">
            <DropdownMenuItem
              className="rounded-xl text-xs gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon className="size-4 opacity-60" />
              Upload from device
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-xl text-xs gap-2" disabled>
              <FolderOpenIcon className="size-4 opacity-60" />
              From Library
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
